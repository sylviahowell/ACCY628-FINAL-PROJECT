import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/actions/auth";
import { createLoad } from "@/lib/actions/freight";
import { createClient } from "@/lib/supabase/server";

export default async function NewLoadPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!["manager", "broker"].includes(profile.role)) {
    redirect("/workspace/loads");
  }

  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name")
    .order("name");
  const { data: carriers } = await supabase
    .from("carriers")
    .select("id, name")
    .order("name");
  const { data: contracts } = await supabase
    .from("contracts")
    .select("id, contract_number, title, customer_id")
    .eq("status", "active");

  async function action(formData: FormData) {
    "use server";
    const result = await createLoad(formData);
    if (result.error) {
      throw new Error(result.error);
    }
    redirect(`/workspace/loads/${result.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#0f2744]">Book a load</h2>
        <p className="text-sm text-slate-600">
          Capture structured engagement terms: customer rate, carrier cost,
          lane, and schedule.
        </p>
      </div>

      <form
        action={action}
        className="space-y-4 rounded-xl border border-slate-200 bg-white/80 p-6 shadow-sm"
      >
        <Field label="Load number" name="load_number" required placeholder="LD-2xxx" />
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Customer</span>
          <select
            name="customer_id"
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">Select…</option>
            {(customers ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Contract (optional)</span>
          <select
            name="contract_id"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">None</option>
            {(contracts ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.contract_number} — {c.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Carrier</span>
          <select
            name="carrier_id"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">Unassigned</option>
            {(carriers ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Origin city" name="origin_city" required />
          <Field label="Origin state" name="origin_state" required />
          <Field label="Destination city" name="dest_city" required />
          <Field label="Destination state" name="dest_state" required />
          <Field label="Customer rate (sell)" name="customer_rate" type="number" step="0.01" required />
          <Field label="Carrier cost (buy)" name="carrier_cost" type="number" step="0.01" required />
          <Field label="Pickup date" name="pickup_date" type="date" />
          <Field label="Promised delivery" name="promised_delivery_date" type="date" />
        </div>
        <button
          type="submit"
          className="rounded-md bg-[#0f2744] px-4 py-2 text-sm font-medium text-white"
        >
          Create load
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  step?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        step={step}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
      />
    </label>
  );
}
