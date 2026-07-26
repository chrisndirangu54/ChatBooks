# ChatBooks

A WhatsApp-native AI bookkeeper for small businesses — log sales and expenses by chat, read receipts automatically, and generate loan-ready financial reports. Built with Next.js (App Router) and Firebase.

This is the investor-demo build described in the roadmap: real Firebase Auth + Firestore, a WhatsApp-style chat simulator inside the app standing in for the Meta Cloud API webhook, and rule-based mocks for the AI parsing and OCR layers (both are swappable — see below).

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Firebase config lives in `.env.local` (already set up for the `paymesh-c9611` project, gitignored). Use `.env.local.example` as the template for a different project.

### Firebase console setup required

1. **Authentication** → Sign-in method → enable **Email/Password**.
2. **Firestore Database** → create a database (production mode) in your preferred region.
3. **Storage** → create a default bucket (used for receipt photo uploads).
4. Deploy the included security rules with the Firebase CLI:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use paymesh-c9611
   firebase deploy --only firestore:rules,storage:rules
   ```
   Rules restrict every business's data and receipt files to that business's own signed-in user (`firestore.rules`, `storage.rules`).

## Customer ordering over WhatsApp

The same WhatsApp number does two jobs. A message from the owner's own number
is bookkeeping, exactly as before; a message from anyone else is a customer
shopping. The fork is a single field — **Settings → Your WhatsApp number**.
Leave it blank and nothing changes: every message stays bookkeeping.

A customer's whole session is text, sized for a feature phone:

```
hi          → numbered catalog of active products
3           → adds item 3
3x2         → adds two of item 3
cart        → review
pay         → M-Pesa STK push; enter PIN on the handset
```

On payment, one Firestore transaction marks the order paid *and* writes the
matching sale to the books, so the two can't drift apart. Daraja retries any
callback it doesn't get a 200 for, so that step re-reads the order status and
does nothing if it has already run.

### Setup

1. **Products** → add your catalog. The price you enter is what the customer
   pays: Kenyan shelf prices are VAT-inclusive, so VAT is derived out of it.
2. **Settings** → set your WhatsApp number and KRA PIN.
3. Fill in the `MPESA_*` variables in `.env.local` (see `.env.local.example`).
   Register the callback URL with the token on it:
   `https://your-host/api/mpesa/callback?token=…`
4. Redeploy the Firestore rules — orders, products, sessions and the M-Pesa
   checkout index are all new.

### eTIMS

Filing sits behind the `EtimsProvider` interface in `lib/etims/provider.ts`.
Only the stub is implemented: it builds the complete KRA payload, logs it, and
the dashboard labels those orders **Simulated** rather than Filed. Nothing is
sent to KRA. Once you're onboarded, add a provider that POSTs `invoice` to your
OSCU/VSCU endpoint and select it with `ETIMS_PROVIDER` — the payment path
doesn't change.

Two things in `lib/etims/mapping.ts` are taxpayer-specific and must be checked
against the code list issued with your onboarding: the tax-type letters
(`A`/`B`/`C`) and each product's item classification code. A wrong code is a
misfiled return, so an order with no classification code refuses to file
instead of guessing.

## Tests

```bash
npm test
```

Runs the pure modules — VAT math, the shopping state machine, the Daraja wire
format and callback parser, the eTIMS mapping — under `node --test`. No
Firebase emulator or Daraja sandbox account needed: every one of those modules
returns the side effect it wants as data and lets a route handler perform it,
which is what keeps a state machine that can charge a customer safe to run in
a test.

## What's real vs. mocked

| Layer | Status |
|---|---|
| Auth, Firestore, Storage | Real — wired to your Firebase project |
| Chat-based transaction logging | Real UI/data flow; the WhatsApp Cloud API webhook itself isn't wired up, so the chat lives in-app |
| AI intent parsing (`src/lib/ai`) | Rule-based mock behind a `TransactionAIProvider` interface — swap in a Claude/OpenAI structured tool call without touching call sites |
| Receipt OCR (`src/lib/ocr`) | Mock behind a `ReceiptOCRProvider` interface — swap in Google Vision the same way |
| PDF reports | Real, generated client-side with jsPDF |
| M-Pesa STK push (`lib/mpesa`) | Real Daraja calls; point `MPESA_ENV` at sandbox until you're ready |
| eTIMS filing (`lib/etims`) | Stub behind an `EtimsProvider` interface — payload is built and logged, nothing reaches KRA |

## Structure

- `src/app` — routes: landing page, `/login`, `/signup`, `/dashboard` (overview, chat, transactions, reports, settings)
- `src/lib` — Firebase client, auth/dashboard context, Firestore data access, AI + OCR providers
- `src/components` — dashboard shell, chat UI, transaction UI, shared primitives

## Deploy

Deploy on [Vercel](https://vercel.com/new) or any Next.js host — set the same `NEXT_PUBLIC_FIREBASE_*` env vars there.
