import Link from "next/link";
import {
  MessageSquareText,
  Camera,
  Smartphone,
  FileBarChart,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

const FEATURES = [
  {
    icon: MessageSquareText,
    title: "Chat-native logging",
    description: 'Text "Sold rice 1500" and it\'s saved — structured, categorized, instantly.',
  },
  {
    icon: Camera,
    title: "Receipts, read automatically",
    description: "Snap a photo of a supplier receipt and confirm the extracted amount in one tap.",
  },
  {
    icon: Smartphone,
    title: "Mobile money aware",
    description: "Built for how businesses actually get paid — M-Pesa, MoMo, and cash side by side.",
  },
  {
    icon: FileBarChart,
    title: "Loan-ready reports",
    description: "Every transaction compounds into a financial identity a lender can trust.",
  },
];

const JOURNEY = [
  { day: "Day 1", you: "Sold rice 1500.", bot: "Saved — Sale: 1500 (Rice)." },
  { day: "Day 3", you: "[Sends a receipt photo]", bot: "I see 2,300 from Supplier XYZ. Save as expense?" },
  { day: "Day 7", you: "", bot: "This week — Sales: 15,000. Expenses: 9,000. Profit: 6,000." },
  { day: "Day 30", you: "Send me a report", bot: "Here's your PDF, ready for your loan officer." },
];

export default function LandingPage() {
  return (
    <div className="flex-1 bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <MessageSquareText size={18} />
          </div>
          <span className="text-lg font-semibold text-slate-900">ChatBooks</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Get started
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 pt-16 pb-20 text-center">
        <p className="mb-4 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          Built for small businesses across Africa
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          Your accountant lives in <span className="text-emerald-600">WhatsApp</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-500">
          Small business owners forget transactions, mix personal and business money, and can&apos;t
          access credit. ChatBooks logs sales by chat, reads receipts automatically, tracks mobile
          money, and prepares loan-ready financials — no spreadsheet required.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Try the demo <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-100">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <feature.icon size={18} />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-1.5 text-sm text-slate-500">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="mb-6 text-center text-2xl font-semibold text-slate-900">
          What using ChatBooks actually looks like
        </h2>
        <div className="space-y-3 rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-100">
          {JOURNEY.map((step) => (
            <div key={step.day} className="rounded-xl bg-white p-4 shadow-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-600">{step.day}</p>
              {step.you && (
                <div className="mb-1.5 flex justify-end">
                  <span className="rounded-2xl bg-emerald-600 px-3 py-1.5 text-sm text-white">{step.you}</span>
                </div>
              )}
              <div className="flex">
                <span className="rounded-2xl bg-slate-100 px-3 py-1.5 text-sm text-slate-700">{step.bot}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-24 text-center">
        <div className="rounded-2xl bg-emerald-600 px-8 py-10 text-white">
          <h2 className="text-2xl font-semibold">Users don&apos;t want software — they want someone to handle it.</h2>
          <p className="mt-2 text-emerald-50">
            That&apos;s the whole product: an assistant, not a tool.
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
          >
            <CheckCircle2 size={16} /> Create your free account
          </Link>
        </div>
      </section>
    </div>
  );
}
