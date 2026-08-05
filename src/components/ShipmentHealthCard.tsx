import type { FriendlyHealth } from "@/lib/portal-views";
import type { HealthResult } from "@/lib/shipment-health";
import { categoryBadgeClass } from "@/lib/shipment-health";

export function CustomerFriendlyStatusCard({ health }: { health: FriendlyHealth }) {
  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="card-title text-base">Shipment status</h2>
          <span className={`badge ${health.badgeClass}`}>{health.label}</span>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm opacity-80">
          {health.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ShipmentHealthCard({
  health,
  audience = "internal",
}: {
  health: HealthResult;
  audience?: "internal" | "carrier";
}) {
  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="card-title text-base">
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
      </div>
    </div>
  );
}
