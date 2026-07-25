"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import type { Transaction, TransactionType } from "@/types";

const CATEGORIES = ["sales", "inventory", "transport", "rent", "utilities", "wages", "other"];

export function TransactionFormModal({
  open,
  onClose,
  onSubmit,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: { type: TransactionType; amount: number; category: string; note: string }) => Promise<void>;
  initial?: Transaction | null;
}) {
  const [type, setType] = useState<TransactionType>(initial?.type || "sale");
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : "");
  const [category, setCategory] = useState(initial?.category || "sales");
  const [note, setNote] = useState(initial?.note || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ type, amount: Number(amount), category, note });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit transaction" : "Add transaction"}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <Label>Type</Label>
          <Select value={type} onChange={(e) => setType(e.target.value as TransactionType)}>
            <option value="sale">Sale</option>
            <option value="expense">Expense</option>
          </Select>
        </div>
        <div>
          <Label>Amount</Label>
          <Input
            type="number"
            required
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div>
          <Label>Category</Label>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Note</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" />
        </div>
        <div className="flex gap-2 pt-1">
          <Button type="submit" disabled={saving} className="flex-1">
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
