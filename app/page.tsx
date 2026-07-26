import Link from "next/link";
import Image from "next/image";
import {
  MessageSquareText,
  Camera,
  Smartphone,
  FileBarChart,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Wallet,
  Sparkles,
} from "lucide-react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { DeepPanelBackdrop, StatusChip } from "@/components/ui/DeepPanel";
import { Parallax } from "@/components/ui/Parallax";
import { Reveal } from "@/components/ui/Reveal";
import { Sparkline } from "@/components/ui/Sparkline";
import { TrendChart } from "@/components/charts/TrendChart";
import { NetProfitBars } from "@/components/charts/NetProfitBars";
import { CategoryBars } from "@/components/charts/CategoryBars";
import { SourceMixBar } from "@/components/charts/SourceMixBar";
import { ScoreRing } from "@/components/charts/ScoreRing";
import {
  SAMPLE_CURRENCY,
  SAMPLE_EXPENSES,
  SAMPLE_MIX,
  SAMPLE_TOTALS,
  SAMPLE_WEEK,
} from "@/lib/data/sample";
import { VIZ } from "@/lib/viz";

const FEATURES = [
  {
    icon: MessageSquareText,
    title: "Chat-native logging",
    description: 'Text "Sold rice 1500" and it\'s saved — structured, categorized, instantly.',
    image: "/img/feat-chat.svg",
    imageAlt: "A typed chat line becoming a structured ledger entry",
  },
  {
    icon: Camera,
    title: "Receipts, read automatically",
    description: "Snap a photo of a supplier receipt and confirm the extracted amount in one tap.",
    image: "/img/feat-receipt.svg",
    imageAlt: "A supplier receipt being scanned, with its total extracted and confirmed",
  },
  {
    icon: Smartphone,
    title: "Mobile money aware",
    description: "Built for how businesses actually get paid — M-Pesa, MoMo, and cash side by side.",
    image: "/img/feat-mobile.svg",
    imageAlt: "A phone receiving mobile money alongside cash",
  },
  {
    icon: FileBarChart,
    title: "Loan-ready reports",
    description: "Every transaction compounds into a financial identity a lender can trust.",
    image: "/img/feat-credit.svg",
    imageAlt: "Records compounding into a lender-ready credit file",
  },
];

const JOURNEY = [
  { day: "Day 1", you: "Sold rice 1500.", bot: "Saved — Sale: 1500 (Rice)." },
  { day: "Day 3", you: "[Sends a receipt photo]", bot: "I see 2,300 from Supplier XYZ. Save as expense?" },
  { day: "Day 7", you: "", bot: "This week — Sales: 15,000. Expenses: 9,000. Profit: 6,000." },
  { day: "Day 30", you: "Send me a report", bot: "Here's your PDF, ready for your loan officer." },
];

const PIPELINE = [
  { step: "01", title: "You type it", body: "One line in a chat you already have open all day." },
  { step: "02", title: "It gets structured", body: "Amount, type, and category pulled out and confirmed." },
  { step: "03", title: "It becomes a number", body: "Every entry lands in the totals behind your dashboard." },
  { step: "04", title: "It becomes credit", body: "Months of clean records turn into a lender-ready file." },
];

