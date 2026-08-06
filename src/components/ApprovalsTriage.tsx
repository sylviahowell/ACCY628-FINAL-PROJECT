"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { reviewApproval } from "@/lib/actions/freight";
import { FocusScroll } from "@/components/FocusScroll";
import { sanitizeDemoText } from "@/lib/display-text";
import { money } from "@/lib/types";

export type ApprovalRow = {
  id: string;
  request_type: string;
  amount: number;
  reason: string | null;
  created_at: string | null;
  loadNumber: string | null;
  shipmentHref: string | null;
};

type TypeFilter = "all" | "accessorial" | "discount";

function initialType(param: string | null): TypeFilter {
  if (param === "accessorial" || param === "discount") return param;
  return "all";
}

function typeBadge(type: string) {
  if (type === "accessorial") return "badge-warning";
  if (type === "discount") return "badge-info";
  return "badge-ghost";
}

export function ApprovalsTriage({
  pending,
  canDecide,
}: {
  pending: ApprovalRow[];
  canDecide: boolean;
}) {
  return (
    <Suspense fallback={<ApprovalsBody pending={pending} filter="all" canDecide={canDecide} />}>
      <ApprovalsTriageInner pending={pending} canDecide={canDecide} />
    </Suspense>
  );
}

function ApprovalsTriageInner({
  pending,
  canDecide,
}: {
  pending: ApprovalRow[];
  canDecide: boolean;
}) {
  const params = useSearchParams();
  const [filter, setFilter] = useState<TypeFilter>(() => initialType(params.get("type")));

  const accessorial = pending.filter((a) => a.request_type === "accessorial").length;
  const discount = pending.filter((a) => a.request_type === "discount").length;

  const visible = useMemo(
    () => (filter === "all" ? pending : pending.filter((a) => a.request_type === filter)),
    [pending, filter],
  );

  return (
    <>
      <FocusScroll />
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All", pending.length],
            ["accessorial", "Accessorial", accessorial],
            ["discount", "Discount", discount],
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
      <ApprovalsBody pending={visible} filter={filter} canDecide={canDecide} />
    </>
  );
}

function ApprovalsBody({
  pending,
  filter,
  canDecide,
}: {
  pending: ApprovalRow[];
  filter: TypeFilter;
  canDecide: boolean;
}) {
  if (pending.length === 0) {
    return (
      <p className="text-sm opacity-70">
        {filter === "all"
          ? "Nothing waiting for review."
          : `No ${filter} requests in this filter.`}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {pending.map((a) => {
        const focusKey = a.loadNumber || a.id;
        return (
          <li
            key={a.id}
            id={`focus-${focusKey}`}
            data-focus={focusKey}
            className="flex flex-wrap items-start justify-between gap-3 rounded-box border border-base-300 bg-base-100 px-4 py-3 transition"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`badge badge-sm capitalize ${typeBadge(a.request_type)}`}>
                  {a.request_type}
                </span>
                {a.loadNumber ? (
                  <span className="font-medium">{a.loadNumber}</span>
                ) : null}
                <span className="font-semibold">{money(a.amount)}</span>
              </div>
              <p className="mt-1 text-sm opacity-70">{sanitizeDemoText(a.reason)}</p>
              {a.shipmentHref ? (
                <Link
                  href={a.shipmentHref}
                  className="btn btn-outline btn-primary btn-sm mt-2"
                >
                  Open load
                </Link>
              ) : null}
            </div>
            {canDecide ? (
              <div className="flex shrink-0 flex-col items-end gap-2">
                <form action={reviewApproval}>
                  <input type="hidden" name="approval_id" value={a.id} />
                  <input type="hidden" name="decision" value="approved" />
                  <button className="btn btn-success btn-sm">Approve</button>
                </form>
                <details className="w-full max-w-xs">
                  <summary className="btn btn-ghost btn-xs cursor-pointer">Reject…</summary>
                  <form action={reviewApproval} className="mt-2 flex flex-col gap-2">
                    <input type="hidden" name="approval_id" value={a.id} />
                    <input type="hidden" name="decision" value="rejected" />
                    <input
                      name="comment"
                      required
                      minLength={3}
                      placeholder="Why rejected?"
                      className="input input-bordered input-sm w-full"
                    />
                    <button className="btn btn-error btn-sm">Confirm reject</button>
                  </form>
                </details>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
