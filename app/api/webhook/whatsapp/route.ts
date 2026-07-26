import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
// Server provider, not the client-safe one from "@/lib/ai": this route already
// runs on the server, so it calls Claude directly instead of making an
// authenticated HTTP round-trip back into our own app.
import { serverTransactionAI } from "@/lib/ai/server";
import { adminDb } from "@/lib/firebase-admin";
import { normalizeMsisdn } from "@/lib/mpesa/wire";
import { getProfile } from "@/lib/server/shop-repo";
import { handleShoppingMessage } from "@/lib/server/shopping";
import type { NewTransaction } from "@/lib/data/transactions";
import type { BusinessProfile, ParsedTransaction } from "@/types";

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

/** The placeholder this route creates when no real business has signed up yet. */
const DEMO_BUSINESS_ID = "demo-business";

/**
 * Work out which business an inbound message belongs to.
 *
 * The naive version of this — `businesses.limit(1)` — had a nasty failure
 * mode. `limit(1)` returns an arbitrary document, so once the demo placeholder
 * existed alongside a real signup, the webhook could read the placeholder
 * while the dashboard wrote to `businesses/{uid}`. The shopkeeper then sets
 * their WhatsApp number in Settings, watches it save, and ordering stays
 * switched off, because the webhook is looking at a different document.
 *
 * So: prefer a real business over the placeholder, and prefer the one whose
 * owner is actually messaging. Genuine multi-tenant routing needs the
 * *receiving* number rather than the sender's, which the GoWA payload doesn't
 * carry — hence the warning rather than a silent guess.
 */
async function resolveBusiness(
  phone?: string,
): Promise<{ uid: string; profile: BusinessProfile | null }> {
  try {
    const snapshot = await adminDb.collection("businesses").limit(50).get();

    const candidates = snapshot.docs.map((doc) => ({
      uid: doc.id,
      profile: doc.data() as BusinessProfile,
    }));
    const real = candidates.filter((c) => c.uid !== DEMO_BUSINESS_ID);
    const pool = real.length > 0 ? real : candidates;

    if (pool.length === 0) {
      const demoRef = adminDb.collection("businesses").doc(DEMO_BUSINESS_ID);
      await demoRef.set(
        { businessName: "Demo Business", currency: "USD", createdAt: Date.now() },
        { merge: true },
      );
      console.warn(
        "[ChatBooks Webhook] No business has signed up yet — using the demo placeholder. " +
          "Customer ordering stays off until a real business exists with ownerPhone set.",
      );
      return { uid: DEMO_BUSINESS_ID, profile: null };
    }

    // If the sender is a registered owner, the business is theirs, no guessing.
    const sender = phone ? (normalizeMsisdn(phone) ?? phone.replace(/\D/g, "")) : null;
    if (sender) {
      const owned = pool.find((c) => {
        if (!c.profile?.ownerPhone) return false;
        return (
          (normalizeMsisdn(c.profile.ownerPhone) ?? c.profile.ownerPhone.replace(/\D/g, "")) ===
          sender
        );
      });
      if (owned) return owned;
    }

    if (pool.length > 1) {
      console.warn(
        `[ChatBooks Webhook] ${pool.length} businesses registered and the sender isn't a known owner; ` +
          `defaulting to ${pool[0].uid}. Multi-shop routing needs the receiving number, which this webhook doesn't get.`,
      );
    }

    return pool[0];
  } catch (error) {
    console.error("[ChatBooks Webhook] Error resolving business:", error, phone);
    return { uid: DEMO_BUSINESS_ID, profile: null };
  }
}

/**
 * Decides whether an inbound message is the owner doing bookkeeping or a
 * customer shopping — the single fork that lets one WhatsApp number serve
 * both.
 *
 * Fails safe towards bookkeeping: with no `ownerPhone` on the profile, every
 * message is the owner's, exactly as it behaved before ordering existed. The
 * alternative default would turn a shopkeeper's "sold rice 1500" into a
 * confused catalog listing.
 */
