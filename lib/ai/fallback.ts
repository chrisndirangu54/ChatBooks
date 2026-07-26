import type { ParsedTransaction } from "@/types";
import type { TransactionAIProvider } from "./types";

/**
 * Tries providers in order and takes the first that returns a transaction.
 *
 * The point is graceful degradation: if Claude is unreachable, rate-limited, or
 * unconfigured, the keyword parser still catches the common
 * `"sold rice 1500"` shape rather than the owner getting an error in a chat.
 *
 * A provider signals "I have nothing" by returning null — which is also how it
 * signals "this genuinely isn't a transaction". Those two cases are
 * indistinguishable here, so a greeting will fall through to the rule-based
 * parser too; that parser also finds nothing without a number, so the outcome
 * is the same. The cost is one wasted call on non-transaction messages.
 */
export class FallbackTransactionAI implements TransactionAIProvider {
  private readonly providers: TransactionAIProvider[];

  constructor(...providers: TransactionAIProvider[]) {
    this.providers = providers;
  }

  async parseMessage(
    message: string,
    knownCategories: string[],
  ): Promise<ParsedTransaction | null> {
    for (const provider of this.providers) {
      try {
        const parsed = await provider.parseMessage(message, knownCategories);
        if (parsed) return parsed;
      } catch (error) {
        // A provider that throws instead of returning null shouldn't take the
        // whole chain down with it.
        console.error("[ChatBooks AI] Provider threw; trying the next one:", error);
      }
    }
    return null;
  }
}
