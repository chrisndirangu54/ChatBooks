"use client";

import type { ReactNode } from "react";
import { formatCurrency } from "@/lib/utils";
import { VIZ } from "@/lib/viz";

export interface TooltipRow {
  name: string;
  value: number;
  color: string;
}

/** Structural shape of a recharts payload entry — only the fields we read. */
type PayloadEntry = {
  name?: unknown;
  value?: unknown;
  color?: unknown;
  stroke?: unknown;
  fill?: unknown;
};

/**
 * Normalises a recharts tooltip payload into rows we control. Recharts hands
 * back the series colour under whichever of stroke/fill/color the mark used.
 */
export function toRows(payload: readonly PayloadEntry[] | undefined): TooltipRow[] {
  if (!payload) return [];
  return payload.map((entry) => ({
    name: typeof entry.name === "string" || typeof entry.name === "number" ? String(entry.name) : "",
    value: Number(entry.value ?? 0),
    color:
      typeof entry.color === "string"
        ? entry.color
        : typeof entry.stroke === "string"
          ? entry.stroke
          : typeof entry.fill === "string"
            ? entry.fill
            : VIZ.inkMuted,
  }));
}

/**
 * One tooltip listing every series at the hovered position.
 *
 * The value leads and the series name follows — the reader already knows which
 * series they're looking at and wants the number, which is the reverse of a
 * legend's hierarchy. Series identity rides a short stroke of the series colour;
 * the text itself stays in ink so light hues never have to be legible as type.
 */
export function VizTooltip({
  active,
  label,
  rows,
  currency,
  footer,
}: {
  active?: boolean;
  label?: ReactNode;
  rows: TooltipRow[];
  currency: string;
  footer?: string;
}) {
  if (!active || rows.length === 0) return null;

  return (
    <div className="pointer-events-none rounded-xl bg-white/95 p-3 shadow-lg ring-1 ring-slate-900/10 backdrop-blur-sm">
      {label != null && label !== "" && (
        <p className="mb-1.5 text-xs font-medium text-slate-500">{label}</p>
      )}
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.name} className="flex items-baseline gap-2">
            <span
              aria-hidden
              className="mt-1 h-0.5 w-3 flex-shrink-0 rounded-full"
              style={{ backgroundColor: row.color }}
            />
            <span className="text-sm font-semibold tabular-nums text-slate-900">
              {formatCurrency(row.value, currency)}
            </span>
            <span className="text-xs text-slate-500">{row.name}</span>
          </li>
        ))}
      </ul>
      {footer && (
        <p className="mt-1.5 border-t border-slate-100 pt-1.5 text-xs text-slate-500">{footer}</p>
      )}
    </div>
  );
}
