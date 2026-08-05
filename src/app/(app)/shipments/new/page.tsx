import { redirect } from "next/navigation";
import { requirePathAccess } from "@/lib/authz";
import { createShipment } from "@/lib/actions/freight";
import { CreateShipmentForm } from "@/components/CreateShipmentForm";
import { createClient } from "@/lib/supabase/server";
import { isOperations, money } from "@/lib/types";
import type { ContractTermsInfo } from "@/lib/contract-terms";
import { openArFromInvoices, insuranceRiskStatus } from "@/lib/risk-credit";
import {
  isOnCreditHold,
  PAST_DUE_CREDIT_HOLD_THRESHOLD,
  pastDueBalanceFromInvoices,
} from "@/lib/credit-hold";

export default async function NewShipmentPage() {
  const profile = await requirePathAccess("/shipments");
  if (!isOperations(profile.role)) redirect("/shipments");

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, credit_limit")
    .order("name");
  const { data: carriers } = await supabase
    .from("carriers")
    .select("id, name, insurance_expiration")
    .order("name");
  const { data: contracts } = await supabase
    .from("contracts")
    .select(
      "id, contract_number, title, customer_id, start_date, end_date, payment_terms, billing_terms, fuel_surcharge_pct, shipping_rates, status, renewal_option, downpayment_pct, customer_rate_per_mile, carrier_rate_per_mile",
    )
    .eq("status", "active");
  const { data: invoices } = await supabase
    .from("invoices")
    .select("customer_id, total, amount_paid, status, due_date")
    .neq("status", "cancelled");

  const openArByCustomer = new Map<string, number>();
  const pastDueByCustomer = new Map<string, number>();
  for (const c of customers ?? []) {
    const invs = (invoices ?? []).filter((i) => i.customer_id === c.id);
    openArByCustomer.set(c.id, openArFromInvoices(invs));
    pastDueByCustomer.set(c.id, pastDueBalanceFromInvoices(invs, today));
  }
  const heldCustomers = (customers ?? []).filter((c) =>
    isOnCreditHold(pastDueByCustomer.get(c.id) ?? 0),
  );

  const assignableCarriers = (carriers ?? []).filter(
    (c) => insuranceRiskStatus(c.insurance_expiration ?? null, today).status !== "expired",
  );

  async function action(formData: FormData) {
    "use server";
    const id = await createShipment(formData);
    redirect(`/shipments/${id}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create shipment</h1>
        <p className="text-sm opacity-70">
          Customer rate is what you charge. Carrier cost is what you pay. Linked contracts drive
          payment terms and fuel surcharge at invoicing, and guide booking dates. Carriers with
          expired insurance (Suspended) are omitted from the list.
        </p>
      </div>

      {heldCustomers.length > 0 ? (
        <div className="rounded-box border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <p className="font-medium">Credit hold warning</p>
          <p className="mt-1 opacity-80">
            Past-due AR ≥ {money(PAST_DUE_CREDIT_HOLD_THRESHOLD)} blocks broker booking
            {profile.role === "manager" ? " (you can override; it is logged)" : ""}. On hold:{" "}
            {heldCustomers
              .map((c) => `${c.name} (${money(pastDueByCustomer.get(c.id) ?? 0)})`)
              .join(", ")}
            .
          </p>
        </div>
      ) : null}

      <CreateShipmentForm
        customers={(customers ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          creditLimit: Number(c.credit_limit ?? 0),
          openAr: openArByCustomer.get(c.id) ?? 0,
          pastDue: pastDueByCustomer.get(c.id) ?? 0,
          onCreditHold: isOnCreditHold(pastDueByCustomer.get(c.id) ?? 0),
        }))}
        carriers={assignableCarriers.map((c) => ({ id: c.id, name: c.name }))}
        contracts={(contracts ?? []) as ContractTermsInfo[]}
        isManager={profile.role === "manager"}
        action={action}
      />
    </div>
  );
}
