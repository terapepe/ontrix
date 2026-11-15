// 03 WALLET SCAN — profile any wallet across the active networks (real RPC + explorer data)
import { CFG, h, net, activeNetworks, caFor, short, fmtUsd, fmtNum, fmtInt, explorerUrl, netIcon, ago, isEvmAddr, isSolAddr, hexToBig, unitsToFloat, copyText, tierOf } from "../util.js";
import { rpc, xget, usdOf } from "../net.js";
import { state } from "../stream.js";
import { panel, empty, watch, toast } from "../ui.js";

const TOKEN_PROGRAMS = ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAS6EHFLLmRBBBsSVuxTTmYAs"];

export function mount(root, [q = "", only = ""]) {
  const input = h("input", { type: "text", value: q, spellcheck: "false", placeholder: "wallet address (0x… or Solana)" });
  const out = h("div", { class: "scan-out" });
  root.append(h("div", { class: "page" },
    h("div", { class: "page-h" }, h("span", { class: "code" }, "03"), h("h1", {}, "WALLET SCAN"), h("p", {}, "Balance, activity, holdings, counterparties and live-grid presence for any wallet.")),
    h("form", { class: "qbar", onsubmit: (e) => { e.preventDefault(); const v = input.value.trim(); if (v) location.hash = `#/scan/${v}`; } }, h("span", { class: "pr" }, "SCAN>"), input, h("button", {}, "RUN")),
    out,
    watchlistPanel()));
  if (!q) { out.append(empty("Enter a wallet address, or click any node on the Grid.")); return; }
  run(q, only, out);
}

function watchlistPanel() {
  const l = watch.list();
  return panel("WATCHLIST", `${l.length} WALLETS`, l.length
    ? h("div", { class: "toplist" }, l.map((w) => h("a", { href: `#/scan/${w.a}/${w.k}` }, netIcon(w.k), h("code", {}, short(w.a, 6)), h("span", {}, "added " + ago(w.added)))))
    : empty("Watched wallets trigger a signal whenever they appear in a live block. Add one with WATCH."));
}

async function run(addr, only, out) {
  const evm = isEvmAddr(addr), sol = isSolAddr(addr) && !evm;
  let keys = activeNetworks().filter((k) => (evm && net(k).type === "evm") || (sol && net(k).type === "solana"));
  if (only && keys.includes(only)) keys = [only];
  if (!keys.length) { out.append(empty(evm || sol ? "This address type is not supported by the active networks (see config mode)." : "Not a valid wallet address.")); return; }

  const tierBox = h("span", { class: "tier" }, "…");
  const wbtn = h("button", { class: "btn", onclick: () => { keys.forEach((k) => watch.toggle(k, addr)); const on = watch.has(keys[0], addr); wbtn.textContent = on ? "UNWATCH" : "WATCH"; toast(on ? "Watching wallet" : "Unwatched"); } }, watch.has(keys[0], addr) ? "UNWATCH" : "WATCH");
  out.append(h("div", { class: "target" },
    h("div", {}, h("small", {}, "TARGET"), h("code", { class: "addr" }, addr)),
    tierBox,
    h("div", { class: "row" }, h("button", { class: "btn", onclick: async () => { await copyText(addr); toast("Address copied"); } }, "COPY"), wbtn)));
  const cards = h("div", { class: "cards" });
  out.append(cards);

  const results = await Promise.all(keys.map(async (k) => {
    const card = h("div", { class: "card loading", style: `--c:${net(k).color}` }, h("div", { class: "ch" }, netIcon(k), h("b", {}, net(k).name), h("span", { class: "spin" })));
    cards.append(card);
    try {
      const d = net(k).type === "solana" ? await solProfile(k, addr) : await evmProfile(k, addr);
      card.replaceWith(renderCard(k, addr, d));
      return d;
    } catch (e) {
      card.classList.remove("loading");
      card.append(h("div", { class: "err" }, "Scan failed: " + e.message));
      return null;
    }
  }));
  const total = results.reduce((s, d) => s + (d?.totalUsd || 0), 0);
  const priced = results.some((d) => d && d.totalUsd != null);
  const tier = tierOf(total);
  tierBox.replaceChildren(h("small", {}, "CLASS"), h("b", {}, priced ? tier.name.toUpperCase() : "—"), h("span", {}, priced ? fmtUsd(total) + " tracked" : "price feed offline"));
  tierBox.dataset.tier = tier.name.toLowerCase();
}

