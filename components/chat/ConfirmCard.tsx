"use client";

import { useState } from "react";
import type { ParsedTransaction, TransactionType } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";

const CATEGORIES = ["sales", "inventory", "transport", "rent", "utilities", "wages", "other"];

export function ConfirmCard({
  parsed,
  currency,
  onConfirm,
  onDismiss,
}: {
  parsed: ParsedTransaction;
  currency: string;
  onConfirm: (edited: ParsedTransaction) => void;
  onDismiss: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(parsed);

  if (editing) {
    return (
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-medium text-slate-700">Edit before saving</p>
        <div className="space-y-2.5">
          <Select
            value={draft.type}
            onChange={(e) => setDraft({ ...draft, type: e.target.value as TransactionType })}
          >
            <option value="sale">Sale</option>
            <option value="expense">Expense</option>
          </Select>
          <Input
            type="number"
            value={draft.amount}
            onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
          />
          <Select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="Note" />
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={() => onConfirm({ ...draft, confidence: 1 })}>
            Save
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-700">
        I think this is a{" "}
        <span className="font-semibold">{parsed.type === "sale" ? "sale" : "expense"}</span> of{" "}
        <span className="font-semibold">{formatCurrency(parsed.amount, currency)}</span> for{" "}
        <span className="font-semibold capitalize">{parsed.category}</span>
        {parsed.note ? ` (${parsed.note})` : ""}. Save it?
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => onConfirm(parsed)}>
          Save
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
          Edit
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Discard
        </Button>
      </div>
    </div>
  );
}
