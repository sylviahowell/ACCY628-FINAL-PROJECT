import Link from "next/link";
import { sanitizeDemoText } from "@/lib/display-text";
import { money } from "@/lib/types";

export type OverrideLogRow = {
  id: string;
  at: string;
  actor: string;
  kind: "approval" | "credit";
  summary: string;
  detail: string | null;
  href: string | null;
};

function kindBadge(kind: OverrideLogRow["kind"]) {
  return kind === "credit" ? "badge-error" : "badge-info";
}

function kindLabel(kind: OverrideLogRow["kind"]) {
  return kind === "credit" ? "Credit override" : "Approval decision";
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Governance evidence: recent approval decisions + credit booking overrides. */
export function ManagerOverridesLog({ rows }: { rows: OverrideLogRow[] }) {
  return (
    <section className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-lg font-semibold">Manager overrides</h2>
        <p className="mt-1 text-sm opacity-70">
          Decisions and credit overrides leave an audit trail for segregation of duties.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm opacity-70">
          No recent overrides — approvals and credit overrides will appear here.
        </p>
      ) : (
        <ul className="divide-y divide-base-300">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className={`badge badge-sm ${kindBadge(row.kind)}`}>
                    {kindLabel(row.kind)}
                  </span>
                  <span className="opacity-60">{formatWhen(row.at)}</span>
                  <span className="font-medium">{row.actor}</span>
                </div>
                <p className="mt-1 font-medium">{row.summary}</p>
                {row.detail ? (
                  <p className="mt-0.5 text-sm opacity-70">{sanitizeDemoText(row.detail)}</p>
                ) : null}
              </div>
              {row.href ? (
                <Link href={row.href} className="btn btn-ghost btn-xs shrink-0">
                  Open
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Build a short summary line for an approval decision row. */
export function approvalOverrideSummary(opts: {
  status: string;
  requestType: string;
  amount: number;
  loadNumber: string | null;
}) {
  const verb = opts.status === "approved" ? "Approved" : "Rejected";
  const load = opts.loadNumber ? ` · ${opts.loadNumber}` : "";
  return `${verb} ${opts.requestType}${load} · ${money(opts.amount)}`;
}