function isOwnerMessage(profile: BusinessProfile | null, phone?: string): boolean {
  const ownerPhone = profile?.ownerPhone;
  if (!ownerPhone) return true;
  if (!phone) return true;

  const normalizedOwner = normalizeMsisdn(ownerPhone) ?? ownerPhone.replace(/\D/g, "");
  const normalizedSender = normalizeMsisdn(phone) ?? phone.replace(/\D/g, "");
  return normalizedOwner === normalizedSender;
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

    // ── 1. Resolve the business ──────────────────────────────────────────────
    const resolved = businessUidOverride
      ? { uid: businessUidOverride, profile: await getProfile(businessUidOverride) }
      : await resolveBusiness(phone);
    const targetUid = resolved.uid;
    const profile = resolved.profile;

    // ── 2. Owner bookkeeping, or a customer shopping? ────────────────────────
    //
    // This fork runs BEFORE the "undo" command below, and the order is not
    // cosmetic. That command matches a bare "cancel" and a bare "remove" —
    // both of which are ordinary customer words here ("cancel" aborts an
    // M-Pesa prompt, "remove" appears in cart edits). Interpreting them before
    // knowing who is speaking would let a shopper delete the shopkeeper's last
    // transaction.
    const routedToOwner = isOwnerMessage(profile, phone);

    // Logged on every message because the failure mode here is silent: a
    // customer gets a bookkeeping reply and nothing anywhere says why.
    console.log(
      `[ChatBooks Webhook] ${phone ?? "(no phone)"} → ${routedToOwner ? "bookkeeping" : "shopping"} ` +
        `(business ${targetUid}, ownerPhone ${profile?.ownerPhone ? "set" : "UNSET"})`,
    );
    if (!profile?.ownerPhone) {
      console.warn(
        "[ChatBooks Webhook] ownerPhone is not set on this business, so every message is treated " +
          "as the owner's and customer ordering is off. Set it in Dashboard → Settings.",
      );
    }

    if (phone && !routedToOwner) {
      const shopping = await handleShoppingMessage({
        uid: targetUid,
        profile,
        phone,
        text: text ?? "",
        now: Date.now(),
      });

      console.log(
        `[ChatBooks Webhook] Shopping turn for ${phone}${shopping.orderId ? ` → order ${shopping.orderId}` : ""}`,
      );

      return NextResponse.json({
        success: true,
        reply_text: shopping.replyText,
        ...(shopping.orderId ? { order_id: shopping.orderId } : {}),
      });
    }

    // ── 3. Handle "undo" / "delete last" command ────────────────────────────
    if (text && /^(undo|delete|delete last|remove|remove last|cancel)$/i.test(text.trim())) {
      const lastQuery = await adminDb
        .collection("businesses")
        .doc(targetUid)
        .collection("transactions")
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();

      if (!lastQuery.empty) {
        const docToDelete = lastQuery.docs[0];
        const data = docToDelete.data();
        await docToDelete.ref.delete();

        const typeStr = data.type === "sale" ? "📈 Sale" : "📉 Expense";
        const amountStr = formatCurrency(data.amount || 0, currency);
        const noteStr = data.note ? ` (${data.note})` : "";

        return NextResponse.json({
          success: true,
          reply_text: [
            `Removed 🗑️ ${typeStr}: ${amountStr}${noteStr}`,
            `This transaction has been deleted from your ChatBooks records.`,
          ].join("\n"),
        });
      }

      return NextResponse.json({
        success: true,
        reply_text: "No recent transactions found to remove.",
      });
    }

    // ── 4. Parse the transaction if not already done by the caller ──────────
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

    // ── 5. Save to Firestore via the Admin SDK ───────────────────────────────
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

    // ── 6. Build friendly confirmation reply with Undo prompt ─────────────────
    const formattedType = transactionToSave.type === "sale" ? "📈 Sale" : "📉 Expense";
    const formattedAmount = formatCurrency(transactionToSave.amount, currency);
    const noteText = transactionToSave.note ? ` — ${transactionToSave.note}` : "";
    const categoryText = transactionToSave.category ? `\n📂 Category: ${transactionToSave.category}` : "";

    const replyText = [
      `Saved ✅ ${formattedType}: ${formattedAmount}${noteText}${categoryText}`,
      ``,
      `📊 Reflected live in your ChatBooks dashboard!`,
      `💡 Made a mistake? Reply "undo" to remove this entry.`,
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
