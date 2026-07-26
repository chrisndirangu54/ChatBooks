import type { OrderItem, Product, ShopSession } from "@/types";
import { addToCart, totalsFor, type OrderTotals } from "./tax.ts";
import { formatMoney } from "./format.ts";

/**
 * The customer-facing shopping conversation, as a pure function.
 *
 * Everything that touches the outside world — Firestore, M-Pesa, WhatsApp
 * delivery — lives in the caller. This module only maps
 * `(session, catalog, message) → (next session, reply text, action to perform)`.
 * That's what makes the ordering flow testable without a Firebase emulator or
 * a Daraja sandbox account, and it's why the payment decision is returned as
 * data rather than executed here: a state machine that can charge a card is
 * one you can't safely run in a test.
 *
 * Pure module — only relative and type imports, so it runs under `node --test`.
 *
 * Input style is shaped by who's typing: a customer on a feature phone with
 * patchy signal. Commands are single words or bare numbers, case-insensitive,
 * and an unrecognised message re-shows the menu rather than scolding.
 */

export type ShopCommand =
  | { kind: "menu" }
  | { kind: "help" }
  | { kind: "cart" }
  | { kind: "add"; index: number; quantity: number }
  | { kind: "remove"; index: number }
  | { kind: "clear" }
  | { kind: "checkout" }
  | { kind: "cancel" }
  | { kind: "unknown" };

/** A side effect for the caller to perform after the turn. */
export type ShopAction =
  | { kind: "none" }
  | { kind: "checkout"; items: OrderItem[]; totals: OrderTotals };

export interface ShopTurn {
  session: ShopSession;
  reply: string;
  action: ShopAction;
}

export interface ShopTurnInput {
  session: ShopSession;
  /** Full product list; inactive items are filtered out here. */
  catalog: Product[];
  text: string;
  businessName: string;
  currency?: string;
  /** Injected rather than read from the clock, to keep this deterministic. */
  now: number;
}

/** Guards against a fat-fingered "1x9999" becoming a real M-Pesa charge. */
const MAX_QUANTITY = 999;

/** Show a remaining count only at or below this, so it reads as urgency. */
const LOW_STOCK_NOTICE = 5;

/**
 * The catalog as the customer sees it: active items only, in a stable order.
 *
 * The sort matters more than it looks — the numbers in the menu *are* the
 * ordering interface. If two messages rendered the same catalog in different
 * orders, "2" would buy different things on different turns.
 */
