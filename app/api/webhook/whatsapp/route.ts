import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
// Server provider, not the client-safe one from "@/lib/ai": this route already
// runs on the server, so it calls Claude directly instead of making an
// authenticated HTTP round-trip back into our own app.
import { serverTransactionAI } from "@/lib/ai/server";
import { adminDb } from "@/lib/firebase-admin";
import type { NewTransaction } from "@/lib/data/transactions";
import type { ParsedTransaction } from "@/types";

/**
 * Verifies the X-Hub-Signature-256 header the Go WhatsApp server signs
 * requests with (HMAC-SHA256 of the raw body, hex-encoded, prefixed
 * "sha256="), matching the convention its own generic webhook forwarder
 * uses. Verification is skipped (with a warning) when no secret is
 * configured — fine for local dev, but CHATBOOKS_WEBHOOK_SECRET should be
 * set in any deployment reachable from outside localhost.
 */
function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.CHATBOOKS_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[ChatBooks Webhook] CHATBOOKS_WEBHOOK_SECRET is not set; skipping signature check");
    return true;
  }
  if (!header || !header.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = header.slice("sha256=".length);

  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(provided, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Finds the UID of the first registered business in Firestore.
 * In a production multi-tenant system, you would look up by phone number
 * or a stored mapping of whatsapp_phone → business uid.
 */
async function getBusinessUidForPhone(phone?: string): Promise<string | null> {
  // Future: implement a businesses/{uid}.whatsapp_phone lookup here
  // For now we use the single registered business (demo / single-tenant mode)
  try {
    const snapshot = await adminDb.collection("businesses").limit(1).get();
    if (!snapshot.empty) {
      return snapshot.docs[0].id;
    }
  } catch (error) {
    console.error("[ChatBooks Webhook] Error finding business UID:", error, phone);
  }
  return null;
}

function formatCurrency(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${amount.toLocaleString()}`;
  }
}

/**
 * POST /api/webhook/whatsapp
 *
 * Receives webhook calls from the Go WhatsApp Web Multi-Device server
 * (ai_bot.go's ChatBooks integration) for every inbound WhatsApp text
 * message, and for receipt photos after the server's own AI provider has
 * turned the image into a short text description (this route never
 * receives image bytes directly).
 *
 * Writes go through the Firebase Admin SDK, not the client SDK, because
 * this route runs with no signed-in browser session — the security rules
 * that gate client writes would otherwise reject every insert here.
 *
 * Expected body:
 * {
 *   sender: string;            // WhatsApp JID of the sender
 *   phone: string;             // Sender's phone number (digits only)
 *   text?: string;             // Raw text, or an OCR'd description of a receipt photo
 *   is_receipt?: boolean;      // True when `text` describes a receipt photo
 *   image_url?: string;        // Optional Firebase Storage URL, if the caller has one
 *   parsed_transaction?: {     // Optional pre-parsed transaction (skips AI parsing here)
 *     type: "sale" | "expense";
 *     amount: number;
 *     category: string;
 *     note: string;
 *     confidence: number;
 *   };
 *   business_uid?: string;     // Optional override uid
 *   currency?: string;         // e.g. "KES" — falls back to "USD"
 * }
 *
 * Returns:
 * {
 *   success: boolean;
 *   reply_text: string;        // Message to send back on WhatsApp
 *   transaction_id?: string;
 *   transaction?: ParsedTransaction;
 * }
 */
export async function POST(req: Request) {
  const rawBody = await req.text();

  if (!verifySignature(rawBody, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ success: false, error: "invalid signature" }, { status: 401 });
  }

  try {
    const body = JSON.parse(rawBody);
    const {
      sender,
      phone,
      text,
      is_receipt: isReceipt = false,
      image_url: imageUrl,
      parsed_transaction: parsedTransactionInput,
      business_uid: businessUidOverride,
      currency = "USD",
    } = body as {
      sender?: string;
      phone?: string;
      text?: string;
      is_receipt?: boolean;
      image_url?: string;
      parsed_transaction?: ParsedTransaction;
      business_uid?: string;
      currency?: string;
    };

    // ── 1. Resolve the business UID ──────────────────────────────────────────
    const targetUid = businessUidOverride ?? (await getBusinessUidForPhone(phone));
    if (!targetUid) {
      return NextResponse.json({
        success: false,
        reply_text: "No ChatBooks business is set up yet — sign up at the ChatBooks dashboard first.",
      });
    }

    // ── 2. Parse the transaction if not already done by the caller ──────────
    let transactionToSave: ParsedTransaction | null = parsedTransactionInput ?? null;

    if (!transactionToSave && text) {
      transactionToSave = await serverTransactionAI.parseMessage(text, []);
    }

    if (!transactionToSave) {
      return NextResponse.json({
        success: false,
        reply_text:
          'I couldn\'t detect a transaction amount. Try something like "Sold rice 1500" or attach a receipt photo.',
      });
    }

    // ── 3. Save to Firestore via the Admin SDK ───────────────────────────────
    const source: NewTransaction["source"] = imageUrl || isReceipt ? "receipt" : "chat";
    const transactionData: NewTransaction = {
      type: transactionToSave.type,
      amount: transactionToSave.amount,
      category: transactionToSave.category,
      note: transactionToSave.note,
      source,
      confidence: transactionToSave.confidence ?? 0.95,
      createdAt: Date.now(),
      ...(imageUrl ? { receiptUrl: imageUrl } : {}),
    };
    const transactionRef = await adminDb
      .collection("businesses")
      .doc(targetUid)
      .collection("transactions")
      .add(transactionData);

    // ── 4. Build confirmation reply ──────────────────────────────────────────
    const formattedType = transactionToSave.type === "sale" ? "📈 Sale" : "📉 Expense";
    const formattedAmount = formatCurrency(transactionToSave.amount, currency);
    const noteText = transactionToSave.note ? ` — ${transactionToSave.note}` : "";
    const replyText = [
      `Saved ✅ ${formattedType}: ${formattedAmount}${noteText}`,
      `Reflected live in your ChatBooks dashboard!`,
    ].join("\n");

    console.log(
      `[ChatBooks Webhook] Saved transaction ${transactionRef.id} for business ${targetUid} from sender ${sender ?? phone}`,
    );

    return NextResponse.json({
      success: true,
      transaction_id: transactionRef.id,
      reply_text: replyText,
      transaction: transactionToSave,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ChatBooks Webhook] Error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** GET /api/webhook/whatsapp — health check */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "ChatBooks WhatsApp Webhook",
    version: "1.0.0",
  });
}
