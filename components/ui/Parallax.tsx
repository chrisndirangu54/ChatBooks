"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Moves its children against the scroll direction at a fraction of scroll speed.
 *
 * Notes on the implementation:
 *  · One rAF-throttled scroll listener per layer, `passive`, and it only writes
 *    a CSS custom property — the transform itself is in globals.css so it is
 *    also gated on `html.motion-ready`.
 *  · The offset is measured from the element's distance to the viewport centre,
 *    so a layer is at its neutral position when centred rather than jumping on
 *    mount partway down a page.
 *  · Bails out entirely under reduced motion: no listener, no transform.
 */
export function Parallax({
  children,
  /** Fraction of scroll distance to travel. Negative moves with the scroll. */
  speed = 0.12,
  /** Cap in px, so a long page can't fling a layer out of its container. */
  max = 90,
  className,
  ariaHidden = false,
}: {
  children: ReactNode;
  speed?: number;
  max?: number;
  className?: string;
  ariaHidden?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    const element = ref.current;
    if (!element) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      const distanceFromCentre = rect.top + rect.height / 2 - window.innerHeight / 2;
      const offset = Math.max(-max, Math.min(max, -distanceFromCentre * speed));
      element.style.setProperty("--parallax-y", `${offset.toFixed(2)}px`);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [reducedMotion, speed, max]);

  return (
    <div ref={ref} data-parallax="" aria-hidden={ariaHidden || undefined} className={cn(className)}>
      {children}
    </div>
  );
}
