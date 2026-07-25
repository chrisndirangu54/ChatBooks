"use client";

import { cn } from "@/lib/utils";

/**
 * Fixed status scale — reserved meaning, never reused as a series colour.
 *
 * Each entry pairs a fill with a lighter step of the *same* hue for the unfilled
 * track, so the state reads across the whole bar instead of only the filled part.
 * `warning` sits below 3:1 on white by design; the icon and label that always
 * accompany a meter are the mitigation, so colour never carries the meaning alone.
 */
export const STATUS = {
  good: { fill: "#0ca30c", track: "#cdeecd", text: "#0a7a0a" },
  warning: { fill: "#fab219", track: "#fdeccc", text: "#8a5e00" },
  serious: { fill: "#ec835a", track: "#fbe0d6", text: "#9c4a24" },
  critical: { fill: "#d03b3b", track: "#f5d8d8", text: "#a32828" },
} as const;

export type StatusKey = keyof typeof STATUS;

/** A single ratio against a limit. Not a one-bar bar chart — no axis, no plot. */
export function Meter({
  value,
  max = 100,
  status = "good",
  label,
  valueLabel,
  delay = 0,
  className,
}: {
  value: number;
  max?: number;
  status?: StatusKey;
  label: string;
  valueLabel?: string;
  delay?: number;
  className?: string;
}) {
  const tone = STATUS[status];
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-slate-600">{label}</span>
        {valueLabel && (
          <span className="text-sm font-semibold tabular-nums text-slate-900">{valueLabel}</span>
        )}
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: tone.track }}
        role="meter"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div
          className="h-full rounded-full animate-grow-x"
          style={
            {
              width: `${ratio * 100}%`,
              backgroundColor: tone.fill,
              "--draw-delay": `${delay}ms`,
            } as React.CSSProperties
          }
        />
      </div>
    </div>
  );
}
