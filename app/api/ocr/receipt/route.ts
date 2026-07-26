import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ParsedTransaction, TransactionType } from "@/types";

const anthropic = new Anthropic();

const EXTRACT_RECEIPT_TOOL: Anthropic.Tool = {
  name: "extract_receipt",
  description: "Extract structured transaction data from a receipt or invoice photo.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["sale", "expense"],
        description: "Almost always 'expense' for a receipt/invoice photo.",
      },
      amount: {
        type: "number",
        description:
          "The total amount paid, as a plain number with no currency symbol. If the image has no readable amount, use 0.",
      },
      category: {
        type: "string",
        enum: ["inventory", "transport", "rent", "utilities", "wages", "sales", "other"],
        description: "Best-fit expense category. Use 'other' if unclear.",
      },
      note: {
        type: "string",
        description:
          "Short note, e.g. the vendor/supplier name and what was purchased. If the image isn't a readable receipt, briefly say so here.",
      },
      confidence: {
        type: "number",
        description: "0 to 1 confidence that the amount and category were read correctly.",
      },
      currency: {
        type: "string",
        description:
          "3-letter ISO 4217 currency code for the amount, guessed from symbols, currency names, or language/region cues on the receipt (e.g. 'KSh' or 'Ksh' -> KES, '₦' -> NGN, '$' with no other cues -> USD). If truly undeterminable, use USD.",
      },
    },
    required: ["type", "amount", "category", "note", "confidence", "currency"],
    additionalProperties: false,
  },
};

function extractMediaType(dataUrl: string): string {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
  return match ? match[1] : "image/jpeg";
}

function extractBase64(dataUrl: string): string {
  return dataUrl.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
}

/**
 * POST /api/ocr/receipt
 * Body: { imageDataUrl: string } — a base64 data URL (data:image/jpeg;base64,...)
 * Returns a ParsedTransaction extracted from the receipt photo via Claude vision.
 */
export async function POST(req: Request) {
  try {
    const { imageDataUrl } = (await req.json()) as { imageDataUrl?: string };
    if (!imageDataUrl) {
      return NextResponse.json({ error: "imageDataUrl is required" }, { status: 400 });
    }

    const mediaType = extractMediaType(imageDataUrl);
    const base64Data = extractBase64(imageDataUrl);

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      tools: [EXTRACT_RECEIPT_TOOL],
      tool_choice: { type: "tool", name: "extract_receipt" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: base64Data,
              },
            },
            {
              type: "text",
              text: "This is a receipt or invoice photo from a small business owner. Extract the transaction details.",
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "Request was declined" }, { status: 422 });
    }

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === "extract_receipt",
    );

    if (!toolUse) {
      return NextResponse.json({ error: "No structured result returned" }, { status: 502 });
    }

    const input = toolUse.input as {
      type: TransactionType;
      amount: number;
      category: string;
      note: string;
      confidence: number;
      currency: string;
    };

    const parsed: ParsedTransaction = {
      type: input.type,
      amount: input.amount,
      category: input.category,
      note: input.note,
      confidence: input.confidence,
      currency: input.currency,
    };

    return NextResponse.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[OCR Receipt] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
