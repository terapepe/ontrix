// 01 GRID — live blockchain network map with floating intelligence readouts
import { CFG, h, net, bus, activeNetworks, short, fmtUsd, fmtNum, fmtInt, explorerUrl, netIcon, ago } from "../util.js";
import { state, computeMetrics } from "../stream.js";
import { NetMap } from "../map.js";
import { logs, logLine, watch, toast } from "../ui.js";

export function mount(root) {
  const canvas = h("canvas", { class: "map" });
  const val = (id) => h("b", { id }, "—");

  const hudWhale = h("div", { class: "hud hud-whale" },
    h("div", { class: "hh" }, h("span", {}, "WHALE ACTIVITY"), h("i", {}, `≥ $${fmtNum(CFG.intel.whaleUsd, 0)}`)),
    h("div", { class: "big", id: "mWhaleCount" }, "0"),
    h("div", { class: "kv" }, h("span", {}, "volume"), val("mWhaleUsd")),
    h("div", { class: "last", id: "mWhaleLast" }, "scanning for large transfers…"));

  const hudSmart = h("div", { class: "hud hud-smart" },
    h("div", { class: "hh" }, h("span", {}, "SMART MONEY FLOW"), h("i", {}, "repeat movers")),
    h("div", { class: "big", id: "mSmartUsd" }, "$0"),
    h("div", { class: "bar" }, h("i", { id: "mSmartBar" })),
    h("div", { class: "kv" }, h("span", {}, "→ contracts / DeFi"), val("mSmartIn")),
    h("div", { class: "kv" }, h("span", {}, "→ wallets"), val("mSmartOut")),
    h("div", { class: "kv" }, h("span", {}, "smart wallets"), val("mSmartW")));

  const hudToken = h("div", { class: "hud hud-token" },
    h("div", { class: "hh" }, h("span", {}, "TOKEN MOVEMENT"), h("i", {}, "transfers / min")),
    h("div", { class: "big", id: "mTokRate" }, "0"),
    h("div", { class: "toplist", id: "mTokTop" }));

  const hudCluster = h("div", { class: "hud hud-cluster" },
    h("div", { class: "hh" }, h("span", {}, "WALLET CLUSTERS"), h("i", {}, `≥ ${CFG.intel.clusterMin} linked`)),
    h("div", { class: "big", id: "mClCount" }, "0"),
    h("div", { class: "kv" }, h("span", {}, "largest cluster"), val("mClLargest")),
    h("div", { class: "kv" }, h("span", {}, "wallets on grid"), val("mClWallets")),
    h("div", { class: "kv" }, h("span", {}, "tx in window"), val("mTx")));

  const term = h("div", { class: "hud hud-term" }, h("div", { class: "hh" }, h("span", {}, "TERMINAL"), h("i", {}, "stream")), h("div", { class: "logs", id: "gridLogs" }, logs.slice(-40).map(logLine)));

  const strip = h("div", { class: "netstrip" }, activeNetworks().map((k) =>
    h("div", { class: "ns", "data-k": k, style: `--c:${net(k).color}` }, netIcon(k), h("div", {}, h("b", {}, net(k).short), h("small", { class: "nsv" }, "linking…")))));

  const dossier = h("aside", { class: "dossier hidden" });
  const legend = h("div", { class: "legend" },
    h("span", {}, h("i", { class: "lg-node" }), "wallet"),
    h("span", {}, h("i", { class: "lg-whale" }), "whale"),
    h("span", {}, h("i", { class: "lg-tok" }), "token packet"),
    h("span", { class: "muted" }, "drag · scroll zoom · dbl-click reset"));

  root.append(h("div", { class: "grid-wrap" }, canvas, hudWhale, hudSmart, hudCluster, hudToken, term, strip, legend, dossier));

  const map = new NetMap(canvas, { onPick: (n) => openDossier(n) });

  function openDossier(n) {
    const nn = net(n.k);
    const links = [...state.edges.values()].filter((e) => e.a === n.id || e.b === n.id).sort((a, b) => b.usd - a.usd).slice(0, 6);
    const watching = watch.has(n.k, n.addr);
    const wbtn = h("button", { class: "btn", onclick: () => { const on = watch.toggle(n.k, n.addr); wbtn.textContent = on ? "UNWATCH" : "WATCH"; toast(on ? "Added to watchlist" : "Removed from watchlist"); } }, watching ? "UNWATCH" : "WATCH");
    dossier.replaceChildren(
      h("button", { class: "x", onclick: () => dossier.classList.add("hidden") }, "×"),
      h("div", { class: "dh" }, netIcon(n.k), h("span", { style: `color:${nn.color}` }, nn.name.toUpperCase()), n.whale ? h("em", { class: "tag-whale" }, "WHALE") : null),
      h("code", { class: "addr" }, n.addr),
      h("div", { class: "kv" }, h("span", {}, "tx seen"), h("b", {}, fmtInt(n.txs))),
      h("div", { class: "kv" }, h("span", {}, "native value seen"), h("b", {}, fmtUsd(n.usd))),
      h("div", { class: "kv" }, h("span", {}, "links"), h("b", {}, fmtInt(n.deg))),
      h("div", { class: "kv" }, h("span", {}, "last activity"), h("b", {}, ago(n.last))),
      links.length ? h("div", { class: "dl" }, h("small", {}, "STRONGEST LINKS"), links.map((e) => {
        const o = state.nodes.get(e.a === n.id ? e.b : e.a);
        return o ? h("a", { href: `#/scan/${o.addr}/${o.k}` }, short(o.addr, 5), h("span", {}, `${e.count}× · ${fmtUsd(e.usd)}`)) : null;
      })) : null,
      h("div", { class: "row" },
        h("a", { class: "btn pri", href: `#/scan/${n.addr}/${n.k}` }, "DEEP SCAN"),
        wbtn,
        h("a", { class: "btn", href: explorerUrl(n.k, "addr", n.addr), target: "_blank", rel: "noopener" }, "EXPLORER ↗")));
    dossier.classList.remove("hidden");
  }

  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  function paint(m) {
    if (!m) return;
    set("mWhaleCount", fmtInt(m.whale.count));
    set("mWhaleUsd", fmtUsd(m.whale.usd));
    const lw = m.whale.last;
    const lastEl = document.getElementById("mWhaleLast");
    if (lastEl && lw) lastEl.replaceChildren(netIcon(lw.k), h("a", { href: `#/trace/${lw.hash}` }, `${fmtUsd(lw.usd)} · ${short(lw.from)} → ${short(lw.to)}`));
    set("mSmartUsd", fmtUsd(m.smart.total));
    set("mSmartIn", fmtUsd(m.smart.toContracts));
    set("mSmartOut", fmtUsd(m.smart.toWallets));
    set("mSmartW", fmtInt(m.smart.wallets));
    const bar = document.getElementById("mSmartBar");
    if (bar) bar.style.width = (m.smart.total ? (m.smart.toContracts / m.smart.total) * 100 : 50) + "%";
    set("mTokRate", fmtNum(m.token.perMin, 1));
    const top = document.getElementById("mTokTop");
    if (top) top.replaceChildren(...(m.token.top.length ? m.token.top.map((t) =>
      h("a", { href: `#/intel/token/${t.k}/${t.token}` }, netIcon(t.k), h("code", {}, short(t.token, 4)), h("span", {}, t.count + "×"))) : [h("span", { class: "muted" }, "no token transfers yet")]));
    set("mClCount", fmtInt(m.clusters.count));
    set("mClLargest", fmtInt(m.clusters.largest) + " wallets");
    set("mClWallets", fmtInt(m.clusters.wallets));
    set("mTx", fmtInt(m.txs));
  }
  const offs = [
    bus.on("metrics", paint),
    bus.on("log:added", (l) => {
      const box = document.getElementById("gridLogs"); if (!box) return;
      box.append(logLine(l)); while (box.children.length > 60) box.firstChild.remove();
      box.scrollTop = box.scrollHeight;
    }),
    bus.on("net", ({ k, st }) => {
      const el = strip.querySelector(`[data-k="${k}"] .nsv`); if (!el) return;
      el.textContent = st.ok ? `#${fmtInt(st.height)}${st.tps ? ` · ${fmtNum(st.tps, 0)} tps` : ""}` : st.err ? "uplink lost" : "linking…";
      el.parentElement.parentElement.classList.toggle("bad", !st.ok);
    }),
  ];
  paint(state.metrics || computeMetrics());
  term.querySelector(".logs").scrollTop = 1e9;
  return () => { map.destroy(); offs.forEach((f) => f()); };
}
