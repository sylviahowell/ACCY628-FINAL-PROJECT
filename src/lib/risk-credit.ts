import { money } from "@/lib/types";

export type CreditStatus = "ok" | "watch" | "over" | "no_limit";
export type InsuranceRiskStatus = "current" | "expiring" | "expired" | "unknown";

export type CustomerCreditRow = {
  id: string;
  name: string;
  paymentTerms: string;
  creditLimit: number;
  openAr: number;
  utilizationPct: number | null;
  status: CreditStatus;
};

export type CarrierRiskRow = {
  id: string;
  name: string;
  insuranceExpiration: string | null;
  rating: number | null;
  activeLoads: number;
  status: InsuranceRiskStatus;
  daysUntilExpiry: number | null;
};

export function openArFromInvoices(
  invoices: { total: number | string; amount_paid: number | string; status: string }[],
): number {
  return invoices.reduce((sum, inv) => {
    if (["paid", "cancelled"].includes(inv.status)) return sum;
    return sum + Math.max(0, Number(inv.total) - Number(inv.amount_paid));
  }, 0);
}

export function creditStatus(openAr: number, creditLimit: number): CreditStatus {
  if (!(creditLimit > 0)) return "no_limit";
  if (openAr > creditLimit) return "over";
  if (openAr / creditLimit >= 0.8) return "watch";
  return "ok";
}

export function creditUtilizationPct(
  openAr: number,
  creditLimit: number,
): number | null {
  if (!(creditLimit > 0)) return null;
  return Math.round((openAr / creditLimit) * 1000) / 10;
}

export function insuranceRiskStatus(
  expiration: string | null,
  today: string,
): { status: InsuranceRiskStatus; daysUntilExpiry: number | null } {
  if (!expiration) return { status: "unknown", daysUntilExpiry: null };
  const days = Math.floor(
    (new Date(expiration + "T00:00:00Z").getTime() -
      new Date(today + "T00:00:00Z").getTime()) /
      (1000 * 60 * 60 * 24),
  );
  if (days < 0) return { status: "expired", daysUntilExpiry: days };
  if (days <= 30) return { status: "expiring", daysUntilExpiry: days };
  return { status: "current", daysUntilExpiry: days };
}

export function creditStatusLabel(status: CreditStatus): string {
  switch (status) {
    case "over":
      return "Over limit";
    case "watch":
      return "Watch (≥80%)";
    case "no_limit":
      return "No limit set";
    default:
      return "OK";
  }
}

export function insuranceStatusLabel(status: InsuranceRiskStatus): string {
  switch (status) {
    case "expired":
      return "Expired";
    case "expiring":
      return "Expiring ≤30d";
    case "unknown":
      return "Unknown";
    default:
      return "Current";
  }
}

export function creditStatusBadge(status: CreditStatus): string {
  switch (status) {
    case "over":
      return "badge-error";
    case "watch":
      return "badge-warning";
    case "no_limit":
      return "badge-ghost";
    default:
      return "badge-success";
  }
}

export function insuranceStatusBadge(status: InsuranceRiskStatus): string {
  switch (status) {
    case "expired":
      return "badge-error";
    case "expiring":
      return "badge-warning";
    case "unknown":
      return "badge-ghost";
    default:
      return "badge-success";
  }
}

export function formatMoney(n: number) {
  return money(n);
}
