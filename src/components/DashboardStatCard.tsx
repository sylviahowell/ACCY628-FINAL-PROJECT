import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { money } from "@/lib/types";

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Compact KPI card: icon + optional meter; value stays for substance, visuals carry the scan. */
export function DashboardStatCard({
  title,
  value,
  href,
  icon: Icon,
  warn,
  meter,
  meterLabel,
  caption,
}: {
  title: string;
  value: string;
  href?: string;
  icon: LucideIcon;
  warn?: boolean;
  /** 0–1 fill for the meter bar. Omit to hide the meter. */
  meter?: number;
  meterLabel?: string;
  caption?: string;
}) {
  const fill = meter == null ? null : clamp01(meter);
  const tone = warn ? "text-error" : "text-primary";
  const meterTone = warn ? "bg-error" : "bg-primary";

  const inner = (
    <div className="flex h-full flex-col gap-2.5 p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-base-content/55">
          {title}
        </p>
        <span
          className={`rounded-lg p-1.5 ${warn ? "bg-error/10 text-error" : "bg-primary/10 text-primary"}`}
          aria-hidden
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>

      <p className={`text-xl font-bold tabular-nums tracking-tight sm:text-2xl ${tone}`}>
        {value}
      </p>

      {fill != null ? (
        <div className="mt-auto space-y-1">
          <div
            className="h-2 overflow-hidden rounded-full bg-base-300/80"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(fill * 100)}
            aria-label={meterLabel ?? title}
          >
            <div
              className={`h-full rounded-full transition-[width] ${meterTone}`}
              style={{ width: `${Math.round(fill * 100)}%` }}
            />
          </div>
          {meterLabel ? (
            <p className="text-[11px] leading-snug text-base-content/55">{meterLabel}</p>
          ) : null}
          {caption ? (
            <p className="text-[11px] leading-snug text-base-content/55">{caption}</p>
          ) : null}
        </div>
      ) : caption ? (
        <p className="mt-auto text-[11px] leading-snug text-base-content/55">{caption}</p>
      ) : null}
    </div>
  );

  const shell =
    "block h-full rounded-box border border-base-300 bg-base-100 shadow-sm transition hover:border-primary/35 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

  if (href) {
    return (
      <Link href={href} className={shell}>
        {inner}
      </Link>
    );
  }

  return <div className={shell}>{inner}</div>;
}

/** Horizontal stacked aging composition — scan buckets visually; dollars stay in titles/tooltips. */
export function AgingCompositionBar({
  buckets,
}: {
  buckets: { name: string; value: number }[];
}) {
  const total = buckets.reduce((s, b) => s + Math.max(0, b.value), 0);
  const palette = [
    "bg-success",
    "bg-primary",
    "bg-accent",
    "bg-warning",
    "bg-error",
  ];

  if (total <= 0) {
    return (
      <p className="py-6 text-center text-sm text-base-content/55">No open balance in aging.</p>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className="flex h-4 overflow-hidden rounded-full bg-base-300/70"
        role="img"
        aria-label="Aging composition"
      >
        {buckets.map((b, i) => {
          const pct = (Math.max(0, b.value) / total) * 100;
          if (pct < 0.4) return null;
          return (
            <div
              key={b.name}
              className={`${palette[i % palette.length]} h-full`}
              style={{ width: `${pct}%` }}
              title={`${b.name}: ${money(b.value)} (${Math.round(pct)}%)`}
            />
          );
        })}
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {buckets.map((b, i) => {
          const pct = Math.round((Math.max(0, b.value) / total) * 100);
          return (
            <li key={b.name} className="flex items-center gap-2 text-xs">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-sm ${palette[i % palette.length]}`}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-base-content/70">{b.name}</span>
              <span className="tabular-nums font-medium text-base-content/80">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
