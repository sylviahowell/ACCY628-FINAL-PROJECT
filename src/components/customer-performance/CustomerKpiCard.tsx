"use client";

import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { AnimatedNumber } from "./AnimatedNumber";

export function CustomerKpiCard({
  label,
  value,
  format,
  icon: Icon,
  delta,
  deltaSuffix = "%",
  invertDelta = false,
}: {
  label: string;
  value: number;
  format: (n: number) => string;
  icon: LucideIcon;
  delta: number | null;
  /** Appended to delta (e.g. "%" or " pts"). */
  deltaSuffix?: string;
  /** When true, positive delta is bad (e.g. cost up). */
  invertDelta?: boolean;
}) {
  const good =
    delta == null ? null : invertDelta ? delta < 0 : delta > 0;
  const bad =
    delta == null ? null : invertDelta ? delta > 0 : delta < 0;

  return (
    <div className="cpe-kpi group">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide opacity-60">{label}</p>
        <span className="rounded-lg bg-primary/10 p-1.5 text-primary transition group-hover:bg-primary/15">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums tracking-tight sm:text-2xl">
        <AnimatedNumber value={value} format={format} />
      </p>
      <div className="mt-1.5 flex min-h-5 items-center gap-1 text-xs">
        {delta == null ? (
          <span className="opacity-50">vs prior month</span>
        ) : (
          <>
            {good ? (
              <TrendingUp className="h-3.5 w-3.5 text-success" aria-hidden />
            ) : bad ? (
              <TrendingDown className="h-3.5 w-3.5 text-error" aria-hidden />
            ) : null}
            <span
              className={
                good ? "font-medium text-success" : bad ? "font-medium text-error" : "opacity-70"
              }
            >
              {delta > 0 ? "+" : ""}
              {delta}
              {deltaSuffix}
            </span>
            <span className="opacity-50">MoM</span>
          </>
        )}
      </div>
    </div>
  );
}
