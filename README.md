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

## What's real vs. mocked

| Layer | Status |
|---|---|
| Auth, Firestore, Storage | Real — wired to your Firebase project |
| Chat-based transaction logging | Real UI/data flow; the WhatsApp Cloud API webhook itself isn't wired up, so the chat lives in-app |
| AI intent parsing (`src/lib/ai`) | Rule-based mock behind a `TransactionAIProvider` interface — swap in a Claude/OpenAI structured tool call without touching call sites |
| Receipt OCR (`src/lib/ocr`) | Mock behind a `ReceiptOCRProvider` interface — swap in Google Vision the same way |
| PDF reports | Real, generated client-side with jsPDF |

## Structure

- `src/app` — routes: landing page, `/login`, `/signup`, `/dashboard` (overview, chat, transactions, reports, settings)
- `src/lib` — Firebase client, auth/dashboard context, Firestore data access, AI + OCR providers
- `src/components` — dashboard shell, chat UI, transaction UI, shared primitives

## Deploy

Deploy on [Vercel](https://vercel.com/new) or any Next.js host — set the same `NEXT_PUBLIC_FIREBASE_*` env vars there.
