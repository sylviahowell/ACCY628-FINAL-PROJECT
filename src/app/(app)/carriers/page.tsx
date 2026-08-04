import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/actions/auth";
import { createCarrier } from "@/lib/actions/freight";
import { createClient } from "@/lib/supabase/server";
import { isOperations } from "@/lib/types";

export default async function CarriersPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!isOperations(profile.role)) redirect("/dashboard");

  const supabase = await createClient();
  const { data: carriers } = await supabase.from("carriers").select("*").order("name");
  const { data: shipments } = await supabase
    .from("shipments")
    .select("carrier_id, status, pickup_date, delivery_date");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Carriers</h1>
        <p className="text-sm opacity-70">Trucking partners who haul your customers&apos; freight.</p>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Add carrier</h2>
          <form action={createCarrier} className="grid gap-3 md:grid-cols-2">
            <input name="name" required placeholder="Carrier name" className="input input-bordered" />
            <input name="contact_name" placeholder="Contact" className="input input-bordered" />
            <input name="dot_number" placeholder="DOT number" className="input input-bordered" />
            <input name="mc_number" placeholder="MC number" className="input input-bordered" />
            <input name="contact_phone" placeholder="Phone" className="input input-bordered" />
            <input name="contact_email" type="email" placeholder="Email" className="input input-bordered" />
            <input name="insurance_expiration" type="date" className="input input-bordered" />
            <input name="equipment_type" placeholder="Equipment type (van, reefer…)" className="input input-bordered" />
            <input name="service_area" placeholder="Service area" className="input input-bordered" />
            <input name="rating" type="number" step="0.1" min="1" max="5" defaultValue={4} className="input input-bordered" />
            <button className="btn btn-primary md:col-span-2">Save carrier</button>
          </form>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(carriers ?? []).map((c) => {
          const loads = (shipments ?? []).filter((s) => s.carrier_id === c.id);
          const current = loads.filter((s) =>
            ["assigned", "picked_up", "in_transit"].includes(s.status),
          ).length;
          const past = loads.filter((s) =>
            ["delivered", "completed"].includes(s.status),
          ).length;
          return (
            <div key={c.id} className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <h3 className="card-title">{c.name}</h3>
                <p className="text-sm opacity-70">
                  DOT {c.dot_number ?? "—"} · MC {c.mc_number ?? "—"} · Rating{" "}
                  {c.rating ?? "—"}
                </p>
                <p className="text-sm">
                  {c.equipment_type ?? "Equipment TBD"} · {c.service_area ?? "Service area TBD"}
                </p>
                <p className="text-xs opacity-60">
                  Insurance expires: {c.insurance_expiration ?? "Not on file"}
                </p>
                <div className="stats shadow-none">
                  <div className="stat px-0">
                    <div className="stat-title">Current loads</div>
                    <div className="stat-value text-2xl">{current}</div>
                  </div>
                  <div className="stat px-0">
                    <div className="stat-title">Past loads</div>
                    <div className="stat-value text-2xl">{past}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
