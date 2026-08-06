import Link from "next/link";
import type { DecideNowItem } from "@/lib/decide-now";

export type { DecideNowItem };

export function DecideNowRail({ items }: { items: DecideNowItem[] }) {
  const count = items.length;
  const borderTone =
    count === 0
      ? "border-success/30"
      : items.some((i) => i.tone === "error")
        ? "border-error/40"
        : "border-warning/40";

  return (
    <div className={`card border bg-base-100 shadow-sm ${borderTone}`}>
      <div className="card-body gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight">Decide now</h2>
            <span
              className={`badge badge-sm ${
                count === 0 ? "badge-success" : "badge-warning"
              }`}
            >
              {count === 0 ? "Clear" : `Top ${count}`}
            </span>
          </div>
          <p className="text-sm opacity-70">
            Highest-impact decisions — one click to act.
          </p>
        </div>

        {count === 0 ? (
          <p className="rounded-box bg-success/10 px-3 py-2 text-sm">
            No decisions waiting — network looks healthy.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const cta = item.cta ?? "Review";
              return (
                <li
                  key={item.id}
                  className={`grid grid-cols-1 items-center gap-3 rounded-box border px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_6.5rem] ${toneRowClass(item.tone)}`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <p className="font-semibold">{item.title}</p>
                      <p
                        className={`text-sm font-bold tabular-nums ${toneMetricClass(item.tone)}`}
                      >
                        {item.metric}
                        {item.metricKind === "count" && item.metricUnit ? (
                          <span className="ml-1 text-xs font-medium opacity-60">
                            {item.metricUnit}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <p className="text-sm opacity-70">{item.detail}</p>
                  </div>
                  <Link
                    href={item.href}
                    aria-label={`${cta} — ${item.title} (${item.metric})`}
                    className={`btn btn-sm w-full justify-center ${toneBtnClass(item.tone)}`}
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
