import { daysPastDue } from "@/lib/collections";
import { money } from "@/lib/types";

/** Past-due open AR at or above this amount puts the customer on credit hold. */
export const PAST_DUE_CREDIT_HOLD_THRESHOLD = 1000;

export function pastDueBalanceFromInvoices(
  invoices: {
    total: number | string;
    amount_paid: number | string;
    due_date: string;
    status: string;
  }[],
  today: string,
): number {
  return invoices.reduce((sum, inv) => {
    if (["paid", "cancelled"].includes(inv.status)) return sum;
    const bal = Math.max(0, Number(inv.total) - Number(inv.amount_paid));
    if (bal <= 0) return sum;
    if (daysPastDue(inv.due_date, today) <= 0) return sum;
    return sum + bal;
  }, 0);
}

export function isOnCreditHold(pastDueBalance: number, threshold = PAST_DUE_CREDIT_HOLD_THRESHOLD) {
  return pastDueBalance >= threshold;
}

export function creditHoldMessage(customerName: string, pastDueBalance: number) {
  return (
    `Credit hold for ${customerName}: past-due AR ${money(pastDueBalance)} ` +
    `meets or exceeds the ${money(PAST_DUE_CREDIT_HOLD_THRESHOLD)} threshold. ` +
    `Ask a manager to book this load, or clear past-due balances first.`
  );
}

export function creditHoldOverrideNote(pastDueBalance: number) {
  return (
    `Credit hold override: past-due AR ${pastDueBalance.toFixed(0)} ` +
    `≥ threshold ${PAST_DUE_CREDIT_HOLD_THRESHOLD}`
  );
}
