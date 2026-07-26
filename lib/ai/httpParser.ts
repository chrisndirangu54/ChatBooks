import { auth } from "@/lib/firebase";
import type { ParsedTransaction } from "@/types";
import type { TransactionAIProvider } from "./types";
import { normalizeExtraction } from "./normalize";

/**
 * Browser-side provider. Posts the message to /api/ai/parse-transaction, which
 * holds the API key and does the actual Claude call.
 *
 * It attaches the signed-in user's Firebase ID token itself rather than taking
 * one as an argument, which keeps `TransactionAIProvider` unchanged — so the
 * chat page's call site didn't have to move.
 *
 * The response is re-validated through the same normalizer the server uses.
 * That's not redundant paranoia: this is a network boundary, and the amount
 * that comes back is about to be written into someone's books.
 */
export class HttpTransactionAI implements TransactionAIProvider {
  async parseMessage(
    message: string,
    knownCategories: string[],
  ): Promise<ParsedTransaction | null> {
    const user = auth.currentUser;
    if (!user) return null;

    const token = await user.getIdToken();

    const response = await fetch("/api/ai/parse-transaction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message, categories: knownCategories }),
    });

    if (!response.ok) {
      // Returning null rather than throwing lets the caller fall through to the
      // rule-based parser, so a 429 or a cold start degrades instead of failing.
      console.warn(`[ChatBooks AI] parse route returned ${response.status}`);
      return null;
    }

    const data = (await response.json()) as { parsed?: unknown };
    return normalizeExtraction(
      data.parsed as Parameters<typeof normalizeExtraction>[0],
      message,
      knownCategories,
    );
  }
}
