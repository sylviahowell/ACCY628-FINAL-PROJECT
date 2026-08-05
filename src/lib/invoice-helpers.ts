/** Deposit vs final customer invoices on a shipment. */

export function isDepositInvoice(inv: { invoice_number: string }) {
  return String(inv.invoice_number || "").toUpperCase().startsWith("DEP-");
}

export function isActiveFinalInvoice(inv: {
  invoice_number: string;
  status: string;
  shipment_id?: string | null;
}) {
  return inv.status !== "cancelled" && !isDepositInvoice(inv);
}

export function depositAmountDue(customerRate: number, downpaymentPct: number) {
  const rate = Number(customerRate);
  const pct = Number(downpaymentPct);
  if (!(rate > 0) || !(pct > 0)) return 0;
  return Math.round(rate * (pct / 100) * 100) / 100;
}