// ---------------- EVM ----------------
async function evmProfile(k, addr) {
  const n = net(k);
  const [bal, nonce, code] = await Promise.all([
    rpc(k, "eth_getBalance", [addr, "latest"]),
    rpc(k, "eth_getTransactionCount", [addr, "latest"]),
    rpc(k, "eth_getCode", [addr, "latest"]),
  ]);
  const native = unitsToFloat(hexToBig(bal), 18);
  const d = { native, nativeUsd: usdOf(k, native), nonce: Number(hexToBig(nonce)), contract: code && code !== "0x", txs: [], tokens: [], ont: null, history: "none" };

  const ca = caFor(k);
  if (ca) {
    try {
      const data = "0x70a08231" + addr.slice(2).toLowerCase().padStart(64, "0");
      const [raw, dec] = await Promise.all([rpc(k, "eth_call", [{ to: ca, data }, "latest"]), rpc(k, "eth_call", [{ to: ca, data: "0x313ce567" }, "latest"])]);
      d.ont = unitsToFloat(hexToBig(raw), Number(hexToBig(dec)) || 18);
    } catch {}
  }

  if (n.blockscoutApi) {
    const [txs, toks] = await Promise.allSettled([
      xget(`${n.blockscoutApi}/addresses/${addr}/transactions`),
      xget(`${n.blockscoutApi}/addresses/${addr}/tokens?type=ERC-20`),
    ]);
    if (txs.status === "fulfilled") {
      d.history = "blockscout";
      d.txs = (txs.value.items || []).slice(0, 25).map((t) => ({
        hash: t.hash, from: t.from?.hash, to: t.to?.hash || null, value: unitsToFloat(BigInt(t.value || "0"), 18),
        ts: t.timestamp ? Date.parse(t.timestamp) : null, method: t.method || (t.to ? "transfer" : "deploy"), ok: t.status !== "error",
      }));
    }
    if (toks.status === "fulfilled") {
      d.tokens = (toks.value.items || []).map((x) => {
        const tk = x.token || {}; const dec = Number(tk.decimals || 18);
        const amt = unitsToFloat(BigInt(x.value || "0"), dec);
        const rate = tk.exchange_rate ? parseFloat(tk.exchange_rate) : null;
        return { addr: tk.address_hash || tk.address, symbol: tk.symbol || "?", name: tk.name, amount: amt, usd: rate ? amt * rate : null };
      }).sort((a, b) => (b.usd || 0) - (a.usd || 0)).slice(0, 12);
    }
  } else if (n.etherscanChainId) {
    try {
      const j = await xget(`https://api.etherscan.io/v2/api?chainid=${n.etherscanChainId}&module=account&action=txlist&address=${addr}&page=1&offset=25&sort=desc`, { proxyOnly: true });
      if (Array.isArray(j.result)) {
        d.history = "etherscan";
        d.txs = j.result.map((t) => ({ hash: t.hash, from: t.from, to: t.to || null, value: unitsToFloat(BigInt(t.value || "0"), 18), ts: Number(t.timeStamp) * 1000, method: (t.functionName || "").split("(")[0] || (t.input === "0x" ? "transfer" : "call"), ok: t.isError !== "1" }));
      }
    } catch { d.history = "unavailable"; }
  }
  const tokUsd = d.tokens.reduce((s, t) => s + (t.usd || 0), 0);
  d.totalUsd = d.nativeUsd != null ? d.nativeUsd + tokUsd : null;
  return d;
}

// ---------------- Solana ----------------
async function solProfile(k, addr) {
  const [bal, sigs, info, ...tokRes] = await Promise.all([
    rpc(k, "getBalance", [addr, { commitment: "confirmed" }]),
    rpc(k, "getSignaturesForAddress", [addr, { limit: 25 }]).catch(() => []),
    rpc(k, "getAccountInfo", [addr, { encoding: "base64" }]).catch(() => null),
    ...TOKEN_PROGRAMS.map((p) => rpc(k, "getParsedTokenAccountsByOwner", [addr, { programId: p }, { encoding: "jsonParsed" }]).catch(() => null)),
  ]);
  const native = (bal?.value ?? bal ?? 0) / 1e9;
  const holdings = [];
  for (const r of tokRes) for (const a of r?.value || []) {
    const inf = a.account?.data?.parsed?.info; if (!inf) continue;
    const amt = inf.tokenAmount?.uiAmount || 0; if (!amt) continue;
    holdings.push({ addr: inf.mint, symbol: short(inf.mint, 4), amount: amt, usd: null });
  }
  const ca = caFor(k);
  const ont = ca ? holdings.filter((t) => t.addr === ca).reduce((s, t) => s + t.amount, 0) : null;
  const d = {
    native, nativeUsd: usdOf(k, native), nonce: null, contract: !!info?.value?.executable, history: "rpc", ont,
    tokens: holdings.sort((a, b) => b.amount - a.amount).slice(0, 12), tokenCount: holdings.length,
    txs: (sigs || []).map((s) => ({ hash: s.signature, ts: s.blockTime ? s.blockTime * 1000 : null, ok: !s.err, method: s.memo ? "memo" : "tx" })),
  };
  d.totalUsd = d.nativeUsd;
  return d;
}

