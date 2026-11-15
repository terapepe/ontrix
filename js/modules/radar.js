// 02 WHALE RADAR — every native transfer ≥ whale threshold, plotted and logged live
import { CFG, h, net, bus, short, fmtUsd, fmtNum, explorerUrl, netIcon, hashNum, ago } from "../util.js";
import { state } from "../stream.js";
import { panel, empty } from "../ui.js";

export function mount(root) {
  const cv = h("canvas", { class: "radar-cv" });
  const feed = h("div", { class: "feed" });
  const top = h("div", { class: "toplist big-list" });
  const stat = h("div", { class: "radar-stat" });

  root.append(h("div", { class: "radar-wrap" },
    h("div", { class: "radar-stage" }, cv, stat,
      h("div", { class: "radar-note" }, `Blips = transfers ≥ $${fmtNum(CFG.intel.whaleUsd, 0)} · closer to center = larger · angle = wallet signature`)),
    h("div", { class: "radar-side" },
      panel("WHALE FEED", "LIVE", feed),
      panel("TOP WHALE SENDERS", `${CFG.intel.windowSec / 60} MIN`, top))));

  const ctx = cv.getContext("2d");
  let t = 0, run = true, W = 0, H = 0;
  const ro = new ResizeObserver(() => { const r = cv.getBoundingClientRect(); const d = Math.min(devicePixelRatio || 1, 2); W = r.width; H = r.height; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); });
  ro.observe(cv);

  function draw() {
    if (!run) return;
    t++;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.45;
    ctx.strokeStyle = "rgba(101,245,193,.18)"; ctx.lineWidth = 1;
    const rad = (usd) => R * Math.max(0.05, 1 - Math.min(2, Math.log10(usd / CFG.intel.whaleUsd)) / 2.1);
    const levels = [CFG.intel.whaleUsd, CFG.intel.whaleUsd * 3, CFG.intel.whaleUsd * 10, CFG.intel.whaleUsd * 100];
    for (const v of levels) { ctx.beginPath(); ctx.arc(cx, cy, rad(v), 0, Math.PI * 2); ctx.stroke(); }
    for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke(); }
    ctx.fillStyle = "rgba(101,245,193,.5)"; ctx.font = "10px 'JetBrains Mono', monospace";
    levels.forEach((v) => ctx.fillText("$" + fmtNum(v, 0), cx + 4, cy - rad(v) + 12));
    const sweep = (t * 0.02) % (Math.PI * 2);
    if (ctx.createConicGradient) {
      const g = ctx.createConicGradient(sweep - 1.2, cx, cy);
      g.addColorStop(0, "rgba(101,245,193,0)"); g.addColorStop(0.19, "rgba(101,245,193,.22)"); g.addColorStop(0.191, "rgba(101,245,193,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    }
    const now = Date.now();
    for (const w of state.whales) {
      if (state.focus !== "all" && w.k !== state.focus) continue;
      const age = (now - w.ts) / 1000; if (age > 1800) continue;
      const ang = hashNum(w.from) * Math.PI * 2;
      const lr = Math.log10(w.usd / CFG.intel.whaleUsd); // 0..2+
      const rr = rad(w.usd);
      const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr;
      let d = sweep - ang; d = ((d % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const glow = Math.max(0.25, 1 - d / 3) * Math.max(0.3, 1 - age / 1800);
      ctx.fillStyle = `rgba(255,77,109,${glow})`; ctx.shadowColor = "#FF4D6D"; ctx.shadowBlur = 12 * glow;
      ctx.beginPath(); ctx.arc(x, y, 3 + Math.min(5, lr * 2), 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = net(w.k).color; ctx.globalAlpha = glow; ctx.beginPath(); ctx.arc(x, y, 7 + Math.min(5, lr * 2), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  function render() {
    const list = state.whales.filter((w) => state.focus === "all" || w.k === state.focus);
    feed.replaceChildren(...(list.length ? list.slice(0, 60).map((w) =>
      h("div", { class: "fr" },
        netIcon(w.k),
        h("div", { class: "fm" },
          h("b", {}, fmtUsd(w.usd)), h("span", {}, ` ${fmtNum(w.value)} ${net(w.k).nativeSymbol}`),
          h("div", { class: "ft" }, h("a", { href: `#/scan/${w.from}/${w.k}` }, short(w.from)), " → ", w.to ? h("a", { href: `#/scan/${w.to}/${w.k}` }, short(w.to)) : "deploy")),
        h("div", { class: "fx" }, h("small", {}, ago(w.ts)), h("a", { href: `#/trace/${w.hash}`, title: "Trace" }, "TRACE"), h("a", { href: explorerUrl(w.k, "tx", w.hash), target: "_blank", rel: "noopener" }, "↗"))))
      : [empty("No whale transfers captured yet. The radar keeps listening on every sampled block.")]));

    const cut = Date.now() - CFG.intel.windowSec * 1000;
    const agg = new Map();
    for (const e of state.events) {
      if (e.ts < cut || e.usd < CFG.intel.smartMoneyUsd) continue;
      if (state.focus !== "all" && e.k !== state.focus) continue;
      const key = e.k + ":" + e.from; const a = agg.get(key) || { k: e.k, a: e.from, usd: 0, n: 0 }; a.usd += e.usd; a.n++; agg.set(key, a);
    }
    const tops = [...agg.values()].sort((a, b) => b.usd - a.usd).slice(0, 10);
    top.replaceChildren(...(tops.length ? tops.map((a, i) => h("a", { href: `#/scan/${a.a}/${a.k}` }, h("span", { class: "rk" }, String(i + 1).padStart(2, "0")), netIcon(a.k), h("code", {}, short(a.a, 5)), h("span", {}, `${a.n}× · ${fmtUsd(a.usd)}`)))
      : [empty(`No senders ≥ $${fmtNum(CFG.intel.smartMoneyUsd, 0)} in the window yet.`)]));

    const total = list.reduce((s, w) => s + w.usd, 0);
    stat.replaceChildren(h("div", {}, h("small", {}, "WHALES CAPTURED"), h("b", {}, String(list.length))), h("div", {}, h("small", {}, "TOTAL VALUE"), h("b", {}, fmtUsd(total))));
  }
  render();
  const iv = setInterval(render, 2500);
  const off = bus.on("focus", render);
  return () => { run = false; ro.disconnect(); clearInterval(iv); off(); };
}
