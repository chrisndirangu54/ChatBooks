import type { ParsedTransaction } from "@/types";

export interface ReceiptOCRProvider {
  parseReceipt(file: File): Promise<ParsedTransaction>;
}

const MOCK_SUPPLIERS = ["Supplier XYZ", "City Wholesalers", "Fresh Market Ltd", "Kaya Traders"];

/**
 * Stand-in for a real OCR call (e.g. Google Vision). Returns a plausible
 * guess with a deliberately capped confidence so the UI always routes it
 * through a confirmation step, exactly like the real pipeline would.
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
    };
  }
}

export const receiptOCR: ReceiptOCRProvider = new MockReceiptOCR();
