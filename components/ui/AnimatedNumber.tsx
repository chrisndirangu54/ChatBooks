"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { easeOutQuint, usePrefersReducedMotion, useInView } from "@/lib/motion";
import { formatCompact, formatCurrency } from "@/lib/utils";

type NumberFormat = "currency" | "compact" | "integer" | "percent";

/** Runs before paint on the client, and is a no-op during SSR. */
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function formatValue(value: number, format: NumberFormat, currency: string, decimals: number): string {
  switch (format) {
    case "currency":
      return formatCurrency(value, currency);
    case "compact":
      return formatCompact(value);
    case "percent":
      return `${value.toFixed(decimals)}%`;
    default:
      return Math.round(value).toLocaleString("en-US");
  }
}

/**
 * Counts from zero up to `value` the first time it scrolls into view.
 *
 * Props are all primitives on purpose — no formatter callbacks — so this can be
 * dropped straight into a Server Component (the landing page) as well as a
 * client one. Format is chosen by name instead.
 *
 * Figures stay proportional, not tabular: at display sizes equal-width digits
 * make a value like `121` look gappy. Tabular is for columns, not headlines.
 */
export function AnimatedNumber({
  value,
  format = "integer",
  currency = "USD",
  decimals = 0,
  duration = 1100,
  delay = 0,
  className,
}: {
  value: number;
  format?: NumberFormat;
  currency?: string;
  decimals?: number;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLSpanElement>({ threshold: 0.4, rootMargin: "0px" });

  // Seeded with the final value so the server render, the no-JS render, and the
  // first hydrated render all show a real number.
  const [display, setDisplay] = useState(value);
  const animatable = useRef(false);

  useIsomorphicLayoutEffect(() => {
    // Only rewind to zero once we know we're on the client and will animate.
    if (!reducedMotion) {
      animatable.current = true;
      setDisplay(0);
    }
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion || !animatable.current) {
      setDisplay(value);
      return;
    }
    if (!inView) return;

    let frame = 0;
    let start = 0;

    const tick = (now: number) => {
      if (!start) start = now;
      const elapsed = now - start - delay;
      if (elapsed < 0) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const progress = Math.min(1, elapsed / duration);
      setDisplay(value * easeOutQuint(progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, duration, delay, reducedMotion]);

  return (
    <span ref={ref} className={className}>
      {formatValue(display, format, currency, decimals)}
    </span>
  );
}
