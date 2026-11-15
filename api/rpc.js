// Vercel serverless JSON-RPC relay: POST /api/rpc?net=<networkKey>
// Forwards the JSON-RPC body to the network's rpcUrls (from ontrix.config.js) with failover.
const CONFIG = require("../ontrix.config.js");

const ALLOWED_METHODS = new Set([
  // EVM (read-only)
  "eth_blockNumber", "eth_getBlockByNumber", "eth_getBlockByHash", "eth_getTransactionByHash",
  "eth_getTransactionReceipt", "eth_getBalance", "eth_getTransactionCount", "eth_getCode",
  "eth_call", "eth_gasPrice", "eth_chainId", "eth_getLogs",
  // Solana (read-only)
  "getSlot", "getBlock", "getBlockTime", "getBalance", "getSignaturesForAddress", "getTransaction",
  "getTokenAccountsByOwner", "getTokenSupply", "getAccountInfo", "getRecentPerformanceSamples",
  "getEpochInfo", "getTokenLargestAccounts", "getParsedTokenAccountsByOwner",
]);

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const net = CONFIG.networks[String(req.query.net || "")];
  if (!net) return res.status(400).json({ error: "unknown network" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  const calls = Array.isArray(body) ? body : [body];
  if (!body || !calls.length || calls.length > 20 || calls.some((c) => !c || !ALLOWED_METHODS.has(c.method))) {
    return res.status(400).json({ error: "method not allowed" });
  }

  let lastErr = "no rpc";
  for (const url of net.rpcUrls) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!r.ok) { lastErr = "upstream " + r.status; continue; }
      const json = await r.json();
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json(json);
    } catch (e) {
      lastErr = String(e && e.message || e);
    }
  }
  return res.status(502).json({ error: lastErr });
};
