// Vercel serverless GET relay for allowlisted public APIs: GET /api/proxy?url=<encoded>
// Used when a public API blocks browser CORS. Adds ETHERSCAN_API_KEY for api.etherscan.io if set.
const CONFIG = require("../ontrix.config.js");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  let target;
  try { target = new URL(String(req.query.url || "")); } catch { return res.status(400).json({ error: "bad url" }); }
  if (target.protocol !== "https:" || !CONFIG.proxyAllowHosts.includes(target.hostname)) {
    return res.status(403).json({ error: "host not allowed" });
  }
  if (target.hostname === "api.etherscan.io") {
    const key = process.env.ETHERSCAN_API_KEY;
    if (!key) return res.status(501).json({ error: "ETHERSCAN_API_KEY not configured" });
    target.searchParams.set("apikey", key);
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch(target.toString(), { headers: { accept: "application/json" }, signal: ctrl.signal });
    clearTimeout(t);
    const text = await r.text();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
    return res.status(r.status).send(text);
  } catch (e) {
    return res.status(502).json({ error: String(e && e.message || e) });
  }
};
