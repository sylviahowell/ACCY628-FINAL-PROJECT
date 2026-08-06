import Link from "next/link";
import { money } from "@/lib/types";

export type CashStepStatus = "done" | "current" | "pending";

export type CashStoryStep = {
  id: string;
  label: string;
  detail: string;
  status: CashStepStatus;
  href: string;
  cta: string;
};

function statusClass(status: CashStepStatus) {
  switch (status) {
    case "done":
      return "border-success/40 bg-success/10";
    case "current":
      return "border-primary/50 bg-primary/10 ring-1 ring-primary/30";
    default:
      return "border-base-300 bg-base-200/40 opacity-80";
  }
}

function statusBadge(status: CashStepStatus) {
  switch (status) {
    case "done":
      return "badge-success";
    case "current":
      return "badge-primary";
    default:
      return "badge-ghost";
  }
}

function statusLabel(status: CashStepStatus) {
  switch (status) {
    case "done":
      return "Done";
    case "current":
      return "Do now";
    default:
      return "Next";
  }
}

/** Pitch differentiator: one-load path from evidence → books. */
export function FollowTheCashRail({
  loadNumber,
  steps,
}: {
  loadNumber: string;
  steps: CashStoryStep[];
}) {
  const current = steps.find((s) => s.status === "current") ?? null;
  const doneCount = steps.filter((s) => s.status === "done").length;

  return (
    <div
      id="follow-the-cash"
      className="card border border-primary/25 bg-base-100 shadow-sm"
    >
      <div className="card-body gap-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">
              Follow the cash
            </p>
            <h2 className="card-title text-base">
              {loadNumber}: evidence → revenue → invoice → cash → books
            </h2>
            <p className="text-sm opacity-70">
              Walk one load through contract-to-cash without leaving the story.{" "}
              {doneCount}/{steps.length} steps complete.
            </p>
          </div>
          {current ? (
            <Link href={current.href} className="btn btn-primary btn-sm">
              {current.cta}
            </Link>
          ) : (
            <Link href="/accounting#accounting-entries" className="btn btn-outline btn-sm">
              Open accounting
            </Link>
          )}
        </div>

        <ol className="grid gap-2 md:grid-cols-5">
          {steps.map((step, idx) => (
            <li
              key={step.id}
              className={`rounded-box border p-3 ${statusClass(step.status)}`}
            >
              <div className="mb-2 flex items-center justify-between gap-1">
                <span className="text-xs font-semibold opacity-60">{idx + 1}</span>
                <span className={`badge badge-xs ${statusBadge(step.status)}`}>
                  {statusLabel(step.status)}
                </span>
              </div>
              <p className="text-sm font-medium leading-snug">{step.label}</p>
              <p className="mt-1 text-xs opacity-70">{step.detail}</p>
              <Link href={step.href} className="link link-primary mt-2 inline-block text-xs">
                {step.cta} →
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function buildFollowTheCashSteps(input: {
  hasPod: boolean;
  delivered: boolean;
  recognized: boolean;
  billed: boolean;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceBalance: number;
  invoiceStatus: string | null;
  cashCollected: number;
  wroteOff: boolean;
  journalCount: number;
}): CashStoryStep[] {
  const {
    hasPod,
    delivered,
    recognized,
    billed,
    invoiceId,
    invoiceNumber,
    invoiceBalance,
    invoiceStatus,
    cashCollected,
    wroteOff,
    journalCount,
  } = input;

  const invoiceHref = invoiceId ? `/invoices/${invoiceId}` : "/invoices";
  const collectHref = invoiceId
    ? `/ar?invoice_id=${invoiceId}&focus=record-payment`
    : "/ar?focus=record-payment";
  const collectedOrWritten = cashCollected > 0 || wroteOff || invoiceBalance <= 0;

  const steps: CashStoryStep[] = [
    {
      id: "pod",
      label: "Proof of delivery",
      detail: hasPod
        ? "Signed BOL on file — performance evidence."
        : delivered
          ? "Delivered but POD still missing."
          : "Attach signed BOL when delivery completes.",
      status: hasPod ? "done" : delivered ? "current" : "pending",
      href: "#pod-upload",
      cta: hasPod ? "View POD" : "Upload POD",
    },
    {
      id: "recognize",
      label: "Recognize revenue",
      detail: recognized
        ? "ASC 606 entry on the books for this load."
        : hasPod
          ? "POD unlocks earned revenue recognition."
          : "Waiting on POD before revenue is earned.",
      status: recognized ? "done" : hasPod ? "current" : "pending",
      href: "#load-journals",
      cta: "See journals",
    },
    {
      id: "bill",
      label: "Bill customer",
      detail: billed
        ? `${invoiceNumber ?? "Invoice"} issued${
            invoiceStatus ? ` · ${invoiceStatus}` : ""
          }.`
        : hasPod
          ? "Ready to bill — convert contract asset to AR."
          : "Invoice after POD is on file.",
      status: billed ? "done" : hasPod ? "current" : "pending",
      href: billed ? invoiceHref : "/invoices?filter=ready-to-bill",
      cta: billed ? "Open invoice" : "Ready-to-bill queue",
    },
    {
      id: "collect",
      label: wroteOff ? "Write-off / close AR" : "Collect cash",
      detail: wroteOff
        ? "Balance written off to bad debt."
        : cashCollected > 0
          ? `Collected ${money(cashCollected)}${
              invoiceBalance > 0 ? ` · ${money(invoiceBalance)} open` : " · paid in full"
            }.`
          : billed
            ? `Open balance ${money(invoiceBalance)} — record payment or write off.`
            : "Collections start after invoicing.",
      status: billed && collectedOrWritten && invoiceBalance <= 0
        ? "done"
        : billed
          ? "current"
          : "pending",
      href: billed ? (wroteOff ? invoiceHref : collectHref) : "/ar",
      cta: wroteOff ? "View invoice" : billed ? "Record payment" : "Open AR",
    },
    {
      id: "books",
      label: "Accounting books",
      detail:
        journalCount > 0
          ? `${journalCount} journal entr${journalCount === 1 ? "y" : "ies"} for this load.`
          : "Journals appear as C2C events post.",
      status:
        journalCount > 0 && billed && collectedOrWritten && invoiceBalance <= 0
          ? "done"
          : journalCount > 0
            ? "current"
            : "pending",
      href: "/accounting#accounting-entries",
      cta: "Open books",
    },
  ];

  // Only one "current" — first non-done that we marked current; clear later currents
  let sawCurrent = false;
  return steps.map((step) => {
    if (step.status === "done") return step;
    if (step.status === "current") {
      if (sawCurrent) return { ...step, status: "pending" as const };
      sawCurrent = true;
      return step;
    }
    if (!sawCurrent && step.status === "pending") {
      // leave pending unless nothing marked current yet and this is first pending after dones
      return step;
    }
    return step;
  });
}
