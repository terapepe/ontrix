// 06 NETWORKS — live telemetry per chain (block height, cadence, throughput, fees, uplink)
import { CFG, h, net, bus, activeNetworks, isMulti, fmtNum, fmtInt, fmtUsd, netIcon, caFor, short, hexToBig, unitsToFloat } from "../util.js";
import { rpc, rpcLatency, rpcVia, prices } from "../net.js";
import { state } from "../stream.js";

export function mount(root) {
  const keys = activeNetworks();
  const extra = {};
  const grid = h("div", { class: "nets" + (isMulti() ? "" : " single") });
  root.append(h("div", { class: "page" },
    h("div", { class: "page-h" }, h("span", { class: "code" }, "06"), h("h1", {}, "NETWORKS"), h("p", {}, isMulti() ? "Multi-network mode: four uplinks monitored in parallel. Robinhood Chain, Base and BSC share one $" + CFG.token.symbol + " contract address." : `Single-network mode: ONTRIX is locked on ${net(keys[0]).name}.`)),
    grid));

  const cards = {};
  for (const k of keys) {
    const n = net(k);
    const c = h("div", { class: "netcard", style: `--c:${n.color}` },
      h("div", { class: "nh" }, h("img", { src: n.icon, alt: "" }), h("div", {}, h("h2", {}, n.name), h("small", {}, n.tagline)), h("span", { class: "upl" }, "LINKING")),
      h("div", { class: "nstats" }),
      h("canvas", { class: "spark" }),
      h("div", { class: "nfoot" },
        h("span", {}, n.type === "solana" ? "SVM" : `EVM · chainId ${n.chainId}`),
        h("span", {}, `native ${n.nativeSymbol}`),
        h("span", {}, `$${CFG.token.symbol}: ${caFor(k) ? short(caFor(k), 4) : "pending"}`),
        h("a", { href: n.explorer, target: "_blank", rel: "noopener" }, "EXPLORER ↗")));
    cards[k] = c; grid.append(c);
  }

  async function poll() {
    await Promise.all(keys.map(async (k) => {
      const e = (extra[k] ||= {});
      try {
        if (net(k).type === "solana") {
          const [perf, ep] = await Promise.all([rpc(k, "getRecentPerformanceSamples", [6]), rpc(k, "getEpochInfo", [])]);
          const tot = perf.reduce((s, p) => s + p.samplePeriodSecs, 0);
          e.tps = perf.reduce((s, p) => s + p.numTransactions, 0) / tot;
          e.userTps = perf[0]?.numNonVoteTransactions != null ? perf.reduce((s, p) => s + p.numNonVoteTransactions, 0) / tot : null;
          e.slotTime = tot / perf.reduce((s, p) => s + p.numSlots, 0);
          e.epoch = ep.epoch; e.epochPct = ep.slotIndex / ep.slotsInEpoch;
        } else {
          e.gasGwei = unitsToFloat(hexToBig(await rpc(k, "eth_gasPrice", [])), 9);
        }
      } catch {}
    }));
    paint();
  }

  function paint() {
    for (const k of keys) {
      const n = net(k), st = state.nets[k] || {}, e = extra[k] || {}, c = cards[k];
      const p = prices[n.priceSymbol];
      const age = st.lastSeen ? Math.round((Date.now() - st.lastSeen) / 1000) : null;
      const rows = n.type === "solana"
        ? [["SLOT", fmtInt(st.slot)], ["BLOCK HEIGHT", fmtInt(st.height)], ["SLOT TIME", e.slotTime ? e.slotTime.toFixed(3) + "s" : "—"], ["TPS (ALL)", fmtNum(e.tps, 0)], ["TPS (USER)", fmtNum(e.userTps, 0)], ["EPOCH", e.epoch != null ? `${e.epoch} · ${(e.epochPct * 100).toFixed(1)}%` : "—"], ["USER TX / BLOCK", fmtInt(st.txPerBlock)], ["SOL PRICE", p ? "$" + p.toFixed(2) : "—"]]
        : [["BLOCK", fmtInt(st.height)], ["BLOCK TIME", st.blockTime ? st.blockTime.toFixed(2) + "s" : "—"], ["TX / BLOCK", fmtInt(st.txPerBlock)], ["EST. TPS", fmtNum(st.tps, 0)], ["GAS PRICE", e.gasGwei != null ? fmtNum(e.gasGwei, 3) + " gwei" : "—"], ["BASE FEE", st.baseFeeGwei != null ? fmtNum(st.baseFeeGwei, 4) + " gwei" : "—"], ["GAS USED", st.gasLimit ? ((st.gasUsed / st.gasLimit) * 100).toFixed(1) + "%" : "—"], [`${n.nativeSymbol} PRICE`, p ? "$" + p.toFixed(2) : "—"]];
      const m = state.metrics?.perNet?.[k];
      rows.push(["WHALES (WINDOW)", fmtInt(m?.whales)], ["NATIVE FLOW (WINDOW)", fmtUsd(m?.usd)], ["RPC LATENCY", rpcLatency(k) ? rpcLatency(k) + " ms · " + rpcVia(k) : "—"], ["LAST BLOCK SEEN", age != null ? age + "s ago" : "—"]);
      c.querySelector(".nstats").replaceChildren(...rows.map(([l, v]) => h("div", {}, h("small", {}, l), h("b", {}, v))));
      const up = c.querySelector(".upl");
      up.textContent = st.ok ? (age > 60 ? "STALLED" : "ONLINE") : st.err ? "OFFLINE" : "LINKING";
      up.className = "upl " + (st.ok ? (age > 60 ? "warn" : "ok") : st.err ? "bad" : "");
      spark(c.querySelector(".spark"), st.hist || [], n.color);
    }
  }

  poll();
  const iv = setInterval(poll, 15000);
  const iv2 = setInterval(paint, 2000);
  const off = bus.on("net", paint);
  return () => { clearInterval(iv); clearInterval(iv2); off(); };
}

function spark(cv, data, color) {
  const r = cv.getBoundingClientRect(); if (!r.width) return;
  const d = Math.min(devicePixelRatio || 1, 2);
  cv.width = r.width * d; cv.height = r.height * d;
  const ctx = cv.getContext("2d"); ctx.scale(d, d);
  ctx.strokeStyle = "rgba(101,245,193,.12)";
  for (let y = 0; y < r.height; y += 10) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(r.width, y); ctx.stroke(); }
  if (data.length < 2) { ctx.fillStyle = "#5b7471"; ctx.font = "10px 'JetBrains Mono', monospace"; ctx.fillText("collecting tx/block samples…", 6, r.height / 2); return; }
  const max = Math.max(...data, 1);
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
  data.forEach((v, i) => { const x = (i / (data.length - 1)) * r.width, y = r.height - (v / max) * (r.height - 6) - 3; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.stroke();
  ctx.lineTo(r.width, r.height); ctx.lineTo(0, r.height); ctx.closePath();
  ctx.fillStyle = color + "22"; ctx.fill();
  ctx.fillStyle = "#8aa3a0"; ctx.font = "10px 'JetBrains Mono', monospace"; ctx.fillText(`tx/block · peak ${max}`, 6, 12);
}