export default function LandingPage() {
  return (
    <div className="flex-1 bg-white">
      {/* Persistent dark command bar — it stays deep as the page scrolls into the
          light content below, which keeps the chrome consistent instead of
          fading a translucent header over white cards. */}
      <header className="sticky top-0 z-40 bg-[var(--fx-deep)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-slate-900">
              <MessageSquareText size={18} />
              <span
                aria-hidden
                className="absolute inset-0 -z-10 rounded-xl bg-emerald-400/40 blur-md"
              />
            </div>
            <span className="text-lg font-semibold tracking-tight text-white">ChatBooks</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-400/40"
            >
              Get started
            </Link>
          </div>
        </div>
        <div aria-hidden className="fx-edge-glow h-px w-full opacity-60" />
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-[var(--fx-deep)] text-[var(--fx-ink)]">
        <DeepPanelBackdrop />

        {/* Parallax glows on top of the backdrop, drifting at different rates. */}
        <Parallax speed={0.2} max={110} ariaHidden className="pointer-events-none absolute -left-32 -top-24">
          <div className="h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl animate-drift" />
        </Parallax>
        <Parallax speed={-0.14} max={90} ariaHidden className="pointer-events-none absolute -right-24 top-10">
          <div className="h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl animate-drift" />
        </Parallax>

        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 pt-16 pb-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-8">
          <div>
            <Reveal direction="up">
              <StatusChip live className="mb-5">
                <Sparkles size={12} aria-hidden />
                Built for small businesses across Africa
              </StatusChip>
            </Reveal>

            <Reveal direction="up" delay={80}>
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Your accountant lives in{" "}
                <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-cyan-300 bg-clip-text text-transparent">
                  WhatsApp
                </span>
              </h1>
            </Reveal>

            <Reveal direction="up" delay={160}>
              <p className="mt-5 max-w-xl text-lg text-slate-300">
                Small business owners forget transactions, mix personal and business money, and
                can&apos;t access credit. ChatBooks logs sales by chat, reads receipts automatically,
                tracks mobile money, and prepares loan-ready financials — no spreadsheet required.
              </p>
            </Reveal>

            <Reveal direction="up" delay={240}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/signup"
                  className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-400/40"
                >
                  Try the demo
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-slate-200 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white"
                >
                  I already have an account
                </Link>
              </div>
            </Reveal>
          </div>

          <div className="relative">
            {/* Phone mock — the transcript types itself in on load. */}
            <Reveal direction="right" delay={200}>
              <Parallax speed={-0.06} max={40} className="relative mx-auto w-full max-w-sm">
                <div className="relative rounded-[2rem] bg-slate-950/80 p-3 shadow-2xl shadow-black/60 ring-1 ring-white/10 backdrop-blur-sm">
                  {/* Scan beam crossing the handset. */}
                  <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2rem]">
                    <div className="animate-scan h-16 w-full bg-gradient-to-b from-transparent via-cyan-300/20 to-transparent" />
                  </div>

                  <div className="relative rounded-[1.6rem] bg-[#e5ddd5] p-4">
                    <div className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-800 px-3 py-2 text-white">
                      <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
                        <MessageSquareText size={14} />
                        <span
                          aria-hidden
                          className="absolute inset-0 rounded-full bg-white/40 animate-pulse-ring"
                        />
                      </div>
                      <div className="leading-tight">
                        <p className="text-xs font-semibold">ChatBooks</p>
                        <p className="text-[10px] text-emerald-50/80">online</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Bubble side="out" delay={300}>
                        Sold rice 1500
                      </Bubble>
                      <Bubble side="in" delay={700}>
                        Saved — Sale: 1500 (Rice). Today&apos;s sales: 4,300.
                      </Bubble>
                      <Bubble side="out" delay={1100}>
                        Bought stock 2300
                      </Bubble>
                      <Bubble side="in" delay={1500}>
                        Saved — Expense: 2,300 (Inventory).
                      </Bubble>
                      <Bubble side="out" delay={1900}>
                        How am I doing?
                      </Bubble>
                      <Bubble side="in" delay={2300}>
                        This week: 15,000 in, 9,000 out. Profit 6,000. 📈
                      </Bubble>
                    </div>
                  </div>
                </div>
              </Parallax>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-20">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, index) => (
            <Reveal key={feature.title} direction="up" delay={index * 80}>
              <div className="group relative h-full overflow-hidden rounded-2xl bg-white p-5 ring-1 ring-slate-200/70 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/5 hover:ring-emerald-600/25">
                {/* Corner glow that warms up on hover. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-emerald-200/50 to-cyan-200/40 blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                />

                <div className="relative">
                  {/* Illustration. Decorative alongside the heading and body copy,
                      but each carries a real alt string since it depicts the
                      feature rather than repeating the title verbatim. */}
                  <Image
                    src={feature.image}
                    alt={feature.imageAlt}
                    width={128}
                    height={96}
                    className="mb-3 h-24 w-32 transition-transform duration-500 group-hover:scale-[1.04]"
                  />

                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10">
                      <feature.icon size={14} />
                    </span>
                    <h3 className="text-sm font-semibold text-slate-900">{feature.title}</h3>
                  </div>
                  <p className="text-sm text-slate-500">{feature.description}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Infographic: what happens to one transaction ───────────────────── */}
      <section className="border-y border-slate-100 bg-slate-50/70 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal direction="up">
            <h2 className="text-center text-2xl font-semibold text-slate-900">
              One line of chat, four things happen
            </h2>
          </Reveal>

          {/* The flow as a standalone diagram. Deliberately narrower than the
              step columns below: at full width its four nodes would land near
              the column centres and imply a 1:1 mapping with the left-aligned
              copy that doesn't actually hold. */}
          <Reveal direction="up" delay={80}>
            <Image
              src="/img/pipeline.svg"
              alt="A chat line moving through four stages: typed, structured, totalled, then turned into a credit file"
              width={960}
              height={120}
              className="mx-auto mt-8 hidden w-full max-w-xl sm:block"
            />
          </Reveal>

          <div className="relative mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {PIPELINE.map((item, index) => (
              <Reveal key={item.step} direction="up" delay={index * 100}>
                <div className="relative">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--fx-deep)] text-sm font-semibold text-emerald-300 shadow-lg shadow-slate-900/10 ring-1 ring-white/10">
                    {item.step}
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-500">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sample dashboard ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal direction="up">
          <div className="mb-2 text-center">
            <h2 className="text-2xl font-semibold text-slate-900">
              A week of chatting, turned into books
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
              This is the dashboard side of the same conversation above. Figures are an{" "}
              <strong className="font-semibold text-slate-700">illustrative sample</strong> in USD,
              not customer data.
            </p>
          </div>
        </Reveal>

        {/* Headline sample figures, counting up as they scroll into view. */}
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Reveal direction="up">
            <SampleTile
              label="Sales this week"
              value={SAMPLE_TOTALS.sales}
              icon={TrendingUp}
              accent={VIZ.salesText}
              trend={SAMPLE_WEEK.map((day) => day.sales)}
              trendColor={VIZ.sales}
            />
          </Reveal>
          <Reveal direction="up" delay={90}>
            <SampleTile
              label="Expenses this week"
              value={SAMPLE_TOTALS.expenses}
              icon={TrendingDown}
              accent={VIZ.expensesText}
              trend={SAMPLE_WEEK.map((day) => day.expenses)}
              trendColor={VIZ.expenses}
            />
          </Reveal>
          <Reveal direction="up" delay={180}>
            <SampleTile
              label="Profit this week"
              value={SAMPLE_TOTALS.profit}
              icon={Wallet}
              accent={VIZ.salesText}
              trend={SAMPLE_WEEK.map((day) => day.profit)}
              trendColor={VIZ.sales}
            />
          </Reveal>
        </div>

        <div className="mt-6 space-y-6">
          <Reveal direction="up">
            <TrendChart
              data={SAMPLE_WEEK}
              currency={SAMPLE_CURRENCY}
              title="Sales vs expenses"
              subtitle="Illustrative sample week"
            />
          </Reveal>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Reveal direction="left">
              <NetProfitBars
                data={SAMPLE_WEEK}
                currency={SAMPLE_CURRENCY}
                subtitle="Wednesday cost more than it sold"
              />
            </Reveal>
            <Reveal direction="right" delay={80}>
              <CategoryBars
                data={SAMPLE_EXPENSES}
                currency={SAMPLE_CURRENCY}
                title="Where the money went"
                subtitle="Sample expenses by category"
              />
            </Reveal>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Reveal direction="left">
              <SourceMixBar
                data={SAMPLE_MIX}
                subtitle="Most records arrive as chat, which is the whole idea"
              />
            </Reveal>
            <Reveal direction="right" delay={80}>
              <div className="flex h-full flex-col items-center justify-center rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                <h3 className="mb-4 text-sm font-semibold text-slate-900">Loan-readiness</h3>
                <ScoreRing
                  score={82}
                  status="good"
                  statusLabel="Loan-ready"
                  caption="What a month of consistent logging looks like"
                />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Journey ────────────────────────────────────────────────────────── */}
      <section className="border-t border-slate-100 bg-slate-50/70 py-20">
        <div className="mx-auto max-w-3xl px-6">
          <Reveal direction="up">
            <h2 className="mb-8 text-center text-2xl font-semibold text-slate-900">
              What using ChatBooks actually looks like
            </h2>
          </Reveal>

          <div className="space-y-3">
            {JOURNEY.map((step, index) => (
              <Reveal key={step.day} direction={index % 2 === 0 ? "left" : "right"} delay={index * 90}>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    {step.day}
                  </p>
                  {step.you && (
                    <div className="mb-1.5 flex justify-end">
                      <span className="rounded-2xl bg-emerald-600 px-3 py-1.5 text-sm text-white">
                        {step.you}
                      </span>
                    </div>
                  )}
                  <div className="flex">
                    <span className="rounded-2xl bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
                      {step.bot}
                    </span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing CTA ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <Reveal direction="scale">
          <div className="relative isolate overflow-hidden rounded-3xl bg-[var(--fx-deep)] px-8 py-14 text-white shadow-2xl shadow-slate-900/20 ring-1 ring-white/10">
            <DeepPanelBackdrop />
            <Parallax speed={0.14} max={60} ariaHidden className="pointer-events-none absolute -right-20 -top-24">
              <div className="h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl animate-drift" />
            </Parallax>

            <div className="relative grid gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-white">
                  Users don&apos;t want software — they want someone to handle it.
                </h2>
                <p className="mt-2 text-slate-300">
                  That&apos;s the whole product: an assistant, not a tool.
                </p>
                <Link
                  href="/signup"
                  className="mt-7 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-400/40"
                >
                  <CheckCircle2 size={16} /> Create your free account
                </Link>
              </div>

              {/* The console illustration finally has room to be seen whole,
                  rather than being clipped behind the hero's handset. */}
              <Image
                src="/img/hero-console.svg"
                alt="A chat message resolving into structured figures, a rising chart, and an approved credit file"
                width={480}
                height={360}
                className="mx-auto hidden w-full max-w-sm animate-float md:block"
              />
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

/** One chat bubble in the phone mock, animated in on a stagger. */
function Bubble({
  children,
  side,
  delay,
}: {
  children: React.ReactNode;
  side: "in" | "out";
  delay: number;
}) {
  return (
    <div className={side === "out" ? "flex justify-end" : "flex justify-start"}>
      <span
        className={`animate-bubble-in max-w-[85%] rounded-2xl px-3 py-2 text-[13px] shadow-sm ${
          side === "out" ? "bg-emerald-600 text-white" : "bg-white text-slate-700"
        }`}
        style={{ "--bubble-delay": `${delay}ms` } as React.CSSProperties}
      >
        {children}
      </span>
    </div>
  );
}

/** Sample headline figure with a shape-only sparkline behind it. */
function SampleTile({
  label,
  value,
  icon: Icon,
  accent,
  trend,
  trendColor,
}: {
  label: string;
  value: number;
  icon: typeof TrendingUp;
  accent: string;
  trend: number[];
  trendColor: string;
}) {
  return (
    <div className="h-full rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <Icon size={16} style={{ color: accent }} aria-hidden />
      </div>
      <p className="mt-2 text-3xl font-semibold" style={{ color: accent }}>
        <AnimatedNumber value={value} format="currency" currency={SAMPLE_CURRENCY} />
      </p>
      <div className="mt-3 h-8 w-full">
        <Sparkline values={trend} color={trendColor} delay={200} className="h-full w-full" />
      </div>
    </div>
  );
}
