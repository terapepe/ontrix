// 04 TX TRACE — decode a transaction's value flows and follow the money hop by hop
import { CFG, h, net, activeNetworks, short, fmtUsd, fmtNum, explorerUrl, netIcon, ago, isEvmHash, isSolSig, hexToBig, unitsToFloat } from "../util.js";
import { rpc, xget, usdOf } from "../net.js";
import { TRANSFER_TOPIC } from "../chains.js";
import { empty } from "../ui.js";

export function mount(root, [q = ""]) {
  const input = h("input", { type: "text", value: q, spellcheck: "false", placeholder: "transaction hash (0x…) or Solana signature" });
  const out = h("div", { class: "trace-out" });
  root.append(h("div", { class: "page" },
    h("div", { class: "page-h" }, h("span", { class: "code" }, "04"), h("h1", {}, "TX TRACE"), h("p", {}, "Decode native and token flows inside a transaction, then follow each recipient to the next hop.")),
    h("form", { class: "qbar", onsubmit: (e) => { e.preventDefault(); const v = input.value.trim(); if (v) location.hash = `#/trace/${v}`; } }, h("span", { class: "pr" }, "TRACE>"), input, h("button", {}, "RUN")),
    out));
  if (!q) { out.append(empty("Paste a transaction hash, or press TRACE on any whale in the Radar.")); return; }
  run(q, out);
}

async function run(q, out) {
  const status = h("div", { class: "scanning" }, "locating transaction across uplinks…");
  out.append(status);
  try {
    if (isEvmHash(q)) {
      const keys = activeNetworks().filter((k) => net(k).type === "evm");
      const found = await Promise.any(keys.map(async (k) => { const tx = await rpc(k, "eth_getTransactionByHash", [q]); if (!tx) throw 0; return { k, tx }; })).catch(() => null);
      if (!found) { status.replaceWith(empty("Transaction not found on the active EVM networks.")); return; }
      const d = await evmTrace(found.k, found.tx);
      status.replaceWith(render(found.k, q, d));
    } else if (isSolSig(q) && activeNetworks().some((k) => net(k).type === "solana")) {
      const k = activeNetworks().find((x) => net(x).type === "solana");
      const d = await solTrace(k, q);
      if (!d) { status.replaceWith(empty("Signature not found on Solana.")); return; }
      status.replaceWith(render(k, q, d));
    } else status.replaceWith(empty("Not a valid transaction hash for the active networks."));
  } catch (e) { status.replaceWith(h("div", { class: "err" }, "Trace failed: " + e.message)); }
}

function decodeStr(hex) {
  try {
    const b = hex.slice(2);
    if (b.length >= 128) { const len = parseInt(b.slice(64, 128), 16); return decodeURIComponent(b.slice(128, 128 + len * 2).replace(/../g, "%$&")); }
    return decodeURIComponent(b.replace(/(00)+$/, "").replace(/../g, "%$&"));
  } catch { return "?"; }
}

async function tokenMeta(k, addr) {
  const [sym, dec] = await Promise.all([
    rpc(k, "eth_call", [{ to: addr, data: "0x95d89b41" }, "latest"]).catch(() => null),
    rpc(k, "eth_call", [{ to: addr, data: "0x313ce567" }, "latest"]).catch(() => null),
  ]);
  return { symbol: sym && sym !== "0x" ? decodeStr(sym) : short(addr, 3), decimals: dec && dec !== "0x" ? Number(hexToBig(dec)) : 18 };
}

