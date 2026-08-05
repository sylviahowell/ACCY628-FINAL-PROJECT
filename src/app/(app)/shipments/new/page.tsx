import { redirect } from "next/navigation";
import { requirePathAccess } from "@/lib/authz";
import { createShipment } from "@/lib/actions/freight";
import { createClient } from "@/lib/supabase/server";
import { isOperations } from "@/lib/types";
import { ContractGuidedFields } from "@/components/ContractGuidedFields";
import type { ContractTermsInfo } from "@/lib/contract-terms";
import { insuranceRiskStatus } from "@/lib/risk-credit";

export default async function NewShipmentPage() {
  const profile = await requirePathAccess("/shipments");
  if (!isOperations(profile.role)) redirect("/shipments");

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: customers } = await supabase.from("customers").select("id, name").order("name");
  const { data: carriers } = await supabase
    .from("carriers")
    .select("id, name, insurance_expiration")
    .order("name");
  const { data: contracts } = await supabase
    .from("contracts")
    .select(
      "id, contract_number, title, customer_id, start_date, end_date, payment_terms, billing_terms, fuel_surcharge_pct, shipping_rates, status, renewal_option",
    )
    .eq("status", "active");

  // Suspended tier = expired insurance — hide from booking picker
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
      <form action={action} className="card bg-base-100 shadow-sm">
        <div className="card-body grid gap-3 md:grid-cols-2">
          <input
            name="load_number"
            required
            placeholder="Shipment number (LD-2001)"
            className="input input-bordered"
          />
          <select name="customer_id" required className="select select-bordered">
            <option value="">Customer…</option>
            {(customers ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select name="carrier_id" className="select select-bordered">
            <option value="">Carrier (optional)…</option>
            {assignableCarriers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ContractGuidedFields contracts={(contracts ?? []) as ContractTermsInfo[]} />
          <input
            name="pickup_location"
            required
            placeholder="Pickup location (City, ST)"
            className="input input-bordered"
          />
          <input
            name="delivery_location"
            required
            placeholder="Delivery location (City, ST)"
            className="input input-bordered"
          />
          <input name="freight_type" placeholder="Freight type" className="input input-bordered" />
          <input
            name="weight_lbs"
            type="number"
            placeholder="Weight (lbs)"
            className="input input-bordered"
          />
          <input
            name="carrier_cost"
            type="number"
            step="0.01"
            required
            placeholder="Carrier cost"
            className="input input-bordered"
          />
          <input
            name="discount_amount"
            type="number"
            step="0.01"
            defaultValue={0}
            placeholder="Discount (needs manager approval)"
            className="input input-bordered"
          />
          {profile.role === "manager" ? (
            <p className="md:col-span-2 text-xs opacity-60">
              Managers may book above a customer credit limit; the override is logged.
            </p>
          ) : (
            <p className="md:col-span-2 text-xs opacity-60">
              Booking is blocked if open AR + this rate exceeds the customer credit limit.
            </p>
          )}
          <button className="btn btn-primary md:col-span-2">Create shipment</button>
        </div>
      </form>
    </div>
  );
}
