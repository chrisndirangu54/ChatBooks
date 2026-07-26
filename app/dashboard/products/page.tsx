"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useDashboard } from "@/lib/dashboard-context";
import { addProduct, deleteProduct, subscribeToProducts, updateProduct } from "@/lib/data/products";
import { formatMoney } from "@/lib/shop/format";
import { taxFromInclusive } from "@/lib/shop/tax";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProductFormModal, type ProductFormValues } from "@/components/products/ProductFormModal";
import type { Product } from "@/types";

const TAX_LABEL = {
  vat_16: "VAT 16%",
  vat_zero: "Zero rated",
  exempt: "Exempt",
} as const;

/** Matches the threshold the WhatsApp catalog uses to say "only N left". */
const LOW_STOCK = 5;

function StockCell({ product }: { product: Product }) {
  if (typeof product.stock !== "number") {
    return <span className="text-sm text-slate-400">Not tracked</span>;
  }
  if (product.stock <= 0) return <Badge tone="danger">Sold out</Badge>;
  if (product.stock <= LOW_STOCK) return <Badge tone="warning">{product.stock} left</Badge>;
  return <span className="tabular-nums text-sm text-slate-700">{product.stock}</span>;
}

function StockLegend() {
  return (
    <p className="text-xs text-slate-500">
      Stock drops when an order is <em>paid</em>, not when it&apos;s added to a cart — an abandoned
      cart never holds your stock hostage. Products at zero disappear from the WhatsApp catalog
      until you restock them here.
    </p>
  );
}

export default function ProductsPage() {
  const { user } = useAuth();
  const { profile } = useDashboard();
  const currency = profile?.currency || "KES";

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeToProducts(user.uid, (data) => {
      setProducts(data);
      setLoading(false);
    });
  }, [user]);

  const toDoc = (values: ProductFormValues) => ({
    name: values.name,
    price: values.price,
    unit: values.unit || "",
    active: values.active,
    taxCategory: values.taxCategory,
    itemClassificationCode: values.itemClassificationCode || "",
  });

  /** "" → not tracked. On update that has to clear the field, not skip it. */
  const stockValue = (values: ProductFormValues): number | null =>
    values.stock.trim() === "" ? null : Math.max(0, Math.floor(Number(values.stock)));

  const handleCreate = async (values: ProductFormValues) => {
    if (!user) return;
    const stock = stockValue(values);
    await addProduct(user.uid, {
      ...toDoc(values),
      createdAt: Date.now(),
      ...(stock === null ? {} : { stock }),
    });
  };

  const handleUpdate = async (values: ProductFormValues) => {
    if (!user || !editing) return;
    await updateProduct(user.uid, editing.id, { ...toDoc(values), stock: stockValue(values) });
    setEditing(null);
  };

  const handleDelete = async (product: Product) => {
    if (!user) return;
    if (!confirm(`Delete ${product.name}? Past orders keep their own copy of the price.`)) return;
    await deleteProduct(user.uid, product.id);
  };

  const missingCodes = products.filter((p) => p.active && !p.itemClassificationCode).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-600">
            Anything active here is what customers see when they message your shop on WhatsApp.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={16} /> Add product
        </Button>
      </div>

      {missingCodes > 0 && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-600/20">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p>
            {missingCodes} active {missingCodes === 1 ? "product has" : "products have"} no KRA item
            classification code. They can still be sold — but their sales can&apos;t be filed with
            eTIMS until a code is set.
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3">Product</th>
              <th className="px-5 py-3">Stock</th>
              <th className="px-5 py-3">VAT</th>
              <th className="px-5 py-3">KRA code</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Price</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && products.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                  No products yet — add one and it appears in the WhatsApp catalog straight away.
                </td>
              </tr>
            )}
            {products.map((product) => (
              <tr key={product.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                <td className="px-5 py-3.5">
                  <p className="font-medium text-slate-900">{product.name}</p>
                  {product.unit && <p className="text-xs text-slate-500">{product.unit}</p>}
                </td>
                <td className="px-5 py-3.5">
                  <StockCell product={product} />
                </td>
                <td className="px-5 py-3.5 text-slate-600">{TAX_LABEL[product.taxCategory]}</td>
                <td className="px-5 py-3.5">
                  {product.itemClassificationCode ? (
                    <span className="font-mono text-xs text-slate-600">
                      {product.itemClassificationCode}
                    </span>
                  ) : (
                    <Badge tone="warning">Not set</Badge>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <Badge tone={product.active ? "success" : "neutral"}>
                    {product.active ? "In catalog" : "Hidden"}
                  </Badge>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <p className="font-semibold tabular-nums text-slate-900">
                    {formatMoney(product.price, currency)}
                  </p>
                  {product.taxCategory === "vat_16" && (
                    <p className="text-xs text-slate-500">
                      incl. {formatMoney(taxFromInclusive(product.price, product.taxCategory), currency)} VAT
                    </p>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setEditing(product)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      aria-label={`Edit ${product.name}`}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(product)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Delete ${product.name}`}
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

      <StockLegend />

      <ProductFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        currency={currency}
      />
      <ProductFormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        onSubmit={handleUpdate}
        initial={editing}
        currency={currency}
      />
    </div>
  );
}
