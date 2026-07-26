import Anthropic from "@anthropic-ai/sdk";
import type { ParsedTransaction } from "@/types";
import type { TransactionAIProvider } from "./types";
import { EXTRACTION_SCHEMA, SYSTEM_PROMPT, buildUserPrompt } from "./extraction";
import { extractJson, normalizeExtraction } from "./normalize";

/**
 * Claude-backed transaction parser. **Server-only** — it reads
 * ANTHROPIC_API_KEY, so it must never be imported from a client component.
 * Browsers reach it through /api/ai/parse-transaction instead.
 *
 * Model and parameter choices, since they're all deliberate:
 *
 *  · `claude-opus-5` — the current Opus. Extraction quality here is the whole
 *    product; a wrong amount in someone's books is the failure mode that
 *    matters, so this isn't the place to shave cost.
 *  · `effort: "low"` — this is short structured extraction, not analysis. Low
 *    effort keeps latency in chat-reply territory and cost per parse around
 *    half a cent. Thinking stays *on* (adaptive is Opus 5's default): with it
 *    disabled the model can emit prose where structured output belongs.
 *  · `output_config.format` — structured outputs, so the response is the JSON
 *    object rather than prose that happens to contain one.
 *  · `cache_control` on the system block — the prompt is identical on every
 *    request, so after the first call it bills at cache-read rates. This is
 *    the single biggest cost lever here, worth roughly half the per-parse bill.
 *  · Short timeout and one retry — a bookkeeping chat that hangs for ten
 *    minutes is worse than one that falls back to the rule-based parser.
 */

const MODEL = "claude-opus-5";
/** Headroom for adaptive thinking plus the small JSON object. `max_tokens` caps
 *  both together on Opus 5, so sizing this to the output alone would truncate. */
const MAX_TOKENS = 8192;
/** Milliseconds — the TypeScript SDK takes ms, unlike the Python one. */
const REQUEST_TIMEOUT_MS = 20_000;

let client: Anthropic | null = null;

/**
 * Built on first use, not at module load, so importing this file in an
 * environment without a key (tests, a misconfigured deploy) doesn't crash the
 * route — it just reports unavailable and the caller falls back.
 */
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    client = new Anthropic({ maxRetries: 1 });
  }
  return client;
}

export function isClaudeParserConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export class ClaudeTransactionAI implements TransactionAIProvider {
  async parseMessage(
    message: string,
    knownCategories: string[],
  ): Promise<ParsedTransaction | null> {
    const anthropic = getClient();
    if (!anthropic) return null;

    const trimmed = message.trim();
    if (!trimmed) return null;

    try {
      const response = await anthropic.messages.create(
        {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          thinking: { type: "adaptive" },
          output_config: {
            effort: "low",
            format: { type: "json_schema", schema: EXTRACTION_SCHEMA },
          },
          system: [
            {
              type: "text",
              text: SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [{ role: "user", content: buildUserPrompt(trimmed, knownCategories) }],
        },
        { timeout: REQUEST_TIMEOUT_MS },
      );

      // Safety classifiers can decline a request: HTTP 200, empty or partial
      // content. Check before reading content, never index content[0] blind.
      if (response.stop_reason === "refusal") {
        console.warn(
          "[ChatBooks AI] Request declined by safety classifier:",
          response.stop_details?.category ?? "unknown",
        );
        return null;
      }

      if (response.stop_reason === "max_tokens") {
        console.warn("[ChatBooks AI] Response hit max_tokens; output may be truncated");
      }

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");

      const parsed = normalizeExtraction(extractJson(text), trimmed, knownCategories);

      if (process.env.NODE_ENV !== "production") {
        const usage = response.usage;
        console.log(
          `[ChatBooks AI] parsed=${parsed ? `${parsed.type} ${parsed.amount} (${parsed.confidence.toFixed(2)})` : "none"}`,
          `in=${usage.input_tokens} out=${usage.output_tokens}`,
          `cache_read=${usage.cache_read_input_tokens ?? 0} cache_write=${usage.cache_creation_input_tokens ?? 0}`,
        );
      }

      return parsed;
    } catch (error) {
      // Distinguish the cases worth acting on rather than swallowing them all
      // into one line — each has a different fix.
      if (error instanceof Anthropic.RateLimitError) {
        console.error("[ChatBooks AI] Rate limited; falling back to rule-based parser");
      } else if (error instanceof Anthropic.AuthenticationError) {
        console.error("[ChatBooks AI] ANTHROPIC_API_KEY is invalid or revoked");
      } else if (error instanceof Anthropic.APIConnectionError) {
        console.error("[ChatBooks AI] Could not reach the API (network or timeout)");
      } else if (error instanceof Anthropic.APIError) {
        console.error(`[ChatBooks AI] API error ${error.status}:`, error.message);
      } else {
        console.error("[ChatBooks AI] Unexpected parser error:", error);
      }
      // Returning null hands control to the fallback provider — a degraded
      // parse beats an error message in the owner's chat.
      return null;
    }
  }
}
