"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useDashboard } from "@/lib/dashboard-context";
import { addTransaction, deleteTransaction, updateTransaction } from "@/lib/data/transactions";
import { formatCurrency, timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TransactionFormModal } from "@/components/transactions/TransactionFormModal";
import type { Transaction, TransactionType } from "@/types";

type FilterType = "all" | TransactionType;

export default function TransactionsPage() {
  const { user } = useAuth();
  const { profile, transactions, loading } = useDashboard();
  const currency = profile?.currency || "USD";

  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filter !== "all" && t.type !== filter) return false;
      if (search && !`${t.note} ${t.category}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [transactions, filter, search]);

  const handleCreate = async (values: { type: TransactionType; amount: number; category: string; note: string }) => {
    if (!user) return;
    await addTransaction(user.uid, { ...values, source: "manual", confidence: 1, createdAt: Date.now() });
  };

  const handleUpdate = async (values: { type: TransactionType; amount: number; category: string; note: string }) => {
    if (!user || !editing) return;
    await updateTransaction(user.uid, editing.id, values);
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    if (!confirm("Delete this transaction?")) return;
    await deleteTransaction(user.uid, id);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(["all", "sale", "expense"] as FilterType[]).map((option) => (
            <button
              key={option}
              onClick={() => setFilter(option)}
              className={`rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                filter === option ? "bg-emerald-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {option === "all" ? "All" : option === "sale" ? "Sales" : "Expenses"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transactions"
              className="w-56 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={16} /> Add
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3">Description</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3">Source</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3 text-right">Amount</th>
              <th className="px-5 py-3" />
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
                  No transactions match.
                </td>
              </tr>
            )}
            {filtered.map((t) => (
              <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                <td className="px-5 py-3.5">
                  <p className="font-medium text-slate-900">{t.note || t.category}</p>
                  {t.confidence < 0.75 && <Badge tone="warning">Needs review</Badge>}
                </td>
                <td className="px-5 py-3.5 capitalize text-slate-600">{t.category}</td>
                <td className="px-5 py-3.5">
                  <Badge tone="neutral">{t.source === "chat" ? "WhatsApp" : t.source === "receipt" ? "Receipt" : "Manual"}</Badge>
                </td>
                <td className="px-5 py-3.5 text-slate-500">{timeAgo(t.createdAt)}</td>
                <td className={`px-5 py-3.5 text-right font-semibold ${t.type === "sale" ? "text-emerald-600" : "text-red-600"}`}>
                  {t.type === "sale" ? "+" : "-"}
                  {formatCurrency(t.amount, currency)}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setEditing(t)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TransactionFormModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleCreate} />
      <TransactionFormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        onSubmit={handleUpdate}
        initial={editing}
      />
    </div>
  );
}
