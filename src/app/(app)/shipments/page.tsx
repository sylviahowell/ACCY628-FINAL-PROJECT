import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { isStaff, money, statusBadge } from "@/lib/types";

export default async function ShipmentsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: shipments } = await supabase
    .from("shipments")
    .select("*, customers(name), carriers(name)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {profile.role === "carrier"
              ? "My assignments"
              : profile.role === "customer"
                ? "My shipments"
                : "Shipments"}
          </h1>
          <p className="text-sm opacity-70">
            Track freight from scheduled pickup through delivery and completion.
          </p>
        </div>
        {isStaff(profile.role) ? (
          <Link href="/shipments/new" className="btn btn-primary">New shipment</Link>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-box bg-base-100 shadow-sm">
        <table className="table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Lane</th>
              <th>Parties</th>
              <th>Status</th>
              <th>Sell / Buy</th>
            </tr>
          </thead>
          <tbody>
            {(shipments ?? []).map((s) => (
              <tr key={s.id} className="hover">
                <td>
                  <Link href={`/shipments/${s.id}`} className="link link-primary font-medium">
                    {s.load_number}
                  </Link>
                </td>
                <td className="text-sm">
                  {s.pickup_location ?? `${s.origin_city}, ${s.origin_state}`}
                  <div className="opacity-60">→ {s.delivery_location ?? `${s.dest_city}, ${s.dest_state}`}</div>
                </td>
                <td className="text-sm">
                  {(s.customers as { name?: string } | null)?.name ?? "—"}
                  <div className="opacity-60">
                    {(s.carriers as { name?: string } | null)?.name ?? "No carrier"}
                  </div>
                </td>
                <td><span className={`badge ${statusBadge(s.status)}`}>{s.status}</span></td>
                <td className="text-sm">{money(s.customer_rate)} / {money(s.carrier_cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
