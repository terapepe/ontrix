(function (root) {
  const CONFIG = {
    brand: {
      name: "ONTRIX",
      system: "ONTRIX-OS",
      version: "1.0.0",
      tagline: "On-chain Intelligence Matrix",
      description:
        "ONTRIX is a blockchain intelligence operating system: live wallet networks, whale radar, money-flow tracing and token intel across Solana, Robinhood Chain, Base and BNB Smart Chain.",
    },

    token: {
      name: "ONTRIX-OS",
      symbol: "ONX",
      evm: "",
      sol: "",
    },

    social: {
      x: "https://x.com/ONTRIXdata",
      xHandle: "@ONTRIXdata",
      telegram: "",
    },

    mode: "single",
    singleNetwork: "robinhood",
    multiOrder: ["solana", "robinhood", "base", "bsc"],

    networks: {
      solana: {
        name: "Solana",
        short: "SOL",
        type: "solana",
        color: "#14F195",
        accent2: "#9945FF",
        icon: "assets/networks/solana.svg",
        tagline: "High-throughput L1 · sub-second slots",
        nativeSymbol: "SOL",
        priceSymbol: "SOL",
        rpcUrls: ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"],
        transport: "auto", // "auto" (direct, then proxy) | "direct" | "proxy"
        pollMs: 8000,
        explorer: "https://solscan.io",
        explorerTx: "/tx/",
        explorerAddr: "/account/",
        explorerToken: "/token/",
        dexscreenerId: "solana",
        ca: "", // overrides token.sol
      },
      robinhood: {
        name: "Robinhood Chain",
        short: "RH",
        type: "evm",
        chainId: 4663,
        color: "#CCFF00",
        icon: "assets/networks/robinhood.svg",
        tagline: "Arbitrum Orbit L2 built for trading",
        nativeSymbol: "ETH",
        priceSymbol: "ETH",
        rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"],
        transport: "auto",
        pollMs: 3000,
        explorer: "https://robinhoodchain.blockscout.com",
        explorerTx: "/tx/",
        explorerAddr: "/address/",
        explorerToken: "/token/",
        blockscoutApi: "https://robinhoodchain.blockscout.com/api/v2",
        dexscreenerId: "robinhood",
        ca: "", // overrides token.evm
      },
      base: {
        name: "Base",
        short: "BASE",
        type: "evm",
        chainId: 8453,
        color: "#2F6BFF",
        icon: "assets/networks/base.svg",
        tagline: "Coinbase L2 · OP Stack",
        nativeSymbol: "ETH",
        priceSymbol: "ETH",
        rpcUrls: ["https://mainnet.base.org", "https://base-rpc.publicnode.com"],
        transport: "auto",
        pollMs: 4000,
        explorer: "https://basescan.org",
        explorerTx: "/tx/",
        explorerAddr: "/address/",
        explorerToken: "/token/",
        blockscoutApi: "https://base.blockscout.com/api/v2",
        dexscreenerId: "base",
        ca: "",
      },
      bsc: {
        name: "BNB Smart Chain",
        short: "BSC",
        type: "evm",
        chainId: 56,
        color: "#F0B90B",
        icon: "assets/networks/bsc.svg",
        tagline: "High-volume EVM L1 · 0.75s blocks",
        nativeSymbol: "BNB",
        priceSymbol: "BNB",
        rpcUrls: ["https://bsc-dataseed.bnbchain.org", "https://bsc-rpc.publicnode.com"],
        transport: "auto",
        pollMs: 4500,
        explorer: "https://bscscan.com",
        explorerTx: "/tx/",
        explorerAddr: "/address/",
        explorerToken: "/token/",
        // No free Blockscout for BSC. Wallet history uses Etherscan V2 when the
        // ETHERSCAN_API_KEY env var is set on Vercel (see README).
        etherscanChainId: 56,
        dexscreenerId: "bsc",
        ca: "",
      },
    },

    /** Intelligence thresholds (USD). */
    intel: {
      whaleUsd: 100000,      // single transfer ≥ this → whale
      smartMoneyUsd: 10000,  // wallets repeating moves ≥ this inside the window → smart money
      windowSec: 300,        // rolling window for live metrics
      maxNodes: 360,         // live map node cap (oldest evicted)
      clusterMin: 3,         // min wallets for a cluster
      tiers: [               // wallet classification by tracked USD value
        { name: "Leviathan", min: 10000000 },
        { name: "Whale", min: 1000000 },
        { name: "Shark", min: 100000 },
        { name: "Dolphin", min: 10000 },
        { name: "Fish", min: 1000 },
        { name: "Shrimp", min: 0 },
      ],
    },

    /** Native USD prices (public, no key). */
    prices: {
      url: "https://api.coinbase.com/v2/prices/{SYM}-USD/spot",
      refreshMs: 60000,
    },

    /** Hosts the /api/proxy function may fetch (server-side allowlist). */
    proxyAllowHosts: [
      "api.dexscreener.com",
      "api.coinbase.com",
      "robinhoodchain.blockscout.com",
      "base.blockscout.com",
      "api.etherscan.io",
    ],

    api: {
      rpcProxy: "/api/rpc",
      fetchProxy: "/api/proxy",
      timeoutMs: 12000,
    },
  };

  if (typeof module !== "undefined" && module.exports) module.exports = CONFIG;
  else root.ONTRIX_CONFIG = CONFIG;
})(typeof window !== "undefined" ? window : globalThis);

