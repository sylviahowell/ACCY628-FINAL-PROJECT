import Link from "next/link";
import { CustomizableKpiRibbon } from "@/components/CustomizableKpiRibbon";
import type { KpiItem } from "@/lib/kpi";

export function MorningBriefCard({
  greeting,
  kpis,
}: {
  greeting: string;
  kpis: KpiItem[];
}) {
  return (
    <div className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Morning Brief
          </p>
          <h2 className="text-xl font-bold tracking-tight">{greeting}</h2>
          <p className="text-sm opacity-70">
            Context for the day — figures from live application records.
          </p>
        </div>
        <CustomizableKpiRibbon items={kpis} />
      </div>
    </div>
  );
}

export function BusinessInsightsPanel({
  insights,
}: {
  insights: {
    id: string;
    observation: string;
    whyItMatters: string;
    action: string;
    href: string;
  }[];
}) {
  return (
    <div className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body">
        <h3 className="card-title text-base">Business Insights</h3>
        <p className="text-sm opacity-70">
          Rule-based observations from current data — not artificial intelligence.
        </p>
        <ul className="mt-2 space-y-4">
          {insights.map((ins) => (
            <li key={ins.id} className="rounded-box border border-base-300 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-50">
                Observation
              </p>
              <p className="font-medium">{ins.observation}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide opacity-50">
                Why it matters
              </p>
              <p className="text-sm opacity-80">{ins.whyItMatters}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide opacity-50">
                Recommended action
              </p>
              <p className="text-sm">
                {ins.action}{" "}
                <Link href={ins.href} className="link link-primary">
                  Open
                </Link>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