export function visibleCatalog(catalog: Product[]): Product[] {
  return catalog
    .filter((product) => product.active && availableStock(product) !== 0)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/**
 * Units available, or `null` when the product doesn't track stock.
 *
 * `null` and `0` must never be conflated: null means "sell as many as they
 * ask for", zero means "don't sell this at all".
 */
export function availableStock(product: Product): number | null {
  if (typeof product.stock !== "number") return null;
  return Math.max(0, Math.floor(product.stock));
}

export function parseCommand(text: string): ShopCommand {
  const input = text.trim().toLowerCase();
  if (!input) return { kind: "unknown" };

  if (/^(hi|hey|hello|start|menu|list|shop|products|niaje|sasa|mambo)\b/.test(input)) {
    return { kind: "menu" };
  }
  if (/^(help|\?)$/.test(input)) return { kind: "help" };
  if (/^(cart|basket|order)$/.test(input)) return { kind: "cart" };
  if (/^(clear|empty|reset)$/.test(input)) return { kind: "clear" };
  if (/^(pay|checkout|lipa|buy|mpesa|m-pesa)$/.test(input)) return { kind: "checkout" };
  if (/^(cancel|stop|no)$/.test(input)) return { kind: "cancel" };

  const remove = input.match(/^(?:remove|delete|del)\s+(\d+)$/);
  if (remove) return { kind: "remove", index: Number(remove[1]) };

  // "3", "add 3", "3x2", "3 * 2", "add 3 x 2". A quantity needs an explicit
  // x/* separator: a bare "1 2" is more likely to mean "items 1 and 2" than
  // "two of item 1", and guessing wrong bills someone for the wrong thing.
  const add = input.match(/^(?:add\s+)?(\d+)\s*(?:[x*]\s*(\d+))?$/);
  if (add) {
    const quantity = add[2] ? Number(add[2]) : 1;
    return { kind: "add", index: Number(add[1]), quantity };
  }

  return { kind: "unknown" };
}

/** Lowercase, punctuation-free tokens — "Sukari 1kg!" → ["sukari", "1kg"]. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/**
 * Match a message against product names, so "want to buy sukari" works.
 *
 * Real customers type the thing they want, not its menu number — the numbers
 * are a convenience for feature phones, not a language. Without this, a
 * perfectly clear message falls through to "I didn't catch that".
 *
 * Matches on the product's leading word rather than its full name, because
 * catalogs read "Sukari 1kg" while customers type "sukari". Longest match wins,
 * so "unga ngano" beats a bare "unga" when both are stocked.
 */
export function matchProductByName(
  catalog: Product[],
  text: string,
): { product: Product; quantity: number } | null {
  const tokens = tokenize(text);
  if (tokens.length === 0) return null;

  let best: { product: Product; at: number; length: number } | null = null;

  for (const product of catalog) {
    const nameTokens = tokenize(product.name);
    if (nameTokens.length === 0) continue;

    // Try the full name first, then progressively shorter prefixes, down to a
    // single leading word of 3+ characters. Two letters matches too much.
    for (let length = nameTokens.length; length >= 1; length -= 1) {
      const phrase = nameTokens.slice(0, length);
      if (length === 1 && phrase[0].length < 3) break;

      const at = indexOfSequence(tokens, phrase);
      if (at === -1) continue;

      if (!best || length > best.length) best = { product, at, length };
      break;
    }
  }

  if (!best) return null;

  // Only read a quantity from the token immediately before the name. Anything
  // looser turns "sukari 500 ml" into an order for five hundred bags.
  const preceding = best.at > 0 ? tokens[best.at - 1] : undefined;
  const quantity = preceding && /^\d{1,3}$/.test(preceding) ? Number(preceding) : 1;

  return { product: best.product, quantity: quantity >= 1 ? quantity : 1 };
}

function indexOfSequence(haystack: string[], needle: string[]): number {
  outer: for (let i = 0; i + needle.length <= haystack.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function renderCatalog(catalog: Product[], businessName: string, currency: string): string {
  if (catalog.length === 0) {
    return `🛒 *${businessName}*\n\nThe catalog is empty right now — please check back shortly.`;
  }

  const lines = catalog.map((product, index) => {
    const remaining = availableStock(product);
    // Only surface a count when it's low enough to matter. "3 left" nudges;
    // "247 left" is noise on a phone screen.
    const scarcity = remaining !== null && remaining <= LOW_STOCK_NOTICE ? ` — only ${remaining} left` : "";
    return `${index + 1}. ${product.name}${product.unit ? ` (${product.unit})` : ""} — ${formatMoney(product.price, currency)}${scarcity}`;
  });

  return [
    `🛒 *${businessName}*`,
    "",
    ...lines,
    "",
    "Reply with a number to add it (e.g. *1*), or *1x3* for three.",
    "Then *CART* to review, *PAY* to pay by M-Pesa.",
  ].join("\n");
}

function renderCart(items: OrderItem[], currency: string): string {
  if (items.length === 0) {
    return "Your cart is empty. Reply *MENU* to see what's available.";
  }

  const { total } = totalsFor(items);
  const lines = items.map(
    (item, index) =>
      `${index + 1}. ${item.name} × ${item.quantity} — ${formatMoney(item.lineTotal, currency)}`,
  );

  return [
    "🧺 *Your cart*",
    "",
    ...lines,
    "",
    `*Total: ${formatMoney(total, currency)}*`,
    "",
    "Reply *PAY* to pay by M-Pesa, *REMOVE 1* to drop a line, or *MENU* to keep shopping.",
  ].join("\n");
}

const HELP_TEXT = [
  "Here's how to order:",
  "",
  "*MENU* — see what's for sale",
  "*2* — add item 2 to your cart",
  "*2x3* — add three of item 2",
  "*CART* — review your cart",
  "*REMOVE 2* — drop line 2",
  "*CLEAR* — empty the cart",
  "*PAY* — pay by M-Pesa",
].join("\n");

/**
 * Advance the conversation by one customer message.
 *
 * Never mutates `input.session`; the returned session is a fresh object, so a
 * caller that fails to persist leaves the customer exactly where they were.
 */
export function handleCustomerMessage(input: ShopTurnInput): ShopTurn {
  const { session, text, businessName, now } = input;
  const currency = input.currency || "KES";
  const catalog = visibleCatalog(input.catalog);
  const command = parseCommand(text);

  const stay = (reply: string, patch: Partial<ShopSession> = {}): ShopTurn => ({
    session: { ...session, ...patch, updatedAt: now },
    reply,
    action: { kind: "none" },
  });

  /** Shared by the "3" form and the "sukari" form — same rules either way. */
  const addToCartTurn = (product: Product, requested: number): ShopTurn => {
    if (requested < 1 || requested > MAX_QUANTITY) {
      return stay(`Please choose a quantity between 1 and ${MAX_QUANTITY}.`);
    }

    // Cap against what's left, counting what this customer is already holding.
    // Refusing here is far kinder than taking the money and discovering the
    // shortfall at settlement.
    const remaining = availableStock(product);
    const alreadyInCart = session.items.find((i) => i.productId === product.id)?.quantity ?? 0;
    const grantable = remaining === null ? requested : Math.max(0, remaining - alreadyInCart);

    if (grantable === 0) {
      return stay(
        remaining === 0
          ? `Sorry, ${product.name} is out of stock.`
          : `You already have all ${remaining} of the ${product.name} we have left in your cart.`,
      );
    }

    const granted = Math.min(requested, grantable);
    const items = addToCart(session.items, product, granted);
    const { total } = totalsFor(items);

    return stay(
      [
        `Added ${granted} × ${product.name} ✅`,
        ...(granted < requested ? [`(that's all ${granted} we had left)`] : []),
        `Cart total: ${formatMoney(total, currency)}`,
        "",
        "Reply with another number to keep shopping, or *PAY* to pay by M-Pesa.",
      ].join("\n"),
      { state: "cart", items },
    );
  };

  // While an STK prompt is live, the only safe move is to finish or abandon it.
  // Re-pushing on "PAY" could leave two prompts on the handset and two debits
  // against one cart, so a resend has to go through an explicit CANCEL first.
  if (session.state === "awaiting_payment") {
    if (command.kind === "cancel") {
      return stay(
        "Payment cancelled. Your cart is still here — reply *CART* to review or *PAY* to try again.",
        { state: "cart", orderId: undefined },
      );
    }
    return stay(
      "⏳ We're waiting for you to enter your M-Pesa PIN. If you didn't get the prompt, reply *CANCEL* and then *PAY* to send it again.",
    );
  }

  switch (command.kind) {
    case "menu":
      return stay(renderCatalog(catalog, businessName, currency), { state: "browsing" });

    case "help":
      return stay(HELP_TEXT);

    case "cart":
      return stay(renderCart(session.items, currency));

    case "clear":
      return stay("Cart cleared. Reply *MENU* to start again.", { state: "browsing", items: [] });

    case "cancel":
      return stay("No problem. Reply *MENU* whenever you're ready.", { state: "browsing" });

    case "add": {
      const product = catalog[command.index - 1];
      if (!product) {
        return stay(
          `I don't have an item ${command.index}.\n\n${renderCatalog(catalog, businessName, currency)}`,
        );
      }
      return addToCartTurn(product, command.quantity);
    }

    case "remove": {
      const target = session.items[command.index - 1];
      if (!target) {
        return stay(`There's no line ${command.index} in your cart.\n\n${renderCart(session.items, currency)}`);
      }
      const items = session.items.filter((_, index) => index !== command.index - 1);
      return stay(`Removed ${target.name}.\n\n${renderCart(items, currency)}`, {
        state: items.length ? "cart" : "browsing",
        items,
      });
    }

    case "checkout": {
      if (session.items.length === 0) {
        return stay("Your cart is empty — add something first.\n\n" + renderCatalog(catalog, businessName, currency));
      }
      const totals = totalsFor(session.items);
      return {
        session: { ...session, state: "awaiting_payment", updatedAt: now },
        reply: `Sending an M-Pesa request for ${formatMoney(totals.total, currency)} — check your phone and enter your PIN. 📲`,
        action: { kind: "checkout", items: session.items, totals },
      };
    }

    case "unknown":
    default: {
      // Before giving up, check whether they simply named what they want —
      // "want to buy sukari" is a clear order, not a parse failure.
      const named = matchProductByName(catalog, text);
      if (named) return addToCartTurn(named.product, named.quantity);

      return stay(
        ["I didn't catch that.", "", renderCatalog(catalog, businessName, currency)].join("\n"),
      );
    }
  }
}

/** A fresh session for a customer we haven't seen before. */
export function newSession(phone: string, now: number): ShopSession {
  return { phone, state: "browsing", items: [], updatedAt: now };
}
