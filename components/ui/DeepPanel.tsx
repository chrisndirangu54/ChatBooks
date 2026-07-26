import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The decorative layer stack behind a deep "console" surface: aurora wash,
 * hairline grid, a raked perspective floor, and a glowing top edge.
 *
 * Kept as one component so every deep panel in the app is lit the same way, and
 * so the whole stack is `aria-hidden` in a single place — none of it is content.
 * It's all gradients, no image requests.
 *
 * This is a Server Component: there's nothing interactive here, so it adds no
 * JavaScript to the page.
 */
export function DeepPanelBackdrop({ floor = true }: { floor?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Colour wash. */}
      <div className="fx-aurora absolute inset-0" />
      {/* Technical grid, masked to fade toward the edges. */}
      <div className="fx-grid absolute inset-0" />
      {/* Raked floor grid, anchored to the bottom edge for depth. */}
      {floor && <div className="fx-grid-floor absolute inset-x-0 bottom-0 h-1/2" />}
      {/* Light along the top hairline, with a slow travelling sheen. */}
      <div className="absolute inset-x-0 top-0 h-px overflow-hidden">
        <div className="fx-edge-glow h-px w-full opacity-70" />
        <div className="animate-sheen absolute inset-y-0 w-1/3 bg-white/60 blur-[1px]" />
      </div>
    </div>
  );
}

/**
 * A deep-space panel: dark surface, hairline ring, decorative backdrop, and a
 * content layer stacked above it.
 *
 * Chart cards deliberately don't use this — the series palette is validated
 * against a light surface, so plots stay on white.
 */
export function DeepPanel({
  children,
  className,
  floor = true,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  floor?: boolean;
  as?: "section" | "div" | "header";
}) {
  return (
    <Tag
      className={cn(
        "relative isolate overflow-hidden bg-[var(--fx-deep)] text-[var(--fx-ink)] ring-1 ring-white/10",
        className,
      )}
    >
      <DeepPanelBackdrop floor={floor} />
      <div className="relative">{children}</div>
    </Tag>
  );
}

/**
 * A small uppercase status chip — the "system readout" motif. Optional live dot
 * for things that are genuinely live.
 */
export function StatusChip({
  children,
  live = false,
  className,
}: {
  children: ReactNode;
  live?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--fx-ink)] backdrop-blur-sm",
        className,
      )}
    >
      {live && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inset-0 rounded-full bg-emerald-400 animate-pulse-ring" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </span>
      )}
      {children}
    </span>
  );
}
