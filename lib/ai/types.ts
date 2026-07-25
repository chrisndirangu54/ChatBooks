import type { ParsedTransaction } from "@/types";

export interface TransactionAIProvider {
  parseMessage(message: string, knownCategories: string[]): Promise<ParsedTransaction | null>;
}
