import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "emerald",
  trend,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "emerald" | "red" | "sky" | "amber";
  trend?: string;
}) {
  const toneClasses: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-600",
    red: "bg-red-50 text-red-600",
    sky: "bg-sky-50 text-sky-600",
    amber: "bg-amber-50 text-amber-600",
  };

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", toneClasses[tone])}>
          <Icon size={18} />
        </div>
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
      {trend && <p className="mt-1 text-xs text-slate-500">{trend}</p>}
    </div>
  );
}
