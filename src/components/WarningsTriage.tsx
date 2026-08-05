"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AlertSeverity, AppAlert } from "@/lib/alerts";
import { severityBadge } from "@/lib/alerts";
import { FocusScroll } from "@/components/FocusScroll";
import { sanitizeDemoText } from "@/lib/display-text";

type Filter = "all" | AlertSeverity;

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function sortAlerts(alerts: AppAlert[]) {
  return [...alerts].sort((a, b) => {
    const bySev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (bySev !== 0) return bySev;
    return a.title.localeCompare(b.title);
  });
}

function initialFilter(param: string | null): Filter {
  if (param === "critical" || param === "warning" || param === "info") return param;
  if (param === "warnings") return "warning";
  return "all";
}

export function WarningsTriage({ alerts }: { alerts: AppAlert[] }) {
  return (
    <Suspense fallback={<WarningsTriageFallback alerts={alerts} />}>
      <WarningsTriageInner alerts={alerts} />
    </Suspense>
  );
}

function WarningsTriageFallback({ alerts }: { alerts: AppAlert[] }) {
  const sorted = sortAlerts(alerts);
  return <WarningsBody alerts={sorted} filter="all" />;
}

function WarningsTriageInner({ alerts }: { alerts: AppAlert[] }) {
  const params = useSearchParams();
  const [filter, setFilter] = useState<Filter>(() => initialFilter(params.get("severity")));

  const sorted = useMemo(() => sortAlerts(alerts), [alerts]);
  const visible = useMemo(
    () => (filter === "all" ? sorted : sorted.filter((a) => a.severity === filter)),
    [sorted, filter],
  );

  const critical = alerts.filter((a) => a.severity === "critical").length;
  const warning = alerts.filter((a) => a.severity === "warning").length;
  const info = alerts.filter((a) => a.severity === "info").length;

  return (
    <>
      <FocusScroll />
      <div className="stats bg-base-100 shadow-sm">
        <button type="button" className="stat text-left" onClick={() => setFilter("critical")}>
          <div className="stat-title">Critical</div>
          <div className="stat-value text-2xl text-error">{critical}</div>
        </button>
        <button type="button" className="stat text-left" onClick={() => setFilter("warning")}>
          <div className="stat-title">Warnings</div>
          <div className="stat-value text-2xl text-warning">{warning}</div>
        </button>
        <button type="button" className="stat text-left" onClick={() => setFilter("all")}>
          <div className="stat-title">Total alerts</div>
          <div className="stat-value text-2xl">{alerts.length}</div>
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All", alerts.length],
            ["critical", "Critical", critical],
            ["warning", "Warnings", warning],
            ["info", "Info", info],
          ] as const
        ).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            className={`btn btn-xs ${filter === id ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setFilter(id)}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      <WarningsBody alerts={visible} filter={filter} />
    </>
  );
}

function WarningsBody({ alerts, filter }: { alerts: AppAlert[]; filter: Filter }) {
  if (alerts.length === 0) {
    return (
      <div className="alert alert-success">
        <span>
          {filter === "all"
            ? "No active warnings for your portal right now."
            : `No ${filter} alerts in this filter.`}
        </span>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {alerts.map((a) => (
        <li
          key={a.id}
          id={`focus-${a.id}`}
          data-focus={a.related || a.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-box border border-base-300 bg-base-100 px-4 py-3 transition"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`badge badge-sm ${severityBadge(a.severity)}`}>{a.severity}</span>
              <p className="font-medium">{a.title}</p>
              {a.related ? <span className="text-sm opacity-60">{a.related}</span> : null}
            </div>
            <p className="mt-1 text-sm opacity-70">{sanitizeDemoText(a.reason)}</p>
            <p className="mt-0.5 text-xs opacity-50">{a.action}</p>
          </div>
          <Link href={a.href} className="btn btn-primary btn-sm shrink-0" title={a.action}>
            Resolve
          </Link>
        </li>
      ))}
    </ul>
  );
}
