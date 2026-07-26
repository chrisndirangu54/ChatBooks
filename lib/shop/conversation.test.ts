import assert from "node:assert/strict";
import { test } from "node:test";
import {
  availableStock,
  handleCustomerMessage,
  newSession,
  parseCommand,
  visibleCatalog,
} from "./conversation.ts";
import type { Product, ShopSession } from "@/types";

const CATALOG: Product[] = [
  { id: "b", name: "Maziwa 500ml", price: 65, active: true, createdAt: 0, taxCategory: "vat_16" },
  { id: "a", name: "Mkate", price: 70, active: true, createdAt: 0, taxCategory: "vat_zero" },
  { id: "c", name: "Sukari 1kg", price: 180, active: true, createdAt: 0, taxCategory: "vat_16" },
  { id: "d", name: "Sigara", price: 20, active: false, createdAt: 0, taxCategory: "vat_16" },
];

const NOW = 1_700_000_000_000;

function turn(text: string, session: ShopSession = newSession("254700000001", NOW)) {
  return handleCustomerMessage({
    session,
    catalog: CATALOG,
    text,
    businessName: "Mama Njeri Shop",
    currency: "KES",
    now: NOW,
  });
}

/** Walk a conversation, threading the session through each message. */
function conversation(...messages: string[]) {
  let session = newSession("254700000001", NOW);
  let last = turn(messages[0], session);
  session = last.session;
  for (const message of messages.slice(1)) {
    last = turn(message, session);
    session = last.session;
  }
  return last;
}

test("the catalog hides inactive items and sorts stably", () => {
  const visible = visibleCatalog(CATALOG);
  assert.deepEqual(
    visible.map((p) => p.name),
    ["Maziwa 500ml", "Mkate", "Sukari 1kg"],
  );
  // Sold-out items must not occupy a number — "4" would buy the wrong thing.
  assert.equal(
    visible.some((p) => p.name === "Sigara"),
    false,
  );
});

test("a greeting shows the numbered menu", () => {
  const { reply } = turn("hi");
  assert.match(reply, /1\. Maziwa 500ml/);
  assert.match(reply, /3\. Sukari 1kg/);
  assert.doesNotMatch(reply, /Sigara/);
});

test("a bare number adds that item", () => {
  const { session, reply } = turn("3");
  assert.equal(session.items.length, 1);
  assert.equal(session.items[0].name, "Sukari 1kg");
  assert.equal(session.items[0].quantity, 1);
  assert.equal(session.state, "cart");
  assert.match(reply, /Added 1 × Sukari 1kg/);
});

test("NxM syntax sets the quantity", () => {
  for (const syntax of ["3x2", "3 x 2", "3*2", "add 3 x 2"]) {
    const { session } = turn(syntax);
    assert.equal(session.items[0].quantity, 2, syntax);
    assert.equal(session.items[0].lineTotal, 360, syntax);
  }
});

test("a bare '1 2' is not read as a quantity", () => {
  // Ambiguous between "items 1 and 2" and "two of item 1"; guessing bills
  // someone for the wrong thing, so it falls through to the menu.
  assert.deepEqual(parseCommand("1 2"), { kind: "unknown" });
});

