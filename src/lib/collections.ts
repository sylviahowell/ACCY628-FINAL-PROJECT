import { money } from "@/lib/types";

export type AgingBuckets = {
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
};

export type CollectionWorkItem = {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  balance: number;
  daysOutstanding: number;
  dueDate: string;
  status: string;
  disputeStatus: "none" | "open" | "resolved";
  lastNote: string | null;
  lastNoteAt: string | null;
  recommendedAction: string;
  priority: "high" | "medium" | "low";
};

export type UnbilledItem = {
  shipmentId: string;
  loadNumber: string;
  customerName: string;
  deliveryDate: string | null;
  hasPod: boolean;
  reason: string;
  action: string;
  href: string;
};

export type CustomerArRollupRow = {
  customerId: string;
  customerName: string;
  openBalance: number;
  pastDueBalance: number;
  invoiceCount: number;
  oldestDays: number;
};

export function daysPastDue(dueDate: string, today: string) {
  return Math.floor(
    (new Date(today + "T00:00:00Z").getTime() -
      new Date(dueDate + "T00:00:00Z").getTime()) /
      (1000 * 60 * 60 * 24),
  );
}

export function computeAging(
  invoices: {
    total: number;
    amount_paid: number;
    due_date: string;
    status: string;
  }[],
  today: string,
): AgingBuckets {
  const buckets: AgingBuckets = {
    current: 0,
    d1_30: 0,
    d31_60: 0,
    d61_90: 0,
    d90_plus: 0,
  };
  for (const inv of invoices) {
    if (inv.status === "cancelled") continue;
    const bal = Number(inv.total) - Number(inv.amount_paid);
    if (bal <= 0) continue;
    const days = daysPastDue(inv.due_date, today);
    if (days <= 0) buckets.current += bal;
    else if (days <= 30) buckets.d1_30 += bal;
    else if (days <= 60) buckets.d31_60 += bal;
    else if (days <= 90) buckets.d61_90 += bal;
    else buckets.d90_plus += bal;
  }
  return buckets;
}

export function agingChartData(aging: AgingBuckets) {
  return [
    { name: "Current", value: Math.round(aging.current) },
    { name: "1–30 days", value: Math.round(aging.d1_30) },
    { name: "31–60 days", value: Math.round(aging.d31_60) },
    { name: "61–90 days", value: Math.round(aging.d61_90) },
    { name: "90+ days", value: Math.round(aging.d90_plus) },
  ];
}

/** Roll open invoice balances up by customer, largest open AR first. */
export function buildCustomerArRollup(
  invoices: {
    customer_id: string;
    total: number;
    amount_paid: number;
    due_date: string;
    status: string;
    customers?: { name?: string } | null;
  }[],
  today: string,
): CustomerArRollupRow[] {
  const byCustomer = new Map<string, CustomerArRollupRow>();

  for (const inv of invoices) {
    if (inv.status === "cancelled") continue;
    const balance = Number(inv.total) - Number(inv.amount_paid);
    if (balance <= 0) continue;

    const days = daysPastDue(inv.due_date, today);
    const existing = byCustomer.get(inv.customer_id);
    if (existing) {
      existing.openBalance += balance;
      if (days > 0) existing.pastDueBalance += balance;
      existing.invoiceCount += 1;
      existing.oldestDays = Math.max(existing.oldestDays, days);
    } else {
      byCustomer.set(inv.customer_id, {
        customerId: inv.customer_id,
        customerName: inv.customers?.name ?? "Customer",
        openBalance: balance,
        pastDueBalance: days > 0 ? balance : 0,
        invoiceCount: 1,
        oldestDays: days,
      });
    }
  }

  return [...byCustomer.values()].sort((a, b) => b.openBalance - a.openBalance);
}

