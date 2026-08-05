/** Helpers so stored contract/customer terms drive billing and booking. */

export type ContractTermsInfo = {
  id: string;
  contract_number: string;
  title: string;
  customer_id: string;
  start_date: string;
  end_date: string | null;
  payment_terms: string | null;
  billing_terms: string | null;
  fuel_surcharge_pct: number | null;
  shipping_rates: string | null;
  status: string;
  renewal_option: boolean | null;
};

/** Parse "Net 30", "net-15", "NET45" → days. Defaults to 30. */
export function parseNetDays(terms: string | null | undefined, fallback = 30): number {
  if (!terms) return fallback;
  const m = terms.match(/net\s*[-:]?\s*(\d+)/i);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  const bare = terms.match(/^\s*(\d+)\s*$/);
  if (bare) {
    const n = Number(bare[1]);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return fallback;
}

export function dueDateFromTerms(
  terms: string | null | undefined,
  from: Date = new Date(),
): string {
  const days = parseNetDays(terms);
  const due = new Date(from);
  due.setUTCDate(due.getUTCDate() + days);
  return due.toISOString().slice(0, 10);
}

/** Pull a suggested customer rate from free-text shipping_rates if present. */
export function suggestedRateFromText(rates: string | null | undefined): number | null {
  if (!rates) return null;
  const m = rates.match(/\$?\s*([\d,]+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function fuelSurchargeAmount(
  customerRate: number,
  fuelPct: number | null | undefined,
): number {
  const pct = Number(fuelPct ?? 0);
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  return Math.round(customerRate * (pct / 100) * 100) / 100;
}

export function isDateOutsideContractWindow(
  dateStr: string | null | undefined,
  start: string,
  end: string | null,
): boolean {
  if (!dateStr) return false;
  if (dateStr < start) return true;
  if (end && dateStr > end) return true;
  return false;
}
