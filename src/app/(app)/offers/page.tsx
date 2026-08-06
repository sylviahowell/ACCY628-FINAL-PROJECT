import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/EmptyState";
import { FocusScroll } from "@/components/FocusScroll";
import { requirePathAccess } from "@/lib/authz";
import { acceptLoadOffer, declineLoadOffer } from "@/lib/actions/freight";
import { createClient } from "@/lib/supabase/server";
import { formatStatusLabel, money, statusBadge } from "@/lib/types";

/**
 * Carrier inbox for broker-tendered loads. Accept → My Deliveries (upcoming pickups);
 * decline → back to broker Assign queue.
 */
export default async function CarrierOffersPage() {
  const profile = await requirePathAccess("/offers");
  if (profile.role !== "carrier" || !profile.carrier_id) {
    return (
      <div className="alert alert-warning">
        <span>Load offers are only available in the Carrier portal.</span>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: offers } = await supabase
    .from("shipments")
    .select(
      "id, load_number, status, pickup_location, delivery_location, origin_city, origin_state, dest_city, dest_state, pickup_date, delivery_date, promised_delivery_date, freight_type, carrier_cost, customers(name)",
    )
    .eq("carrier_id", profile.carrier_id)
    .eq("status", "offered")
    .order("pickup_date", { ascending: true });

  const rows = offers ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Suspense fallback={null}>
        <FocusScroll />
      </Suspense>

      <div>
        <h1 className="text-2xl font-bold">Load offers</h1>
        <p className="mt-1 text-sm opacity-70">
          Broker Operations tendered these loads to you. Accept to add them to My Deliveries as
          upcoming pickups, or decline to send them back to the assign queue.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No pending offers"
          description="When ops assigns a load to your carrier, it shows up here first."
          action={
            <Link href="/shipments?filter=pickup-upcoming" className="btn btn-outline btn-sm">
              Go to My Deliveries
            </Link>
          }
        />
      ) : (
        <ul className="space-y-4">
          {rows.map((s) => {
            const lane =
              s.pickup_location && s.delivery_location
                ? `${s.pickup_location} → ${s.delivery_location}`
                : `${s.origin_city ?? "?"}, ${s.origin_state ?? ""} → ${s.dest_city ?? "?"}, ${s.dest_state ?? ""}`;
            const customerName =
              (s.customers as { name?: string } | null)?.name ?? "Customer";

            return (
              <li
                key={s.id}
                id={s.id}
                className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/shipments/${s.id}`}
                        className="font-semibold link link-hover"
                      >
                        {s.load_number}
                      </Link>
                      <span className={`badge badge-sm ${statusBadge(s.status)}`}>
                        {formatStatusLabel(s.status)}
                      </span>
                    </div>
                    <p className="text-sm">{lane}</p>
                    <p className="text-xs opacity-70">
                      {customerName}
                      {s.freight_type ? ` · ${s.freight_type}` : ""}
                      {s.pickup_date ? ` · Pickup ${s.pickup_date}` : ""}
                      {s.delivery_date || s.promised_delivery_date
                        ? ` · Delivery ${s.delivery_date ?? s.promised_delivery_date}`
                        : ""}
                    </p>
                    <p className="text-sm font-medium">
                      Haul pay {money(s.carrier_cost)}
                    </p>
                  </div>

                  <div className="flex w-full max-w-xs flex-col gap-2 sm:w-56">
                    <form action={acceptLoadOffer}>
                      <input type="hidden" name="shipment_id" value={s.id} />
                      <button className="btn btn-primary btn-sm w-full">Accept offer</button>
                    </form>
                    <details>
                      <summary className="btn btn-ghost btn-xs cursor-pointer">Decline…</summary>
                      <form action={declineLoadOffer} className="mt-2 flex flex-col gap-2">
                        <input type="hidden" name="shipment_id" value={s.id} />
                        <input
                          name="note"
                          required
                          minLength={3}
                          placeholder="Reason for ops"
                          className="input input-bordered input-sm"
                        />
                        <button className="btn btn-error btn-sm">Confirm decline</button>
                      </form>
                    </details>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
