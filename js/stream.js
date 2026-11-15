// ONTRIX — live intelligence engine. Samples real blocks, builds the wallet graph and live metrics.
import { CFG, net, bus, activeNetworks, caFor, short, fmtUsd, fmtNum, unitsToFloat } from "./util.js";
import { latestBlock } from "./chains.js";
import { usdOf } from "./net.js";

const EDGES_PER_BLOCK = 36;

export const state = {
  nets: {},             // k → { height, slot, ts, blockTime, txPerBlock, ok, err, lastSeen, sampled }
  nodes: new Map(),     // id → node
  edges: new Map(),     // id → edge
  events: [],           // rolling window of txs
  whales: [],           // latest whale txs (max 200)
  metrics: null,
  focus: "all",         // network filter for views ("all" | k)
};

const nodeId = (k, a) => k + ":" + a;

function touchNode(k, addr, usd, ts, whale) {
  const id = nodeId(k, addr);
  let n = state.nodes.get(id);
  if (!n) {
    n = { id, k, addr, txs: 0, usd: 0, last: ts, born: performance.now(), whale: false, deg: 0 };
    state.nodes.set(id, n);
  }
  n.txs++; n.usd += usd || 0; n.last = ts;
  if (whale) n.whale = true;
  return n;
}

function addEdge(k, a, b, usd, ts, tx) {
  if (!a || !b || a === b) return;
  const na = touchNode(k, a, usd, ts, tx.whale), nb = touchNode(k, b, usd, ts, tx.whale);
  const id = na.id < nb.id ? na.id + "|" + nb.id : nb.id + "|" + na.id;
  let e = state.edges.get(id);
  if (!e) { e = { id, a: na.id, b: nb.id, k, count: 0, usd: 0, last: ts }; state.edges.set(id, e); na.deg++; nb.deg++; }
  e.count++; e.usd += usd || 0; e.last = ts;
  bus.emit("packet", { from: na.id, to: nb.id, k, usd, whale: tx.whale, token: !!tx.token });
}

function evict() {
  const max = CFG.intel.maxNodes;
  if (state.nodes.size <= max) return;
  const sorted = [...state.nodes.values()].sort((x, y) => x.last - y.last);
  const drop = new Set(sorted.slice(0, state.nodes.size - max).map((n) => n.id));
  drop.forEach((id) => state.nodes.delete(id));
  for (const [id, e] of state.edges) {
    if (drop.has(e.a) || drop.has(e.b)) {
      state.edges.delete(id);
      const o = state.nodes.get(drop.has(e.a) ? e.b : e.a); if (o) o.deg--;
    }
  }
}

function ingest(block) {
  const k = block.k;
  const now = Date.now();
  const myCa = (caFor(k) || "").toLowerCase();
  const evs = [];
  for (const t of block.txs) {
    const usd = usdOf(k, t.value) ?? 0;
    const ev = { k, hash: t.hash, from: t.from, to: t.to, value: t.value, usd, kind: t.kind, token: t.token, ts: now, block: block.number, whale: usd >= CFG.intel.whaleUsd };
    evs.push(ev);
    if (ev.whale) {
      state.whales.unshift(ev);
      bus.emit("alert", { level: "whale", k, ev, msg: `WHALE ${fmtUsd(usd)} · ${fmtNum(t.value)} ${net(k).nativeSymbol} · ${short(t.from)} → ${short(t.to)}` });
    }
    if (myCa && t.token && t.token.token.toLowerCase() === myCa) {
      bus.emit("alert", { level: "ont", k, ev, msg: `$${CFG.token.symbol} transfer · ${short(t.token.from)} → ${short(t.token.to)}` });
    }
  }
  state.whales.length = Math.min(state.whales.length, 200);
  state.events.push(...evs);
  bus.emit("txs", evs);

  // graph: whales + token moves + top value transfers
  const picks = evs
    .filter((e) => e.to)
    .sort((a, b) => (b.whale - a.whale) || (!!b.token - !!a.token) || (b.usd - a.usd))
    .slice(0, EDGES_PER_BLOCK);
  picks.forEach((e, i) => setTimeout(() => {
    if (e.token && e.token.to) addEdge(k, e.token.from || e.from, e.token.to, e.usd, now, e);
    else addEdge(k, e.from, e.to, e.usd, now, e);
  }, i * 60));
  setTimeout(evict, EDGES_PER_BLOCK * 60 + 50);

  const vol = evs.reduce((s, e) => s + e.usd, 0);
  const whales = evs.filter((e) => e.whale).length;
  const tokens = evs.filter((e) => e.token).length;
  bus.emit("log", { k, level: whales ? "warn" : "info", msg: `blk ${block.number.toLocaleString("en-US")} · ${block.txCount} tx${block.votes ? ` (+${block.votes} votes)` : ""} · ${fmtUsd(vol)} native · ${tokens} token moves${whales ? ` · ${whales} WHALE` : ""}` });
}

function prune() {
  const cut = Date.now() - CFG.intel.windowSec * 1000;
  let i = 0; while (i < state.events.length && state.events[i].ts < cut) i++;
  if (i) state.events.splice(0, i);
}