// ---------------- render ----------------
function labels(k, d) {
  const out = [];
  if (d.contract) out.push(net(k).type === "solana" ? "PROGRAM" : "CONTRACT");
  if (d.nonce != null) { if (d.nonce === 0) out.push("NO OUTGOING TX"); else if (d.nonce < 10) out.push("FRESH WALLET"); else if (d.nonce > 5000) out.push("HIGH-FREQUENCY"); else if (d.nonce > 500) out.push("ACTIVE TRADER"); }
  if (d.ont) out.push(`$${CFG.token.symbol} HOLDER`);
  if (d.nativeUsd != null && d.nativeUsd >= CFG.intel.whaleUsd) out.push("WHALE BALANCE");
  return out;
}

function renderCard(k, addr, d) {
  const n = net(k);
  const node = state.nodes.get(k + ":" + (n.type === "evm" ? addr.toLowerCase() : addr));
  const cps = new Map();
  for (const t of d.txs) {
    const o = t.from && t.from.toLowerCase() === addr.toLowerCase() ? t.to : t.from;
    if (!o) continue; const c = cps.get(o) || { a: o, n: 0, v: 0 }; c.n++; c.v += t.value || 0; cps.set(o, c);
  }
  const top = [...cps.values()].sort((a, b) => b.n - a.n).slice(0, 10);

  return h("div", { class: "card", style: `--c:${n.color}` },
    h("div", { class: "ch" }, netIcon(k), h("b", {}, n.name), h("a", { class: "ext", href: explorerUrl(k, "addr", addr), target: "_blank", rel: "noopener" }, "EXPLORER ↗")),
    h("div", { class: "tags" }, labels(k, d).map((l) => h("em", {}, l))),
    h("div", { class: "stats" },
      stat("NATIVE", `${fmtNum(d.native, 4)} ${n.nativeSymbol}`, fmtUsd(d.nativeUsd)),
      d.nonce != null ? stat("OUTGOING TX", fmtInt(d.nonce), "nonce") : stat("RECENT SIGS", fmtInt(d.txs.length), "last 25"),
      stat(`$${CFG.token.symbol}`, d.ont == null ? (caFor(k) ? "0" : "—") : fmtNum(d.ont), caFor(k) ? "balance" : "CA pending"),
      stat("ON GRID", node ? `${node.txs} tx` : "not seen", node ? fmtUsd(node.usd) : "live window")),
    top.length ? h("div", { class: "ego" }, egoSvg(addr, top, n.color)) : null,
    d.tokens.length ? h("div", { class: "sub" }, h("small", {}, `TOKEN HOLDINGS${d.tokenCount ? ` · ${d.tokenCount}` : ""}`),
      h("div", { class: "toks" }, d.tokens.map((t) => h("a", { href: `#/intel/token/${k}/${t.addr}` }, h("b", {}, t.symbol), h("span", {}, fmtNum(t.amount)), t.usd != null ? h("i", {}, fmtUsd(t.usd)) : null)))) : null,
    h("div", { class: "sub" }, h("small", {}, "RECENT ACTIVITY"),
      d.txs.length ? h("div", { class: "txl" }, d.txs.slice(0, 12).map((t) => h("div", { class: "tx" + (t.ok === false ? " fail" : "") },
        h("a", { href: `#/trace/${t.hash}`, title: "Trace" }, short(t.hash, 6)),
        h("span", { class: "m" }, t.method || ""),
        t.value != null ? h("span", {}, t.value ? `${fmtNum(t.value, 4)} ${n.nativeSymbol}` : "") : h("span"),
        h("small", {}, t.ts ? ago(t.ts) : ""))))
        : empty(d.history === "none" || d.history === "unavailable" ? "Tx history needs an explorer API for this network (set ETHERSCAN_API_KEY on Vercel for BSC)." : "No transactions found.")));
}
const stat = (l, v, s) => h("div", { class: "st" }, h("small", {}, l), h("b", {}, v), h("span", {}, s || ""));

function egoSvg(addr, cps, color) {
  const W = 340, H = 200, cx = W / 2, cy = H / 2;
  const max = Math.max(...cps.map((c) => c.n));
  let s = `<svg viewBox="0 0 ${W} ${H}" class="egosvg">`;
  cps.forEach((c, i) => {
    const a = (i / cps.length) * Math.PI * 2 - Math.PI / 2, x = cx + Math.cos(a) * 130, y = cy + Math.sin(a) * 76;
    s += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${color}" stroke-opacity=".5" stroke-width="${1 + (c.n / max) * 3}"/>`;
    s += `<a href="#/scan/${c.a}"><circle cx="${x}" cy="${y}" r="${3 + (c.n / max) * 4}" fill="${color}"/><text x="${x}" y="${y + (y > cy ? 16 : -9)}" text-anchor="middle">${short(c.a, 3)} ·${c.n}</text></a>`;
  });
  s += `<circle cx="${cx}" cy="${cy}" r="8" fill="#fff"/><text x="${cx}" y="${cy + 22}" text-anchor="middle" class="me">${short(addr, 4)}</text></svg>`;
  return h("div", { html: s });
}
