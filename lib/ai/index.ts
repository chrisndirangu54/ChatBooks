import { FallbackTransactionAI } from "./fallback";
import { HttpTransactionAI } from "./httpParser";
import { RuleBasedTransactionAI } from "./parseTransaction";
import type { TransactionAIProvider } from "./types";

/**
 * **Client-safe** parser used by the chat UI.
 *
 * Goes over HTTP to /api/ai/parse-transaction, which does the Claude call
 * server-side — the Anthropic SDK and the API key are deliberately absent from
 * this import graph, so neither can end up in the browser bundle.
 *
 * Route handlers should import `serverTransactionAI` from `@/lib/ai/server`
 * instead and skip the network hop.
 *
 * The keyword parser stays on as a last resort: offline, rate-limited, or
 * key-less, `"sold rice 1500"` still gets logged.
 */
export const transactionAI: TransactionAIProvider = new FallbackTransactionAI(
  new HttpTransactionAI(),
  new RuleBasedTransactionAI(),
);

export type { TransactionAIProvider } from "./types";
