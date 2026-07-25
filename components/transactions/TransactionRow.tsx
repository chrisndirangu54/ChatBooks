import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { Transaction } from "@/types";
import { formatCurrency, timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";

const SOURCE_LABEL: Record<Transaction["source"], string> = {
  chat: "WhatsApp",
  manual: "Manual",
  receipt: "Receipt",
};

export function TransactionRow({
  transaction,
  currency,
  trailing,
}: {
  transaction: Transaction;
  currency: string;
  trailing?: React.ReactNode;
}) {
  const isSale = transaction.type === "sale";

  return (
    <div className="flex items-center gap-4 border-b border-slate-100 py-3.5 last:border-0">
      <div
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
          isSale ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
        }`}
      >
        {isSale ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{transaction.note || transaction.category}</p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
          <span className="capitalize">{transaction.category}</span>
          <span>•</span>
          <span>{SOURCE_LABEL[transaction.source]}</span>
          <span>•</span>
          <span>{timeAgo(transaction.createdAt)}</span>
          {transaction.confidence < 0.75 && (
            <Badge tone="warning">Needs review</Badge>
          )}
        </div>
      </div>

      <p className={`flex-shrink-0 text-sm font-semibold ${isSale ? "text-emerald-600" : "text-red-600"}`}>
        {isSale ? "+" : "-"}
        {formatCurrency(transaction.amount, currency)}
      </p>

      {trailing}
    </div>
  );
}
