// 07 DOCS — manual: introduction, quick start, module guides, metric definitions, data sources, config
import { CFG, h, net, activeNetworks, isMulti, caFor, fmtNum, esc } from "../util.js";

const sym = CFG.token.symbol;
const nets = () => activeNetworks().map((k) => net(k).name).join(", ");

const SECTIONS = [
  { id: "intro", t: "What is ONTRIX", html: () => `
    <p class="lead">${esc(CFG.brand.description)}</p>
    <p>Most crypto dashboards show you prices. ONTRIX shows you <b>behaviour</b>: who is moving money, how much, where it goes next and which wallets keep acting together. It is built like an operating system rather than a website — you land directly inside a live data room, not on a marketing page.</p>
    <div class="callout"><b>Everything you see is live.</b> ONTRIX reads blocks straight from public RPC nodes of each network and public market APIs. There is no simulated or sample data anywhere in the interface. If an uplink is down, the panel says so.</div>
    <h3>Who it is for</h3>
    <ul>
      <li><b>Traders</b> — spot whale transfers and buy/sell pressure before they show up on a chart.</li>
      <li><b>Researchers</b> — trace where funds went after an exploit, airdrop or large unlock.</li>
      <li><b>Communities</b> — watch your own token, your team wallets and your treasury in real time.</li>
      <li><b>Newcomers</b> — learn how blockchains actually move value by watching it happen.</li>
    </ul>` },
  { id: "quick", t: "Quick start (60 seconds)", html: () => `
    <ol class="steps">
      <li><b>Watch the Grid.</b> Each dot is a real wallet seen in a recent block, each moving packet is a real transaction. Red pulsing nodes are whales.</li>
      <li><b>Click any node.</b> A dossier opens with its activity on the grid. Press <kbd>DEEP SCAN</kbd> for the full profile.</li>
      <li><b>Search anything.</b> Press <kbd>/</kbd> and paste a wallet, a transaction hash or a token address. ONTRIX detects the type and the network automatically.</li>
      <li><b>Follow the money.</b> In <i>Tx Trace</i>, press <kbd>FOLLOW →</kbd> on any recipient to see where the funds went next.</li>
      <li><b>Set a watch.</b> Press <kbd>WATCH</kbd> on a wallet. Whenever it appears in a live block, a signal fires in the bottom ticker.</li>
    </ol>` },
  { id: "modes", t: "Network modes", html: () => `
    <p>ONTRIX runs in one of two modes, set by the operator in the config file.</p>
    <table><tr><th>Mode</th><th>Behaviour</th></tr>
      <tr><td><b>Single</b></td><td>The whole OS locks onto one network (any supported chain). The interface takes that network's colour, the Grid shows one large cluster and every search targets that chain.</td></tr>
      <tr><td><b>Multi</b></td><td>All four networks — Solana, Robinhood Chain, Base and BNB Smart Chain — stream in parallel. The Grid shows four clusters orbiting the ONTRIX core. Use the network filter next to the search bar to isolate one chain.</td></tr></table>
    <p>Current mode: <b>${isMulti() ? "Multi" : "Single"}</b> · active networks: <b>${esc(nets())}</b>.</p>` },
  { id: "grid", t: "01 · Grid", html: () => `
    <p>The live network map. ONTRIX samples the latest block of every active network on a fixed cadence and plots the most significant transactions of each block (whale transfers first, then token transfers, then the largest native transfers).</p>
    <ul>
      <li><b>Nodes</b> — wallets or contracts. Size grows with value moved and number of links.</li>
      <li><b>Edges</b> — a transfer between two wallets. They fade as they age.</li>
      <li><b>Packets</b> — chain-coloured = native coin, white = token transfer, red = whale transfer.</li>
      <li><b>Controls</b> — drag to pan, scroll to zoom, double-click to reset, click a node to open its dossier.</li>
    </ul>
    <p>The grid keeps up to ${CFG.intel.maxNodes} wallets in memory; the oldest ones are released as new activity arrives.</p>` },
  { id: "metrics", t: "Live metrics explained", html: () => `
    <p>All metrics are computed in your browser over a rolling <b>${CFG.intel.windowSec / 60}-minute window</b> of sampled blocks.</p>
    <table>
      <tr><th>Metric</th><th>Definition</th></tr>
      <tr><td><b>Whale Activity</b></td><td>Native-coin transfers worth at least <b>$${fmtNum(CFG.intel.whaleUsd, 0)}</b> (ETH, BNB or SOL valued at the live spot price). Count, total value and the latest one.</td></tr>
      <tr><td><b>Smart Money Flow</b></td><td>Value moved by wallets that made <b>two or more</b> moves of at least $${fmtNum(CFG.intel.smartMoneyUsd, 0)} inside the window — repeat, deliberate movers. Split into value sent to <i>contracts / DeFi</i> (swaps, deposits, deployments) versus value sent <i>to other wallets</i> (distribution, OTC, exchange deposits).</td></tr>
      <tr><td><b>Token Movement</b></td><td>Token transfers per minute. On EVM chains: direct ERC-20 <code>transfer</code>/<code>transferFrom</code> calls decoded from transaction calldata. On Solana: SPL token balance changes per transaction. The most-moved tokens are listed and clickable.</td></tr>
      <tr><td><b>Wallet Clusters</b></td><td>Groups of at least ${CFG.intel.clusterMin} wallets connected by transfers on the grid (connected components). Large clusters often indicate a distribution, a market maker, a bot network or a coordinated campaign.</td></tr>
    </table>
    <div class="callout warn">Metrics are based on <b>sampled</b> blocks, not every block ever produced. They describe live behaviour, not complete chain totals. Smart Money Flow is a behavioural heuristic, not financial advice.</div>` },
  { id: "radar", t: "02 · Whale Radar", html: () => `
    <p>A radar scope of every whale transfer captured. The closer a blip is to the center, the larger the transfer (rings at 1×, 3×, 10× and 100× the whale threshold). The angle is a fingerprint of the sending wallet, so repeated blips on the same bearing come from the same whale.</p>
    <p>The side panels list the whale feed (with one-click <kbd>TRACE</kbd>) and the top senders above $${fmtNum(CFG.intel.smartMoneyUsd, 0)} in the window.</p>` },
  { id: "scan", t: "03 · Wallet Scan", html: () => `
    <p>Paste any wallet. EVM addresses are scanned on every active EVM network at once; Solana addresses on Solana.</p>
    <ul>
      <li><b>Balance &amp; class</b> — native balance, token holdings with USD value where available and a size class: ${CFG.intel.tiers.map((t) => `${t.name} (≥ $${fmtNum(t.min, 0)})`).join(", ")}.</li>
      <li><b>Behaviour tags</b> — fresh wallet, active trader, high-frequency, contract/program, whale balance, $${sym} holder.</li>
      <li><b>Counterparty map</b> — the wallets it interacts with most, from its recent history.</li>
      <li><b>On grid</b> — whether the wallet was seen in the live stream and how much it moved.</li>
    </ul>
    <p>Transaction history uses Blockscout for Robinhood Chain and Base, the Solana RPC for Solana, and Etherscan V2 for BSC when the operator has configured an API key.</p>` },
  { id: "trace", t: "04 · Tx Trace", html: () => `
    <p>Paste a transaction hash (or Solana signature). ONTRIX finds the network automatically and decodes every value flow inside it: the native transfer plus all ERC-20 <code>Transfer</code> events (EVM), or all SOL and SPL balance changes (Solana).</p>
    <p>Press <kbd>FOLLOW →</kbd> next to a recipient to load its next outgoing moves, then keep clicking to walk the money trail hop by hop.</p>` },
  { id: "intel", t: "05 · Token Intel", html: () => `
    <p>The $${sym} dossier plus a lookup for any token on the active networks: price, market cap, FDV, liquidity, 24h volume, buy/sell pressure, per-timeframe changes, every pool, on-chain supply and live transfers captured on the grid.</p>
    <p>Automatic signals: buy or sell pressure (&gt;60% one side), high turnover (volume &gt; 3× liquidity), thin liquidity (&lt; $20K), new pair (&lt; 24h), 1h momentum spikes and dumps.</p>` },
  { id: "nets", t: "06 · Networks", html: () => `
    <p>Telemetry for each uplink: block height, block or slot time, transactions per block, estimated TPS, gas price and base fee (EVM), epoch progress (Solana), native price, RPC latency and transport (direct or relay), plus a live tx-per-block sparkline.</p>` },
  { id: "token", t: `$${sym} token`, html: () => {
    const rows = activeNetworks().map((k) => `<tr><td><img class="ni" src="${net(k).icon}" alt=""> ${esc(net(k).name)}</td><td><code>${esc(caFor(k) || "pending launch")}</code></td></tr>`).join("");
    return `<p><b>${esc(CFG.token.name)}</b> ($${sym}) is the native token of the ONTRIX intelligence network.</p>
      <table><tr><th>Network</th><th>Contract address</th></tr>${rows}</table>
      ${isMulti() ? `<p>In multi-network mode Robinhood Chain, Base and BSC share the same contract address; Solana has its own mint.</p>` : ""}
      <p>Official channels: <a href="${esc(CFG.social.x)}" target="_blank" rel="noopener">X ${esc(CFG.social.xHandle)}</a>${CFG.social.telegram ? ` · <a href="${esc(CFG.social.telegram)}" target="_blank" rel="noopener">Telegram</a>` : ""}. Always verify the CA against these channels before trading.</p>`;
  } },
  { id: "data", t: "Data sources", html: () => `
    <table>
      <tr><th>Data</th><th>Source</th></tr>
      ${activeNetworks().map((k) => `<tr><td>${esc(net(k).name)} blocks &amp; balances</td><td>Public RPC: <code>${esc(net(k).rpcUrls.join(", "))}</code></td></tr>`).join("")}
      <tr><td>Wallet history (Robinhood, Base)</td><td>Blockscout API v2</td></tr>
      <tr><td>Wallet history (BSC)</td><td>Etherscan API V2 (optional key, server-side)</td></tr>
      <tr><td>Token markets</td><td>DexScreener public API</td></tr>
      <tr><td>Native prices (ETH, BNB, SOL)</td><td>Coinbase public spot price</td></tr>
    </table>
    <p>Your browser talks to these sources directly. When a source blocks browser requests, ONTRIX automatically switches to its own read-only relay (<code>/api/rpc</code>, <code>/api/proxy</code>) for that source. ONTRIX never asks for a wallet connection, private key or signature.</p>` },
  { id: "config", t: "Operator config", html: () => `
    <p>Everything is controlled from a single file in the repository: <code>ontrix.config.js</code>. Edit it on GitHub and Vercel redeploys automatically.</p>
    <table>
      <tr><th>Key</th><th>Purpose</th><th>Current</th></tr>
      <tr><td><code>token.name / token.symbol</code></td><td>Token identity</td><td>${esc(CFG.token.name)} / ${esc(sym)}</td></tr>
      <tr><td><code>token.evm</code></td><td>CA shared by Robinhood, Base, BSC</td><td>${esc(CFG.token.evm || "—")}</td></tr>
      <tr><td><code>token.sol</code></td><td>Solana mint</td><td>${esc(CFG.token.sol || "—")}</td></tr>
      <tr><td><code>mode</code></td><td><code>"single"</code> or <code>"multi"</code></td><td>${esc(CFG.mode)}</td></tr>
      <tr><td><code>singleNetwork</code></td><td>Network used in single mode</td><td>${esc(CFG.singleNetwork)}</td></tr>
      <tr><td><code>multiOrder</code></td><td>Network order in multi mode</td><td>${esc(CFG.multiOrder.join(", "))}</td></tr>
      <tr><td><code>networks.&lt;key&gt;</code></td><td>Name, colour, icon, RPCs, explorer, poll speed, per-network <code>ca</code> override</td><td>${Object.keys(CFG.networks).join(", ")}</td></tr>
      <tr><td><code>social.x / social.telegram</code></td><td>Links in the rail (Telegram hidden when empty)</td><td>${esc(CFG.social.xHandle)}${CFG.social.telegram ? " · TG" : ""}</td></tr>
      <tr><td><code>intel.*</code></td><td>Whale / smart-money thresholds, window, node cap, wallet classes</td><td>whale $${fmtNum(CFG.intel.whaleUsd, 0)}</td></tr>
    </table>` },
  { id: "faq", t: "FAQ", html: () => `
    <details><summary>Do I need to connect a wallet?</summary><p>No. ONTRIX is read-only. It never requests a connection, signature or approval.</p></details>
    <details><summary>Why are some panels empty?</summary><p>They fill as live blocks arrive. A brand-new session needs a few seconds of streaming; whale panels stay empty until a transfer crosses the threshold.</p></details>
    <details><summary>Why does a network show OFFLINE?</summary><p>Its public RPC is rate-limiting or unreachable. ONTRIX retries automatically, falls back to backup RPCs and to the relay.</p></details>
    <details><summary>Is the data complete?</summary><p>Live metrics are built from sampled blocks to stay fast in a browser. Wallet scans and traces read the full on-chain record for the specific wallet or transaction.</p></details>
    <details><summary>Is anything here financial advice?</summary><p>No. Signals and classes are behavioural heuristics. Always do your own research.</p></details>` },
];

export function mount(root, [sec = "intro"]) {
  const toc = h("nav", { class: "toc" }, h("small", {}, "MANUAL"), SECTIONS.map((s) => h("a", { href: `#/docs/${s.id}`, class: s.id === sec ? "on" : "" }, s.t)));
  const body = h("article", { class: "doc" });
  SECTIONS.forEach((s) => body.append(h("section", { id: "d-" + s.id }, h("h2", {}, s.t), h("div", { html: s.html() }))));
  root.append(h("div", { class: "docs" }, toc, h("div", { class: "doc-wrap" },
    h("div", { class: "doc-hero" }, h("img", { src: "assets/logo.svg", alt: "" }), h("div", {}, h("small", {}, `${CFG.brand.system} v${CFG.brand.version} · OPERATOR MANUAL`), h("h1", {}, CFG.brand.name), h("p", {}, CFG.brand.tagline))),
    body)));
  requestAnimationFrame(() => { const el = document.getElementById("d-" + sec); if (el && sec !== "intro") el.scrollIntoView({ block: "start" }); });
}