test("an out-of-range item number is refused and the menu re-shown", () => {
  const { session, reply } = turn("9");
  assert.equal(session.items.length, 0);
  assert.match(reply, /don't have an item 9/);
  assert.match(reply, /1\. Maziwa 500ml/);
});

test("an absurd quantity is refused", () => {
  const { session, reply } = turn("3x5000");
  assert.equal(session.items.length, 0);
  assert.match(reply, /between 1 and 999/);
});

test("unrecognised text re-shows the menu instead of scolding", () => {
  const { reply, action } = turn("do you have bread??");
  assert.equal(action.kind, "none");
  assert.match(reply, /1\. Maziwa 500ml/);
});

test("PAY on an empty cart does not start a payment", () => {
  const { action, reply } = turn("pay");
  assert.equal(action.kind, "none");
  assert.match(reply, /cart is empty/);
});

test("PAY with items emits a checkout action with reconciled totals", () => {
  const { action, session } = conversation("3", "1", "pay");
  assert.equal(session.state, "awaiting_payment");
  assert.equal(action.kind, "checkout");
  if (action.kind !== "checkout") return;
  assert.equal(action.totals.total, 245); // 180 + 65
  assert.equal(action.totals.netTotal + action.totals.taxTotal, action.totals.total);
});

test("PAY again while a prompt is live does NOT push a second STK request", () => {
  // Two live prompts against one cart is two debits. The resend has to be
  // deliberate: CANCEL first, then PAY.
  const { session, action, reply } = conversation("3", "pay", "pay");
  assert.equal(action.kind, "none");
  assert.equal(session.state, "awaiting_payment");
  assert.match(reply, /waiting for you to enter your M-Pesa PIN/);
});

test("CANCEL during payment returns to the cart with items intact", () => {
  const { session, action } = conversation("3", "pay", "cancel");
  assert.equal(action.kind, "none");
  assert.equal(session.state, "cart");
  assert.equal(session.items.length, 1);
  assert.equal(session.orderId, undefined);
});

test("cancel-then-pay is allowed to push again", () => {
  const { action } = conversation("3", "pay", "cancel", "pay");
  assert.equal(action.kind, "checkout");
});

test("REMOVE drops the numbered cart line", () => {
  // Cart lines are numbered in the order they were added, not catalog order:
  // "3" (Sukari) went in first, so line 1 is Sukari.
  const { session } = conversation("3", "1", "remove 1");
  assert.deepEqual(
    session.items.map((i) => i.name),
    ["Maziwa 500ml"],
  );
});

test("removing a line that isn't there changes nothing", () => {
  const { session, reply } = conversation("3", "remove 7");
  assert.equal(session.items.length, 1);
  assert.match(reply, /no line 7/);
});

test("CLEAR empties the cart", () => {
  const { session } = conversation("3", "1", "clear");
  assert.deepEqual(session.items, []);
  assert.equal(session.state, "browsing");
});

test("CART shows the running total", () => {
  const { reply } = conversation("3x2", "cart");
  assert.match(reply, /Sukari 1kg × 2/);
  assert.match(reply, /Total: KES 360/);
});

test("the input session is never mutated", () => {
  const session = newSession("254700000001", NOW);
  handleCustomerMessage({
    session,
    catalog: CATALOG,
    text: "3",
    businessName: "Mama Njeri Shop",
    now: NOW,
  });
  assert.deepEqual(session.items, []);
  assert.equal(session.state, "browsing");
});

// ── Stock ──────────────────────────────────────────────────────────────────

const STOCKED: Product[] = [
  { id: "s1", name: "Amchi", price: 100, active: true, createdAt: 0, taxCategory: "vat_16", stock: 3 },
  { id: "s2", name: "Bamia", price: 50, active: true, createdAt: 0, taxCategory: "vat_16", stock: 0 },
  { id: "s3", name: "Chumvi", price: 30, active: true, createdAt: 0, taxCategory: "vat_16" },
];

function stockedTurn(text: string, session: ShopSession = newSession("254700000001", NOW)) {
  return handleCustomerMessage({
    session,
    catalog: STOCKED,
    text,
    businessName: "Mama Njeri Shop",
    currency: "KES",
    now: NOW,
  });
}

test("a product with no stock field is treated as unlimited, not as zero", () => {
  // Every product predating stock tracking has no value here. Reading the
  // missing field as 0 would empty the catalog on deploy.
  assert.equal(availableStock(STOCKED[2]), null);
  assert.equal(
    visibleCatalog(STOCKED).some((p) => p.name === "Chumvi"),
    true,
  );
});

test("a sold-out product is hidden from the catalog", () => {
  assert.deepEqual(
    visibleCatalog(STOCKED).map((p) => p.name),
    ["Amchi", "Chumvi"],
  );
});

test("an untracked product can be ordered in any quantity", () => {
  const { session } = stockedTurn("2x50"); // Chumvi, untracked
  assert.equal(session.items[0].quantity, 50);
});

test("a request beyond stock is capped rather than refused outright", () => {
  const { session, reply } = stockedTurn("1x10"); // Amchi, 3 on hand
  assert.equal(session.items[0].quantity, 3);
  assert.match(reply, /all 3 we had left/);
});

test("stock is counted against what's already in the cart", () => {
  let session = newSession("254700000001", NOW);
  session = stockedTurn("1x2", session).session;
  const second = stockedTurn("1x2", session);
  assert.equal(second.session.items[0].quantity, 3); // 2 + 1, not 2 + 2
});

test("asking for more once the cart already holds every unit is refused", () => {
  let session = newSession("254700000001", NOW);
  session = stockedTurn("1x3", session).session;
  const third = stockedTurn("1", session);
  assert.equal(third.session.items[0].quantity, 3);
  assert.match(third.reply, /already have all 3/);
});

test("low stock is flagged in the catalog, plentiful stock is not", () => {
  const { reply } = stockedTurn("menu");
  assert.match(reply, /Amchi.*only 3 left/);
  assert.doesNotMatch(reply, /Chumvi.*left/);
});

test("an empty catalog says so instead of rendering a bare header", () => {
  const { reply } = handleCustomerMessage({
    session: newSession("254700000001", NOW),
    catalog: [],
    text: "menu",
    businessName: "Mama Njeri Shop",
    now: NOW,
  });
  assert.match(reply, /catalog is empty/);
});
