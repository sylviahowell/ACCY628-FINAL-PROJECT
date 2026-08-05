import { money } from "@/lib/types";

export type AccountingEntryType =
  | "recognize"
  | "bill"
  | "collect"
  | "accrue_ap"
  | "pay_carrier";

export type JournalLine = {
  account: string;
  debit: number;
  credit: number;
};

export type AccountingEntry = {
  id: string;
  date: string;
  type: AccountingEntryType;
  memo: string;
  refLabel: string;
  refHref?: string;
  lines: JournalLine[];
};

export const ENTRY_TYPE_LABEL: Record<AccountingEntryType, string> = {
  recognize: "Recognize revenue",
  bill: "Bill customer",
  collect: "Collect cash",
  accrue_ap: "Record carrier bill",
  pay_carrier: "Pay carrier",
};

type ShipmentRow = {
  id: string;
  load_number: string;
  status: string;
  customer_rate: number | string;
  carrier_cost: number | string;
  carrier_id: string | null;
  discount_amount: number | string | null;
  discount_approved: boolean | null;
  delivery_date: string | null;
  customers: { name?: string } | null;
};

type ChargeRow = {
  shipment_id: string;
  amount: number | string;
  billable_to_customer: boolean;
  payable_to_carrier: boolean;
  approval_status: string;
};

type PodRow = {
  shipment_id: string;
  delivered_at: string;
};

type InvoiceRow = {
  id: string;
  shipment_id: string | null;
  invoice_number: string;
  status: string;
  total: number | string;
  issue_date: string;
  customers: { name?: string } | null;
};

type PaymentRow = {
  id: string;
  invoice_id: string;
  amount: number | string;
  payment_date: string;
  invoices: {
    invoice_number?: string;
    shipment_id?: string | null;
    customers?: { name?: string } | null;
  } | null;
};

type CarrierBillRow = {
  id: string;
  bill_number: string;
  status: string;
  total: number | string;
  issue_date: string;
  shipment_id: string;
  carriers: { name?: string } | null;
  shipments: { load_number?: string } | null;
};

type CarrierPaymentRow = {
  id: string;
  carrier_bill_id: string;
  amount: number | string;
  payment_date: string;
  carrier_bills: {
    bill_number?: string;
    shipment_id?: string;
    shipments?: { load_number?: string } | null;
  } | null;
};

function n(v: number | string | null | undefined) {
  return Number(v ?? 0);
}

function dateOnly(isoOrDate: string | null | undefined, fallback = "1970-01-01") {
  if (!isoOrDate) return fallback;
  return isoOrDate.slice(0, 10);
}

function billableExtras(charges: ChargeRow[], shipmentId: string) {
  return charges
    .filter(
      (c) =>
        c.shipment_id === shipmentId &&
        c.billable_to_customer &&
        c.approval_status === "approved",
    )
    .reduce((s, c) => s + n(c.amount), 0);
}

function payableExtras(charges: ChargeRow[], shipmentId: string) {
  return charges
    .filter(
      (c) =>
        c.shipment_id === shipmentId &&
        c.payable_to_carrier &&
        c.approval_status === "approved",
    )
    .reduce((s, c) => s + n(c.amount), 0);
}

function earnedAmount(s: ShipmentRow, charges: ChargeRow[]) {
  const discount = s.discount_approved ? n(s.discount_amount) : 0;
  return Math.max(0, n(s.customer_rate) - discount + billableExtras(charges, s.id));
}

function carrierCost(s: ShipmentRow, charges: ChargeRow[]) {
  return Math.max(0, n(s.carrier_cost) + payableExtras(charges, s.id));
}