/* ---- hybot sync: CA, token name, symbol, X and Telegram follow the newest token hybot launched for this site ----
   https://hybot.xyz/api/site-token?site=<domain> · values above are the fallback when hybot has none / is unreachable.
   Links in the page that point to the old X / Telegram are updated, or hidden when the launched token has none. */
(function (C) {
  if (!C || typeof window === "undefined") return;
  var DOMAIN = "ontrix.work";
  var host = String(location.hostname || "").replace(/^www\./, "");
  var site = /\./.test(host) && !/(^|\.)(vercel\.app|localhost|127\.0\.0\.1)$/.test(host) ? host : DOMAIN;
  if (!site) return;
  var d = null, key = "hybot:" + site;
  try { var c = JSON.parse(localStorage.getItem(key) || "null"); if (c && Date.now() - c.t < 60000) d = c.d; } catch (e) {}
  if (!d) {
    try {
      var x = new XMLHttpRequest();
      x.open("GET", "https://hybot.xyz/api/site-token?site=" + encodeURIComponent(site), false); // sync: config must be ready before the app scripts run
      x.send();
      if (x.status === 200) { d = JSON.parse(x.responseText); try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {} }
    } catch (e) {}
  }
  if (!d || !d.found || !/^0x[0-9a-fA-F]{40}$/.test(d.ca || "")) return;
  var handle = function (u) { var m = String(u || "").match(/(?:x|twitter)\.com\/@?([A-Za-z0-9_]{1,15})|^@?([A-Za-z0-9_]{1,15})$/); return m ? (m[1] || m[2]) : ""; };
  var tgName = function (u) { var m = String(u || "").match(/t\.me\/([\w+/-]+)/); return m ? m[1].replace(/\/+$/, "") : String(u || "").replace(/^@/, ""); };
  var X0 = C.social && C.social.x || "", TG0 = C.social && C.social.telegram || "";
  var oldX = handle(X0), oldTg = tgName(TG0);
  var X = d.x || "", TG = d.telegram || "", SYM = d.symbol, NAME = d.name, CA = d.ca;
  // no X / Telegram on the launched token → config keeps the old link so the app renders as usual, and the link fixer below hides it
  var XV = X || X0, TGV = TG || TG0, XH = handle(XV);
  // network from hybot (Pons launches → mode "single" on robinhood); this site keeps mode/network on C
  var NK = C;
  NK.mode = d.mode || "single";
  if ("singleChain" in NK) NK.singleChain = d.singleNetwork || "robinhood"; else NK.singleNetwork = d.singleNetwork || "robinhood";
  NK.primaryNetwork = d.primaryNetwork || d.singleNetwork || "robinhood";
  // single-network per-chain CA overrides would win over the shared address → clear them
  var net = C.singleNetwork || C.singleChain || (C.token && C.token.singleNetwork);
  [C.networks, C.chains, C.token && C.token.chains].forEach(function (m) { if (m && net && m[net] && "ca" in m[net]) m[net].ca = ""; });
  C.token.name = NAME; C.token.symbol = SYM; C.token.evm = CA;
  C.social.x = XV; C.social.xHandle = XH ? "@" + XH : ""; C.social.telegram = TGV;
  // page links still pointing to the old X / Telegram (hard-coded or rendered later)
  var fix = function (root) {
    var as = root.querySelectorAll ? root.querySelectorAll("a[href]") : [];
    for (var i = 0; i < as.length; i++) {
      var a = as[i], h = a.getAttribute("href") || "";
      if (oldX && new RegExp("(x|twitter)\\.com/@?" + oldX + "(?![A-Za-z0-9_])", "i").test(h) && !/intent|share/i.test(h)) {
        if (X) { if (h !== X) { a.href = X; if (XH && oldX !== XH) a.innerHTML = a.innerHTML.split("@" + oldX).join("@" + XH); } }
        else a.style.display = "none";
      } else if (oldTg && /t\.me\//i.test(h) && tgName(h).toLowerCase() === oldTg.toLowerCase()) {
        if (TG) { if (h !== TG) a.href = TG; } else a.style.display = "none";
      }
    }
  };
  var start = function () { fix(document); new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) { fix(n); if (n.matches && n.matches("a[href]")) fix(n.parentNode || n); } }); }); }).observe(document.documentElement, { childList: true, subtree: true }); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window.ONTRIX_CONFIG : null);
