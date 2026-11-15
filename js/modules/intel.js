// 05 TOKEN INTEL — $ONT dossier + any-token lookup (DexScreener market data + on-chain supply)
import { CFG, h, net, activeNetworks, caFor, short, fmtUsd, fmtNum, fmtPrice, fmtInt, explorerUrl, netIcon, ago, copyText, hexToBig, unitsToFloat, isEvmAddr, isSolAddr } from "../util.js";
import { rpc, xget } from "../net.js";
import { state } from "../stream.js";
import { panel, empty, toast } from "../ui.js";

const DS = "https://api.dexscreener.com/latest/dex";
const keyByDs = () => Object.fromEntries(activeNetworks().map((k) => [net(k).dexscreenerId, k]));

export function mount(root, [kind = "", a = "", b = ""]) {
  const input = h("input", { type: "text", spellcheck: "false", placeholder: "token CA, symbol or name" });
  const out = h("div", { class: "intel-out" });
  root.append(h("div", { class: "page" },
    h("div", { class: "page-h" }, h("span", { class: "code" }, "05"), h("h1", {}, "TOKEN INTEL"), h("p", {}, `Market structure, liquidity and live on-chain movement for $${CFG.token.symbol} and any token on the active networks.`)),
    h("form", { class: "qbar", onsubmit: (e) => { e.preventDefault(); const v = input.value.trim(); if (v) location.hash = `#/intel/search/${encodeURIComponent(v)}`; } }, h("span", { class: "pr" }, "INTEL>"), input, h("button", {}, "RUN")),
    out));
  if (kind === "token" && a && b) tokenView(out, a, b);
  else if (kind === "search" && a) searchView(out, a);
  else home(out);
}

// ---------- home: $ONT dossier ----------
async function home(out) {
  const groups = new Map();
  for (const k of activeNetworks()) { const ca = caFor(k); const g = groups.get(ca || "_" + net(k).type) || { ca, keys: [] }; g.keys.push(k); groups.set(ca || "_" + net(k).type, g); }
  const ont = h("div", { class: "ont" },
    h("div", { class: "ont-id" }, h("img", { src: "assets/logo.svg", alt: "" }),
      h("div", {}, h("h2", {}, `${CFG.token.name} `, h("span", {}, `$${CFG.token.symbol}`)), h("p", {}, CFG.brand.description))),
    h("div", { class: "ont-cas" }, [...groups.values()].map((g) => h("div", { class: "ont-ca" },
      h("span", { class: "ca-icons" }, g.keys.map((k) => netIcon(k))),
      h("div", {}, h("small", {}, g.keys.map((k) => net(k).name).join(" · ")), h("code", {}, g.ca || "Contract address — pending launch")),
      g.ca ? h("button", { class: "btn", onclick: async () => { await copyText(g.ca); toast("CA copied"); } }, "COPY") : null,
      g.ca ? h("a", { class: "btn pri", href: `#/intel/token/${g.keys[0]}/${g.ca}` }, "OPEN DOSSIER") : null))));
  out.append(panel(`$${CFG.token.symbol} DOSSIER`, "PRIMARY ASSET", ont));

  const hasCa = [...groups.values()].some((g) => g.ca);
  if (!hasCa) out.append(panel("LAUNCH STATUS", "STANDBY", h("p", { class: "muted" }, `The $${CFG.token.symbol} contract is not live yet. Market data, holders and live transfer alerts activate automatically once the CA is set in the config. Follow `, h("a", { href: CFG.social.x, target: "_blank", rel: "noopener" }, CFG.social.xHandle), " for the launch signal.")));

  const live = h("div", { class: "toplist big-list" });
  const paint = () => {
    const m = state.metrics?.token;
    live.replaceChildren(...(m?.top?.length ? m.top.map((t, i) => h("a", { href: `#/intel/token/${t.k}/${t.token}` }, h("span", { class: "rk" }, String(i + 1).padStart(2, "0")), netIcon(t.k), h("code", {}, short(t.token, 6)), h("span", {}, `${t.count} transfers`)))
      : [empty("Collecting token transfers from live blocks…")]));
  };
  paint();
  const iv = setInterval(() => { if (!live.isConnected) return clearInterval(iv); paint(); }, 3000);
  out.append(panel("MOST MOVED TOKENS", `LIVE · ${CFG.intel.windowSec / 60} MIN`, live));
}