export function recommendCollectionAction(input: {
  daysOutstanding: number;
  disputeStatus: CollectionWorkItem["disputeStatus"];
  balance: number;
  lastNoteAt: string | null;
  today: string;
}): { action: string; priority: CollectionWorkItem["priority"] } {
  if (input.disputeStatus === "open") {
    return {
      action: "Hold hard collection — resolve dispute first",
      priority: "high",
    };
  }
  if (input.daysOutstanding > 90) {
    return {
      action: "Escalate — formal demand / credit hold review",
      priority: "high",
    };
  }
  if (input.daysOutstanding > 60) {
    return {
      action: "Call AP contact and confirm payment plan",
      priority: "high",
    };
  }
  if (input.daysOutstanding > 30) {
    return {
      action: "Send past-due reminder and verify invoice receipt",
      priority: "medium",
    };
  }
  if (input.daysOutstanding > 0) {
    return {
      action: "Friendly reminder — invoice is past due",
      priority: "medium",
    };
  }
  // Current — due today or future
  if (input.daysOutstanding === 0) {
    return { action: "Due today — confirm remittance", priority: "medium" };
  }
  const daysSinceNote = input.lastNoteAt
    ? Math.floor(
        (new Date(input.today + "T00:00:00Z").getTime() -
          new Date(input.lastNoteAt.slice(0, 10) + "T00:00:00Z").getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : 999;
  if (daysSinceNote > 14 && input.balance > 1000) {
    return {
      action: "Pre-due courtesy check — large balance coming due",
      priority: "low",
    };
  }
  return { action: "Monitor — not yet due", priority: "low" };
}

export function buildCollectionWorklist(input: {
  invoices: {
    id: string;
    invoice_number: string;
    customer_id: string;
    total: number;
    amount_paid: number;
    due_date: string;
    status: string;
    customers?: { name?: string } | null;
  }[];
  disputes: { invoice_id: string | null; status: string }[];
  notes: { invoice_id: string; note: string; created_at: string }[];
  today: string;
}): CollectionWorkItem[] {
  const openDispute = new Set(
    input.disputes
      .filter((d) => d.status === "open" && d.invoice_id)
      .map((d) => d.invoice_id as string),
  );
  const latestNote = new Map<string, { note: string; created_at: string }>();
  for (const n of [...input.notes].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  )) {
    latestNote.set(n.invoice_id, { note: n.note, created_at: n.created_at });
  }

  return input.invoices
    .map((inv) => {
      const balance = Number(inv.total) - Number(inv.amount_paid);
      if (balance <= 0 || inv.status === "cancelled") return null;
      const days = daysPastDue(inv.due_date, input.today);
      const disputeStatus: CollectionWorkItem["disputeStatus"] = openDispute.has(
        inv.id,
      )
        ? "open"
        : inv.status === "disputed"
          ? "open"
          : "none";
      const note = latestNote.get(inv.id) ?? null;
      const rec = recommendCollectionAction({
        daysOutstanding: days,
        disputeStatus,
        balance,
        lastNoteAt: note?.created_at ?? null,
        today: input.today,
      });
      return {
        invoiceId: inv.id,
        invoiceNumber: inv.invoice_number,
        customerId: inv.customer_id,
        customerName: inv.customers?.name ?? "Customer",
        balance,
        daysOutstanding: days,
        dueDate: inv.due_date,
        status: inv.status,
        disputeStatus,
        lastNote: note?.note ?? null,
        lastNoteAt: note?.created_at ?? null,
        recommendedAction: rec.action,
        priority: rec.priority,
      } satisfies CollectionWorkItem;
    })
    .filter(Boolean)
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 };
      if (rank[a!.priority] !== rank[b!.priority]) {
        return rank[a!.priority] - rank[b!.priority];
      }
      return b!.daysOutstanding - a!.daysOutstanding;
    }) as CollectionWorkItem[];
}

