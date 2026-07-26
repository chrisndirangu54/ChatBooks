import { buildEtimsInvoice, EtimsMappingError, type EtimsInvoice, type EtimsInvoiceInput } from "./mapping.ts";

/**
 * eTIMS filing, behind an adapter.
 *
 * You aren't onboarded to eTIMS yet, so the only implementation here is a stub
 * that records what *would* have been filed. The adapter exists so that
 * turning on real filing is a config change and a new file, not a rewrite of
 * the payment path: the callback route already builds the full KRA payload,
 * already stores the result on the order, and already surfaces failures — the
 * only thing the stub skips is the HTTP call.
 *
 * When credentials arrive, add an implementation of `EtimsProvider` that POSTs
 * `invoice` to your OSCU/VSCU endpoint and returns its invoice number and QR
 * payload, then select it in `getEtimsProvider`.
 *
 * **Import from route handlers only** — a real provider will read credentials.
 */

export interface EtimsFilingResult {
  ok: boolean;
  provider: string;
  /** KRA control-unit invoice number. */
  invoiceNumber?: string;
  /** Verification QR payload printed on the receipt. */
  qrCode?: string;
  error?: string;
}

export interface EtimsProvider {
  readonly name: string;
  file(invoice: EtimsInvoice): Promise<EtimsFilingResult>;
}

/**
 * Records the filing locally and returns a clearly-marked placeholder.
 *
 * The invoice number is derived from the trader invoice number rather than a
 * counter, so it's stable if the same order is retried — and prefixed STUB- so
 * nobody mistakes one for a KRA control number on a receipt or in the orders
 * list.
 */
export const stubEtimsProvider: EtimsProvider = {
  name: "stub",
  async file(invoice: EtimsInvoice): Promise<EtimsFilingResult> {
    console.log(
      `[ChatBooks eTIMS:stub] Would file invoice ${invoice.invcNo} for order ${invoice.trdInvcNo}:`,
      JSON.stringify({
        tin: invoice.tin,
        totAmt: invoice.totAmt,
        totTaxAmt: invoice.totTaxAmt,
        items: invoice.itemList.length,
      }),
    );

    return {
      ok: true,
      provider: "stub",
      invoiceNumber: `STUB-${invoice.trdInvcNo}`,
      qrCode: undefined,
    };
  },
};

export function getEtimsProvider(): EtimsProvider {
  // Only the stub exists today; ETIMS_PROVIDER is read now so that adding a
  // real provider doesn't also mean changing every call site.
  switch (process.env.ETIMS_PROVIDER) {
    case "stub":
    default:
      return stubEtimsProvider;
  }
}

/** True once a real provider is configured — the dashboard uses this to label filings honestly. */
export function isEtimsLive(): boolean {
  return getEtimsProvider().name !== "stub";
}

/**
 * Build and file in one step, converting a mapping problem into a failed
 * filing rather than an exception.
 *
 * A sale that can't be filed is still a sale: the caller records the money and
 * flags the filing, so an eTIMS outage or a missing classification code never
 * loses a customer's payment.
 */
export async function fileOrder(input: EtimsInvoiceInput): Promise<EtimsFilingResult> {
  const provider = getEtimsProvider();

  let invoice: EtimsInvoice;
  try {
    invoice = buildEtimsInvoice(input);
  } catch (error) {
    return {
      ok: false,
      provider: provider.name,
      error:
        error instanceof EtimsMappingError
          ? error.message
          : `Could not build the eTIMS invoice: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  try {
    return await provider.file(invoice);
  } catch (error) {
    return {
      ok: false,
      provider: provider.name,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
