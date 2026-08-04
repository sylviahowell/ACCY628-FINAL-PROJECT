import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/actions/auth";
import { createShipment } from "@/lib/actions/freight";
import { createClient } from "@/lib/supabase/server";
import { isOperations } from "@/lib/types";

export default async function NewShipmentPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!isOperations(profile.role)) redirect("/shipments");

  const supabase = await createClient();
  const { data: customers } = await supabase.from("customers").select("id, name").order("name");
  const { data: carriers } = await supabase.from("carriers").select("id, name").order("name");
  const { data: contracts } = await supabase
    .from("contracts")
    .select("id, contract_number, title")
    .eq("status", "active");

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
          Customer rate is what you charge. Carrier cost is what you pay. Profit = rate − cost − extras.
        </p>
      </div>
      <form action={action} className="card bg-base-100 shadow-sm">
        <div className="card-body grid gap-3 md:grid-cols-2">
          <input name="load_number" required placeholder="Shipment number (LD-2001)" className="input input-bordered" />
          <select name="customer_id" required className="select select-bordered">
            <option value="">Customer…</option>
            {(customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select name="carrier_id" className="select select-bordered">
            <option value="">Carrier (optional)…</option>
            {(carriers ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select name="contract_id" className="select select-bordered">
            <option value="">Contract (optional)…</option>
            {(contracts ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.contract_number} — {c.title}</option>
            ))}
          </select>
          <input name="pickup_location" required placeholder="Pickup location (City, ST)" className="input input-bordered" />
          <input name="delivery_location" required placeholder="Delivery location (City, ST)" className="input input-bordered" />
          <input name="pickup_date" type="date" className="input input-bordered" />
          <input name="delivery_date" type="date" className="input input-bordered" />
          <input name="freight_type" placeholder="Freight type" className="input input-bordered" />
          <input name="weight_lbs" type="number" placeholder="Weight (lbs)" className="input input-bordered" />
          <input name="customer_rate" type="number" step="0.01" required placeholder="Rate charged to customer" className="input input-bordered" />
          <input name="carrier_cost" type="number" step="0.01" required placeholder="Carrier cost" className="input input-bordered" />
          <input name="discount_amount" type="number" step="0.01" defaultValue={0} placeholder="Discount (needs manager approval)" className="input input-bordered md:col-span-2" />
          <button className="btn btn-primary md:col-span-2">Create shipment</button>
        </div>
      </form>
    </div>
  );
}
