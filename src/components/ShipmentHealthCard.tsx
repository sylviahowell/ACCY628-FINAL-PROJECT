import Link from "next/link";
import type { FriendlyHealth } from "@/lib/portal-views";
import type { HealthResult } from "@/lib/shipment-health";
import { categoryBadgeClass } from "@/lib/shipment-health";
import { UNIFORM_STATUS_BADGE } from "@/lib/types";

export function CustomerFriendlyStatusCard({
  loadNumber,
  href,
  lane,
  opsStatus,
  health,
  embedded = false,
  hideTitle = false,
}: {
  loadNumber?: string;
  href?: string;
  lane?: string;
  opsStatus?: string;
  health: FriendlyHealth;
  /** Drop outer card chrome when nested inside a parent section. */
  embedded?: boolean;
  /** Hide the default "Shipment status" heading (e.g. parent section already titles it). */
  hideTitle?: boolean;
}) {
  const hasShipmentMeta = Boolean(loadNumber && href);

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {hasShipmentMeta ? (
            <>
              <Link href={href!} className="link link-primary font-semibold">
                {loadNumber}
              </Link>
              {lane ? (
                <p className="mt-0.5 truncate text-sm opacity-70" title={lane}>
                  {lane}
                </p>
              ) : null}
              {opsStatus ? (
                <p className="mt-1 text-xs opacity-50">{opsStatus}</p>
              ) : null}
            </>
          ) : hideTitle ? (
            <p className="text-sm font-semibold">Status</p>
          ) : (
            <h2 className="card-title text-base">Shipment status</h2>
          )}
        </div>
        <span className={`${UNIFORM_STATUS_BADGE} ${health.badgeClass}`}>{health.label}</span>
      </div>
      <p className="text-sm opacity-80">{health.summary}</p>
      <ul className="space-y-1 text-sm opacity-70">
        {health.reasons.map((r) => (
          <li key={r} className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-50" />
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </>
  );

  if (embedded) {
    return <div className="flex h-full flex-col gap-3">{body}</div>;
  }

  return (
    <div className="card h-full border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-3 p-4">{body}</div>
    </div>
  );
}

export function ShipmentHealthCard({
  health,
  audience = "internal",
  embedded = false,
}: {
  health: HealthResult;
  audience?: "internal" | "carrier";
  /** Drop outer card chrome when nested inside a parent section. */
  embedded?: boolean;
}) {
  const body = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={embedded ? "text-sm font-semibold" : "card-title text-base"}>
          {audience === "carrier" ? "Load readiness" : "Shipment health"}
        </h2>
        <span className={`badge ${categoryBadgeClass(health.category)}`}>
          {health.score} — {health.category}
        </span>
      </div>
      <progress
        className={`progress w-full ${
          health.category === "Healthy"
            ? "progress-success"
            : health.category === "At Risk"
              ? "progress-warning"
              : "progress-error"
        }`}
        value={health.score}
        max={100}
      />
      <p className="text-xs opacity-60">
        {audience === "carrier"
          ? "Based on timing, documentation, and assignment — not brokerage margin."
          : "Rule-based score (not AI). Starts at 100; penalties for delay, missing carrier/POD, negative margin, pending charges, billing lag, disputes."}
      </p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
        {health.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </>
  );

  if (embedded) {
    return <div className="flex flex-col gap-2">{body}</div>;
  }

  return (
    <div className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-2">{body}</div>
    </div>
  );
}
