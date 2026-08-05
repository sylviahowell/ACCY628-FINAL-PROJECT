import { daysPastDue } from "@/lib/collections";

export type ShipmentFilterRow = {
  id: string;
  status: string;
  carrier_id: string | null;
  pickup_date: string | null;
  delivery_date: string | null;
  promised_delivery_date: string | null;
};

export function shipmentFilterLabel(filter: string | undefined): string | null {
  switch (filter) {
    case "active":
      return "active shipments";
    case "delivered":
      return "delivered / completed loads";
    case "pickup-today":
      return "pickups scheduled today";
    case "delivery-today":
      return "deliveries expected today";
    case "pickup-upcoming":
      return "upcoming pickups";
    case "delivery-due-today":
      return "deliveries due today";
    case "unassigned":
      return "loads awaiting a carrier";
    case "delayed":
      return "delayed loads";
    case "ready-to-bill":
      return "POD-ready unbilled loads";
    case "awaiting-docs":
      return "delivered loads awaiting POD";
    case "needs-pod":
    case "missing-pod":
      return "loads still missing POD";
    default:
      return null;
  }
}

export function filterShipments<T extends ShipmentFilterRow>(
  rows: T[],
  filter: string | undefined,
  opts: {
    today: string;
    podSet: Set<string>;
    billedSet: Set<string>;
  },
): T[] {
  const { today, podSet, billedSet } = opts;
  let next = rows;

  switch (filter) {
    case "active":
      next = rows.filter((s) => !["completed", "cancelled"].includes(s.status));
      break;
    case "delivered":
      next = rows.filter((s) => ["delivered", "completed"].includes(s.status));
      break;
    case "pickup-today":
      next = rows.filter((s) => s.pickup_date === today);
      break;
    case "delivery-today":
      next = rows.filter(
        (s) => s.delivery_date === today || s.promised_delivery_date === today,
      );
      break;
    case "pickup-upcoming":
      next = rows.filter(
        (s) =>
          Boolean(s.pickup_date) &&
          (s.pickup_date as string) >= today &&
          ["assigned", "scheduled", "booked"].includes(s.status),
      );
      break;
    case "delivery-due-today":
      next = rows.filter(
        (s) =>
          (s.promised_delivery_date === today || s.delivery_date === today) &&
          !["completed", "cancelled"].includes(s.status),
      );
      break;
    case "unassigned":
      next = rows.filter(
        (s) =>
          !s.carrier_id &&
          !["delivered", "completed", "cancelled"].includes(s.status),
      );
      break;
    case "delayed":
      next = rows.filter(
        (s) =>
          Boolean(s.promised_delivery_date) &&
          (s.promised_delivery_date as string) < today &&
          !["delivered", "completed", "cancelled"].includes(s.status),
      );
      break;
    case "ready-to-bill":
      next = rows.filter(
        (s) =>
          ["delivered", "completed"].includes(s.status) &&
          podSet.has(s.id) &&
          !billedSet.has(s.id),
      );
      break;
    case "awaiting-docs":
      next = rows.filter(
        (s) =>
          ["delivered", "completed"].includes(s.status) &&
          !podSet.has(s.id) &&
          !billedSet.has(s.id),
      );
      break;
    case "needs-pod":
    case "missing-pod":
      next = rows.filter(
        (s) => ["delivered", "completed"].includes(s.status) && !podSet.has(s.id),
      );
      break;
    default:
      break;
  }

  return sortShipments(next, filter, today);
}

function sortShipments<T extends ShipmentFilterRow>(
  rows: T[],
  filter: string | undefined,
  today: string,
): T[] {
  const copy = [...rows];
  if (filter === "delayed" || filter === "delivery-due-today" || filter === "delivery-today") {
    copy.sort((a, b) =>
      (a.promised_delivery_date ?? a.delivery_date ?? "").localeCompare(
        b.promised_delivery_date ?? b.delivery_date ?? "",
      ),
    );
    return copy;
  }
  if (filter === "pickup-today" || filter === "pickup-upcoming") {
    copy.sort((a, b) => (a.pickup_date ?? "").localeCompare(b.pickup_date ?? ""));
    return copy;
  }
  if (filter === "missing-pod" || filter === "awaiting-docs" || filter === "ready-to-bill" || filter === "needs-pod") {
    copy.sort((a, b) =>
      (b.delivery_date ?? "").localeCompare(a.delivery_date ?? ""),
    );
    return copy;
  }
  // Default: delayed / at-risk first, then by promised date
  copy.sort((a, b) => {
    const aLate =
      a.promised_delivery_date &&
      a.promised_delivery_date < today &&
      !["delivered", "completed", "cancelled"].includes(a.status)
        ? 0
        : 1;
    const bLate =
      b.promised_delivery_date &&
      b.promised_delivery_date < today &&
      !["delivered", "completed", "cancelled"].includes(b.status)
        ? 0
        : 1;
    if (aLate !== bLate) return aLate - bLate;
    return (a.promised_delivery_date ?? "").localeCompare(b.promised_delivery_date ?? "");
  });
  return copy;
}

export function invoiceFilterLabel(filter: string | undefined): string | null {
  switch (filter) {
    case "unpaid":
      return "unpaid balances only";
    case "overdue":
      return "past-due invoices only";
    case "open":
      return "open invoices only";
    case "disputed":
      return "disputed invoices only";
    case "ready-to-bill":
      return "ready-to-bill queue";
    default:
      return null;
  }
}

export function isUnpaidInvoice(inv: {
  status: string;
  total: number | string;
  amount_paid: number | string;
}) {
  if (inv.status === "cancelled" || inv.status === "paid") return false;
  return Number(inv.total) - Number(inv.amount_paid) > 0;
}

export function filterInvoices<
  T extends {
    status: string;
    total: number | string;
    amount_paid: number | string;
    due_date: string;
  },
>(rows: T[], filter: string | undefined, today: string): T[] {
  let next = rows;
  switch (filter) {
    case "unpaid":
      next = rows.filter(isUnpaidInvoice);
      break;
    case "overdue":
      next = rows.filter((i) => {
        const bal = Number(i.total) - Number(i.amount_paid);
        return bal > 0 && i.due_date < today && !["paid", "cancelled"].includes(i.status);
      });
      break;
    case "open":
      next = rows.filter((i) =>
        ["pending", "sent", "partial", "overdue", "disputed"].includes(i.status),
      );
      break;
    case "disputed":
      next = rows.filter((i) => i.status === "disputed");
      break;
    default:
      break;
  }

  if (filter === "overdue" || filter === "unpaid") {
    return [...next].sort((a, b) => a.due_date.localeCompare(b.due_date));
  }
  return next;
}

export function agingBucketForInvoice(
  dueDate: string,
  today: string,
): "current" | "d1_30" | "d31_60" | "d61_90" | "d90_plus" {
  const days = daysPastDue(dueDate, today);
  if (days <= 0) return "current";
  if (days <= 30) return "d1_30";
  if (days <= 60) return "d31_60";
  if (days <= 90) return "d61_90";
  return "d90_plus";
}

export function arFilterLabel(filter: string | undefined): string | null {
  switch (filter) {
    case "current":
      return "current (not yet due) balances";
    case "past-due":
      return "all past-due balances";
    case "cash-at-risk":
      return "cash at risk (past due + open disputes)";
    case "d1_30":
      return "1–30 days past due";
    case "d31_60":
      return "31–60 days past due";
    case "d61_90":
      return "61–90 days past due";
    case "d90_plus":
      return "more than 90 days past due";
    default:
      return null;
  }
}