function clusters(filter) {
  const parent = new Map();
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  for (const n of state.nodes.values()) if (filter(n.k)) parent.set(n.id, n.id);
  for (const e of state.edges.values()) {
    if (!parent.has(e.a) || !parent.has(e.b)) continue;
    const ra = find(e.a), rb = find(e.b); if (ra !== rb) parent.set(ra, rb);
  }
  const size = new Map();
  for (const id of parent.keys()) { const r = find(id); size.set(r, (size.get(r) || 0) + 1); }
  const big = [...size.entries()].filter(([, s]) => s >= CFG.intel.clusterMin).sort((a, b) => b[1] - a[1]);
  return { count: big.length, largest: big[0]?.[1] || 0, wallets: parent.size, roots: big.slice(0, 8), find };
}

export function computeMetrics() {
  prune();
  const f = state.focus;
  const keep = (k) => f === "all" || f === k;
  const evs = state.events.filter((e) => keep(e.k));
  const win = CFG.intel.windowSec;

  const whaleEvs = evs.filter((e) => e.whale);
  const whale = { count: whaleEvs.length, usd: whaleEvs.reduce((s, e) => s + e.usd, 0), last: whaleEvs.at(-1) || null };

  // smart money: wallets repeating ≥ smartMoneyUsd moves in window
  const big = evs.filter((e) => e.usd >= CFG.intel.smartMoneyUsd);
  const byWallet = new Map();
  for (const e of big) { const key = e.k + ":" + e.from; byWallet.set(key, (byWallet.get(key) || 0) + 1); }
  const smartSet = new Set([...byWallet.entries()].filter(([, c]) => c >= 2).map(([w]) => w));
  let smIn = 0, smOut = 0;
  for (const e of big) {
    if (!smartSet.has(e.k + ":" + e.from)) continue;
    if (e.kind === "contract" || e.kind === "deploy") smIn += e.usd; else smOut += e.usd;
  }
  const allContract = evs.filter((e) => e.kind !== "transfer").reduce((s, e) => s + e.usd, 0);
  const allVol = evs.reduce((s, e) => s + e.usd, 0);
  const smart = { wallets: smartSet.size, toContracts: smIn, toWallets: smOut, total: smIn + smOut, contractShare: allVol ? allContract / allVol : 0, volume: allVol };

  // token movement
  const tok = evs.filter((e) => e.token);
  const top = new Map();
  for (const e of tok) { const key = e.k + ":" + e.token.token; top.set(key, (top.get(key) || 0) + 1); }
  const span = evs.length ? Math.max(30, (Date.now() - evs[0].ts) / 1000) : win;
  const token = {
    count: tok.length,
    perMin: tok.length / (span / 60),
    top: [...top.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([key, c]) => { const i = key.indexOf(":"); return { k: key.slice(0, i), token: key.slice(i + 1), count: c }; }),
  };

  const cl = clusters(keep);
  const perNet = {};
  for (const k of activeNetworks()) {
    const e = state.events.filter((x) => x.k === k);
    perNet[k] = { tx: e.length, usd: e.reduce((s, x) => s + x.usd, 0), whales: e.filter((x) => x.whale).length };
  }
  state.metrics = { whale, smart, token, clusters: { count: cl.count, largest: cl.largest, wallets: cl.wallets }, txs: evs.length, perNet, span };
  bus.emit("metrics", state.metrics);
  return state.metrics;
}

async function loop(k) {
  const st = (state.nets[k] ||= { ok: false, err: null, sampled: 0, lastSeen: 0 });
  const n = net(k);
  for (;;) {
    const t0 = Date.now();
    try {
      const b = await latestBlock(k, n.type === "solana" ? st.slot : null);
      if (b && (!st.height || b.number > st.height)) {
        if (st.height && st.ts && b.number > st.height) st.blockTime = (b.ts - st.ts) / (b.number - st.height) / 1000;
        if (b.txCount && st.blockTime) st.tps = b.txCount / Math.max(st.blockTime, 0.2);
        st.height = b.number; st.slot = b.slot; st.ts = b.ts; st.txPerBlock = b.txCount; st.sampled++;
        st.gasUsed = b.gasUsed; st.gasLimit = b.gasLimit; st.baseFeeGwei = b.baseFeeGwei;
        st.lastSeen = Date.now();
        st.hist = [...(st.hist || []), b.txCount].slice(-48);
        ingest(b);
      }
      if (!st.ok) bus.emit("log", { k, level: "ok", msg: `uplink established · ${n.name}` });
      st.ok = true; st.err = null;
    } catch (e) {
      if (st.ok || !st.err) bus.emit("log", { k, level: "err", msg: `uplink error · ${e.message}` });
      st.ok = false; st.err = e.message;
    }
    bus.emit("net", { k, st });
    const wait = Math.max(800, (st.ok ? n.pollMs : n.pollMs * 2) - (Date.now() - t0));
    await new Promise((r) => setTimeout(r, document.hidden ? wait * 3 : wait));
  }
}

let started = false;
export function startEngine() {
  if (started) return; started = true;
  activeNetworks().forEach((k, i) => setTimeout(() => loop(k), i * 400));
  setInterval(computeMetrics, 1500);
}
export function setFocus(f) { state.focus = f; computeMetrics(); bus.emit("focus", f); }
export function tokenAmount(raw, dec) { return unitsToFloat(raw, dec); }
