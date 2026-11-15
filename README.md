# ONTRIX — On-chain Intelligence Matrix

ONTRIX-OS is a blockchain intelligence operating system: a live data room instead of a landing page.
Real wallets, real transactions, streamed from public nodes of **Solana, Robinhood Chain, Base and BNB Smart Chain**.

- Token: **ONTRIX ($ONT)** · X: [@ONTRIXdata](https://x.com/ONTRIXdata)
- Static frontend (HTML/CSS/vanilla JS modules, no build step) + two Vercel serverless relays in `/api`.
- No demo data anywhere: every number comes from on-chain RPC reads or public APIs. If a source is down, the UI says so.

## Modules

| # | Module | What it does |
|---|---|---|
| 01 | **Grid** | Live network map. Wallets = nodes, transactions = packets. Whale Activity, Smart Money Flow, Token Movement, Wallet Clusters, terminal log, radar sweep, node dossiers. |
| 02 | **Whale Radar** | Radar scope + feed of every native transfer ≥ `intel.whaleUsd`, top senders in the window. |
| 03 | **Wallet Scan** | Balance, size class, behaviour tags, $ONT balance, token holdings, counterparty map, recent activity, live-grid presence, watchlist. |
| 04 | **Tx Trace** | Decodes native + ERC-20 / SPL flows of a transaction; `FOLLOW →` walks the money hop by hop. |
| 05 | **Token Intel** | $ONT dossier (CA + copy) and any-token lookup: price, MC/FDV, liquidity, volume, buy/sell pressure, pools, on-chain supply, signals. |
| 06 | **Networks** | Per-chain telemetry: height, block/slot time, TPS, gas, epoch, RPC latency, tx/block sparkline. |
| 07 | **Docs** | User manual: intro, quick start, modes, metric definitions, data sources, operator config, FAQ. |

Global: omnibox (`/`) auto-detects wallet / tx hash / token; network filter (multi mode); CA chips with network icons and Copy CA; signal ticker (whales, $ONT transfers, watchlist hits).

## Configure — `ontrix.config.js`

Everything editable lives in **one file** (used by both the browser and the API functions). Edit on GitHub → Vercel redeploys.

| Key | Purpose |
|---|---|
| `token.name`, `token.symbol` | Token identity (ONTRIX / ONT) |
| `token.evm` | CA shared by Robinhood, Base, BSC (empty → "PENDING LAUNCH") |
| `token.sol` | Solana mint |
| `networks.<key>.ca` | Optional per-network CA override |
| `mode` | `"single"` or `"multi"` |
| `singleNetwork` | Any key of `networks` (`solana`, `robinhood`, `base`, `bsc`) — the UI takes that network's colour |
| `multiOrder` | Order of the 4 networks in multi mode |
| `networks.<key>` | name, colour, icon, RPC URLs, transport (`auto`/`direct`/`proxy`), poll speed, explorer, Blockscout API, DexScreener chain id |
| `social.x`, `social.telegram` | Rail links (empty → hidden) |
| `intel.*` | Whale / smart-money thresholds (USD), window, node cap, cluster size, wallet classes |
| `proxyAllowHosts` | Hosts the `/api/proxy` relay may fetch |

Adding a new chain: add an entry under `networks` (EVM or Solana type) plus an icon in `assets/networks/`.

### Optional env var (Vercel → Settings → Environment Variables)

| Name | Effect |
|---|---|
| `ETHERSCAN_API_KEY` | Enables BSC wallet history (Etherscan API V2) in Wallet Scan. Without it BSC scans show balance/nonce/holdings only. |

## Data sources

- Blocks, balances, receipts, supply: public JSON-RPC of each network (direct from the browser; falls back to `/api/rpc` relay when a node blocks CORS).
- Wallet history: Blockscout API v2 (Robinhood, Base), Solana RPC, Etherscan V2 (BSC, optional key).
- Token markets: DexScreener. Native prices: Coinbase spot.

## Run locally

```bash
python3 -m http.server 8000   # open http://localhost:8000
```
The `/api` relays only run on Vercel (or `vercel dev`); locally the app talks to RPCs directly.

## Structure

```
index.html            shell
ontrix.config.js      ALL settings
css/ontrix.css        design system
js/app.js             boot, shell, router
js/util.js · net.js   helpers, transport (RPC/REST, direct→relay), prices
js/chains.js          EVM + Solana block adapters
js/stream.js          live engine: graph, whales, metrics
js/map.js             canvas network map
js/ui.js              CA chips, terminal, signals, watchlist
js/modules/*.js       grid, radar, scan, trace, intel, nets, docs
api/rpc.js            read-only JSON-RPC relay (method allowlist)
api/proxy.js          GET relay for allowlisted public APIs
assets/               logo, favicon, network icons
```
