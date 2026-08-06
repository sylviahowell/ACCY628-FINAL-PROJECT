import Link from "next/link";
import { AssignCarrierForm } from "@/components/AssignCarrierForm";
import { FocusScroll } from "@/components/FocusScroll";
import { resolveSearchParams } from "@/components/FilterBanner";
import { requirePathAccess } from "@/lib/authz";
import { assignCarrier } from "@/lib/actions/freight";
import { latestDeclinesByShipment } from "@/lib/carrier-declines";
import {
  buildCarrierScorecards,
  suggestCarriersForLoad,
  tierBadge,
} from "@/lib/carrier-scorecard";
import { insuranceRiskStatus } from "@/lib/risk-credit";
import { createClient } from "@/lib/supabase/server";
import { formatStatusLabel, money, statusBadge } from "@/lib/types";
import { Suspense } from "react";

type AssignView = "all" | "needs" | "awaiting";

function resolveView(raw: string | undefined): AssignView {
  if (raw === "needs" || raw === "awaiting" || raw === "all") return raw;
  return "all";
}

/**
 * Step 3 of the simplified ops flow: tender / reassign carriers.
 * Views: All · Needs assignment · Awaiting acceptance.
 */
export default async function AssignCarriersPage({
  searchParams,
}: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const profile = await requirePathAccess("/assign");
  const params = await resolveSearchParams(searchParams);
  const view = resolveView(params.view);
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const returnTo =
    view === "all" ? "/assign" : `/assign?view=${view}`;

  const [{ data: openRaw }, { data: offeredRaw }, { data: declineUpdates }] =
    await Promise.all([
      supabase
        .from("shipments")
        .select(
          "id, load_number, status, pickup_location, delivery_location, origin_city, origin_state, dest_city, dest_state, pickup_date, delivery_date, freight_type, customer_rate, carrier_cost, customer_id, carrier_id, customers(name)",
        )
        .is("carrier_id", null)
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("shipments")
        .select(
          "id, load_number, status, pickup_location, delivery_location, origin_city, origin_state, dest_city, dest_state, pickup_date, delivery_date, freight_type, customer_rate, carrier_cost, customer_id, carrier_id, customers(name), carriers(name)",
        )
        .eq("status", "offered")
        .not("carrier_id", "is", null)
        .order("pickup_date", { ascending: true })
        .limit(40),
      supabase
        .from("shipment_status_updates")
        .select("shipment_id, note, created_at")
        .ilike("note", "Carrier declined offer:%")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

  const declines = latestDeclinesByShipment(declineUpdates ?? []);

  const openLoads = (openRaw ?? []).filter(
    (s) => !["cancelled", "delivered", "completed"].includes(s.status),
  );
  openLoads.sort((a, b) => {
    const ad = declines.has(a.id) ? 0 : 1;
    const bd = declines.has(b.id) ? 0 : 1;
    if (ad !== bd) return ad - bd;
    return 0;
  });

  const offeredLoads = offeredRaw ?? [];
  const showNeeds = view === "all" || view === "needs";
  const showAwaiting = view === "all" || view === "awaiting";

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

  function renderLoadCard(
    s: {
      id: string;
      load_number: string;
      status: string;
      pickup_location: string | null;
      delivery_location: string | null;
      origin_city: string | null;
      origin_state: string | null;
      dest_city: string | null;
      dest_state: string | null;
      pickup_date: string | null;
      delivery_date: string | null;
      freight_type: string | null;
      customer_rate: number | null;
      carrier_cost: number | null;
      carrier_id: string | null;
      customers: { name?: string } | null;
      carriers?: { name?: string } | null;
    },
    mode: "open" | "offered",
  ) {
    const customerName = (s.customers as { name?: string } | null)?.name ?? "Customer";
    const carrierName = (s.carriers as { name?: string } | null)?.name ?? null;
    const laneFrom = s.pickup_location ?? `${s.origin_city}, ${s.origin_state}`;
    const laneTo = s.delivery_location ?? `${s.dest_city}, ${s.dest_state}`;
    const decline = declines.get(s.id);
    const suggested = suggestCarriersForLoad(scorecards, {
      equipmentHint: s.freight_type,
      preferLowCost: true,
    })
      .filter((c) => assignableCarriers.some((a) => a.id === c.carrierId))
      .filter((c) => c.carrierId !== s.carrier_id)
      .slice(0, 3);

    return (
      <li
        key={s.id}
        id={`focus-${s.id}`}
        className={`rounded-box border bg-base-100 px-4 py-3 ${
          decline
            ? "border-error/50"
            : mode === "offered"
              ? "border-warning/50"
              : "border-base-300"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/shipments/${s.id}`} className="link link-primary font-medium">
                {s.load_number}
              </Link>
              <span className={`badge badge-sm ${statusBadge(s.status)}`}>
                {formatStatusLabel(s.status)}
              </span>
              {mode === "open" ? (
                <span className="badge badge-sm badge-outline">Needs assignment</span>
              ) : (
                <span className="badge badge-sm badge-warning">Awaiting acceptance</span>
              )}
              {decline ? (
                <span className="badge badge-sm badge-error">Carrier declined</span>
              ) : null}
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
              Customer rate {money(s.customer_rate)} · booked carrier cost {money(s.carrier_cost)}
            </p>
            {mode === "offered" && carrierName ? (
              <p className="mt-1 text-sm font-medium text-warning">
                Offer pending with {carrierName} — reassign below if they do not accept.
              </p>
            ) : null}
            {mode === "open" && !decline ? (
              <p className="mt-1 text-sm opacity-70">
                No carrier yet — pick one and send an offer.
              </p>
            ) : null}
            {decline ? (
              <div className="mt-2 rounded-box border border-error/30 bg-error/5 px-3 py-2 text-sm">
                <p className="font-semibold text-error">Carrier declined this offer</p>
                <p className="opacity-80">Reason: {decline.reason}</p>
                <p className="mt-1 text-xs opacity-60">
                  Pick a different carrier below and send a new offer.
                </p>
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-3 max-w-md">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-60">
            {mode === "offered" ? "Reassign / pull offer" : "Send offer"}
          </p>
          <AssignCarrierForm
            shipmentId={s.id}
            customerRate={Number(s.customer_rate) || 0}
            defaultCarrierCost={s.carrier_cost ?? ""}
            defaultCarrierId=""
            isManager={profile.role === "manager"}
            action={assignCarrier}
            returnTo={returnTo}
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
  }

  const declinedCount = openLoads.filter((s) => declines.has(s.id)).length;
  const totalQueue = openLoads.length + offeredLoads.length;

  const tabs: { id: AssignView; label: string; count: number }[] = [
    { id: "all", label: "All", count: totalQueue },
    { id: "needs", label: "Needs assignment", count: openLoads.length },
    { id: "awaiting", label: "Awaiting acceptance", count: offeredLoads.length },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Suspense fallback={null}>
        <FocusScroll />
      </Suspense>

      <div>
        <h1 className="text-2xl font-bold">Assign carriers</h1>
        <p className="mt-1 text-sm opacity-70">
          Step 3 — send offers to carriers, then track who still needs assignment vs who has an
          offer waiting for acceptance.
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

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={t.id === "all" ? "/assign" : `/assign?view=${t.id}`}
            className={`btn btn-sm ${view === t.id ? "btn-primary" : "btn-outline"}`}
          >
            {t.label}
            <span className="badge badge-sm badge-ghost tabular-nums">{t.count}</span>
          </Link>
        ))}
      </div>

      {declinedCount > 0 && showNeeds ? (
        <div className="alert alert-error text-sm">
          <span>
            {declinedCount} load{declinedCount === 1 ? "" : "s"} need reassignment after a carrier
            decline. They are listed first in Needs assignment.
          </span>
        </div>
      ) : null}

      {showNeeds ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Needs assignment</h2>
              <p className="text-sm opacity-70">
                Loads with no carrier. Sending an offer moves them to Awaiting acceptance.
              </p>
            </div>
            {view === "all" ? (
              <Link href="/assign?view=needs" className="btn btn-ghost btn-xs">
                View only
              </Link>
            ) : null}
          </div>
          {openLoads.length === 0 ? (
            <div className="rounded-box border border-base-300 bg-base-100 p-6 text-sm opacity-80">
              <p>No loads waiting for a carrier.</p>
              <p className="mt-2">
                Approve a customer request on{" "}
                <Link href="/coverage" className="link link-primary">
                  Load requests
                </Link>{" "}
                first — then it appears here.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {openLoads.map((s) =>
                renderLoadCard(
                  {
                    ...s,
                    customers: s.customers as { name?: string } | null,
                  },
                  "open",
                ),
              )}
            </ul>
          )}
        </section>
      ) : null}

      {showAwaiting ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Awaiting carrier acceptance</h2>
              <p className="text-sm opacity-70">
                Offers already sent. Reassign to another carrier, or set Unassigned to pull the offer
                back into Needs assignment.
              </p>
            </div>
            {view === "all" ? (
              <Link href="/assign?view=awaiting" className="btn btn-ghost btn-xs">
                View only
              </Link>
            ) : null}
          </div>
          {offeredLoads.length === 0 ? (
            <p className="text-sm opacity-60">No pending offers right now.</p>
          ) : (
            <ul className="space-y-4">
              {offeredLoads.map((s) =>
                renderLoadCard(
                  {
                    ...s,
                    customers: s.customers as { name?: string } | null,
                    carriers: s.carriers as { name?: string } | null,
                  },
                  "offered",
                ),
              )}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
