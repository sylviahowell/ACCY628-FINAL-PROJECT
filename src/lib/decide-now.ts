import { daysPastDue } from "@/lib/collections";
import { money, formatStatusLabel } from "@/lib/types";

export type DecideNowTone = "warning" | "error" | "info";

export type DecideNowItem = {
  id: string;
  title: string;
  metric: string;
  detail: string;
  href: string;
  tone?: DecideNowTone;
  cta?: string;
  /** Higher = more urgent; sort only. */
  score: number;
  /** Count rows get a muted unit suffix in the rail; money rows stay bare. */
  metricKind: "count" | "money";
  /** Shown after count metrics only (e.g. loads, requests). */
  metricUnit?: string;
};

function daysBetween(from: string, to: string): number {
  return Math.floor(
    (new Date(to + "T00:00:00Z").getTime() -
      new Date(from + "T00:00:00Z").getTime()) /
      (1000 * 60 * 60 * 24),
  );
}

function ageLabel(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

const TONE_URGENCY: Record<DecideNowTone, number> = {
  error: 3_000_000_000,
  warning: 1_500_000_000,
  info: 500_000_000,
};

/** Rank by urgency: critical tone first, then score (impact / age). */
export function rankDecideNowItems(items: DecideNowItem[], limit = 5): DecideNowItem[] {
  return [...items]
    .filter((i) => i.score > 0)
    .sort((a, b) => {
      const toneA = TONE_URGENCY[a.tone ?? "warning"];
      const toneB = TONE_URGENCY[b.tone ?? "warning"];
      if (toneB !== toneA) return toneB - toneA;
      return b.score - a.score;
    })
    .slice(0, limit);
}

type ApprovalRow = {
  id: string;
  amount: number;
  request_type: string;
  entity_type: string;
  entity_id: string;
  created_at?: string | null;
};

type ShipRow = {
  id: string;
  load_number: string;
  customer_rate: number;
  promised_delivery_date: string | null;
  status: string;
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  total: number;
  amount_paid: number;
  due_date: string;
};

type DisputeRow = {
  id: string;
  amount_disputed: number;
  invoice_number: string | null;
};

export function buildDecideNowCandidates(input: {
  today: string;
  coverageCount: number;
  /** Deep-link to the oldest / first pending coverage request when known. */
  coverageFocusId?: string | null;
  approvals: ApprovalRow[];
  lateShipments: ShipRow[];
  unbilledShipments: ShipRow[];
  pastDueInvoices: InvoiceRow[];
  openDisputes?: DisputeRow[];
  openDisputeCount: number;
  cashAtRisk: number;
  riskIssueCount: number;
  riskDetail: string;
  riskTone: DecideNowTone;
  /** Prefer a specific customer or carrier row on /risk. */
  riskFocusId?: string | null;
  supportOpenCount?: number;
  supportHighCount?: number;
  /** Deep-link to a specific support ticket when known. */
  supportFocusId?: string | null;
  resolveLoadNumber: (entityType: string, entityId: string) => string | null;
  sanitize: (text: string) => string;
}): DecideNowItem[] {
  const items: DecideNowItem[] = [];
  const { today } = input;
  const openDisputes = input.openDisputes ?? [];

  const supportOpen = input.supportOpenCount ?? 0;
  const supportHigh = input.supportHighCount ?? 0;
  if (supportOpen > 0) {
    items.push({
      id: "support-queue",
      title: "Support tickets",
      metric: String(supportOpen),
      metricKind: "count",
      metricUnit: supportOpen === 1 ? "ticket" : "tickets",
      detail:
        supportHigh > 0
          ? `${supportHigh} high priority · shipper/carrier replies waiting`
          : "Open and pending tickets in the support inbox",
      href: input.supportFocusId
        ? `/support/${input.supportFocusId}`
        : "/support",
      tone: supportHigh > 0 ? "warning" : "info",
      cta: "Review",
      score: supportOpen * 25_000 + supportHigh * 40_000,
    });
  }

  if (input.coverageCount > 0) {
    items.push({
      id: "coverage",
      title: "Coverage requests",
      metric: String(input.coverageCount),
      metricKind: "count",
      metricUnit: input.coverageCount === 1 ? "request" : "requests",
      detail: "Shippers waiting for ops to book a load, then assign a carrier",
      href: input.coverageFocusId
        ? `/coverage#focus-${input.coverageFocusId}`
        : "/coverage",
      tone: "warning",
      cta: "Review",
      // Waiting shippers: volume drives urgency within the warning band.
      score: 400_000 + input.coverageCount * 80_000,
    });
  }

  if (input.approvals.length > 0) {
    const approvalSum = input.approvals.reduce((s, a) => s + Number(a.amount), 0);
    const sorted = [...input.approvals].sort((a, b) =>
      (a.created_at ?? "").localeCompare(b.created_at ?? ""),
    );
    const oldest = sorted[0];
    const focusLoad = input.resolveLoadNumber(oldest.entity_type, oldest.entity_id);
    const ageDays = oldest.created_at
      ? daysBetween(oldest.created_at.slice(0, 10), today)
      : 0;
    const href = focusLoad
      ? `/approvals?type=${encodeURIComponent(oldest.request_type)}&focus=${encodeURIComponent(focusLoad)}`
      : `/approvals?type=${encodeURIComponent(oldest.request_type)}`;
    items.push({
      id: "approvals",
      title: "Pending approvals",
      metric: money(approvalSum),
      metricKind: "money",
      detail: input.sanitize(
        `${input.approvals.length} waiting · oldest ${ageLabel(ageDays)}${
          focusLoad ? ` · ${focusLoad}` : ""
        } · ${formatStatusLabel(oldest.request_type)}`,
      ),
      href,
      tone: ageDays >= 3 ? "error" : "warning",
      cta: "Review",
      // Stale approvals escalate; dollars still matter within the band.
      score: 500_000 + ageDays * 120_000 + approvalSum,
    });
  }

  if (input.lateShipments.length > 0) {
    const exposure = input.lateShipments.reduce(
      (s, sh) => s + Number(sh.customer_rate),
      0,
    );
    const worst = [...input.lateShipments].sort((a, b) => {
      const ad = a.promised_delivery_date
        ? daysPastDue(a.promised_delivery_date, today)
        : 0;
      const bd = b.promised_delivery_date
        ? daysPastDue(b.promised_delivery_date, today)
        : 0;
      return bd - ad;
    })[0];
    const daysLate = worst.promised_delivery_date
      ? daysPastDue(worst.promised_delivery_date, today)
      : 0;
    items.push({
      id: "delayed",
      title: "Delayed loads",
      metric: String(input.lateShipments.length),
      metricKind: "count",
      metricUnit: input.lateShipments.length === 1 ? "load" : "loads",
      detail: `${money(exposure)} exposure · worst ${worst.load_number} (${ageLabel(daysLate)} late)`,
      href: `/shipments/${worst.id}`,
      tone: "error",
      cta: "Review",
      // Service failures: days late outweigh pure dollar size.
      score: 800_000 + daysLate * 150_000 + exposure,
    });
  }

  if (input.cashAtRisk > 0) {
    const overdueN = input.pastDueInvoices.length;
    const disputeN = input.openDisputeCount;
    const parts: string[] = [];
    if (overdueN > 0) parts.push(`${overdueN} overdue`);
    if (disputeN > 0) {
      parts.push(`${disputeN} open dispute${disputeN === 1 ? "" : "s"}`);
    }

    const worstPastDue = [...input.pastDueInvoices].sort((a, b) => {
      const aDays = daysPastDue(a.due_date, today);
      const bDays = daysPastDue(b.due_date, today);
      const aBal = Math.max(0, Number(a.total) - Number(a.amount_paid));
      const bBal = Math.max(0, Number(b.total) - Number(b.amount_paid));
      if (bDays !== aDays) return bDays - aDays;
      return bBal - aBal;
    })[0];
    const worstDispute = [...openDisputes].sort(
      (a, b) => Number(b.amount_disputed) - Number(a.amount_disputed),
    )[0];
    const focusInvoice =
      worstPastDue?.invoice_number ||
      worstDispute?.invoice_number ||
      null;
    const cashHref = focusInvoice
      ? `/ar?filter=cash-at-risk&focus=${encodeURIComponent(focusInvoice)}`
      : "/ar?filter=cash-at-risk";

    items.push({
      id: "cash-at-risk",
      title: "Cash at risk",
      metric: money(input.cashAtRisk),
      metricKind: "money",
      detail:
        parts.length > 0
          ? `${parts.join(" · ")} — overdue balances plus dispute amounts${
              focusInvoice ? ` · focus ${focusInvoice}` : ""
            }`
          : "Overdue balances plus open dispute amounts",
      href: cashHref,
      tone: "error",
      cta: "Review",
      score: 700_000 + input.cashAtRisk,
    });
  }

  if (input.riskIssueCount > 0) {
    items.push({
      id: "risk-credit",
      title: "Risk & credit",
      metric: String(input.riskIssueCount),
      metricKind: "count",
      metricUnit: input.riskIssueCount === 1 ? "issue" : "issues",
      detail: input.riskDetail || "Credit or carrier insurance needs review",
      href: input.riskFocusId
        ? `/risk?focus=${encodeURIComponent(input.riskFocusId)}`
        : "/risk",
      tone: input.riskTone,
      cta: "Review",
      score:
        (input.riskTone === "error" ? 650_000 : 350_000) +
        input.riskIssueCount * 40_000,
    });
  }

  if (input.unbilledShipments.length > 0) {
    const unbilledValue = input.unbilledShipments.reduce(
      (s, sh) => s + Number(sh.customer_rate),
      0,
    );
    const top = [...input.unbilledShipments].sort(
      (a, b) => Number(b.customer_rate) - Number(a.customer_rate),
    )[0];
    items.push({
      id: "ready-to-bill",
      title: "Ready to bill",
      metric: money(unbilledValue),
      metricKind: "money",
      detail: `${input.unbilledShipments.length} load${
        input.unbilledShipments.length === 1 ? "" : "s"
      } with POD · top ${top.load_number}`,
      href: `/shipments/${top.id}`,
      tone: "warning",
      cta: "Review",
      // Revenue waiting — important, but below service / credit failures.
      score: 250_000 + unbilledValue,
    });
  }

  if (input.cashAtRisk <= 0 && input.pastDueInvoices.length > 0) {
    const overdueBal = input.pastDueInvoices.reduce(
      (s, i) => s + Math.max(0, Number(i.total) - Number(i.amount_paid)),
      0,
    );
    const worst = [...input.pastDueInvoices].sort((a, b) => {
      const aDays = daysPastDue(a.due_date, today);
      const bDays = daysPastDue(b.due_date, today);
      return bDays - aDays;
    })[0];
    items.push({
      id: "overdue",
      title: "Overdue invoices",
      metric: money(overdueBal),
      metricKind: "money",
      detail: `${input.pastDueInvoices.length} invoice${
        input.pastDueInvoices.length === 1 ? "" : "s"
      } past due · focus ${worst.invoice_number}`,
      href: `/ar?filter=past-due&focus=${encodeURIComponent(worst.invoice_number)}`,
      tone: "warning",
      cta: "Review",
      score: 300_000 + overdueBal,
    });
  }

  if (input.cashAtRisk <= 0 && input.openDisputeCount > 0) {
    const topDispute = [...openDisputes].sort(
      (a, b) => Number(b.amount_disputed) - Number(a.amount_disputed),
    )[0];
    const disputeHref = topDispute?.invoice_number
      ? `/disputes?filter=open&focus=${encodeURIComponent(topDispute.invoice_number)}`
      : "/disputes?filter=open";
    items.push({
      id: "disputes",
      title: "Open disputes",
      metric: String(input.openDisputeCount),
      metricKind: "count",
      metricUnit: input.openDisputeCount === 1 ? "dispute" : "disputes",
      detail: "Billing disputes still unresolved",
      href: disputeHref,
      tone: "info",
      cta: "Review",
      score: 150_000 + input.openDisputeCount * 25_000,
    });
  }

  return items;
}

export function arBalanceAsOf(input: {
  invoices: {
    id: string;
    total: number;
    issue_date: string | null;
    status: string;
  }[];
  payments: { invoice_id: string; amount: number; payment_date: string | null }[];
  asOfExclusive: string;
}): number {
  const paidByInvoice = new Map<string, number>();
  for (const p of input.payments) {
    if (!p.payment_date || p.payment_date >= input.asOfExclusive) continue;
    if (!p.invoice_id) continue;
    paidByInvoice.set(
      p.invoice_id,
      (paidByInvoice.get(p.invoice_id) ?? 0) + Number(p.amount),
    );
  }

  let total = 0;
  for (const inv of input.invoices) {
    if (inv.status === "cancelled") continue;
    if (!inv.issue_date || inv.issue_date >= input.asOfExclusive) continue;
    const paid = paidByInvoice.get(inv.id) ?? 0;
    total += Math.max(0, Number(inv.total) - paid);
  }
  return total;
}

const ACTIVE_STATUSES = new Set([
  "scheduled",
  "assigned",
  "booked",
  "picked_up",
  "in_transit",
]);

export function countActiveAsOf(
  shipments: {
    created_at: string | null;
    delivery_date: string | null;
    status: string;
  }[],
  asOf: string,
): number {
  return shipments.filter((s) => {
    if (s.status === "cancelled") return false;
    const created = s.created_at?.slice(0, 10);
    if (!created || created > asOf) return false;
    if (s.delivery_date && s.delivery_date <= asOf) return false;
    if (ACTIVE_STATUSES.has(s.status)) return true;
    if (
      ["delivered", "completed"].includes(s.status) &&
      s.delivery_date &&
      s.delivery_date > asOf
    ) {
      return true;
    }
    return false;
  }).length;
}

export function countLateAsOf(
  shipments: {
    promised_delivery_date: string | null;
    delivery_date: string | null;
    status: string;
  }[],
  asOf: string,
): number {
  return shipments.filter((s) => {
    if (s.status === "cancelled") return false;
    if (!s.promised_delivery_date || s.promised_delivery_date >= asOf) return false;
    if (s.delivery_date && s.delivery_date <= asOf) return false;
    return true;
  }).length;
}
