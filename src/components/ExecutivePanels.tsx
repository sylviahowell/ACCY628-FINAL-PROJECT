import Link from "next/link";
import type { KpiItem } from "@/lib/kpi";

function toneClass(tone: KpiItem["tone"]) {
  if (tone === "good") return "text-success";
  if (tone === "bad") return "text-error";
  return "text-base-content/70";
}

function arrow(tone: KpiItem["tone"], deltaLabel: string) {
  if (deltaLabel.toLowerCase().includes("flat")) return "→";
  if (tone === "good") return "▲";
  if (tone === "bad") return "▼";
  return "•";
}

function KpiCell({ item }: { item: KpiItem }) {
  const body = (
    <>
      <p className="text-[11px] font-medium uppercase tracking-wide opacity-60">
        {item.label}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums text-primary">{item.value}</p>
      <p className={`mt-1 text-xs ${toneClass(item.tone)}`}>
        <span className="mr-1" aria-hidden>
          {arrow(item.tone, item.deltaLabel)}
        </span>
        {item.deltaLabel}
      </p>
      <p className="mt-0.5 text-[11px] opacity-50">{item.status}</p>
    </>
  );

  if (item.href) {
    return (
      <Link
        href={item.href}
        className="block min-w-[9.5rem] px-4 py-3 transition-colors hover:bg-base-200/70 focus-visible:bg-base-200/70 focus-visible:outline-none"
      >
        {body}
      </Link>
    );
  }

  return <div className="min-w-[9.5rem] px-4 py-3">{body}</div>;
}

export function KpiRibbon({ items }: { items: KpiItem[] }) {
  return (
    <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100 shadow-sm">
      <div className="flex min-w-max divide-x divide-base-300">
        {items.map((item) => (
          <KpiCell key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

export function MorningBriefCard({
  greeting,
  yesterday,
  today,
  attention,
}: {
  greeting: string;
  yesterday: { label: string; value: string; href?: string }[];
  today: { label: string; value: string; href?: string }[];
  attention?: { label: string; value: string; href?: string }[];
}) {
  const showAttention = attention !== undefined;
  return (
    <div className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Morning Brief
          </p>
          <h2 className="text-xl font-bold tracking-tight">{greeting}</h2>
          <p className="text-sm opacity-70">
            Context for the day — figures from live application records.
          </p>
        </div>
        <div
          className={`grid gap-4 ${showAttention ? "md:grid-cols-3" : "md:grid-cols-2"}`}
        >
          <BriefCol title="Yesterday" lines={yesterday} />
          <BriefCol title="Today" lines={today} />
          {showAttention && attention ? (
            <BriefCol
              title="Attention required"
              lines={
                attention.length
                  ? attention
                  : [{ label: "No critical items", value: "Clear" }]
              }
              emphasize
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function BriefCol({
  title,
  lines,
  emphasize,
}: {
  title: string;
  lines: { label: string; value: string; href?: string }[];
  emphasize?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <ul className="space-y-2 text-sm">
        {lines.map((line) => (
          <li
            key={line.label}
            className={`flex items-start justify-between gap-2 rounded-box px-2 py-1.5 ${
              emphasize && line.value !== "Clear" ? "bg-warning/10" : "bg-base-200/60"
            }`}
          >
            <span className="opacity-80">{line.label}</span>
            {line.href ? (
              <Link
                href={line.href}
                className="link link-primary shrink-0 font-semibold tabular-nums"
              >
                {line.value}
              </Link>
            ) : (
              <span className="shrink-0 font-semibold tabular-nums">{line.value}</span>
            )}
          </li>
        ))}
      </ul>
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
    <div className="card bg-base-100 shadow-sm">
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
