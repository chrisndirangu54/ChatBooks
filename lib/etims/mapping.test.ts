import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEtimsInvoice, EtimsMappingError, taxTypeCodeFor } from "./mapping.ts";
import { lineFor, totalsFor } from "../shop/tax.ts";
import type { Order, Product } from "@/types";

const FILED_AT = new Date("2024-03-05T07:00:00Z"); // 10:00 EAT

const product = (over: Partial<Product> = {}): Product => ({
  id: "p1",
  name: "Sukari 1kg",
  price: 180,
  active: true,
  createdAt: 0,
  taxCategory: "vat_16",
  itemClassificationCode: "5059871800",
  ...over,
});

function orderOf(...products: Array<[Product, number]>): Order {
  const items = products.map(([p, qty]) => lineFor(p, qty));
  const totals = totalsFor(items);
  return {
    id: "order123",
    customerPhone: "254712345678",
    items,
    ...totals,
    status: "paid",
    createdAt: 0,
    updatedAt: 0,
  };
}

test("tax categories map to KRA's letter codes", () => {
  assert.equal(taxTypeCodeFor("vat_16"), "B");
  assert.equal(taxTypeCodeFor("vat_zero"), "C");
  assert.equal(taxTypeCodeFor("exempt"), "A");
});

test("line amounts are VAT-exclusive but the line total is what was paid", () => {
  const invoice = buildEtimsInvoice({
    order: orderOf([product(), 1]),
    kraPin: "P051234567M",
    invoiceNumber: 7,
    filedAt: FILED_AT,
  });

  const [line] = invoice.itemList;
  assert.equal(line.totAmt, 180);
  assert.equal(line.taxAmt, 24.83);
  assert.equal(line.taxblAmt, 155.17);
  assert.equal(line.taxblAmt + line.taxAmt, line.totAmt);
});

test("header totals equal the sum of the lines", () => {
  // KRA reconciles these; a header rounded independently drifts and is rejected.
  const invoice = buildEtimsInvoice({
    order: orderOf([product(), 3], [product({ id: "p2", name: "Maziwa", price: 65 }), 2]),
    kraPin: "P051234567M",
    invoiceNumber: 8,
    filedAt: FILED_AT,
  });

  const lineTax = invoice.itemList.reduce((sum, i) => sum + i.taxAmt, 0);
  const lineTotal = invoice.itemList.reduce((sum, i) => sum + i.totAmt, 0);
  assert.equal(Math.round(lineTax * 100) / 100, invoice.totTaxAmt);
  assert.equal(Math.round(lineTotal * 100) / 100, invoice.totAmt);
  assert.equal(invoice.totTaxblAmt + invoice.totTaxAmt, invoice.totAmt);
});

test("tax is bucketed by rate band", () => {
  const invoice = buildEtimsInvoice({
    order: orderOf(
      [product(), 1],
      [product({ id: "p2", name: "Mkate", price: 70, taxCategory: "vat_zero" }), 1],
    ),
    kraPin: "P051234567M",
    invoiceNumber: 9,
    filedAt: FILED_AT,
  });

  assert.equal(invoice.taxAmtB, 24.83);
  assert.equal(invoice.taxAmtC, 0);
  assert.equal(invoice.taxblAmtC, 70); // zero-rated: full value, no tax
  assert.equal(invoice.taxRtB, 16);
});

test("dates are filed in East Africa Time", () => {
  const invoice = buildEtimsInvoice({
    order: orderOf([product(), 1]),
    kraPin: "P051234567M",
    invoiceNumber: 10,
    filedAt: FILED_AT,
  });
  assert.equal(invoice.cfmDt, "20240305100000");
  assert.equal(invoice.salesDt, "20240305");
});

test("the order id is carried as the trader invoice number", () => {
  const invoice = buildEtimsInvoice({
    order: orderOf([product(), 1]),
    kraPin: "P051234567M",
    invoiceNumber: 11,
    filedAt: FILED_AT,
  });
  assert.equal(invoice.trdInvcNo, "order123");
  assert.equal(invoice.pmtTyCd, "06"); // mobile money
});

test("a missing classification code refuses to file rather than guessing", () => {
  assert.throws(
    () =>
      buildEtimsInvoice({
        order: orderOf([product({ itemClassificationCode: undefined }), 1]),
        kraPin: "P051234567M",
        invoiceNumber: 12,
        filedAt: FILED_AT,
      }),
    (error: unknown) =>
      error instanceof EtimsMappingError && /Sukari 1kg/.test((error as Error).message),
  );
});

test("a missing KRA PIN refuses to file", () => {
  assert.throws(
    () =>
      buildEtimsInvoice({
        order: orderOf([product(), 1]),
        kraPin: "",
        invoiceNumber: 13,
        filedAt: FILED_AT,
      }),
    EtimsMappingError,
  );
});
