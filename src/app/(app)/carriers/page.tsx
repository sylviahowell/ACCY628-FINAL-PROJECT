import { redirect } from "next/navigation";
import { CarrierScorecardGrid } from "@/components/CarrierScorecards";
import { requirePathAccess } from "@/lib/authz";
import { createCarrier } from "@/lib/actions/freight";
import { buildCarrierScorecards } from "@/lib/carrier-scorecard";
import { createClient } from "@/lib/supabase/server";
import { isOperations } from "@/lib/types";

export default async function CarriersPage() {
  const profile = await requirePathAccess("/carriers");
  if (!isOperations(profile.role)) redirect("/dashboard");

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: carriers } = await supabase.from("carriers").select("*").order("name");
  const { data: shipments } = await supabase
    .from("shipments")
    .select(
      "id, carrier_id, status, pickup_date, delivery_date, promised_delivery_date, carrier_cost, customer_rate",
    );
  const { data: profit } = await supabase
    .from("shipment_profitability")
    .select("shipment_id, margin, carrier_cost");
  const { data: pods } = await supabase.from("proof_of_delivery").select("shipment_id");
  const { data: charges } = await supabase
    .from("shipment_charges")
    .select("shipment_id");

  const profitByShipment = new Map(
    (profit ?? []).map((p) => [
      p.shipment_id as string,
      { margin: Number(p.margin), carrier_cost: Number(p.carrier_cost) },
    ]),
  );
  const chargeCount = new Map<string, number>();
  for (const c of charges ?? []) {
    chargeCount.set(c.shipment_id, (chargeCount.get(c.shipment_id) ?? 0) + 1);
  }

  const scorecards = buildCarrierScorecards({
    carriers: (carriers ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      equipment_type: c.equipment_type ?? null,
      service_area: c.service_area ?? null,
      rating: c.rating == null ? null : Number(c.rating),
      insurance_expiration: c.insurance_expiration ?? null,
    })),
    shipments: (shipments ?? []).map((s) => ({
      id: s.id,
      carrier_id: s.carrier_id,
      status: s.status,
      pickup_date: s.pickup_date,
      delivery_date: s.delivery_date,
      promised_delivery_date: s.promised_delivery_date,
      carrier_cost: Number(s.carrier_cost),
      customer_rate: Number(s.customer_rate),
    })),
    profitByShipment,
    podShipmentIds: new Set((pods ?? []).map((p) => p.shipment_id)),
    chargesByShipment: chargeCount,
    today,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Carriers</h1>
        <p className="text-sm opacity-70">
          Trucking partners with performance scorecards for coverage decisions. Tiers are
          rule-based — Suspended (expired insurance) is blocked from create/assign; Watch List
          remains assignable with Risk & Warnings visibility.
        </p>
      </div>

      <CarrierScorecardGrid scorecards={scorecards} showComparison />

      <details className="collapse collapse-arrow rounded-box border border-base-300 bg-base-100">
        <summary className="collapse-title font-medium">Add carrier</summary>
        <div className="collapse-content">
          <form action={createCarrier} className="grid gap-3 md:grid-cols-2 pb-2">
            <input name="name" required placeholder="Carrier name" className="input input-bordered" />
            <input name="contact_name" placeholder="Contact" className="input input-bordered" />
            <input name="dot_number" placeholder="DOT number" className="input input-bordered" />
            <input name="mc_number" placeholder="MC number" className="input input-bordered" />
            <input name="contact_phone" placeholder="Phone" className="input input-bordered" />
            <input name="contact_email" type="email" placeholder="Email" className="input input-bordered" />
            <input name="insurance_expiration" type="date" className="input input-bordered" />
            <input
              name="equipment_type"
              placeholder="Equipment type (van, reefer…)"
              className="input input-bordered"
            />
            <input name="service_area" placeholder="Service area" className="input input-bordered" />
            <input
              name="rating"
              type="number"
              step="0.1"
              min="1"
              max="5"
              defaultValue={4}
              className="input input-bordered"
            />
            <button className="btn btn-primary md:col-span-2">Save carrier</button>
          </form>
        </div>
      </details>
    </div>
  );
}