// ---------- search ----------
async function searchView(out, q) {
  if (isEvmAddr(q) || isSolAddr(q)) {
    const keys = activeNetworks().filter((k) => (isEvmAddr(q) ? net(k).type === "evm" : net(k).type === "solana"));
    try {
      const j = await xget(`${DS}/tokens/${q}`);
      const map = keyByDs();
      const p = (j.pairs || []).find((x) => map[x.chainId]);
      if (p) { tokenView(out, map[p.chainId], q); return; }
    } catch {}
    if (keys.length) { tokenView(out, keys[0], q); return; }
  }
  const box = h("div", { class: "scanning" }, "querying markets…");
  out.append(box);
  try {
    const j = await xget(`${DS}/search?q=${encodeURIComponent(q)}`);
    const map = keyByDs();
    const pairs = (j.pairs || []).filter((p) => map[p.chainId]).slice(0, 30);
    box.replaceWith(panel(`RESULTS · "${q}"`, `${pairs.length} PAIRS`, pairs.length ? pairsTable(pairs, map, true) : empty("No pairs found on the active networks.")));
  } catch (e) { box.replaceWith(h("div", { class: "err" }, "Search failed: " + e.message)); }
}

function pairsTable(pairs, map, link) {
  return h("div", { class: "tbl" },
    h("div", { class: "tr th" }, ["PAIR", "NET", "PRICE", "LIQUIDITY", "VOL 24H", "24H", "AGE"].map((x) => h("span", {}, x))),
    pairs.map((p) => {
      const k = map[p.chainId];
      const ch = p.priceChange?.h24;
      return h(link ? "a" : "div", { class: "tr", href: link ? `#/intel/token/${k}/${p.baseToken.address}` : null },
        h("span", {}, h("b", {}, p.baseToken.symbol), `/${p.quoteToken.symbol} `, h("small", {}, p.dexId)),
        h("span", {}, netIcon(k)),
        h("span", {}, fmtPrice(parseFloat(p.priceUsd))),
        h("span", {}, fmtUsd(p.liquidity?.usd)),
        h("span", {}, fmtUsd(p.volume?.h24)),
        h("span", { class: ch > 0 ? "up" : ch < 0 ? "down" : "" }, ch != null ? ch.toFixed(1) + "%" : "—"),
        h("span", {}, p.pairCreatedAt ? ago(p.pairCreatedAt) : "—"));
    }));
}