async function evmTrace(k, tx) {
  const [rc, blk] = await Promise.all([
    rpc(k, "eth_getTransactionReceipt", [tx.hash]),
    tx.blockNumber ? rpc(k, "eth_getBlockByNumber", [tx.blockNumber, false]) : null,
  ]);
  const value = unitsToFloat(hexToBig(tx.value), 18);
  const flows = [];
  if (value > 0) flows.push({ from: tx.from, to: tx.to, amount: value, symbol: net(k).nativeSymbol, usd: usdOf(k, value), native: true });
  const logs = (rc?.logs || []).filter((l) => l.topics?.[0] === TRANSFER_TOPIC && l.topics.length === 3);
  const tokens = [...new Set(logs.map((l) => l.address.toLowerCase()))].slice(0, 10);
  const meta = Object.fromEntries(await Promise.all(tokens.map(async (t) => [t, await tokenMeta(k, t)])));
  for (const l of logs) {
    const t = l.address.toLowerCase(); if (!meta[t]) continue;
    flows.push({ from: "0x" + l.topics[1].slice(26), to: "0x" + l.topics[2].slice(26), amount: unitsToFloat(hexToBig(l.data === "0x" ? "0x0" : l.data.slice(0, 66)), meta[t].decimals), symbol: meta[t].symbol, token: t });
  }
  const gasUsed = rc ? Number(hexToBig(rc.gasUsed)) : null;
  const gasPrice = rc?.effectiveGasPrice ? hexToBig(rc.effectiveGasPrice) : hexToBig(tx.gasPrice);
  const fee = gasUsed != null ? unitsToFloat(BigInt(gasUsed) * gasPrice, 18) : null;
  return {
    from: tx.from, to: tx.to, status: rc ? rc.status === "0x1" : null, block: Number(hexToBig(tx.blockNumber)),
    ts: blk ? Number(hexToBig(blk.timestamp)) * 1000 : null, fee, feeUsd: fee != null ? usdOf(k, fee) : null,
    method: tx.input && tx.input.length >= 10 ? tx.input.slice(0, 10) : "transfer", flows, logCount: rc?.logs?.length || 0,
  };
}

async function solTrace(k, sig) {
  const tx = await rpc(k, "getTransaction", [sig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }]);
  if (!tx) return null;
  const keys = tx.transaction.message.accountKeys.map((a) => a.pubkey || a);
  const m = tx.meta;
  const deltas = keys.map((a, i) => ({ a, d: ((m.postBalances[i] || 0) - (m.preBalances[i] || 0) + (i === 0 ? m.fee : 0)) / 1e9 }));
  const flows = [];
  const senders = deltas.filter((x) => x.d < -1e-9).sort((a, b) => a.d - b.d);
  for (const r of deltas.filter((x) => x.d > 1e-9).sort((a, b) => b.d - a.d).slice(0, 12)) {
    flows.push({ from: senders[0]?.a || keys[0], to: r.a, amount: r.d, symbol: "SOL", usd: usdOf(k, r.d), native: true });
  }
  const pre = {}; for (const b of m.preTokenBalances || []) pre[b.accountIndex] = b;
  const ch = {};
  for (const b of m.postTokenBalances || []) {
    const p = pre[b.accountIndex]; const d = (b.uiTokenAmount.uiAmount || 0) - (p?.uiTokenAmount.uiAmount || 0);
    if (d) (ch[b.mint] ||= []).push({ owner: b.owner, d });
  }
  for (const b of m.preTokenBalances || []) {
    if (!(m.postTokenBalances || []).some((x) => x.accountIndex === b.accountIndex) && b.uiTokenAmount.uiAmount) (ch[b.mint] ||= []).push({ owner: b.owner, d: -b.uiTokenAmount.uiAmount });
  }
  for (const [mint, list] of Object.entries(ch)) {
    const s = list.filter((x) => x.d < 0).sort((a, b) => a.d - b.d)[0];
    for (const r of list.filter((x) => x.d > 0)) flows.push({ from: s?.owner || keys[0], to: r.owner, amount: r.d, symbol: short(mint, 4), token: mint });
  }
  return { from: keys[0], to: null, status: !m.err, block: tx.slot, ts: tx.blockTime ? tx.blockTime * 1000 : null, fee: m.fee / 1e9, feeUsd: usdOf(k, m.fee / 1e9), method: "solana tx", flows, logCount: (m.logMessages || []).length };
}

