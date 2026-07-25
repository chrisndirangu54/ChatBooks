"use client";

import type { ElementType, ReactNode } from "react";
import { useInView } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Direction = "up" | "left" | "right" | "scale";

/**
 * Slides its children in the first time they scroll into view.
 *
 * The offset and transition live in globals.css behind `html.motion-ready`, so
 * this component only decides *when* — which keeps the reduced-motion and no-JS
 * fallbacks in one place instead of spread across inline styles.
 */
export function Reveal({
  children,
  direction = "up",
  delay = 0,
  as: Tag = "div",
  className,
}: {
  children: ReactNode;
  direction?: Direction;
  /** Stagger, in ms. Keep cumulative delays under ~400ms or it reads as lag. */
  delay?: number;
  as?: ElementType;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <Tag
      ref={ref}
      data-reveal={direction}
      data-revealed={inView ? "true" : "false"}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
      className={className}
    >
      {children}
    </Tag>
  );
}

/**
 * Reveals a list of children in sequence. Saves threading an index-derived
 * delay through every `.map()` call site.
 */
export function RevealGroup({
  children,
  direction = "up",
  step = 70,
  className,
}: {
  children: ReactNode[];
  direction?: Direction;
  step?: number;
  className?: string;
}) {
  return (
    <div className={cn(className)}>
      {children.map((child, index) => (
        <Reveal key={index} direction={direction} delay={index * step}>
          {child}
        </Reveal>
      ))}
    </div>
  );
}
