import { darajaAmount, darajaTimestamp, normalizeMsisdn, stkPassword } from "./wire.ts";

/**
 * Safaricom Daraja client — Lipa na M-Pesa Online (STK Push).
 *
 * **Import this from route handlers only.** The consumer secret and passkey it
 * reads are the credentials that move money. None of them carry the
 * NEXT_PUBLIC_ prefix, which is what keeps them out of the browser bundle —
 * so a client component importing this would get `undefined` config rather
 * than leak the keys, but it would still be a mistake.
 *
 * Two entry points matter:
 *   - `stkPush` asks the customer's handset for a PIN.
 *   - `queryStkStatus` asks Daraja what happened, for the orders where the
 *     callback never arrived. That isn't a hypothetical — callbacks are lost
 *     to timeouts and redeploys routinely, and without a poll those orders sit
 *     "awaiting_payment" forever while the customer's money is gone.
 */

export interface DarajaConfig {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
  /** The paybill or till number the STK request is registered against. */
  shortcode: string;
  passkey: string;
  /** Till number for Buy Goods; equals `shortcode` for a paybill. */
  partyB: string;
  transactionType: "CustomerPayBillOnline" | "CustomerBuyGoodsOnline";
  callbackUrl: string;
}

function readConfig(): DarajaConfig | null {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  const callbackUrl = process.env.MPESA_CALLBACK_URL;

  if (!consumerKey || !consumerSecret || !shortcode || !passkey || !callbackUrl) return null;

  const transactionType =
    process.env.MPESA_TRANSACTION_TYPE === "CustomerBuyGoodsOnline"
      ? "CustomerBuyGoodsOnline"
      : "CustomerPayBillOnline";

  return {
    baseUrl:
      process.env.MPESA_ENV === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke",
    consumerKey,
    consumerSecret,
    shortcode,
    passkey,
    partyB: process.env.MPESA_PARTY_B || shortcode,
    transactionType,
    callbackUrl,
  };
}

export function isMpesaConfigured(): boolean {
  return readConfig() !== null;
}

// Daraja tokens last an hour and the endpoint is rate-limited, so one is
// reused across requests. Refreshed a minute early to avoid racing expiry.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(config: DarajaConfig): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const credentials = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString(
    "base64",
  );
  const response = await fetch(`${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    method: "GET",
    headers: { Authorization: `Basic ${credentials}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Daraja auth failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token?: string; expires_in?: string };
  if (!data.access_token) throw new Error("Daraja auth returned no access_token");

  const ttlSeconds = Number(data.expires_in) || 3599;
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (ttlSeconds - 60) * 1000,
  };
  return cachedToken.value;
}

export type StkPushResult =
  | {
      ok: true;
      merchantRequestId: string;
      checkoutRequestId: string;
      customerMessage: string;
    }
  | { ok: false; error: string };

export interface StkPushInput {
  /** Any Kenyan format; normalised here. */
  phone: string;
  /** VAT-inclusive order total in shillings. */
  amount: number;
  /** Shown on the customer's M-Pesa statement — we use the order id. */
  accountReference: string;
  description: string;
}

export async function stkPush(input: StkPushInput): Promise<StkPushResult> {
  const config = readConfig();
  if (!config) return { ok: false, error: "M-Pesa is not configured" };

  const msisdn = normalizeMsisdn(input.phone);
  if (!msisdn) return { ok: false, error: `Not a valid Kenyan M-Pesa number: ${input.phone}` };

  const timestamp = darajaTimestamp(new Date());

  // Daraja's field names are PascalCase and it rejects the whole request on a
  // single mismatch, so the payload is spelled out rather than mapped.
  const payload = {
    BusinessShortCode: config.shortcode,
    Password: stkPassword(config.shortcode, config.passkey, timestamp),
    Timestamp: timestamp,
    TransactionType: config.transactionType,
    Amount: darajaAmount(input.amount),
    PartyA: msisdn,
    PartyB: config.partyB,
    PhoneNumber: msisdn,
    CallBackURL: config.callbackUrl,
    // Both are truncated by Safaricom past ~12 and ~13 chars respectively.
    AccountReference: input.accountReference.slice(0, 12),
    TransactionDesc: input.description.slice(0, 13),
  };

  try {
    const token = await getAccessToken(config);
    const response = await fetch(`${config.baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const data = (await response.json()) as {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResponseCode?: string;
      ResponseDescription?: string;
      CustomerMessage?: string;
      errorMessage?: string;
    };

    // A non-"0" ResponseCode is a rejection even on HTTP 200.
    if (!response.ok || data.ResponseCode !== "0" || !data.CheckoutRequestID) {
      return {
        ok: false,
        error: data.errorMessage || data.ResponseDescription || `STK push failed (${response.status})`,
      };
    }

    return {
      ok: true,
      merchantRequestId: data.MerchantRequestID ?? "",
      checkoutRequestId: data.CheckoutRequestID,
      customerMessage: data.CustomerMessage ?? "",
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export type StkQueryResult =
  | { ok: true; resultCode: number; resultDesc: string; settled: boolean }
  | { ok: false; error: string };

/**
 * Ask Daraja for the outcome of a push, for reconciling orders whose callback
 * never landed.
 *
 * `settled: false` means "still pending, ask again later" — result code 1037
 * and the 500.001.1001 "transaction is being processed" error both mean the
 * prompt is still on the handset, and treating either as a failure would
 * cancel an order the customer is mid-way through paying.
 */
export async function queryStkStatus(checkoutRequestId: string): Promise<StkQueryResult> {
  const config = readConfig();
  if (!config) return { ok: false, error: "M-Pesa is not configured" };

  const timestamp = darajaTimestamp(new Date());

  try {
    const token = await getAccessToken(config);
    const response = await fetch(`${config.baseUrl}/mpesa/stkpushquery/v1/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: config.shortcode,
        Password: stkPassword(config.shortcode, config.passkey, timestamp),
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      }),
      cache: "no-store",
    });

    const data = (await response.json()) as {
      ResultCode?: string;
      ResultDesc?: string;
      errorCode?: string;
      errorMessage?: string;
    };

    if (data.errorCode === "500.001.1001") {
      return { ok: true, resultCode: 1037, resultDesc: "Still awaiting the customer", settled: false };
    }
    if (!response.ok || data.ResultCode === undefined) {
      return { ok: false, error: data.errorMessage || `Status query failed (${response.status})` };
    }

    const resultCode = Number(data.ResultCode);
    return {
      ok: true,
      resultCode,
      resultDesc: data.ResultDesc ?? "",
      settled: resultCode !== 1037,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
