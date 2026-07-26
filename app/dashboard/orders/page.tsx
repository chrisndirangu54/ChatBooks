"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useDashboard } from "@/lib/dashboard-context";
import { subscribeToOrders } from "@/lib/data/orders";
import { formatMoney } from "@/lib/shop/format";
import { timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import type { Order, OrderStatus } from "@/types";

const STATUS_TONE: Record<OrderStatus, "success" | "warning" | "danger" | "neutral"> = {
  paid: "success",
  awaiting_payment: "warning",
  failed: "danger",
  cancelled: "neutral",
  cart: "neutral",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  paid: "Paid",
  awaiting_payment: "Awaiting payment",
  failed: "Failed",
  cancelled: "Cancelled",
  cart: "In cart",
};

type Filter = "all" | "paid" | "awaiting_payment" | "failed";

export default function OrdersPage() {
  const { user } = useAuth();
  const { profile } = useDashboard();
  const currency = profile?.currency || "KES";

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!user) return;
    return subscribeToOrders(user.uid, (data) => {
      setOrders(data);
      setLoading(false);
    });
  }, [user]);

  const filtered = useMemo(
    () => (filter === "all" ? orders : orders.filter((order) => order.status === filter)),
    [orders, filter],
  );

  const paidTotal = useMemo(
    () => orders.filter((o) => o.status === "paid").reduce((sum, o) => sum + o.total, 0),
    [orders],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(["all", "paid", "awaiting_payment", "failed"] as Filter[]).map((option) => (
            <button
              key={option}
              onClick={() => setFilter(option)}
              className={`rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                filter === option
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {option === "all" ? "All" : STATUS_LABEL[option]}
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-600">
          Paid via WhatsApp:{" "}
          <span className="font-semibold text-slate-900">{formatMoney(paidTotal, currency)}</span>
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Items</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">eTIMS</th>
              <th className="px-5 py-3">When</th>
              <th className="px-5 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                  No orders yet. Customers order by messaging your WhatsApp number.
                </td>
              </tr>
            )}
            {filtered.map((order) => (
              <tr key={order.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                <td className="px-5 py-3.5">
                  <p className="font-medium text-slate-900">
                    {order.customerName || order.customerPhone}
                  </p>
                  {order.mpesa?.receiptNumber && (
                    <p className="font-mono text-xs text-slate-500">{order.mpesa.receiptNumber}</p>
                  )}
                </td>
                <td className="px-5 py-3.5 text-slate-600">
                  {order.items.map((item) => `${item.name} ×${item.quantity}`).join(", ")}
                </td>
                <td className="px-5 py-3.5">
                  <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
                  {order.status === "failed" && order.mpesa?.resultDesc && (
                    <p className="mt-1 text-xs text-slate-500">{order.mpesa.resultDesc}</p>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <EtimsCell order={order} />
                </td>
                <td className="px-5 py-3.5 text-slate-500">{timeAgo(order.createdAt)}</td>
                <td className="px-5 py-3.5 text-right">
                  <p className="font-semibold tabular-nums text-slate-900">
                    {formatMoney(order.total, currency)}
                  </p>
                  <p className="text-xs text-slate-500">
                    incl. {formatMoney(order.taxTotal, currency)} VAT
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EtimsCell({ order }: { order: Order }) {
  const filing = order.etims;
  if (!filing || filing.status === "not_filed") return <Badge tone="neutral">Not filed</Badge>;

  if (filing.status === "failed") {
    return (
      <div>
        <Badge tone="danger">Failed</Badge>
        {filing.error && <p className="mt-1 max-w-48 text-xs text-slate-500">{filing.error}</p>}
      </div>
    );
  }

  if (filing.status === "pending") return <Badge tone="warning">Pending</Badge>;

  // A stub filing is not a KRA record, and labelling it "Filed" would let a
  // shopkeeper believe they're compliant when nothing was submitted.
  if (filing.provider === "stub") {
    return (
      <div>
        <Badge tone="warning">Simulated</Badge>
        <p className="mt-1 text-xs text-slate-500">Not sent to KRA</p>
      </div>
    );
  }

  return (
    <div>
      <Badge tone="success">Filed</Badge>
      {filing.invoiceNumber && (
        <p className="mt-1 font-mono text-xs text-slate-500">{filing.invoiceNumber}</p>
      )}
    </div>
  );
}
