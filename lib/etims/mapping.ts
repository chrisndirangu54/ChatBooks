import { eatCompact, eatDay } from "../eat-time.ts";
import { taxFromInclusive } from "../shop/tax.ts";
import type { Order, TaxCategory } from "@/types";

/**
 * Maps a ChatBooks order onto KRA's eTIMS sales-invoice shape.
 *
 * Pure and separate from the transport so the field mapping — the part that
 * makes a filing right or wrong — can be tested without an eTIMS account.
 *
 * ⚠️ **Verify before filing for real.** These field names follow the KRA
 * eTIMS (OSCU/VSCU) sales specification, but two things are taxpayer-specific
 * and must be confirmed against the code list issued with your own eTIMS
 * onboarding: the tax-type letters below, and each product's
 * `itemClassificationCode`. A wrong letter here is a misfiled return, not a
 * display bug, which is why `buildEtimsInvoice` refuses to guess a
 * classification code it hasn't been given.
 */

/**
 * KRA tax type codes. A = exempt, B = standard 16%, C = zero-rated,
 * D = non-VAT, E = 8%. Only the three ChatBooks models are mapped.
 */
export type EtimsTaxTypeCode = "A" | "B" | "C";

export function taxTypeCodeFor(category: TaxCategory): EtimsTaxTypeCode {
  switch (category) {
    case "vat_16":
      return "B";
    case "vat_zero":
      return "C";
    case "exempt":
      return "A";
  }
}

export interface EtimsInvoiceItem {
  itemSeq: number;
  itemCd: string;
  itemClsCd: string;
  itemNm: string;
  qty: number;
  prc: number;
  splyAmt: number;
  dcRt: number;
  dcAmt: number;
  taxTyCd: EtimsTaxTypeCode;
  taxblAmt: number;
  taxAmt: number;
  totAmt: number;
}

export interface EtimsInvoice {
  /** Seller's KRA PIN. */
  tin: string;
  /** Branch id; "00" is head office. */
  bhfId: string;
  invcNo: number;
  /** Our own order id, so a filing can be traced back to a WhatsApp cart. */
  trdInvcNo: string;
  custTin?: string;
  custNm?: string;
  /** "N" normal sale. */
  salesTyCd: "N";
  /** "S" sale receipt. */
  rcptTyCd: "S";
  /** "06" mobile money — every order here is paid by M-Pesa. */
  pmtTyCd: "06";
  /** "02" approved. */
  salesSttsCd: "02";
  cfmDt: string;
  salesDt: string;
  totItemCnt: number;
  taxblAmtA: number;
  taxblAmtB: number;
  taxblAmtC: number;
  taxRtA: number;
  taxRtB: number;
  taxRtC: number;
  taxAmtA: number;
  taxAmtB: number;
  taxAmtC: number;
  totTaxblAmt: number;
  totTaxAmt: number;
  totAmt: number;
  itemList: EtimsInvoiceItem[];
}

export interface EtimsInvoiceInput {
  order: Order;
  /** Seller's KRA PIN, from the business profile. */
  kraPin: string;
  branchId?: string;
  /** Monotonic per-seller invoice counter KRA requires. */
  invoiceNumber: number;
  customerKraPin?: string;
  filedAt: Date;
}

export class EtimsMappingError extends Error {}

/**
 * Build the invoice payload, or throw with a message the shopkeeper can act on.
 *
 * Throwing beats filing a guess: an item with no classification code would be
 * accepted by some providers under a default code and quietly misclassify the
 * sale on the seller's return.
 */
export function buildEtimsInvoice(input: EtimsInvoiceInput): EtimsInvoice {
  const { order, kraPin, invoiceNumber, filedAt } = input;

  if (!kraPin) {
    throw new EtimsMappingError("No KRA PIN on the business profile — set one in Settings.");
  }
  if (order.items.length === 0) {
    throw new EtimsMappingError("Cannot file an invoice with no line items.");
  }

  const missingCodes = order.items.filter((item) => !item.itemClassificationCode);
  if (missingCodes.length > 0) {
    throw new EtimsMappingError(
      `Missing KRA item classification code for: ${missingCodes.map((i) => i.name).join(", ")}`,
    );
  }

  const itemList: EtimsInvoiceItem[] = order.items.map((item, index) => {
    const taxAmt = taxFromInclusive(item.lineTotal, item.taxCategory);
    // splyAmt/taxblAmt are the VAT-exclusive value; totAmt is what was paid.
    const taxblAmt = Math.round((item.lineTotal - taxAmt) * 100) / 100;

    return {
      itemSeq: index + 1,
      itemCd: item.productId,
      itemClsCd: item.itemClassificationCode as string,
      itemNm: item.name,
      qty: item.quantity,
      prc: item.unitPrice,
      splyAmt: taxblAmt,
      dcRt: 0,
      dcAmt: 0,
      taxTyCd: taxTypeCodeFor(item.taxCategory),
      taxblAmt,
      taxAmt,
      totAmt: item.lineTotal,
    };
  });

  const sumBy = (code: EtimsTaxTypeCode, field: "taxblAmt" | "taxAmt") =>
    Math.round(
      itemList.filter((i) => i.taxTyCd === code).reduce((sum, i) => sum + i[field], 0) * 100,
    ) / 100;

  return {
    tin: kraPin,
    bhfId: input.branchId || "00",
    invcNo: invoiceNumber,
    trdInvcNo: order.id,
    ...(input.customerKraPin ? { custTin: input.customerKraPin } : {}),
    ...(order.customerName ? { custNm: order.customerName } : {}),
    salesTyCd: "N",
    rcptTyCd: "S",
    pmtTyCd: "06",
    salesSttsCd: "02",
    cfmDt: eatCompact(filedAt),
    salesDt: eatDay(filedAt),
    totItemCnt: itemList.length,
    taxblAmtA: sumBy("A", "taxblAmt"),
    taxblAmtB: sumBy("B", "taxblAmt"),
    taxblAmtC: sumBy("C", "taxblAmt"),
    taxRtA: 0,
    taxRtB: 16,
    taxRtC: 0,
    taxAmtA: sumBy("A", "taxAmt"),
    taxAmtB: sumBy("B", "taxAmt"),
    taxAmtC: sumBy("C", "taxAmt"),
    totTaxblAmt: order.netTotal,
    totTaxAmt: order.taxTotal,
    totAmt: order.total,
    itemList,
  };
}
