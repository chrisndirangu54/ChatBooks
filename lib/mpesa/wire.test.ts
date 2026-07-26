import assert from "node:assert/strict";
import { test } from "node:test";
import {
  darajaAmount,
  darajaTimestamp,
  normalizeMsisdn,
  parseDarajaDate,
  stkPassword,
} from "./wire.ts";
import { describeFailure, parseStkCallback } from "./callback.ts";

test("every way a Kenyan customer writes their number normalises to 254…", () => {
  for (const input of [
    "0712345678",
    "+254712345678",
    "254712345678",
    "254 712 345 678",
    "+254 712-345-678",
    "712345678",
  ]) {
    assert.equal(normalizeMsisdn(input), "254712345678", input);
  }
});

test("Safaricom's 01x range normalises too", () => {
  assert.equal(normalizeMsisdn("0110123456"), "254110123456");
});

test("a number that can't be a Kenyan mobile is rejected, not guessed", () => {
  // Guessing here would send a stranger a PIN prompt.
  for (const input of ["", "12345", "0812345678", "254812345678", "07123456789", "abcd"]) {
    assert.equal(normalizeMsisdn(input), null, input);
  }
});

test("the timestamp is East Africa Time, not UTC", () => {
  // 09:30 UTC is 12:30 in Nairobi; using UTC here silently breaks the password.
  assert.equal(darajaTimestamp(new Date("2024-01-15T09:30:00Z")), "20240115123000");
});

test("the timestamp rolls the date correctly across EAT midnight", () => {
  assert.equal(darajaTimestamp(new Date("2024-01-14T21:00:00Z")), "20240115000000");
});

test("the password is base64 of shortcode + passkey + timestamp", () => {
  const password = stkPassword("174379", "secretpass", "20240115123000");
  assert.equal(
    Buffer.from(password, "base64").toString("utf8"),
    "174379secretpass20240115123000",
  );
});

test("the amount is whole shillings and never zero", () => {
  assert.equal(darajaAmount(245), 245);
  assert.equal(darajaAmount(245.4), 245);
  assert.equal(darajaAmount(0.2), 1); // Daraja rejects 0
});

test("TransactionDate is read as EAT", () => {
  // 2019-12-19 10:21:15 in Nairobi == 07:21:15 UTC
  assert.equal(parseDarajaDate(20191219102115), Date.parse("2019-12-19T07:21:15Z"));
});

test("a malformed TransactionDate yields undefined rather than an Invalid Date", () => {
  assert.equal(parseDarajaDate("not-a-date"), undefined);
});

const SUCCESS_CALLBACK = {
  Body: {
    stkCallback: {
      MerchantRequestID: "29115-34620561-1",
      CheckoutRequestID: "ws_CO_191220191020363925",
      ResultCode: 0,
      ResultDesc: "The service request is processed successfully.",
      CallbackMetadata: {
        Item: [
          { Name: "Amount", Value: 245 },
          { Name: "MpesaReceiptNumber", Value: "NLJ7RT61SV" },
          { Name: "TransactionDate", Value: 20191219102115 },
          { Name: "PhoneNumber", Value: 254712345678 },
        ],
      },
    },
  },
};

test("a successful callback yields the receipt, amount and time", () => {
  const result = parseStkCallback(SUCCESS_CALLBACK);
  assert.ok(result);
  assert.equal(result.success, true);
  assert.equal(result.receiptNumber, "NLJ7RT61SV");
  assert.equal(result.amount, 245);
  assert.equal(result.phone, "254712345678");
  assert.equal(result.paidAt, Date.parse("2019-12-19T07:21:15Z"));
});

test("a cancelled callback has no CallbackMetadata and must not throw", () => {
  // This is the shape that 500s a naive handler — and a 500 makes Daraja retry.
  const result = parseStkCallback({
    Body: {
      stkCallback: {
        MerchantRequestID: "29115-34620561-1",
        CheckoutRequestID: "ws_CO_191220191020363925",
        ResultCode: 1032,
        ResultDesc: "Request cancelled by user",
      },
    },
  });
  assert.ok(result);
  assert.equal(result.success, false);
  assert.equal(result.resultCode, 1032);
  assert.equal(result.receiptNumber, undefined);
  assert.match(describeFailure(result), /cancelled/i);
});

test("a string ResultCode is still understood", () => {
  const result = parseStkCallback({
    Body: { stkCallback: { CheckoutRequestID: "ws_CO_1", ResultCode: "0", ResultDesc: "ok" } },
  });
  assert.equal(result?.success, true);
});

test("garbage bodies parse to null rather than to a failed payment", () => {
  // A null return is "bad request"; a parsed failure would wrongly tell a
  // customer their payment was declined.
  assert.equal(parseStkCallback(null), null);
  assert.equal(parseStkCallback({}), null);
  assert.equal(parseStkCallback({ Body: {} }), null);
  assert.equal(parseStkCallback({ Body: { stkCallback: { ResultCode: 0 } } }), null);
  assert.equal(
    parseStkCallback({ Body: { stkCallback: { CheckoutRequestID: "x", ResultCode: "nope" } } }),
    null,
  );
});

test("insufficient funds gets a plain-language reason", () => {
  const result = parseStkCallback({
    Body: { stkCallback: { CheckoutRequestID: "ws_CO_1", ResultCode: 1, ResultDesc: "..." } },
  });
  assert.ok(result);
  assert.match(describeFailure(result), /enough money/i);
});
