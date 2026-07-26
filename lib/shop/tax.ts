import type { OrderItem, Product, TaxCategory } from "@/types";

/**
 * VAT arithmetic for a Kenyan retail catalog.
 *
 * The one rule that shapes everything here: **shelf prices are VAT-inclusive**.
 * A shopkeeper who says "sukari 180" means the customer pays 180, not 180+VAT.
 * So tax is extracted *out of* the price rather than added on top, and the
 * customer-facing total always equals the sum of the shelf prices.
 *
 * eTIMS wants both halves of that split per line, and KRA reconciles the
 * header against the sum of the lines — so tax is rounded per line and the
 * totals are summed from the rounded parts. Rounding the header separately
 * would drift by a cent or two on multi-line orders and fail that check.
 *
 * Pure module: no imports beyond types, so it runs under `node --test`.
 */

/** Standard Kenyan VAT rate. Zero-rated and exempt lines bypass this. */
export const VAT_RATE = 0.16;

/** Two-decimal rounding that doesn't lose a cent to float representation. */
export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * The VAT contained within a VAT-inclusive amount.
 *
 * 116 inclusive at 16% is 16 of tax, not 18.56 — dividing out, not multiplying
 * up, is the whole point.
 */
export function taxFromInclusive(inclusiveAmount: number, category: TaxCategory): number {
  if (category !== "vat_16") return 0;
  return roundMoney(inclusiveAmount - inclusiveAmount / (1 + VAT_RATE));
}

/** Turn a catalog product plus a quantity into an immutable order line. */
export function lineFor(product: Product, quantity: number): OrderItem {
  return {
    productId: product.id,
    name: product.name,
    unitPrice: product.price,
    quantity,
    lineTotal: roundMoney(product.price * quantity),
    taxCategory: product.taxCategory,
    ...(product.itemClassificationCode
      ? { itemClassificationCode: product.itemClassificationCode }
      : {}),
  };
}

export interface OrderTotals {
  /** What the customer pays — the sum of VAT-inclusive line totals. */
  total: number;
  /** VAT contained within `total`. */
  taxTotal: number;
  /** `total - taxTotal`, the taxable/net value eTIMS files. */
  netTotal: number;
}

export function totalsFor(items: OrderItem[]): OrderTotals {
  let total = 0;
  let taxTotal = 0;

  for (const item of items) {
    total = roundMoney(total + item.lineTotal);
    taxTotal = roundMoney(taxTotal + taxFromInclusive(item.lineTotal, item.taxCategory));
  }

  return { total, taxTotal, netTotal: roundMoney(total - taxTotal) };
}

/**
 * Merge a line into a cart, stacking quantity when the product is already
 * there. Returns a new array — the state machine treats carts as immutable so
 * a failed turn can't leave a half-mutated session behind.
 */
export function addToCart(items: OrderItem[], product: Product, quantity: number): OrderItem[] {
  const existing = items.find((item) => item.productId === product.id);
  if (!existing) return [...items, lineFor(product, quantity)];

  return items.map((item) =>
    item.productId === product.id ? lineFor(product, item.quantity + quantity) : item,
  );
}
