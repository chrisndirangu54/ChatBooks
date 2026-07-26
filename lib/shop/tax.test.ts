import assert from "node:assert/strict";
import { test } from "node:test";
import { addToCart, lineFor, taxFromInclusive, totalsFor, VAT_RATE } from "./tax.ts";
import type { Product } from "@/types";

const product = (over: Partial<Product> = {}): Product => ({
  id: "p1",
  name: "Sukari 1kg",
  price: 180,
  active: true,
  createdAt: 0,
  taxCategory: "vat_16",
  ...over,
});

test("VAT is extracted out of the shelf price, not added to it", () => {
  // The classic off-by-VAT bug: 116 * 0.16 = 18.56 would be wrong.
  assert.equal(taxFromInclusive(116, "vat_16"), 16);
  assert.equal(taxFromInclusive(180, "vat_16"), 24.83);
});

test("zero-rated and exempt lines carry no VAT", () => {
  assert.equal(taxFromInclusive(180, "vat_zero"), 0);
  assert.equal(taxFromInclusive(180, "exempt"), 0);
});

test("VAT_RATE is the standard Kenyan rate", () => {
  assert.equal(VAT_RATE, 0.16);
});

test("the customer's total is exactly the sum of shelf prices", () => {
  const items = [lineFor(product(), 2), lineFor(product({ id: "p2", name: "Unga", price: 210 }), 1)];
  const { total } = totalsFor(items);
  assert.equal(total, 570); // 180*2 + 210 — no VAT bolted on top
});

test("net plus tax reconciles to the total, as KRA expects", () => {
  const items = [
    lineFor(product(), 3),
    lineFor(product({ id: "p2", name: "Maziwa", price: 65 }), 2),
    lineFor(product({ id: "p3", name: "Mkate", price: 70, taxCategory: "vat_zero" }), 1),
  ];
  const { total, taxTotal, netTotal } = totalsFor(items);
  assert.equal(netTotal + taxTotal, total);
});

test("a zero-rated line contributes value but no tax", () => {
  const zeroRated = [lineFor(product({ taxCategory: "vat_zero" }), 1)];
  const { total, taxTotal, netTotal } = totalsFor(zeroRated);
  assert.equal(total, 180);
  assert.equal(taxTotal, 0);
  assert.equal(netTotal, 180);
});

test("an empty cart totals zero rather than NaN", () => {
  assert.deepEqual(totalsFor([]), { total: 0, taxTotal: 0, netTotal: 0 });
});

test("adding the same product twice stacks the quantity", () => {
  const cart = addToCart(addToCart([], product(), 1), product(), 2);
  assert.equal(cart.length, 1);
  assert.equal(cart[0].quantity, 3);
  assert.equal(cart[0].lineTotal, 540);
});

test("addToCart leaves the original cart untouched", () => {
  const original = addToCart([], product(), 1);
  addToCart(original, product({ id: "p2", name: "Unga" }), 1);
  assert.equal(original.length, 1);
});

test("order lines snapshot the price, so later edits can't rewrite history", () => {
  const line = lineFor(product({ price: 180 }), 1);
  lineFor(product({ price: 999 }), 1);
  assert.equal(line.unitPrice, 180);
});
