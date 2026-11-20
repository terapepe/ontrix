// ONTRIX — chain adapters. Normalize real blocks/transactions from each network.
import { net, hexToBig, unitsToFloat } from "./util.js";
import { rpc } from "./net.js";

const SEL_TRANSFER = "0xa9059cbb";
const SEL_TRANSFER_FROM = "0x23b872dd";
const VOTE_PROGRAM = "Vote111111111111111111111111111111111111111";
export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/** Decode ERC-20 transfer/transferFrom calldata → { token, from, to, raw } or null. */
export function decodeTokenCall(tx) {
  const input = tx.input || "";
  if (!tx.to || input.length < 138) return null;
  const sel = input.slice(0, 10).toLowerCase();
  if (sel === SEL_TRANSFER && input.length >= 138) {
    return { token: tx.to.toLowerCase(), from: tx.from.toLowerCase(), to: "0x" + input.slice(34, 74).toLowerCase(), raw: hexToBig("0x" + input.slice(74, 138)) };
  }
  if (sel === SEL_TRANSFER_FROM && input.length >= 202) {
    return { token: tx.to.toLowerCase(), from: "0x" + input.slice(34, 74).toLowerCase(), to: "0x" + input.slice(98, 138).toLowerCase(), raw: hexToBig("0x" + input.slice(138, 202)) };
  }
  return null;
}

// ---------------- EVM ----------------
async function evmLatest(k) {
  const b = await rpc(k, "eth_getBlockByNumber", ["latest", true]);
  if (!b) throw new Error("empty block");
  const txs = [];
  for (const t of b.transactions || []) {
    if (typeof t !== "object") continue;
    const value = unitsToFloat(hexToBig(t.value), 18);
    const input = t.input || "0x";
    txs.push({
      hash: t.hash,
      from: (t.from || "").toLowerCase(),
      to: t.to ? t.to.toLowerCase() : null,
      value,
      kind: !t.to ? "deploy" : input === "0x" || input.length <= 2 ? "transfer" : "contract",
      token: decodeTokenCall(t),
    });
  }
  return {
    k,
    number: Number(hexToBig(b.number)),
    ts: Number(hexToBig(b.timestamp)) * 1000,
    txs,
    txCount: txs.length,
    gasUsed: Number(hexToBig(b.gasUsed)),
    gasLimit: Number(hexToBig(b.gasLimit)),
    baseFeeGwei: b.baseFeePerGas ? unitsToFloat(hexToBig(b.baseFeePerGas), 9) : null,
  };
}

// ---------------- Solana ----------------
async function solLatest(k, lastSlot) {
  const head = await rpc(k, "getSlot", [{ commitment: "confirmed" }]);
  if (lastSlot && head <= lastSlot) return null;
  // The confirmed head is often not served by getBlock yet (-32004), and slots can be skipped
  // (-32007/-32009). Walk back over those; stop on transport/rate-limit errors and report them.
  const RETRYABLE = new Set([-32004, -32007, -32009, -32014]);
  const floor = lastSlot ? Math.max(lastSlot + 1, head - 12) : head - 12;
  let b = null, slot = head, lastErr = null;
  for (; slot >= floor && !b; slot--) {
    try {
      b = await rpc(k, "getBlock", [slot, { encoding: "json", transactionDetails: "accounts", maxSupportedTransactionVersion: 0, rewards: false, commitment: "confirmed" }]);
    } catch (e) {
      lastErr = e;
      if (!RETRYABLE.has(e.code)) break;
    }
  }
  if (!b) {
    if (lastSlot && (!lastErr || RETRYABLE.has(lastErr.code))) return null; // nothing servable since lastSlot yet
    throw new Error(`no block near slot ${head}` + (lastErr ? ` · ${lastErr.message}` : ""));
  }
  slot++;
  const txs = [];
  let votes = 0;
  for (const tx of b.transactions || []) {
    const keys = (tx.transaction?.accountKeys || []).map((a) => (typeof a === "string" ? a : a.pubkey));
    if (keys.includes(VOTE_PROGRAM)) { votes++; continue; }
    const m = tx.meta;
    if (!m || m.err) continue;
    const d = (m.postBalances || []).map((p, i) => p - (m.preBalances?.[i] || 0));
    if (d.length) d[0] += m.fee || 0;
    let toIdx = -1, best = 0;
    for (let i = 1; i < d.length; i++) if (d[i] > best) { best = d[i]; toIdx = i; }
    const value = best / 1e9;

    // SPL token movement
    let token = null;
    const pre = {}; for (const x of m.preTokenBalances || []) pre[x.accountIndex] = x;
    const changes = {};
    const seen = new Set([...Object.keys(pre), ...(m.postTokenBalances || []).map((x) => String(x.accountIndex))]);
    const post = {}; for (const x of m.postTokenBalances || []) post[x.accountIndex] = x;
    for (const idx of seen) {
      const a = pre[idx], z = post[idx];
      const mint = (z || a).mint, owner = (z || a).owner;
      const delta = (parseFloat(z?.uiTokenAmount?.uiAmountString || "0") || 0) - (parseFloat(a?.uiTokenAmount?.uiAmountString || "0") || 0);
      if (!delta) continue;
      (changes[mint] ||= []).push({ owner, delta });
    }
    const mints = Object.keys(changes);
    if (mints.length) {
      const mint = mints[0];
      const list = changes[mint].sort((x, y) => y.delta - x.delta);
      const recv = list[0], send = list.at(-1);
      token = { token: mint, from: send.delta < 0 ? send.owner : keys[0], to: recv.delta > 0 ? recv.owner : null, amount: Math.abs(recv.delta > 0 ? recv.delta : send.delta), mints: mints.length };
    }
    txs.push({
      hash: tx.transaction?.signatures?.[0],
      from: keys[0],
      to: toIdx > 0 ? keys[toIdx] : token?.to || null,
      value,
      kind: value > 0 ? "transfer" : "contract",
      token,
    });
  }
  return { k, number: b.blockHeight ?? slot, slot, ts: (b.blockTime || Date.now() / 1000) * 1000, txs, txCount: txs.length, votes };
}

export async function latestBlock(k, last) {
  return net(k).type === "solana" ? solLatest(k, last) : evmLatest(k);
}
