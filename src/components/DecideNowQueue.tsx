"use client";

import Link from "next/link";
import { reviewApproval } from "@/lib/actions/freight";
import { sanitizeDemoText } from "@/lib/display-text";
import { money } from "@/lib/types";

export type DecideApprovalItem = {
  id: string;
  request_type: string;
  amount: number;
  reason: string | null;
  loadNumber: string | null;
};

export type DecideOpenItem = {
  id: string;
  badge: string;
  title: string;
  detail: string;
  href: string;
};

function typeBadge(type: string) {
  if (type === "accessorial") return "badge-warning";
  if (type === "discount") return "badge-info";
  return "badge-ghost";
}

/** Manager home queue: approve/reject pending requests + open top seed risks. */
export function DecideNowQueue({
  approvals,
  openItems,
}: {
  approvals: DecideApprovalItem[];
  openItems: DecideOpenItem[];
}) {
  const approvalSlice = approvals.slice(0, 3);
  const openSlots = Math.max(0, 5 - approvalSlice.length);
  const openSlice = openItems.slice(0, openSlots);
  const empty = approvalSlice.length === 0 && openSlice.length === 0;

  return (
    <section className="rounded-box border border-warning/40 bg-warning/5 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Decide now</h2>
          <p className="mt-1 text-sm opacity-70">
            Clear exceptions from the home screen — approvals stay in the inbox for full
            triage.
          </p>
        </div>
        <Link href="/approvals" className="btn btn-ghost btn-xs">
          Approval Inbox
        </Link>
      </div>

      {empty ? (
        <p className="text-sm opacity-70">Nothing waiting — queue is clear.</p>
      ) : (
        <ul className="space-y-3">
          {approvalSlice.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-box border border-base-300 bg-base-100 px-4 py-3"
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
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <form action={reviewApproval}>
                  <input type="hidden" name="approval_id" value={a.id} />
                  <input type="hidden" name="decision" value="approved" />
                  <input type="hidden" name="return_to" value="/dashboard" />
                  <button className="btn btn-success btn-sm">Approve</button>
                </form>
                <details className="w-full max-w-xs">
                  <summary className="btn btn-ghost btn-xs cursor-pointer">Reject…</summary>
                  <form action={reviewApproval} className="mt-2 flex flex-col gap-2">
                    <input type="hidden" name="approval_id" value={a.id} />
                    <input type="hidden" name="decision" value="rejected" />
                    <input type="hidden" name="return_to" value="/dashboard" />
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
            </li>
          ))}
          {openSlice.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-box border border-base-300 bg-base-100 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge badge-sm badge-warning capitalize">{item.badge}</span>
                  <span className="font-medium">{item.title}</span>
                </div>
                <p className="mt-1 text-sm opacity-70">{item.detail}</p>
              </div>
              <Link href={item.href} className="btn btn-warning btn-sm shrink-0">
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
