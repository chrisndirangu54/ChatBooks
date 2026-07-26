"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { taxFromInclusive } from "@/lib/shop/tax";
import { formatMoney } from "@/lib/shop/format";
import type { Product, TaxCategory } from "@/types";

export interface ProductFormValues {
  name: string;
  price: number;
  unit: string;
  taxCategory: TaxCategory;
  itemClassificationCode: string;
  active: boolean;
}

const EMPTY: ProductFormValues = {
  name: "",
  price: 0,
  unit: "",
  taxCategory: "vat_16",
  itemClassificationCode: "",
  active: true,
};

function valuesFor(initial?: Product | null): ProductFormValues {
  if (!initial) return EMPTY;
  return {
    name: initial.name,
    price: initial.price,
    unit: initial.unit ?? "",
    taxCategory: initial.taxCategory,
    itemClassificationCode: initial.itemClassificationCode ?? "",
    active: initial.active,
  };
}

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: ProductFormValues) => Promise<void>;
  initial?: Product | null;
  currency?: string;
}

export function ProductFormModal({ open, onClose, ...props }: ProductFormModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={props.initial ? "Edit product" : "Add product"}>
      {/* `Modal` renders nothing while closed, so the form below mounts fresh
          on every open — which is what seeds its fields from `initial` without
          an effect that syncs state back and forth. */}
      <ProductForm onClose={onClose} {...props} />
    </Modal>
  );
}

function ProductForm({
  onClose,
  onSubmit,
  initial,
  currency = "KES",
}: Omit<ProductFormModalProps, "open">) {
  const [values, setValues] = useState<ProductFormValues>(() => valuesFor(initial));
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!values.name.trim() || values.price <= 0) return;
    setSaving(true);
    try {
      await onSubmit({ ...values, name: values.name.trim() });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const vat = taxFromInclusive(values.price, values.taxCategory);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="product-name">Name</Label>
          <Input
            id="product-name"
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
            placeholder="Sukari"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="product-price">Price (what the customer pays)</Label>
            <Input
              id="product-price"
              type="number"
              min={0}
              step="0.01"
              value={values.price || ""}
              onChange={(e) => setValues({ ...values, price: Number(e.target.value) })}
              placeholder="180"
            />
          </div>
          <div>
            <Label htmlFor="product-unit">Unit</Label>
            <Input
              id="product-unit"
              value={values.unit}
              onChange={(e) => setValues({ ...values, unit: e.target.value })}
              placeholder="1kg"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="product-tax">VAT treatment</Label>
          <Select
            id="product-tax"
            value={values.taxCategory}
            onChange={(e) => setValues({ ...values, taxCategory: e.target.value as TaxCategory })}
          >
            <option value="vat_16">Standard rated (16%)</option>
            <option value="vat_zero">Zero rated (0%)</option>
            <option value="exempt">Exempt</option>
          </Select>
          {/* Prices are quoted VAT-inclusive, which surprises people often
              enough to be worth showing rather than explaining. */}
          <p className="mt-1.5 text-xs text-slate-500">
            {values.price > 0
              ? `Customer pays ${formatMoney(values.price, currency)}, of which ${formatMoney(vat, currency)} is VAT.`
              : "The price you enter is what the customer pays — VAT is taken out of it, not added on."}
          </p>
        </div>

        <div>
          <Label htmlFor="product-cls">KRA item classification code</Label>
          <Input
            id="product-cls"
            value={values.itemClassificationCode}
            onChange={(e) => setValues({ ...values, itemClassificationCode: e.target.value })}
            placeholder="5059871800"
          />
          <p className="mt-1.5 text-xs text-slate-500">
            Optional for selling, required to file the sale with eTIMS. It comes from the KRA code
            list issued with your eTIMS onboarding.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={values.active}
            onChange={(e) => setValues({ ...values, active: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          Show in the WhatsApp catalog
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !values.name.trim() || values.price <= 0}>
            {saving ? "Saving…" : initial ? "Save changes" : "Add product"}
          </Button>
        </div>
    </form>
  );
}