function render(k, hash, d) {
  const n = net(k);
  const hops = h("div", { class: "hops" });
  const box = h("div", { class: "trace-res", style: `--c:${n.color}` },
    h("div", { class: "target" },
      h("div", {}, h("small", {}, "TRANSACTION"), h("code", { class: "addr" }, hash)),
      h("div", { class: "row" }, h("span", { class: "nb", style: `--c:${n.color}` }, netIcon(k), n.short), h("em", { class: d.status === false ? "bad" : "good" }, d.status === false ? "FAILED" : d.status ? "SUCCESS" : "PENDING"),
        h("a", { class: "btn", href: explorerUrl(k, "tx", hash), target: "_blank", rel: "noopener" }, "EXPLORER ↗"))),
    h("div", { class: "stats" },
      st("BLOCK / SLOT", d.block ? d.block.toLocaleString("en-US") : "—"),
      st("TIME", d.ts ? new Date(d.ts).toISOString().replace("T", " ").slice(0, 19) + " UTC" : "—", d.ts ? ago(d.ts) : ""),
      st("FEE", d.fee != null ? `${fmtNum(d.fee, 6)} ${n.nativeSymbol}` : "—", fmtUsd(d.feeUsd)),
      st("SIGNER", short(d.from, 5), d.method)),
    h("div", { class: "flows" },
      h("small", {}, `VALUE FLOWS · ${d.flows.length}`),
      d.flows.length ? d.flows.map((f) => h("div", { class: "flow" + (f.native ? " native" : "") },
        h("a", { class: "fa", href: `#/scan/${f.from}/${k}` }, short(f.from, 5)),
        h("div", { class: "fl" }, h("span", {}, `${fmtNum(f.amount, 4)} ${f.symbol}${f.usd ? " · " + fmtUsd(f.usd) : ""}`), h("i")),
        h("a", { class: "fa", href: `#/scan/${f.to}/${k}` }, short(f.to, 5)),
        n.blockscoutApi && f.to ? h("button", { class: "btn sm", onclick: (e) => follow(k, f.to, hops, e.target) }, "FOLLOW →") : null))
        : empty("No native or token value moved in this transaction (contract call only).")),
    hops);
  return box;
}
const st = (l, v, s) => h("div", { class: "st" }, h("small", {}, l), h("b", {}, v), h("span", {}, s || ""));

async function follow(k, addr, hops, btn) {
  btn.disabled = true; btn.textContent = "…";
  const n = net(k);
  const col = h("div", { class: "hop" }, h("div", { class: "hh" }, h("small", {}, `NEXT HOP · ${short(addr, 5)}`)));
  hops.append(col);
  try {
    const [txs, tt] = await Promise.allSettled([
      xget(`${n.blockscoutApi}/addresses/${addr}/transactions?filter=from`),
      xget(`${n.blockscoutApi}/addresses/${addr}/token-transfers?filter=from`),
    ]);
    const rows = [];
    if (txs.status === "fulfilled") for (const t of (txs.value.items || []).slice(0, 6)) {
      const v = unitsToFloat(BigInt(t.value || "0"), 18);
      rows.push({ hash: t.hash, to: t.to?.hash, label: v ? `${fmtNum(v, 4)} ${n.nativeSymbol}` : t.method || "call", ts: Date.parse(t.timestamp) });
    }
    if (tt.status === "fulfilled") for (const t of (tt.value.items || []).slice(0, 6)) {
      const dec = Number(t.total?.decimals || t.token?.decimals || 18);
      rows.push({ hash: t.transaction_hash || t.tx_hash, to: t.to?.hash, label: `${fmtNum(unitsToFloat(BigInt(t.total?.value || "0"), dec))} ${t.token?.symbol || "?"}`, ts: Date.parse(t.timestamp) });
    }
    rows.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    col.append(...(rows.length ? rows.slice(0, 10).map((r) => h("div", { class: "hr" },
      h("a", { href: `#/trace/${r.hash}` }, r.label), h("span", {}, "→ "), r.to ? h("a", { href: `#/scan/${r.to}/${k}` }, short(r.to, 4)) : "—", h("small", {}, r.ts ? ago(r.ts) : "")))
      : [empty("No outgoing activity — funds are still parked here.")]));
    btn.textContent = "TRACED";
  } catch (e) { col.append(h("div", { class: "err" }, e.message)); btn.disabled = false; btn.textContent = "FOLLOW →"; }
}
