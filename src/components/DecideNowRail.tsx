"use client";

import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import type { DecideNowItem, DecideNowTone } from "@/lib/decide-now";

export type { DecideNowItem };

type SortOrder = "urgent-desc" | "urgent-asc";

const TONE_URGENCY: Record<DecideNowTone, number> = {
  error: 3,
  warning: 2,
  info: 1,
};

function compareUrgency(a: DecideNowItem, b: DecideNowItem): number {
  const toneA = TONE_URGENCY[a.tone ?? "warning"];
  const toneB = TONE_URGENCY[b.tone ?? "warning"];
  if (toneB !== toneA) return toneB - toneA;
  return b.score - a.score;
}

export function DecideNowRail({
  items,
  title = "Needs attention",
  subtitle = "Exceptions for executive review — ranked by urgency.",
  emptyTitle = "Nothing urgent",
  emptyDescription = "Network looks healthy — no ranked exceptions right now.",
}: {
  items: DecideNowItem[];
  title?: string;
  subtitle?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const [sortOrder, setSortOrder] = useState<SortOrder>("urgent-desc");
  const count = items.length;

  const sorted = [...items].sort(compareUrgency);
  if (sortOrder === "urgent-asc") sorted.reverse();

  const borderTone =
    count === 0
      ? "border-success/30"
      : items.some((i) => i.tone === "error")
        ? "border-error/40"
        : "border-warning/40";

  return (
    <div className={`card border bg-base-100 shadow-sm ${borderTone}`}>
      <div className="card-body gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight">{title}</h2>
              <span
                className={`badge badge-sm ${
                  count === 0 ? "badge-success" : "badge-warning"
                }`}
              >
                {count === 0 ? "All clear" : `${count} open`}
              </span>
            </div>
            <p className="text-sm opacity-70">{subtitle}</p>
          </div>

          {count > 0 ? (
            <label className="form-control w-full max-w-[14rem] sm:w-auto">
              <span className="label py-0 pb-1">
                <span className="label-text text-xs opacity-70">Sort by</span>
              </span>
              <select
                className="select select-bordered select-sm"
                aria-label="Sort attention items by urgency"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              >
                <option value="urgent-desc">Most urgent first</option>
                <option value="urgent-asc">Least urgent first</option>
              </select>
            </label>
          ) : null}
        </div>

        {count === 0 ? (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        ) : (
          <ul className="space-y-2">
            {sorted.map((item, index) => {
              const cta = item.cta ?? "Review";
              const rank =
                sortOrder === "urgent-desc" ? index + 1 : sorted.length - index;
              return (
                <li
                  key={item.id}
                  className={`grid grid-cols-1 items-center gap-3 rounded-box border px-3 py-2.5 sm:grid-cols-[2rem_minmax(0,1fr)_minmax(5.5rem,7rem)_6.5rem] sm:gap-x-3 ${toneRowClass(item.tone)}`}
                >
                  <span
                    className="badge badge-ghost badge-sm tabular-nums justify-self-start sm:justify-self-center"
                    title={`Urgency rank ${rank}`}
                    aria-label={`Urgency rank ${rank}`}
                  >
                    {rank}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <p className="font-semibold">{item.title}</p>
                      <span className={`badge badge-xs ${urgencyBadgeClass(item.tone)}`}>
                        {urgencyLabel(item.tone)}
                      </span>
                    </div>
                    <p className="text-sm opacity-70">{item.detail}</p>
                  </div>
                  <p
                    className={`text-sm font-bold tabular-nums sm:justify-self-end sm:text-right ${toneMetricClass(item.tone)}`}
                  >
                    {item.metric}
                    {item.metricKind === "count" && item.metricUnit ? (
                      <span className="ml-1 text-xs font-medium opacity-60">
                        {item.metricUnit}
                      </span>
                    ) : null}
                  </p>
                  <Link
                    href={item.href}
                    aria-label={`${cta} — ${item.title} (${item.metric})`}
                    className={`btn btn-sm w-full justify-center sm:w-[6.5rem] ${toneBtnClass(item.tone)}`}
                  >
                    {cta}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function urgencyLabel(tone: DecideNowItem["tone"]) {
  if (tone === "error") return "Critical";
  if (tone === "info") return "Watch";
  return "High";
}

function urgencyBadgeClass(tone: DecideNowItem["tone"]) {
  if (tone === "error") return "badge-error";
  if (tone === "info") return "badge-info";
  return "badge-warning";
}

function toneRowClass(tone: DecideNowItem["tone"]) {
  if (tone === "error") return "border-error/40 bg-error/10";
  if (tone === "info") return "border-info/30 bg-info/10";
  return "border-warning/40 bg-warning/10";
}

function toneMetricClass(tone: DecideNowItem["tone"]) {
  if (tone === "error") return "text-error";
  if (tone === "info") return "text-info";
  return "text-warning";
}

function toneBtnClass(tone: DecideNowItem["tone"]) {
  if (tone === "error") return "btn-error";
  if (tone === "info") return "btn-info";
  return "btn-warning";
}
