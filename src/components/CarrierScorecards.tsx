import Link from "next/link";
import {
  suggestCarriersForLoad,
  tierBadge,
  type CarrierScorecard,
} from "@/lib/carrier-scorecard";
import { money } from "@/lib/types";

export function CarrierScorecardGrid({
  scorecards,
  showComparison = true,
}: {
  scorecards: CarrierScorecard[];
  showComparison?: boolean;
}) {
  const suggestions = showComparison
    ? suggestCarriersForLoad(scorecards, { preferLowCost: false })
    : [];

  return (
    <div className="space-y-6">
      {showComparison && suggestions.length > 0 ? (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Carrier comparison (for coverage)</h2>
            <p className="text-sm opacity-70">
              Ranked by tier and on-time delivery. Suspended carriers are excluded. Use this when
              assigning a load — still confirm equipment and insurance on the shipment.
            </p>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Carrier</th>
                    <th>Tier</th>
                    <th>On-time del.</th>
                    <th>Avg cost</th>
                    <th>Avg margin</th>
                    <th>Insurance</th>
                    <th>Equipment</th>
                    <th>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map((c) => (
                    <tr key={c.carrierId}>
                      <td className="font-medium">{c.name}</td>
                      <td>
                        <span className={`badge badge-sm ${tierBadge(c.tier)}`}>{c.tier}</span>
                      </td>
                      <td>{c.onTimeDeliveryPct == null ? "—" : `${c.onTimeDeliveryPct}%`}</td>
                      <td>{c.avgCarrierCost == null ? "—" : money(c.avgCarrierCost)}</td>
                      <td>{c.avgMargin == null ? "—" : money(c.avgMargin)}</td>
                      <td>{c.insuranceStatus}</td>
                      <td className="text-xs">{c.equipmentType ?? "—"}</td>
                      <td>{c.activeLoads}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {scorecards.map((c) => (
          <div key={c.carrierId} className="card bg-base-100 shadow-sm">
            <div className="card-body gap-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="card-title text-lg">{c.name}</h3>
                  <p className="text-sm opacity-70">
                    {c.equipmentType ?? "Equipment TBD"} · {c.serviceArea ?? "Area TBD"}
                    {c.rating != null ? ` · Rating ${c.rating}` : ""}
                  </p>
                </div>
                <span className={`badge ${tierBadge(c.tier)}`}>{c.tier}</span>
              </div>
              <ul className="list-disc space-y-0.5 pl-5 text-xs opacity-80">
                {c.tierReasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                <Metric label="Total loads" value={String(c.totalLoads)} />
                <Metric
                  label="On-time pickup"
                  value={c.onTimePickupPct == null ? "—" : `${c.onTimePickupPct}%`}
                />
                <Metric
                  label="On-time delivery"
                  value={c.onTimeDeliveryPct == null ? "—" : `${c.onTimeDeliveryPct}%`}
                />
                <Metric
                  label="Avg delay (days)"
                  value={c.avgDelayDays == null ? "—" : String(c.avgDelayDays)}
                />
                <Metric
                  label="Avg carrier cost"
                  value={c.avgCarrierCost == null ? "—" : money(c.avgCarrierCost)}
                />
                <Metric
                  label="Avg margin"
                  value={c.avgMargin == null ? "—" : money(c.avgMargin)}
                />
                <Metric
                  label="POD completion"
                  value={c.documentationPct == null ? "—" : `${c.documentationPct}%`}
                />
                <Metric
                  label="Accessorial rate"
                  value={`${Math.round(c.accessorialFrequency * 100)}%`}
                />
                <Metric
                  label="Acceptance"
                  value={c.acceptanceRate == null ? "—" : `${c.acceptanceRate}%`}
                />
              </div>
              <p className="text-xs opacity-60">
                Insurance: {c.insuranceStatus}
                {c.insuranceExpiration ? ` (${c.insuranceExpiration})` : ""} · Active loads:{" "}
                {c.activeLoads}
              </p>
              <p className="text-[11px] opacity-50">
                Claims/damage incidents are not tracked in this demo dataset — shown as N/A in
                formal scorecards elsewhere when a claims table exists.
              </p>
              <Link href="/shipments" className="btn btn-ghost btn-xs w-fit">
                View shipments
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-box bg-base-200/70 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide opacity-60">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
