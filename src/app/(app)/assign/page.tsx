import Link from "next/link";
import { AssignCarrierForm } from "@/components/AssignCarrierForm";
import { FocusScroll } from "@/components/FocusScroll";
import { requirePathAccess } from "@/lib/authz";
import { assignCarrier } from "@/lib/actions/freight";
import {
  buildCarrierScorecards,
  suggestCarriersForLoad,
  tierBadge,
} from "@/lib/carrier-scorecard";
import { insuranceRiskStatus } from "@/lib/risk-credit";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/types";
import { Suspense } from "react";

/**
 * Step 3 of the simplified ops flow: assign a carrier to an approved (booked) load.
 * Expired-insurance carriers cannot be assigned.
 */
export default async function AssignCarriersPage() {
  const profile = await requirePathAccess("/assign");
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: loadsRaw } = await supabase
    .from("shipments")
    .select(
      "id, load_number, status, pickup_location, delivery_location, origin_city, origin_state, dest_city, dest_state, pickup_date, delivery_date, freight_type, customer_rate, carrier_cost, customer_id, customers(name)",
    )
    .is("carrier_id", null)
    .order("created_at", { ascending: false })
    .limit(60);

  const loads = (loadsRaw ?? []).filter(
    (s) => !["cancelled", "delivered", "completed"].includes(s.status),
  );

  const { data: allCarriers } = await supabase
    .from("carriers")
    .select("id, name, equipment_type, service_area, rating, insurance_expiration")
    .order("name");

  const assignableCarriers = (allCarriers ?? []).filter(
    (c) => insuranceRiskStatus(c.insurance_expiration ?? null, today).status !== "expired",
  );

  const [{ data: networkShips }, { data: networkPods }, { data: networkProfit }, { data: networkCharges }] =
    await Promise.all([
      supabase
        .from("shipments")
        .select(
          "id, carrier_id, status, pickup_date, delivery_date, promised_delivery_date, carrier_cost, customer_rate",
        ),
      supabase.from("proof_of_delivery").select("shipment_id"),
      supabase.from("shipment_profitability").select("shipment_id, margin, carrier_cost"),
      supabase.from("shipment_charges").select("shipment_id"),
    ]);

  const profitMap = new Map(
    (networkProfit ?? []).map((p) => [
      p.shipment_id as string,
      { margin: Number(p.margin), carrier_cost: Number(p.carrier_cost) },
    ]),
  );
  const chargeCount = new Map<string, number>();
  for (const ch of networkCharges ?? []) {
    chargeCount.set(ch.shipment_id, (chargeCount.get(ch.shipment_id) ?? 0) + 1);
  }

  const scorecards = buildCarrierScorecards({
    carriers: (allCarriers ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      equipment_type: c.equipment_type ?? null,
      service_area: c.service_area ?? null,
      rating: c.rating == null ? null : Number(c.rating),
      insurance_expiration: c.insurance_expiration ?? null,
    })),
    shipments: (networkShips ?? []).map((row) => ({
      id: row.id,
      carrier_id: row.carrier_id,
      status: row.status,
      pickup_date: row.pickup_date,
      delivery_date: row.delivery_date,
      promised_delivery_date: row.promised_delivery_date,
      carrier_cost: Number(row.carrier_cost),
      customer_rate: Number(row.customer_rate),
    })),
    profitByShipment: profitMap,
    podShipmentIds: new Set((networkPods ?? []).map((p) => p.shipment_id)),
    chargesByShipment: chargeCount,
    today,
  });

  const carrierOptions = assignableCarriers.map((c) => {
    const risk = insuranceRiskStatus(c.insurance_expiration ?? null, today);
    const insuranceLabel =
      risk.status === "expiring"
        ? ` · insurance ${c.insurance_expiration} (≤30d)`
        : risk.status === "unknown"
          ? " · insurance unknown"
          : c.insurance_expiration
            ? ` · insured thru ${c.insurance_expiration}`
            : "";
    return { id: c.id, name: c.name, insuranceLabel };
  });

  const rows = loads.slice(0, 40);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Suspense fallback={null}>
        <FocusScroll />
      </Suspense>

      <div>
        <h1 className="text-2xl font-bold">Assign carriers</h1>
        <p className="mt-1 text-sm opacity-70">
          Step 3 — pick a carrier for approved loads. Carriers with expired insurance cannot be
          assigned.
        </p>
      </div>

      <ol className="flex flex-wrap gap-2 text-sm">
        <li className="rounded-box border border-base-300 bg-base-100 px-3 py-1.5 opacity-70">
          <Link href="/coverage" className="link link-hover">
            1. Load requests
          </Link>
        </li>
        <li className="rounded-box border border-base-300 bg-base-100 px-3 py-1.5 opacity-70">
          Approve on Requests
        </li>
        <li className="rounded-box border border-primary/40 bg-primary/10 px-3 py-1.5 font-medium">
          3. Assign carriers
        </li>
      </ol>

      {rows.length === 0 ? (
        <div className="rounded-box border border-base-300 bg-base-100 p-6 text-sm opacity-80">
          <p>No loads waiting for a carrier.</p>
          <p className="mt-2">
            Approve a shipper request on{" "}
            <Link href="/coverage" className="link link-primary">
              Load requests
            </Link>{" "}
            first — then it appears here.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map((s) => {
            const customerName = (s.customers as { name?: string } | null)?.name ?? "Customer";
            const laneFrom = s.pickup_location ?? `${s.origin_city}, ${s.origin_state}`;
            const laneTo = s.delivery_location ?? `${s.dest_city}, ${s.dest_state}`;
            const suggested = suggestCarriersForLoad(scorecards, {
              equipmentHint: s.freight_type,
              preferLowCost: true,
            })
              .filter((c) => assignableCarriers.some((a) => a.id === c.carrierId))
              .slice(0, 3);

            return (
              <li
                key={s.id}
                id={`focus-${s.id}`}
                className="rounded-box border border-base-300 bg-base-100 px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/shipments/${s.id}`}
                        className="link link-primary font-medium"
                      >
                        {s.load_number}
                      </Link>
                      <span className="badge badge-sm badge-warning capitalize">{s.status}</span>
                      <span className="text-sm opacity-70">{customerName}</span>
                    </div>
                    <p className="mt-1 font-medium">
                      {laneFrom} → {laneTo}
                    </p>
                    <p className="text-sm opacity-70">
                      Pickup {s.pickup_date ?? "TBD"} · Delivery {s.delivery_date ?? "TBD"}
                      {s.freight_type ? ` · ${s.freight_type}` : ""}
                    </p>
                    <p className="text-sm opacity-70">
                      Customer rate {money(s.customer_rate)} · booked carrier cost{" "}
                      {money(s.carrier_cost)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 max-w-md">
                  <AssignCarrierForm
                    shipmentId={s.id}
                    customerRate={Number(s.customer_rate) || 0}
                    defaultCarrierCost={s.carrier_cost ?? ""}
                    defaultCarrierId=""
                    isManager={profile.role === "manager"}
                    action={assignCarrier}
                    returnTo="/assign"
                    compact
                    suggestedCarriers={suggested.map((c) => ({
                      carrierId: c.carrierId,
                      name: c.name,
                      tier: c.tier,
                      onTimeDeliveryPct: c.onTimeDeliveryPct,
                      avgCarrierCost: c.avgCarrierCost,
                      insuranceExpiration: c.insuranceExpiration,
                      tierBadgeClass: tierBadge(c.tier),
                    }))}
                    carriers={carrierOptions}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
