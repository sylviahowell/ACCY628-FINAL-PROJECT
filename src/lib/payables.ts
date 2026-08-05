import { computeAging, daysPastDue, type AgingBuckets } from "@/lib/collections";
import { money } from "@/lib/types";

export type CarrierBillLike = {
  id: string;
  bill_number: string;
  carrier_id: string;
  shipment_id: string;
  total: number;
  amount_paid: number;
  due_date: string;
  status: string;
  carriers?: { name?: string } | null;
  shipments?: { load_number?: string } | null;
};

export type PayableWorkItem = {
  billId: string;
  billNumber: string;
  carrierId: string;
  carrierName: string;
  loadNumber: string;
  shipmentId: string;
  balance: number;
  daysOutstanding: number;
  dueDate: string;
  status: string;
  recommendedAction: string;
  priority: "high" | "medium" | "low";
};

export type ReadyToPayItem = {
  shipmentId: string;
  loadNumber: string;
  carrierName: string;
  deliveryDate: string | null;
  estimatedPayable: number;
  reason: string;
};

export function computePayableAging(
  bills: {
    total: number;
    amount_paid: number;
    due_date: string;
    status: string;
  }[],
  today: string,
): AgingBuckets {
  return computeAging(bills, today);
}

export function openApBalance(
  bills: { total: number; amount_paid: number; status: string }[],
) {
  return bills.reduce((sum, b) => {
    if (b.status === "cancelled" || b.status === "paid") return sum;
    return sum + Math.max(0, Number(b.total) - Number(b.amount_paid));
  }, 0);
}

export function payableAmount(
  carrierCost: number,
  charges: {
    amount: number;
    payable_to_carrier?: boolean;
    approval_status?: string | null;
  }[],
) {
  const extras = charges
    .filter(
      (c) =>
        c.payable_to_carrier &&
        (c.approval_status === "approved" || c.approval_status == null),
    )
    .reduce((s, c) => s + Number(c.amount), 0);
  return Number(carrierCost) + extras;
}

export function buildReadyToPayQueue(input: {
  shipments: {
    id: string;
    load_number: string;
    status: string;
    carrier_id: string | null;
    carrier_cost: number;
    delivery_date: string | null;
    carriers?: { name?: string } | null;
  }[];
  billedShipmentIds: Set<string>;
  podShipmentIds: Set<string>;
  chargesByShipment: Map<
    string,
    { amount: number; payable_to_carrier?: boolean; approval_status?: string | null }[]
  >;
}): ReadyToPayItem[] {
  const items: ReadyToPayItem[] = [];
  for (const s of input.shipments) {
    if (!["delivered", "completed"].includes(s.status)) continue;
    if (!s.carrier_id) continue;
    if (input.billedShipmentIds.has(s.id)) continue;
    if (!input.podShipmentIds.has(s.id)) continue;
    const charges = input.chargesByShipment.get(s.id) ?? [];
    items.push({
      shipmentId: s.id,
      loadNumber: s.load_number,
      carrierName: s.carriers?.name ?? "Carrier",
      deliveryDate: s.delivery_date,
      estimatedPayable: payableAmount(Number(s.carrier_cost), charges),
      reason: "Delivered with POD — ready to create carrier bill",
    });
  }
  return items.sort((a, b) =>
    (a.deliveryDate ?? "").localeCompare(b.deliveryDate ?? ""),
  );
}

export function buildPayableWorklist(input: {
  bills: CarrierBillLike[];
  today: string;
}): PayableWorkItem[] {
  const items: PayableWorkItem[] = [];
  for (const b of input.bills) {
    if (b.status === "cancelled" || b.status === "paid") continue;
    const balance = Math.max(0, Number(b.total) - Number(b.amount_paid));
    if (balance <= 0) continue;
    const days = daysPastDue(b.due_date, input.today);
    let recommendedAction = "Schedule carrier payment";
    let priority: PayableWorkItem["priority"] = "low";
    if (days > 30) {
      recommendedAction = "Pay immediately — past terms";
      priority = "high";
    } else if (days > 0) {
      recommendedAction = "Prioritize payment this week";
      priority = "medium";
    } else if (days > -7) {
      recommendedAction = "Due soon — confirm remittance";
      priority = "medium";
    }
    items.push({
      billId: b.id,
      billNumber: b.bill_number,
      carrierId: b.carrier_id,
      carrierName: b.carriers?.name ?? "Carrier",
      loadNumber: b.shipments?.load_number ?? "—",
      shipmentId: b.shipment_id,
      balance,
      daysOutstanding: days,
      dueDate: b.due_date,
      status: b.status,
      recommendedAction,
      priority,
    });
  }
  return items.sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 };
    if (rank[a.priority] !== rank[b.priority]) {
      return rank[a.priority] - rank[b.priority];
    }
    return b.daysOutstanding - a.daysOutstanding;
  });
}

export function apSummaryLine(aging: AgingBuckets, openAp: number) {
  return `${money(openAp)} open · ${money(aging.d1_30 + aging.d31_60 + aging.d61_90 + aging.d90_plus)} past due`;
}
