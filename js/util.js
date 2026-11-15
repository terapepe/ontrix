// ONTRIX — shared helpers
export const CFG = window.ONTRIX_CONFIG;

/** Networks active for the current mode, in display order. */
export function activeNetworks() {
  if (CFG.mode === "single") {
    const k = CFG.networks[CFG.singleNetwork] ? CFG.singleNetwork : Object.keys(CFG.networks)[0];
    return [k];
  }
  return CFG.multiOrder.filter((k) => CFG.networks[k]);
}
export const net = (k) => CFG.networks[k];
export const isMulti = () => CFG.mode !== "single";

/** CA for a network (network override → shared token CA). */
export function caFor(k) {
  const n = net(k);
  if (!n) return "";
  if (n.ca) return n.ca;
  return n.type === "solana" ? CFG.token.sol : CFG.token.evm;
}

export function explorerUrl(k, kind, id) {
  const n = net(k);
  const path = kind === "tx" ? n.explorerTx : kind === "token" ? n.explorerToken : n.explorerAddr;
  return n.explorer + path + id;
}

// ---------- event bus ----------
const listeners = {};
export const bus = {
  on(ev, fn) { (listeners[ev] ||= new Set()).add(fn); return () => listeners[ev].delete(fn); },
  emit(ev, data) { listeners[ev]?.forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); },
};

// ---------- DOM ----------
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
export const $ = (s, r = document) => r.querySelector(s);
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- format ----------
export function short(a, n = 4) {
  if (!a) return "—";
  return a.length <= n * 2 + 3 ? a : a.slice(0, n + (a.startsWith("0x") ? 2 : 0)) + "…" + a.slice(-n);
}
export function fmtNum(v, d = 2) {
  if (v == null || !isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e12) return (v / 1e12).toFixed(d) + "T";
  if (a >= 1e9) return (v / 1e9).toFixed(d) + "B";
  if (a >= 1e6) return (v / 1e6).toFixed(d) + "M";
  if (a >= 1e3) return (v / 1e3).toFixed(d) + "K";
  if (a >= 1) return v.toFixed(d);
  if (a === 0) return "0";
  return v.toPrecision(3);
}
export const fmtUsd = (v, d = 2) => (v == null || !isFinite(v) ? "—" : (v < 0 ? "-$" : "$") + fmtNum(Math.abs(v), d));
export function fmtPrice(v) {
  if (v == null || !isFinite(v)) return "—";
  if (v >= 1) return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 4 });
  const s = v.toFixed(20);
  const m = s.match(/^0\.(0*)(\d{1,4})/);
  if (!m) return "$" + v;
  return m[1].length >= 4 ? `$0.0{${m[1].length}}${m[2]}` : "$0." + m[1] + m[2];
}
export const fmtInt = (v) => (v == null || !isFinite(v) ? "—" : Math.round(v).toLocaleString("en-US"));
export function ago(ms) {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return s + "s ago";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}
export const utcClock = () => new Date().toISOString().slice(11, 19) + " UTC";

// ---------- big numbers ----------
export function hexToBig(hex) { try { return BigInt(hex || "0x0"); } catch { return 0n; } }
export function unitsToFloat(big, decimals = 18) {
  big = typeof big === "bigint" ? big : BigInt(big || 0);
  const neg = big < 0n; if (neg) big = -big;
  const base = 10n ** BigInt(decimals);
  const whole = big / base, frac = big % base;
  const v = Number(whole) + Number(frac) / Number(base);
  return neg ? -v : v;
}

// ---------- detection ----------
export const isEvmAddr = (s) => /^0x[0-9a-fA-F]{40}$/.test(s);
export const isEvmHash = (s) => /^0x[0-9a-fA-F]{64}$/.test(s);
export const isSolAddr = (s) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
export const isSolSig = (s) => /^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(s);

// ---------- misc ----------
export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; }
  catch {
    const ta = h("textarea", { style: "position:fixed;opacity:0" }); ta.value = t; document.body.append(ta);
    ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok;
  }
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function hashNum(str) { let x = 2166136261; for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0) / 4294967295; }
export function netIcon(k, cls = "ni") { const n = net(k); return h("img", { class: cls, src: n.icon, alt: n.short, title: n.name }); }
export function tierOf(usd) { return CFG.intel.tiers.find((t) => usd >= t.min) || CFG.intel.tiers.at(-1); }
