import type { ParsedTransaction } from "@/types";

export interface ReceiptOCRProvider {
  parseReceipt(file: File): Promise<ParsedTransaction>;
}

const MOCK_SUPPLIERS = ["Supplier XYZ", "City Wholesalers", "Fresh Market Ltd", "Kaya Traders"];

/**
 * Stand-in for a real OCR call. Returns a plausible guess with a
 * deliberately capped confidence so the UI always routes it through a
 * confirmation step, exactly like the real pipeline would. Kept around as
 * a zero-dependency fallback / offline dev option.
 */
export class MockReceiptOCR implements ReceiptOCRProvider {
  async parseReceipt(file: File): Promise<ParsedTransaction> {
    await new Promise((resolve) => setTimeout(resolve, 900));

    const seed = file.size % 9000;
    const amount = 500 + seed;
    const supplier = MOCK_SUPPLIERS[file.size % MOCK_SUPPLIERS.length];

    return {
      type: "expense",
      amount,
      category: "inventory",
      note: `Receipt from ${supplier}`,
      confidence: 0.6,
      currency: "USD",
    };
  }
}

function fileToResizedDataUrl(file: File, maxDim = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Real OCR via Claude vision (server-side, /api/ocr/receipt — keeps the
 * Anthropic API key off the client). Sends a resized copy of the photo to
 * keep payload size and token cost down.
 */
export class ClaudeReceiptOCR implements ReceiptOCRProvider {
  async parseReceipt(file: File): Promise<ParsedTransaction> {
    const imageDataUrl = await fileToResizedDataUrl(file);

    const response = await fetch("/api/ocr/receipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Receipt OCR failed (${response.status}): ${body}`);
    }

    return (await response.json()) as ParsedTransaction;
  }
}

export const receiptOCR: ReceiptOCRProvider = new ClaudeReceiptOCR();
