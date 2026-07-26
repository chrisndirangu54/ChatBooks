"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { DashboardProvider } from "@/lib/dashboard-context";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { MobileSidebar } from "@/components/dashboard/MobileSidebar";
import { Topbar } from "@/components/dashboard/Topbar";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/chat": "WhatsApp Chat",
  "/dashboard/products": "Products",
  "/dashboard/orders": "Orders",
  "/dashboard/transactions": "Transactions",
  "/dashboard/reports": "Reports",
  "/dashboard/settings": "Settings",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <DashboardProvider>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <MobileSidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        <div className="flex min-h-screen flex-1 flex-col">
          <DashboardHeader onMenuClick={() => setMobileNavOpen(true)} />
          <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </DashboardProvider>
  );
}

function DashboardHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] || "Dashboard";
  return <Topbar title={title} onMenuClick={onMenuClick} />;
}
