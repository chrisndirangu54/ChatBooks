"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageCircle,
  Receipt,
  FileBarChart,
  Settings,
  MessageSquareText,
  Package,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/chat", label: "WhatsApp Chat", icon: MessageCircle },
  { href: "/dashboard/products", label: "Products", icon: Package },
  { href: "/dashboard/orders", label: "Orders", icon: ShoppingCart },
  { href: "/dashboard/transactions", label: "Transactions", icon: Receipt },
  { href: "/dashboard/reports", label: "Reports", icon: FileBarChart },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="flex h-16 items-center gap-2.5 border-b border-slate-100 px-6">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white">
          <MessageSquareText size={18} />
          <span aria-hidden className="absolute inset-0 -z-10 rounded-xl bg-emerald-400/40 blur-md" />
        </div>
        <span className="text-lg font-semibold tracking-tight text-slate-900">ChatBooks</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-6">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="relative isolate mx-3 mb-6 overflow-hidden rounded-2xl bg-[var(--fx-deep)] p-4 ring-1 ring-white/10">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="fx-aurora absolute inset-0 opacity-80" />
          <div className="fx-grid absolute inset-0" />
        </div>
        <div className="relative">
          <p className="text-sm font-semibold text-white">Your accountant lives in WhatsApp</p>
          <p className="mt-1 text-xs text-slate-300">
            Log a sale by chatting, snap a receipt, and get a loan-ready report anytime.
          </p>
        </div>
      </div>
    </aside>
  );
}