/** Derive balanced demo journal entries from live C2C records (not a posted GL). */
export function buildAccountingEntries(input: {
  shipments: ShipmentRow[];
  charges: ChargeRow[];
  pods: PodRow[];
  invoices: InvoiceRow[];
  payments: PaymentRow[];
  carrierBills: CarrierBillRow[];
  carrierPayments: CarrierPaymentRow[];
}): AccountingEntry[] {
  const {
    shipments,
    charges,
    pods,
    invoices,
    payments,
    carrierBills,
    carrierPayments,
  } = input;

  const byId = new Map(shipments.map((s) => [s.id, s]));
  const podByShipment = new Map<string, PodRow>();
  for (const p of pods) {
    const prev = podByShipment.get(p.shipment_id);
    if (!prev || p.delivered_at > prev.delivered_at) {
      podByShipment.set(p.shipment_id, p);
    }
  }

  const entries: AccountingEntry[] = [];

  for (const [shipmentId, pod] of podByShipment) {
    const s = byId.get(shipmentId);
    if (!s) continue;
    if (!["delivered", "completed"].includes(s.status)) continue;

    const revenue = earnedAmount(s, charges);
    const cogs = carrierCost(s, charges);
    if (revenue <= 0 && cogs <= 0) continue;

    const customer = s.customers?.name ?? "customer";
    const lines: JournalLine[] = [];
    if (revenue > 0) {
      lines.push({ account: "Contract asset (unbilled earned)", debit: revenue, credit: 0 });
      lines.push({ account: "Brokerage revenue", debit: 0, credit: revenue });
    }
    if (cogs > 0) {
      lines.push({ account: "Purchased transportation (COGS)", debit: cogs, credit: 0 });
      lines.push({ account: "Accrued carrier payable", debit: 0, credit: cogs });
    }

    entries.push({
      id: `recognize-${shipmentId}`,
      date: dateOnly(pod.delivered_at, dateOnly(s.delivery_date)),
      type: "recognize",
      memo: `Performance complete — ${s.load_number} · ${customer}`,
      refLabel: s.load_number,
      refHref: `/shipments/${shipmentId}`,
      lines,
    });
  }

  for (const inv of invoices) {
    if (inv.status === "cancelled") continue;
    const total = n(inv.total);
    if (total <= 0) continue;
    const load = inv.shipment_id ? byId.get(inv.shipment_id) : null;
    const customer = inv.customers?.name ?? load?.customers?.name ?? "customer";

    entries.push({
      id: `bill-${inv.id}`,
      date: dateOnly(inv.issue_date),
      type: "bill",
      memo: `Invoice ${inv.invoice_number} · ${customer}`,
      refLabel: inv.invoice_number,
      refHref: "/invoices",
      lines: [
        { account: "Accounts receivable", debit: total, credit: 0 },
        { account: "Contract asset (unbilled earned)", debit: 0, credit: total },
      ],
    });
  }

  for (const pay of payments) {
    const amount = n(pay.amount);
    if (amount <= 0) continue;
    const invNo = pay.invoices?.invoice_number ?? "invoice";
    const customer = pay.invoices?.customers?.name ?? "customer";

    entries.push({
      id: `collect-${pay.id}`,
      date: dateOnly(pay.payment_date),
      type: "collect",
      memo: `Cash application · ${invNo} · ${customer}`,
      refLabel: invNo,
      refHref: "/payments",
      lines: [
        { account: "Cash", debit: amount, credit: 0 },
        { account: "Accounts receivable", debit: 0, credit: amount },
      ],
    });
  }

  for (const bill of carrierBills) {
    if (bill.status === "cancelled") continue;
    const total = n(bill.total);
    if (total <= 0) continue;
    const loadNo =
      bill.shipments?.load_number ?? byId.get(bill.shipment_id)?.load_number ?? "load";
    const carrier = bill.carriers?.name ?? "carrier";

    entries.push({
      id: `accrue_ap-${bill.id}`,
      date: dateOnly(bill.issue_date),
      type: "accrue_ap",
      memo: `Carrier bill ${bill.bill_number} · ${loadNo} · ${carrier}`,
      refLabel: bill.bill_number,
      refHref: "/ap",
      lines: [
        { account: "Accrued carrier payable", debit: total, credit: 0 },
        { account: "Accounts payable", debit: 0, credit: total },
      ],
    });
  }

  for (const pay of carrierPayments) {
    const amount = n(pay.amount);
    if (amount <= 0) continue;
    const billNo = pay.carrier_bills?.bill_number ?? "carrier bill";
    const loadNo = pay.carrier_bills?.shipments?.load_number;

    entries.push({
      id: `pay_carrier-${pay.id}`,
      date: dateOnly(pay.payment_date),
      type: "pay_carrier",
      memo: `Carrier remittance · ${billNo}${loadNo ? ` · ${loadNo}` : ""}`,
      refLabel: billNo,
      refHref: "/ap",
      lines: [
        { account: "Accounts payable", debit: amount, credit: 0 },
        { account: "Cash", debit: 0, credit: amount },
      ],
    });
  }

  return entries.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return a.refLabel.localeCompare(b.refLabel);
  });
}

export function entryTotals(entry: AccountingEntry) {
  const debit = entry.lines.reduce((s, l) => s + l.debit, 0);
  const credit = entry.lines.reduce((s, l) => s + l.credit, 0);
  return { debit, credit, balanced: Math.abs(debit - credit) < 0.01 };
}

export function formatEntryMoney(amount: number) {
  return amount > 0 ? money(amount) : "—";
}
