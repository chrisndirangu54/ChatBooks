"use client";

import { CheckCircle2, AlertTriangle, CircleDashed } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { STATUS, type StatusKey } from "@/components/ui/Meter";
import { cn } from "@/lib/utils";

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const ICONS: Record<StatusKey, typeof CheckCircle2> = {
  good: CheckCircle2,
  warning: AlertTriangle,
  serious: AlertTriangle,
  critical: CircleDashed,
};

/**
 * A meter in the round: one ratio against a fixed limit, with the value printed
 * in the middle.
 *
 * It's a meter and not a gauge chart — no tick marks, no needle, no coloured
 * zones around the rim. The track is a lighter step of the fill's own hue, and
 * the status is spelled out with an icon and a word underneath, so the ring's
 * colour is never the only thing saying "you're fine".
 */
export function ScoreRing({
  score,
  max = 100,
  status,
  statusLabel,
  caption,
  className,
}: {
  score: number;
  max?: number;
  status: StatusKey;
  statusLabel: string;
  caption?: string;
  className?: string;
}) {
  const tone = STATUS[status];
  const ratio = Math.max(0, Math.min(1, score / max));
  const arcLength = ratio * CIRCUMFERENCE;
  const Icon = ICONS[status];

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative">
        <svg width={128} height={128} viewBox="0 0 128 128" role="presentation" aria-hidden="true">
          {/* Track — same hue, lighter step. */}
          <circle
            cx={64}
            cy={64}
            r={RADIUS}
            fill="none"
            stroke={tone.track}
            strokeWidth={10}
          />
          {/* Fill — starts at 12 o'clock and sweeps clockwise. Offset settles at
              0 so that with motion off the arc is simply drawn in place. */}
          <circle
            cx={64}
            cy={64}
            r={RADIUS}
            fill="none"
            stroke={tone.fill}
            strokeWidth={10}
            strokeLinecap="round"
            transform="rotate(-90 64 64)"
            strokeDasharray={`${arcLength.toFixed(2)} ${CIRCUMFERENCE.toFixed(2)}`}
            strokeDashoffset={0}
            className="animate-arc"
            style={
              {
                "--arc-length": arcLength.toFixed(2),
                "--draw-delay": "120ms",
              } as React.CSSProperties
            }
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-3xl font-semibold leading-none text-slate-900">
            <AnimatedNumber value={score} delay={120} />
          </p>
          <p className="mt-0.5 text-xs text-slate-500">out of {max}</p>
        </div>
      </div>

      <p
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold"
        style={{ color: tone.text }}
      >
        <Icon size={16} aria-hidden />
        {statusLabel}
      </p>
      {caption && <p className="mt-1 text-center text-xs text-slate-500">{caption}</p>}
    </div>
  );
}
