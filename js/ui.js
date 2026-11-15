// ONTRIX — shell components: CA chip, terminal buffer, alerts, toasts, watchlist, omnibox
import { CFG, h, net, bus, activeNetworks, isMulti, caFor, short, copyText, netIcon, utcClock, isEvmAddr, isEvmHash, isSolAddr, isSolSig } from "./util.js";

// ---------- terminal log buffer ----------
export const logs = [];
bus.on("log", (l) => {
  logs.push({ ...l, time: utcClock().slice(0, 8) });
  if (logs.length > 300) logs.shift();
  bus.emit("log:added", logs.at(-1));
});
export function sysLog(msg, level = "sys") { bus.emit("log", { k: "sys", level, msg }); }

export function logLine(l) {
  const tag = l.k === "sys" ? "SYS" : net(l.k)?.short || l.k;
  const color = l.k === "sys" ? "" : `color:${net(l.k)?.color}`;
  return h("div", { class: "log l-" + l.level }, h("span", { class: "lt" }, l.time), h("span", { class: "lk", style: color }, `[${tag}]`), h("span", { class: "lm" }, l.msg));
}

// ---------- toasts ----------
export function toast(msg, level = "ok") {
  let box = document.getElementById("toasts");
  if (!box) { box = h("div", { id: "toasts" }); document.body.append(box); }
  const t = h("div", { class: "toast t-" + level }, msg);
  box.append(t);
  setTimeout(() => t.classList.add("out"), 2600);
  setTimeout(() => t.remove(), 3100);
}

// ---------- alerts ----------
export const alerts = [];
bus.on("alert", (a) => {
  alerts.unshift({ ...a, time: utcClock().slice(0, 8) });
  alerts.length = Math.min(alerts.length, 100);
  bus.emit("alert:added", alerts[0]);
});

// ---------- watchlist (localStorage) ----------
const WKEY = "ontrix.watch";
export const watch = {
  list() { try { return JSON.parse(localStorage.getItem(WKEY) || "[]"); } catch { return []; } },
  has(k, a) { const norm = net(k).type === "evm" ? a.toLowerCase() : a; return this.list().some((w) => w.k === k && w.a === norm); },
  toggle(k, a, label = "") {
    const norm = net(k).type === "evm" ? a.toLowerCase() : a;
    let l = this.list();
    const on = l.some((w) => w.k === k && w.a === norm);
    l = on ? l.filter((w) => !(w.k === k && w.a === norm)) : [...l, { k, a: norm, label, added: Date.now() }];
    try { localStorage.setItem(WKEY, JSON.stringify(l)); } catch {}
    bus.emit("watch", l);
    return !on;
  },
};
bus.on("txs", (evs) => {
  const l = watch.list(); if (!l.length) return;
  const set = new Set(l.map((w) => w.k + ":" + w.a));
  for (const e of evs) {
    const hit = [e.from, e.to, e.token?.from, e.token?.to].find((a) => a && set.has(e.k + ":" + a));
    if (hit) bus.emit("alert", { level: "watch", k: e.k, ev: e, msg: `WATCHLIST hit · ${short(hit)} · tx ${short(e.hash, 6)}` });
  }
});

// ---------- CA chip ----------
function caGroup(keys, ca) {
  const icons = h("span", { class: "ca-icons" }, keys.map((k) => netIcon(k)));
  if (!ca) return h("div", { class: "ca-chip pending", title: "Contract address will be published at launch" }, icons, h("span", { class: "ca-label" }, "CA"), h("span", { class: "ca-val" }, "PENDING LAUNCH"));
  const btn = h("button", { class: "ca-copy", title: "Copy CA", onclick: async () => { if (await copyText(ca)) { toast(`$${CFG.token.symbol} CA copied`); btn.textContent = "COPIED"; setTimeout(() => (btn.textContent = "COPY"), 1400); } } }, "COPY");
  return h("div", { class: "ca-chip" }, icons, h("span", { class: "ca-label" }, "CA"), h("code", { class: "ca-val", title: ca }, short(ca, 6)), btn);
}
/** CA chips: grouped by identical address (Robinhood/Base/BSC share one CA in multi mode). */
export function caChips() {
  const groups = new Map();
  for (const k of activeNetworks()) {
    const ca = caFor(k);
    const key = ca || (net(k).type === "solana" ? "__sol" : "__evm");
    if (!groups.has(key)) groups.set(key, { keys: [], ca });
    groups.get(key).keys.push(k);
  }
  return h("div", { class: "ca-row" }, h("span", { class: "tk" }, `$${CFG.token.symbol}`), [...groups.values()].map((g) => caGroup(g.keys, g.ca)));
}

// ---------- omnibox: detect wallet / tx / token ----------
export function routeQuery(q) {
  q = q.trim();
  if (!q) return null;
  if (isEvmHash(q) || isSolSig(q)) return `#/trace/${q}`;
  if (isEvmAddr(q) || isSolAddr(q)) return `#/scan/${q}`;
  return `#/intel/search/${encodeURIComponent(q)}`;
}

export function networkBadge(k) {
  const n = net(k);
  return h("span", { class: "nb", style: `--c:${n.color}` }, netIcon(k), n.short);
}

export function modeLabel() {
  return isMulti() ? `MULTI · ${activeNetworks().length} NETWORKS` : `SINGLE · ${net(activeNetworks()[0]).name.toUpperCase()}`;
}

export function panel(title, code, ...body) {
  return h("section", { class: "pnl" }, h("header", {}, h("span", { class: "pt" }, title), code ? h("span", { class: "pc" }, code) : null), h("div", { class: "pb" }, ...body));
}

export function empty(msg) { return h("div", { class: "empty" }, msg); }
