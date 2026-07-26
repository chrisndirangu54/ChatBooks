import { ClaudeTransactionAI, isClaudeParserConfigured } from "./claudeParser";
import { FallbackTransactionAI } from "./fallback";
import { RuleBasedTransactionAI } from "./parseTransaction";
import type { TransactionAIProvider } from "./types";

/**
 * **Server-side** parser: calls Claude directly.
 *
 * Import this from route handlers only — it pulls in the Anthropic SDK and
 * reads ANTHROPIC_API_KEY. Client components must use `@/lib/ai` instead,
 * which goes through the authenticated API route.
 *
 * Falls back to the keyword parser when Claude returns nothing, and skips it
 * entirely when no key is configured, so a deploy without the key degrades to
 * the old behaviour instead of failing every message.
 */
export const serverTransactionAI: TransactionAIProvider = isClaudeParserConfigured()
  ? new FallbackTransactionAI(new ClaudeTransactionAI(), new RuleBasedTransactionAI())
  : new RuleBasedTransactionAI();

export { isClaudeParserConfigured };
