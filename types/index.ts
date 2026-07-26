export type TransactionType = "sale" | "expense";

export type TransactionSource = "chat" | "manual" | "receipt";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  note: string;
  source: TransactionSource;
  confidence: number;
  createdAt: number;
  receiptUrl?: string;
}

export interface BusinessProfile {
  businessName: string;
  ownerName: string;
  currency: string;
  categories: string[];
  createdAt: number;
  /**
   * The owner's own WhatsApp number, in 2547… form.
   *
   * This is what lets one WhatsApp number serve two audiences: a message from
   * this number is the owner doing bookkeeping, anything else is a customer
   * shopping. When unset, every message is treated as the owner's — preserving
   * the behaviour that existed before ordering was added.
   */
  ownerPhone?: string;
  /** KRA PIN, printed on eTIMS invoices. */
  kraPin?: string;
}

/**
 * VAT treatment for a catalog item. eTIMS requires every line to declare one,
 * and getting it wrong is a filing error rather than a display bug — so it's
 * modelled explicitly instead of assumed.
 */
export type TaxCategory = "vat_16" | "vat_zero" | "exempt";

export interface Product {
  id: string;
  name: string;
  /**
   * Shelf price, **VAT-inclusive** — the number a customer is quoted and pays.
   * Kenyan retail prices are quoted inclusive, so the tax component is derived
   * out of this rather than added on top. See `lib/shop/tax.ts`.
   */
  price: number;
  /** Free text: "1kg", "500ml", "crate". Shown in the catalog line. */
  unit?: string;
  active: boolean;
  createdAt: number;
  /** KRA item classification code. Required by eTIMS; blank until set. */
  itemClassificationCode?: string;
  /** Quantity in stock. Optional for services/untracked inventory. */
  stock?: number;
  taxCategory: TaxCategory;
  /**
   * Units on hand.
   *
   * `undefined` means **not tracked**, and that distinction carries weight:
   * every product that existed before stock was added has no value here, and
   * reading a missing field as 0 would empty the whole catalog the moment this
   * shipped. Only an explicit number gates availability.
   */
  stock?: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  /** VAT-inclusive unit price, copied at order time so later price edits
   *  don't rewrite historical orders. */
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  taxCategory: TaxCategory;
  itemClassificationCode?: string;
}

export type OrderStatus = "cart" | "awaiting_payment" | "paid" | "failed" | "cancelled";

export interface MpesaPayment {
  merchantRequestId?: string;
  checkoutRequestId?: string;
  /** M-Pesa receipt e.g. "SGR7H2K9QP" — the customer's proof of payment. */
  receiptNumber?: string;
  paidAt?: number;
  resultCode?: number;
  resultDesc?: string;
}

export type EtimsStatus = "not_filed" | "pending" | "filed" | "failed";

export interface EtimsFiling {
  status: EtimsStatus;
  /** KRA control-unit invoice number, once filed. */
  invoiceNumber?: string;
  /** Verification QR payload/URL KRA returns; printed on the receipt. */
  qrCode?: string;
  filedAt?: number;
  error?: string;
  /** Which provider filed it — "stub" until real credentials are wired. */
  provider?: string;
  /** How many times filing has been attempted, including retries. */
  attempts?: number;
}

export interface Order {
  id: string;
  /** Customer's WhatsApp number in 2547… form. */
  customerPhone: string;
  customerName?: string;
  items: OrderItem[];
  /** Sum of line totals (VAT-inclusive), i.e. what the customer pays. */
  total: number;
  /** VAT contained within `total`, for the eTIMS filing. */
  taxTotal: number;
  /** `total - taxTotal`. */
  netTotal: number;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
  mpesa?: MpesaPayment;
  etims?: EtimsFiling;
  /** Ledger entry created when payment landed — links order to books. */
  transactionId?: string;
  /**
   * Stock has been decremented for this order. Guards the decrement against
   * running twice if the order is ever settled by both a callback and the
   * reconciliation sweep.
   */
  stockAdjusted?: boolean;
  /**
   * Names of lines that took stock below zero.
   *
   * Payment has already been taken by the time stock is decremented, and a
   * callback cannot un-take an M-Pesa payment — so an oversell is recorded for
   * the shopkeeper to refund or restock rather than silently clamped.
   */
  oversold?: string[];
  /**
   * Set when the outcome came from polling Daraja rather than from a callback,
   * i.e. the callback was lost. Such an order has no M-Pesa receipt number,
   * because the status query doesn't return one.
   */
  reconciledAt?: number;
}

/** Where a given customer is in the ordering conversation. */
export interface ShopSession {
  /** 2547… — also the Firestore document id. */
  phone: string;
  state: "browsing" | "cart" | "awaiting_payment";
  items: OrderItem[];
  /** Set once checkout starts, so a callback can find the order. */
  orderId?: string;
  updatedAt: number;
}

export interface ParsedTransaction {
  type: TransactionType;
  amount: number;
  category: string;
  note: string;
  confidence: number;
  /** ISO 4217 currency code detected on a receipt photo, e.g. "KES", "USD". */
  currency?: string;
}

export interface WeeklySummary {
  label: string;
  sales: number;
  expenses: number;
  profit: number;
}
