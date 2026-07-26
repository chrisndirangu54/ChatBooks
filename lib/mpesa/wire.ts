/**
 * Pure wire-format helpers for Safaricom Daraja (M-Pesa STK Push).
 *
 * Every field Daraja is fussy about is derived here rather than inline at the
 * call site, so the fussy parts are testable without a sandbox account and
 * there's exactly one place to correct if the contract shifts.
 *
 * ⚠️ Field names and formats below follow Daraja's published Lipa na M-Pesa
 * Online contract. developer.safaricom.co.ke is a client-rendered app that
 * can't be fetched programmatically, so these were written from the stable
 * documented contract rather than read off the live page — worth a look at
 * the portal before the first production push.
 *
 * Pure module: no I/O, so it runs under `node --test`.
 */
import { eatCompact } from "../eat-time.ts";

/**
 * Daraja wants a bare MSISDN: 254 country code, no plus, no spaces.
 *
 * Kenyan customers type their number every possible way, and each variant that
 * slips through unnormalised is a push sent to nobody. Returns null rather
 * than a guess when the digits can't be a Kenyan mobile number — a wrong guess
 * would prompt a stranger for a PIN.
 */
export function normalizeMsisdn(input: string): string | null {
  const digits = input.replace(/\D/g, "");

  // 0712345678 → 254712345678
  if (/^0(7|1)\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  // 712345678 → 254712345678
  if (/^(7|1)\d{8}$/.test(digits)) return `254${digits}`;
  // Already 254712345678, or the 254 0712345678 form some clients produce.
  if (/^254(7|1)\d{8}$/.test(digits)) return digits;
  if (/^2540(7|1)\d{8}$/.test(digits)) return `254${digits.slice(4)}`;

  return null;
}

/**
 * Daraja's Timestamp: YYYYMMDDHHmmss in East Africa Time.
 *
 * It has to be EAT, not UTC — the same string is hashed into the request
 * password, and a mismatched timestamp is rejected as a bad password rather
 * than as a bad time, which is a miserable thing to debug.
 */
export function darajaTimestamp(date: Date): string {
  return eatCompact(date);
}

/** base64(BusinessShortCode + Passkey + Timestamp) — Daraja's `Password`. */
export function stkPassword(shortcode: string, passkey: string, timestamp: string): string {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`, "utf8").toString("base64");
}

/**
 * Daraja rejects fractional amounts, so the request has to carry whole
 * shillings.
 *
 * Rounds to nearest rather than up: Kenyan shelf prices are whole shillings in
 * practice, so this is a no-op on real carts, and when it isn't, the callback
 * records what M-Pesa actually collected rather than what we asked for.
 */
export function darajaAmount(total: number): number {
  return Math.max(1, Math.round(total));
}

/**
 * The M-Pesa timestamp echoed back on a successful callback
 * (`TransactionDate`, e.g. 20191219102115) is EAT with no zone marker.
 * EAT is a fixed UTC+3 with no daylight saving, so the offset is a constant.
 */
export function parseDarajaDate(value: number | string): number | undefined {
  const raw = String(value);
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (!match) return undefined;

  const [, year, month, day, hour, minute, second] = match;
  return Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) - 3,
    Number(minute),
    Number(second),
  );
}
