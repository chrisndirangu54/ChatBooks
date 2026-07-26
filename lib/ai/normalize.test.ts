/**
 * TEMPORARY test scratchpad for the normalizer. Run with:
 *   node --experimental-strip-types lib/ai/normalize.test.ts
 * Delete after verifying — this repo has no test runner wired up.
 */
import { normalizeExtraction, extractJson } from "./normalize.ts";

let passed = 0;
let failed = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed += 1;
  } else {
    failed += 1;
    console.log(`FAIL ${name}\n  expected ${e}\n  actual   ${a}`);
  }
}

const CATS = ["sales", "inventory", "transport", "wages", "other"];
const ok = {
  isTransaction: true,
  type: "sale",
  amount: 1500,
  category: "sales",
  note: "Rice - 3 bags",
  confidence: 0.95,
  reasoning: "explicit",
};

// ── happy path ───────────────────────────────────────────────────────────────
check("clean sale", normalizeExtraction(ok, "sold rice 1500", CATS), {
  type: "sale",
  amount: 1500,
  category: "sales",
  note: "Rice - 3 bags",
  confidence: 0.95,
});

// ── rejections: nothing here should ever reach the ledger ─────────────────────
check("not a transaction", normalizeExtraction({ ...ok, isTransaction: false }, "hi", CATS), null);
check("missing flag", normalizeExtraction({ ...ok, isTransaction: undefined }, "hi", CATS), null);
check("zero amount", normalizeExtraction({ ...ok, amount: 0 }, "x", CATS), null);
check("negative amount", normalizeExtraction({ ...ok, amount: -50 }, "x", CATS), null);
check("NaN amount", normalizeExtraction({ ...ok, amount: Number.NaN }, "x", CATS), null);
check("Infinity amount", normalizeExtraction({ ...ok, amount: Infinity }, "x", CATS), null);
check("string amount", normalizeExtraction({ ...ok, amount: "1500" }, "x", CATS), null);
check("absurd amount", normalizeExtraction({ ...ok, amount: 5e12 }, "x", CATS), null);
check("null input", normalizeExtraction(null, "x", CATS), null);
check("undefined input", normalizeExtraction(undefined, "x", CATS), null);

// ── category resolution ──────────────────────────────────────────────────────
check(
  "category casing snaps to the business's own",
  normalizeExtraction({ ...ok, category: "INVENTORY" }, "x", CATS)?.category,
  "inventory",
);
check(
  "unknown category is kept, lowercased",
  normalizeExtraction({ ...ok, category: "Packaging" }, "x", CATS)?.category,
  "packaging",
);
check(
  "empty category falls back by type (sale)",
  normalizeExtraction({ ...ok, category: "" }, "x", CATS)?.category,
  "sales",
);
check(
  "empty category falls back by type (expense)",
  normalizeExtraction({ ...ok, type: "expense", category: "  " }, "x", CATS)?.category,
  "other",
);
check(
  "non-string category falls back",
  normalizeExtraction({ ...ok, category: 42 }, "x", CATS)?.category,
  "sales",
);

// ── confidence clamping ──────────────────────────────────────────────────────
check("confidence >1 clamps", normalizeExtraction({ ...ok, confidence: 4 }, "x", CATS)?.confidence, 1);
check("confidence <0 clamps", normalizeExtraction({ ...ok, confidence: -2 }, "x", CATS)?.confidence, 0);
check(
  "unusable confidence → 0.5 (routes to review)",
  normalizeExtraction({ ...ok, confidence: "high" }, "x", CATS)?.confidence,
  0.5,
);

// ── type coercion ────────────────────────────────────────────────────────────
check("expense preserved", normalizeExtraction({ ...ok, type: "expense" }, "x", CATS)?.type, "expense");
check("garbage type defaults to sale", normalizeExtraction({ ...ok, type: "refund" }, "x", CATS)?.type, "sale");

// ── notes ────────────────────────────────────────────────────────────────────
check(
  "empty note falls back to the owner's message",
  normalizeExtraction({ ...ok, note: "" }, "  sold rice 1500  ", CATS)?.note,
  "sold rice 1500",
);
check(
  "long note is truncated to 140",
  normalizeExtraction({ ...ok, note: "z".repeat(300) }, "x", CATS)?.note?.length,
  140,
);

// ── rounding ─────────────────────────────────────────────────────────────────
check("float rounds to cents", normalizeExtraction({ ...ok, amount: 1500.456 }, "x", CATS)?.amount, 1500.46);

// ── extractJson ──────────────────────────────────────────────────────────────
check("plain json", extractJson('{"a":1}'), { a: 1 });
check("whitespace tolerated", extractJson('\n  {"a":1}\n'), { a: 1 });
check("salvages wrapped json", extractJson('Here you go: {"a":1} done'), { a: 1 });
check("empty string", extractJson("   "), null);
check("unrecoverable", extractJson("not json at all"), null);
check("truncated json", extractJson('{"a":1'), null);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
