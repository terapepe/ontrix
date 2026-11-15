// ONTRIX — transport layer (JSON-RPC + public REST) with direct → proxy failover
import { CFG, net, bus } from "./util.js";

const mode = {};      // per-network resolved transport: "direct" | "proxy"
const rpcIdx = {};    // per-network rpc url index (direct)
const latency = {};   // per-network last RPC latency ms
let rid = 1;

async function timed(url, opts) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), CFG.api.timeoutMs);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

async function postJson(url, body) {
  const r = await timed(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

/** Raw JSON-RPC call. Throws on RPC error. */
export async function rpc(k, method, params = []) {
  const n = net(k);
  const body = { jsonrpc: "2.0", id: rid++, method, params };
  const pref = mode[k] || (n.transport === "proxy" ? "proxy" : "direct");
  const t0 = performance.now();
  let json;

  const viaDirect = async () => {
    let err;
    for (let i = 0; i < n.rpcUrls.length; i++) {
      const idx = ((rpcIdx[k] || 0) + i) % n.rpcUrls.length;
      try { const j = await postJson(n.rpcUrls[idx], body); rpcIdx[k] = idx; return j; }
      catch (e) { err = e; }
    }
    throw err || new Error("rpc unreachable");
  };
  const viaProxy = () => postJson(`${CFG.api.rpcProxy}?net=${encodeURIComponent(k)}`, body);

  if (pref === "direct") {
    try { json = await viaDirect(); mode[k] = "direct"; }
    catch (e) {
      if (n.transport === "direct") throw e;
      json = await viaProxy(); mode[k] = "proxy";
    }
  } else {
    try { json = await viaProxy(); }
    catch (e) {
      if (n.transport === "proxy") throw e;
      json = await viaDirect(); mode[k] = "direct";
    }
  }
  latency[k] = Math.round(performance.now() - t0);
  bus.emit("rpc:latency", { k, ms: latency[k], via: mode[k] });
  if (json.error) throw new Error(json.error.message || "rpc error");
  return json.result;
}
export const rpcLatency = (k) => latency[k];
export const rpcVia = (k) => mode[k] || "—";

const proxyHosts = new Set();
/** GET JSON from a public API, falling back to /api/proxy (allowlisted hosts) on CORS/network failure. */
export async function xget(url, { proxyOnly = false } = {}) {
  const host = new URL(url).hostname;
  if (!proxyOnly && !proxyHosts.has(host)) {
    try {
      const r = await timed(url, { headers: { accept: "application/json" } });
      if (r.ok) return r.json();
      if (r.status === 404) throw Object.assign(new Error("not found"), { status: 404 });
      if (r.status < 500 && r.status !== 429) throw new Error("HTTP " + r.status);
    } catch (e) {
      if (e.status === 404) throw e;
    }
    proxyHosts.add(host);
  }
  const r = await timed(`${CFG.api.fetchProxy}?url=${encodeURIComponent(url)}`);
  if (!r.ok) throw Object.assign(new Error("HTTP " + r.status), { status: r.status });
  return r.json();
}

// ---------- native prices ----------
export const prices = {};
async function refreshPrices() {
  const syms = [...new Set(Object.values(CFG.networks).map((n) => n.priceSymbol))];
  await Promise.all(syms.map(async (s) => {
    try {
      const j = await xget(CFG.prices.url.replace("{SYM}", s));
      const v = parseFloat(j?.data?.amount);
      if (isFinite(v)) prices[s] = v;
    } catch {}
  }));
  bus.emit("prices", prices);
}
export function startPrices() { refreshPrices(); setInterval(refreshPrices, CFG.prices.refreshMs); return refreshPrices; }
export const usdOf = (k, amount) => { const p = prices[net(k).priceSymbol]; return p ? amount * p : null; };