export function buildUnbilledQueues(input: {
  shipments: {
    id: string;
    load_number: string;
    status: string;
    delivery_date: string | null;
    customers?: { name?: string } | null;
  }[];
  billedShipmentIds: Set<string>;
  podShipmentIds: Set<string>;
}): { ready: UnbilledItem[]; awaitingDocs: UnbilledItem[] } {
  const ready: UnbilledItem[] = [];
  const awaitingDocs: UnbilledItem[] = [];

  for (const s of input.shipments) {
    if (!["delivered", "completed"].includes(s.status)) continue;
    if (input.billedShipmentIds.has(s.id)) continue;
    const customerName = s.customers?.name ?? "Customer";
    const hasPod = input.podShipmentIds.has(s.id);
    if (hasPod) {
      ready.push({
        shipmentId: s.id,
        loadNumber: s.load_number,
        customerName,
        deliveryDate: s.delivery_date,
        hasPod: true,
        reason: "Delivered with POD — ready to invoice",
        action: "Generate invoice",
        href: "/invoices",
      });
    } else {
      awaitingDocs.push({
        shipmentId: s.id,
        loadNumber: s.load_number,
        customerName,
        deliveryDate: s.delivery_date,
        hasPod: false,
        reason: "Delivered but proof of delivery is missing",
        action: "Request POD before invoicing",
        href: `/shipments/${s.id}`,
      });
    }
  }
  return { ready, awaitingDocs };
}

export type BillingInsight = {
  id: string;
  observation: string;
  whyItMatters: string;
  action: string;
  href: string;
};

export function buildBillingInsights(input: {
  aging: AgingBuckets;
  unbilledReady: number;
  awaitingDocs: number;
  disputedBalance: number;
  cashToday: number;
  cashMonth: number;
  overdueCount: number;
}): BillingInsight[] {
  const insights: BillingInsight[] = [];
  const totalAr =
    input.aging.current +
    input.aging.d1_30 +
    input.aging.d31_60 +
    input.aging.d61_90 +
    input.aging.d90_plus;

  if (input.aging.d90_plus > 0) {
    insights.push({
      id: "ar-90",
      observation: `${money(input.aging.d90_plus)} sits in 90+ day AR.`,
      whyItMatters: "Very old receivables are least likely to collect without escalation.",
      action: "Work the 90+ items on the collections list first.",
      href: "/ar",
    });
  }

  if (input.unbilledReady > 0) {
    insights.push({
      id: "unbilled",
      observation: `${input.unbilledReady} delivered load(s) have POD and are still unbilled.`,
      whyItMatters: "Earned revenue is not yet in AR or the cash forecast.",
      action: "Generate invoices from the Ready-to-bill queue.",
      href: "/invoices",
    });
  }

  if (input.awaitingDocs > 0) {
    insights.push({
      id: "pod",
      observation: `${input.awaitingDocs} delivered load(s) lack POD and cannot be invoiced under policy.`,
      whyItMatters: "Billing is blocked until documentation is complete.",
      action: "Coordinate with operations/carrier for missing PODs.",
      href: "/warnings",
    });
  }

  if (input.disputedBalance > 0) {
    insights.push({
      id: "dispute",
      observation: `${money(input.disputedBalance)} is tied up in open disputes.`,
      whyItMatters: "Disputed dollars should not be treated as collectible cash.",
      action: "Resolve disputes before continuing collection pressure.",
      href: "/disputes",
    });
  }

  if (totalAr > 0 && input.cashMonth === 0 && input.overdueCount > 0) {
    insights.push({
      id: "no-cash",
      observation: "No cash collected this month while overdue invoices remain open.",
      whyItMatters: "Collections activity may need a daily cadence.",
      action: "Log outreach notes and record any remittances received.",
      href: "/payments",
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "ok",
      observation: "Billing queues look under control on current rules.",
      whyItMatters: `AR is ${money(totalAr)}; cash today ${money(input.cashToday)}.`,
      action: "Scan the collections worklist for due-soon items.",
      href: "/ar",
    });
  }

  return insights.slice(0, 5);
}
