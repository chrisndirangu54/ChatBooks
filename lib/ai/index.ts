import { RuleBasedTransactionAI } from "./parseTransaction";
import type { TransactionAIProvider } from "./types";

/**
 * Single swap point for the AI layer. Replace with a Claude/OpenAI-backed
 * provider (structured tool call returning the same ParsedTransaction shape)
 * without touching any calling code.
 */
export const transactionAI: TransactionAIProvider = new RuleBasedTransactionAI();

export type { TransactionAIProvider } from "./types";