// ---------- token dossier ----------
async function tokenView(out, k, addr) {
  const n = net(k);
  const box = h("div", { class: "scanning" }, `pulling market + supply for ${short(addr, 5)} on ${n.name}…`);
  out.append(box);
  const [ds, sup] = await Promise.allSettled([xget(`${DS}/tokens/${addr}`), supply(k, addr)]);
  const pairs = ds.status === "fulfilled" ? (ds.value.pairs || []).filter((p) => p.chainId === n.dexscreenerId) : [];
  pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
  const p = pairs[0];
  const s = sup.status === "fulfilled" ? sup.value : null;
  const isOnt = caFor(k) && caFor(k).toLowerCase() === addr.toLowerCase();
  const liq = pairs.reduce((a, x) => a + (x.liquidity?.usd || 0), 0);
  const vol = pairs.reduce((a, x) => a + (x.volume?.h24 || 0), 0);
  const buys = pairs.reduce((a, x) => a + (x.txns?.h24?.buys || 0), 0), sells = pairs.reduce((a, x) => a + (x.txns?.h24?.sells || 0), 0);
  const seen = state.events.filter((e) => e.k === k && e.token && e.token.token.toLowerCase() === addr.toLowerCase());

  const sym = p?.baseToken?.symbol || s?.symbol || short(addr, 4);
  const name = p?.baseToken?.name || s?.name || "";
  const signals = [];
  if (p) {
    if (buys + sells > 0) signals.push(buys / (buys + sells) > 0.6 ? ["BUY PRESSURE", "good"] : sells / (buys + sells) > 0.6 ? ["SELL PRESSURE", "bad"] : ["BALANCED FLOW", ""]);
    if (liq && vol / liq > 3) signals.push(["HIGH TURNOVER", "warn"]);
    if (liq && liq < 20000) signals.push(["THIN LIQUIDITY", "bad"]);
    if (p.pairCreatedAt && Date.now() - p.pairCreatedAt < 86400000) signals.push(["NEW PAIR < 24H", "warn"]);
    if ((p.priceChange?.h1 || 0) > 15) signals.push(["MOMENTUM SPIKE 1H", "good"]);
    if ((p.priceChange?.h1 || 0) < -15) signals.push(["DUMP 1H", "bad"]);
  }

  box.replaceWith(h("div", { class: "tokv", style: `--c:${n.color}` },
    h("div", { class: "target" },
      h("div", { class: "tok-id" }, p?.info?.imageUrl ? h("img", { src: p.info.imageUrl, alt: "" }) : isOnt ? h("img", { src: "assets/logo.svg", alt: "" }) : null,
        h("div", {}, h("h2", {}, sym, isOnt ? h("em", { class: "tag-ont" }, "ONTRIX") : null), h("small", {}, name))),
      h("div", { class: "row" }, h("span", { class: "nb", style: `--c:${n.color}` }, netIcon(k), n.short), h("code", {}, short(addr, 6)),
        h("button", { class: "btn", onclick: async () => { await copyText(addr); toast("CA copied"); } }, "COPY CA"),
        h("a", { class: "btn", href: explorerUrl(k, "token", addr), target: "_blank", rel: "noopener" }, "EXPLORER ↗"),
        p ? h("a", { class: "btn", href: p.url, target: "_blank", rel: "noopener" }, "CHART ↗") : null)),
    h("div", { class: "tags" }, signals.map(([t, c]) => h("em", { class: c }, t))),
    h("div", { class: "stats" },
      st("PRICE", p ? fmtPrice(parseFloat(p.priceUsd)) : "—", p ? chg(p.priceChange) : "no market"),
      st("MARKET CAP", fmtUsd(p?.marketCap ?? p?.fdv), p?.fdv ? "FDV " + fmtUsd(p.fdv) : ""),
      st("LIQUIDITY", fmtUsd(liq || null), `${pairs.length} pairs`),
      st("VOLUME 24H", fmtUsd(vol || null), `${fmtInt(buys)} buys · ${fmtInt(sells)} sells`),
      st("SUPPLY", s ? fmtNum(s.supply) : "—", s ? `${s.decimals} decimals · on-chain` : ""),
      st("LIVE GRID", `${seen.length} transfers`, `last ${CFG.intel.windowSec / 60} min`)),
    buys + sells ? h("div", { class: "pressure" }, h("i", { style: `width:${(buys / (buys + sells)) * 100}%` }), h("span", {}, `BUYS ${((buys / (buys + sells)) * 100).toFixed(0)}%`), h("span", {}, `SELLS ${((sells / (buys + sells)) * 100).toFixed(0)}%`)) : null,
    p ? h("div", { class: "tf" }, ["m5", "h1", "h6", "h24"].map((tf) => h("div", {}, h("small", {}, tf.toUpperCase()), h("b", { class: (p.priceChange?.[tf] || 0) >= 0 ? "up" : "down" }, p.priceChange?.[tf] != null ? p.priceChange[tf].toFixed(2) + "%" : "—"), h("span", {}, `${fmtUsd(p.volume?.[tf])} vol`), h("span", {}, `${p.txns?.[tf]?.buys ?? "—"}B / ${p.txns?.[tf]?.sells ?? "—"}S`)))) : null,
    pairs.length ? panel("POOLS", `${pairs.length}`, pairsTable(pairs, { [n.dexscreenerId]: k }, false)) : panel("POOLS", "NONE", empty("No DEX pools indexed for this token on " + n.name + " yet.")),
    seen.length ? panel("LIVE TRANSFERS", "GRID", h("div", { class: "txl" }, seen.slice(-15).reverse().map((e) => h("div", { class: "tx" }, h("a", { href: `#/trace/${e.hash}` }, short(e.hash, 6)), h("a", { href: `#/scan/${e.token.from}/${k}` }, short(e.token.from)), h("span", {}, "→"), h("a", { href: `#/scan/${e.token.to}/${k}` }, short(e.token.to)), h("small", {}, ago(e.ts)))))) : null));
}
const st = (l, v, s) => h("div", { class: "st" }, h("small", {}, l), h("b", {}, v), typeof s === "string" ? h("span", {}, s) : s);
function chg(pc) { const v = pc?.h24; return h("span", { class: v > 0 ? "up" : v < 0 ? "down" : "" }, v != null ? `${v > 0 ? "+" : ""}${v.toFixed(2)}% 24h` : ""); }

async function supply(k, addr) {
  if (net(k).type === "solana") {
    const r = await rpc(k, "getTokenSupply", [addr]);
    return { supply: parseFloat(r.value.uiAmountString), decimals: r.value.decimals };
  }
  const [ts, dec] = await Promise.all([rpc(k, "eth_call", [{ to: addr, data: "0x18160ddd" }, "latest"]), rpc(k, "eth_call", [{ to: addr, data: "0x313ce567" }, "latest"])]);
  const d = Number(hexToBig(dec)) || 18;
  return { supply: unitsToFloat(hexToBig(ts), d), decimals: d };
}
