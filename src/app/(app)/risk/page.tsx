import { redirect } from "next/navigation";
import { RiskCreditWorkspace } from "@/components/RiskCreditWorkspace";
import { requirePathAccess } from "@/lib/authz";
import {
  type CarrierRiskRow,
  type CustomerCreditRow,
  creditStatus,
  creditUtilizationPct,
  insuranceRiskStatus,
  openArFromInvoices,
} from "@/lib/risk-credit";
import {
  isOnCreditHold,
  PAST_DUE_CREDIT_HOLD_THRESHOLD,
  pastDueBalanceFromInvoices,
} from "@/lib/credit-hold";
import { money } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export default async function RiskCreditPage() {
  const profile = await requirePathAccess("/risk");
  if (profile.role !== "manager") redirect("/dashboard");

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: customers },
    { data: invoices },
    { data: carriers },
    { data: shipments },
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, credit_limit, payment_terms")
      .order("name"),
    supabase
      .from("invoices")
      .select("customer_id, total, amount_paid, status, due_date")
      .neq("status", "cancelled"),
    supabase
      .from("carriers")
      .select("id, name, insurance_expiration, rating")
      .order("name"),
    supabase.from("shipments").select("carrier_id, status"),
  ]);

  const invoicesByCustomer = new Map<
    string,
    { total: number; amount_paid: number; status: string; due_date: string }[]
  >();
  for (const inv of invoices ?? []) {
    const list = invoicesByCustomer.get(inv.customer_id) ?? [];
    list.push({
      total: Number(inv.total),
      amount_paid: Number(inv.amount_paid),
      status: inv.status,
      due_date: inv.due_date,
    });
    invoicesByCustomer.set(inv.customer_id, list);
  }

  const customerRows: CustomerCreditRow[] = (customers ?? []).map((c) => {
    const invs = invoicesByCustomer.get(c.id) ?? [];
    const openAr = openArFromInvoices(invs);
    const pastDue = pastDueBalanceFromInvoices(invs, today);
    const creditLimit = Number(c.credit_limit ?? 0);
    return {
      id: c.id,
      name: c.name,
      paymentTerms: c.payment_terms ?? "Net 30",
      creditLimit,
      openAr,
      pastDue,
      onCreditHold: isOnCreditHold(pastDue),
      utilizationPct: creditUtilizationPct(openAr, creditLimit),
      status: creditStatus(openAr, creditLimit),
    };
  });

  const activeByCarrier = new Map<string, number>();
  for (const s of shipments ?? []) {
    if (!s.carrier_id) continue;
    if (["completed", "cancelled"].includes(s.status)) continue;
    if (
      !["assigned", "booked", "picked_up", "in_transit"].includes(s.status)
    ) {
      continue;
    }
    activeByCarrier.set(
      s.carrier_id,
      (activeByCarrier.get(s.carrier_id) ?? 0) + 1,
    );
  }

  const carrierRows: CarrierRiskRow[] = (carriers ?? []).map((c) => {
    const { status, daysUntilExpiry } = insuranceRiskStatus(
      c.insurance_expiration ?? null,
      today,
    );
    return {
      id: c.id,
      name: c.name,
      insuranceExpiration: c.insurance_expiration ?? null,
      rating: c.rating == null ? null : Number(c.rating),
      activeLoads: activeByCarrier.get(c.id) ?? 0,
      status,
      daysUntilExpiry,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Risk &amp; Credit</h1>
        <p className="text-sm opacity-70">
          Customer credit exposure and carrier insurance risk that can block safe booking or
          collections. Use filters to focus on who you need to review.
        </p>
      </div>

      <div className="rounded-box border border-info/30 bg-info/10 px-4 py-3 text-sm">
        <p className="font-medium text-info-content">Control in this workspace</p>
        <p className="mt-1 opacity-80">
          This business faces credit over-extension and uninsured carrier risk. RowanLane
          surfaces limit utilization and certificate expiry here, blocks non-manager booking when
          open AR plus a new rate would exceed the customer credit limit, and places customers on
          credit hold when past-due AR reaches {money(PAST_DUE_CREDIT_HOLD_THRESHOLD)} (managers may
          override).
        </p>
      </div>

      <RiskCreditWorkspace customers={customerRows} carriers={carrierRows} />
    </div>
  );
}
