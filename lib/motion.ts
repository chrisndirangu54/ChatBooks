"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Whether the visitor has asked for reduced motion, kept in sync with the media
 * query.
 *
 * `useSyncExternalStore` rather than state-plus-effect: a media query *is* an
 * external store, and subscribing to it this way avoids the extra render pass
 * (and the cascading-render lint error) that setting state from an effect causes.
 * The server snapshot is `false` — the server can't know, and the CSS gate in
 * globals.css is what actually keeps motion off for these visitors.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

/**
 * Fires once, the first time the element scrolls into view. One-shot, so
 * scrolling back up doesn't replay a reveal.
 *
 * There's deliberately no fallback for a missing `IntersectionObserver` here:
 * the root layout only adds the `motion-ready` class when the API exists, so
 * without it nothing is ever hidden and there is nothing for this to reveal.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(
  options: { rootMargin?: string; threshold?: number } = {},
): { ref: React.RefObject<T | null>; inView: boolean } {
  const { rootMargin = "0px 0px -12% 0px", threshold = 0.15 } = options;
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin, threshold },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin, threshold]);

  return { ref, inView };
}

/** Ease-out quint — fast start, long settle. Reads as "landing on" a number. */
export function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}
