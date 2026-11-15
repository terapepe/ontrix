/**
 * ONTRIX — single source of truth.
 * Edit this file on GitHub; Vercel redeploys automatically.
 * Used by the browser (window.ONTRIX_CONFIG) and by the Vercel API functions (require).
 */
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

    /** $ONT token. Fill the CA after launch. */
    token: {
      name: "ONTRIX",
      symbol: "ONT",
      // Contract address shared by all EVM networks (Robinhood, Base, BSC). Leave "" until launch.
      evm: "",
      // Mint address on Solana. Leave "" until launch.
      sol: "",
    },

    social: {
      x: "https://x.com/ONTRIXdata",
      xHandle: "@ONTRIXdata",
      telegram: "", // e.g. "https://t.me/ontrix" — hidden when empty
      github: "https://github.com/terapepe/ontrix",
    },

    /**
     * Network mode
     *  "single" → only `singleNetwork` is shown and themed (any key from `networks`)
     *  "multi"  → always all 4 networks (Solana, Robinhood, Base, BSC) in `multiOrder`
     */
    mode: "multi",
    singleNetwork: "base",
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
