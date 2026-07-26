import assert from "node:assert/strict";
import { test } from "node:test";
import { decideReconciliation } from "./reconcile-policy.ts";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

const base = {
  hasCheckoutId: true,
  settled: true,
  ageMs: 10 * MINUTE,
  maxAgeMs: DAY,
};

test("a confirmed payment is recorded no matter how old the order is", () => {
  // The customer's money left their account. Age is irrelevant.
  assert.equal(
    decideReconciliation({ ...base, resultCode: 0, ageMs: 30 * DAY }),
    "settle_paid",
  );
});

test("a definite failure is recorded", () => {
  for (const resultCode of [1, 1032, 2001]) {
    assert.equal(decideReconciliation({ ...base, resultCode }), "settle_failed", String(resultCode));
  }
});

test("a prompt still on the handset is left alone", () => {
  assert.equal(
    decideReconciliation({ ...base, resultCode: 1037, settled: false, ageMs: 3 * MINUTE }),
    "wait",
  );
});

test("a prompt still pending past the cutoff is expired, not failed", () => {
  // "Expire" and "fail" read differently to a shopkeeper: one is the customer
  // declining, the other is us losing track.
  assert.equal(
    decideReconciliation({ ...base, resultCode: 1037, settled: false, ageMs: 2 * DAY }),
    "expire",
  );
});

test("a failed status query means keep trying, not assume failure", () => {
  // Assuming failure on a Daraja outage would cancel orders that were paid.
  assert.equal(decideReconciliation({ ...base, resultCode: undefined }), "wait");
});

test("a failed status query on an ancient order gives up", () => {
  assert.equal(
    decideReconciliation({ ...base, resultCode: undefined, ageMs: 2 * DAY }),
    "expire",
  );
});

test("an order whose push never returned an id can only be waited on or expired", () => {
  assert.equal(decideReconciliation({ ...base, hasCheckoutId: false, resultCode: 0 }), "settle_paid");
  assert.equal(
    decideReconciliation({ ...base, hasCheckoutId: false, resultCode: undefined }),
    "wait",
  );
  assert.equal(
    decideReconciliation({
      ...base,
      hasCheckoutId: false,
      resultCode: undefined,
      ageMs: 2 * DAY,
    }),
    "expire",
  );
});

test("exactly at the cutoff is not yet too old", () => {
  assert.equal(
    decideReconciliation({ ...base, resultCode: undefined, ageMs: DAY, maxAgeMs: DAY }),
    "wait",
  );
});
