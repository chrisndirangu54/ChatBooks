import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ChatBooks — Your accountant lives in WhatsApp",
  description:
    "A WhatsApp-native AI bookkeeper for small businesses: log sales by chat, read receipts automatically, and get loan-ready financial reports.",
};

/**
 * Opts the document into animation before first paint.
 *
 * Two conditions, both of which have to hold for anything to animate:
 *  · the visitor hasn't asked for reduced motion, and
 *  · `IntersectionObserver` exists — it's what triggers the scroll reveals, so
 *    without it the hidden start state would never be lifted.
 *
 * Every motion rule in globals.css hangs off this one class, so if this script
 * never runs (no JS, hydration failure) the page renders fully visible and
 * static rather than stuck mid-transition.
 */
const MOTION_READY = `try{if('IntersectionObserver' in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.classList.add('motion-ready')}}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <script dangerouslySetInnerHTML={{ __html: MOTION_READY }} />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
