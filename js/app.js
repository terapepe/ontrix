// ONTRIX-OS — boot + shell + router
import { CFG, h, $, net, bus, activeNetworks, isMulti, utcClock, netIcon } from "./util.js";
import { startPrices, prices } from "./net.js";
import { startEngine, state, setFocus } from "./stream.js";
import { caChips, routeQuery, modeLabel, sysLog, alerts, toast } from "./ui.js";
import * as grid from "./modules/grid.js";
import * as radar from "./modules/radar.js";
import * as scan from "./modules/scan.js";
import * as trace from "./modules/trace.js";
import * as intel from "./modules/intel.js";
import * as nets from "./modules/nets.js";
import * as docs from "./modules/docs.js";

const MODULES = [
  { id: "grid", code: "01", label: "Grid", hint: "Live network map", mod: grid, icon: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" },
  { id: "radar", code: "02", label: "Whale Radar", hint: "Large transfers", mod: radar, icon: "M12 12L20 6M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5" },
  { id: "scan", code: "03", label: "Wallet Scan", hint: "Profile any wallet", mod: scan, icon: "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM16 16l5 5" },
  { id: "trace", code: "04", label: "Tx Trace", hint: "Follow the money", mod: trace, icon: "M4 6h5l3 6 3-6h5M4 18h16M12 12v6" },
  { id: "intel", code: "05", label: "Token Intel", hint: "$" + CFG.token.symbol + " & token lookup", mod: intel, icon: "M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5" },
  { id: "nets", code: "06", label: "Networks", hint: "Chain telemetry", mod: nets, icon: "M3 12h4l3-8 4 16 3-8h4" },
  { id: "docs", code: "07", label: "Docs", hint: "Manual & guides", mod: docs, icon: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7" },
];

const svgIcon = (d) => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.innerHTML = `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"/>`; return s; };

function buildShell() {
  const single = !isMulti() ? net(activeNetworks()[0]) : null;
  document.documentElement.style.setProperty("--net", single ? single.color : "#65F5C1");
  document.body.classList.toggle("is-single", !!single);
  document.title = `${CFG.brand.name} · ${CFG.brand.tagline}`;

  const nav = h("nav", { class: "nav" }, MODULES.map((m) =>
    h("a", { href: `#/${m.id}`, "data-id": m.id, title: m.hint }, svgIcon(m.icon), h("span", { class: "nc" }, m.code), h("span", { class: "nl" }, m.label))));

  const socials = h("div", { class: "socials" },
    CFG.social.x ? h("a", { href: CFG.social.x, target: "_blank", rel: "noopener", title: "X " + CFG.social.xHandle, html: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.9 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z"/></svg>' }) : null,
    CFG.social.telegram ? h("a", { href: CFG.social.telegram, target: "_blank", rel: "noopener", title: "Telegram", html: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M21.9 4.3l-3.2 15c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.2 13 1.4 11.5c-1-.3-1-1 .2-1.5l18.9-7.3c.9-.3 1.6.2 1.4 1.6z"/></svg>' }) : null,
    CFG.social.github ? h("a", { href: CFG.social.github, target: "_blank", rel: "noopener", title: "Source", html: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .8.1-.7.4-1.1.6-1.4-2.2-.2-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.6 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.3.2 2.3.1 2.6.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2z"/></svg>' }) : null);

  const rail = h("aside", { class: "rail" },
    h("a", { class: "id", href: "#/grid" },
      h("img", { src: "assets/logo.svg", alt: CFG.brand.name }),
      h("div", {}, h("b", {}, CFG.brand.name), h("small", {}, `${CFG.brand.system} v${CFG.brand.version}`))),
    h("div", { class: "rail-sec" }, "MODULES"),
    nav,
    h("div", { class: "rail-sec" }, "UPLINKS"),
    h("div", { class: "uplinks" }, activeNetworks().map((k) =>
      h("a", { class: "up", href: `#/nets`, "data-k": k, style: `--c:${net(k).color}` }, netIcon(k), h("span", {}, net(k).short), h("i", { class: "dot" })))),
    h("div", { class: "rail-foot" },
      h("div", { class: "mode" }, modeLabel()),
      socials,
      h("div", { class: "clock", id: "clock" }, utcClock())));

  const omni = h("input", { id: "omni", type: "text", spellcheck: "false", autocomplete: "off", placeholder: "search wallet · tx hash · token / CA   ( / )" });
  const form = h("form", { class: "omni", onsubmit: (e) => { e.preventDefault(); const r = routeQuery(omni.value); if (r) { location.hash = r; omni.blur(); } } },
    h("span", { class: "pr" }, ">_"), omni, h("button", { type: "submit" }, "EXEC"));

  const focus = isMulti() ? h("div", { class: "focus" },
    h("button", { "data-f": "all", class: "on", onclick: () => setFocus("all") }, "ALL"),
    activeNetworks().map((k) => h("button", { "data-f": k, style: `--c:${net(k).color}`, onclick: () => setFocus(k) }, netIcon(k), net(k).short))) : null;

  const cmd = h("div", { class: "cmdbar" }, form, focus, caChips(), h("div", { class: "live", id: "live" }, h("i"), "LIVE"));
  const ticker = h("div", { class: "ticker" }, h("span", { class: "tl" }, "SIGNALS"), h("div", { class: "tw" }, h("div", { class: "tt", id: "tickerTrack" }, h("span", { class: "muted" }, "awaiting signals…"))));
  const view = h("section", { id: "view" });

  $("#app").replaceChildren(h("div", { class: "os" }, rail, h("main", { class: "deck" }, cmd, view, ticker)));

  setInterval(() => { const c = $("#clock"); if (c) c.textContent = utcClock(); }, 1000);
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") { e.preventDefault(); omni.focus(); }
  });

  bus.on("focus", (f) => document.querySelectorAll(".focus button").forEach((b) => b.classList.toggle("on", b.dataset.f === f)));
  bus.on("net", ({ k, st }) => { const el = document.querySelector(`.up[data-k="${k}"]`); if (el) el.classList.toggle("ok", st.ok), el.classList.toggle("bad", !st.ok && !!st.err); });
  bus.on("alert:added", () => renderTicker());
}

function renderTicker() {
  const tr = $("#tickerTrack"); if (!tr) return;
  const items = alerts.slice(0, 14);
  tr.replaceChildren(...[...items, ...items].map((a) => h("span", { class: "sig s-" + a.level, style: a.k && net(a.k) ? `--c:${net(a.k).color}` : "" }, h("b", {}, a.time), a.k && net(a.k) ? `[${net(a.k).short}] ` : "", a.msg)));
}

// ---------- router ----------
let current = null;
function route() {
  const parts = (location.hash.replace(/^#\/?/, "") || "grid").split("/");
  const id = parts[0];
  const m = MODULES.find((x) => x.id === id) || MODULES[0];
  document.querySelectorAll(".nav a").forEach((a) => a.classList.toggle("on", a.dataset.id === m.id));
  try { current?.cleanup?.(); } catch {}
  const view = $("#view");
  view.className = "v-" + m.id;
  view.replaceChildren();
  const cleanup = m.mod.mount(view, parts.slice(1).map(decodeURIComponent));
  current = { id: m.id, cleanup };
}

function boot() {
  const lines = [
    `${CFG.brand.system} v${CFG.brand.version} — ${CFG.brand.tagline}`,
    `mode ............ ${modeLabel()}`,
    ...activeNetworks().map((k) => `uplink .......... ${net(k).name}`),
    `whale threshold . $${CFG.intel.whaleUsd.toLocaleString("en-US")}`,
    "intelligence matrix online",
  ];
  const ov = h("div", { class: "boot" }, h("img", { src: "assets/logo.svg", alt: "" }), h("pre", { id: "bootlog" }));
  document.body.append(ov);
  const pre = ov.querySelector("pre");
  let i = 0;
  const iv = setInterval(() => {
    pre.textContent += "> " + lines[i++] + "\n";
    if (i >= lines.length) { clearInterval(iv); setTimeout(() => { ov.classList.add("out"); setTimeout(() => ov.remove(), 500); }, 250); }
  }, 120);
  ov.addEventListener("click", () => ov.remove());
}

buildShell();
boot();
startPrices();
startEngine();
sysLog(`${CFG.brand.system} online · ${modeLabel()}`, "ok");
window.addEventListener("hashchange", route);
route();
window.ONTRIX = { state, prices, toast };
