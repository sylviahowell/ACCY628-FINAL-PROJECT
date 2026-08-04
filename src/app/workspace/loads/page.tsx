import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/actions/auth";
import { money } from "@/lib/types";
import { redirect } from "next/navigation";

export default async function LoadsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: loads } = await supabase
    .from("shipments")
    .select(
      "id, load_number, status, origin_city, dest_city, customer_rate, carrier_cost, customers(name), carriers(name)",
    )
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-[#0f2744]">Loads</h2>
          <p className="text-sm text-slate-600">
            Work performed under brokerage engagements
          </p>
        </div>
        {["manager", "broker"].includes(profile.role) ? (
          <Link
            href="/workspace/loads/new"
            className="rounded-md bg-[#0f2744] px-4 py-2 text-sm font-medium text-white"
          >
            New load
          </Link>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white/80 shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Load</th>
              <th className="px-4 py-3">Lane</th>
              <th className="px-4 py-3">Parties</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Sell / Buy</th>
            </tr>
          </thead>
          <tbody>
            {(loads ?? []).map((load) => (
              <tr key={load.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <Link
                    href={`/workspace/loads/${load.id}`}
                    className="font-medium text-[#0f2744] hover:underline"
                  >
                    {load.load_number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {load.origin_city} → {load.dest_city}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {(load.customers as { name?: string } | null)?.name ?? "—"}
                  <br />
                  <span className="text-xs">
                    {(load.carriers as { name?: string } | null)?.name ??
                      "No carrier"}
                  </span>
                </td>
                <td className="px-4 py-3">{load.status}</td>
                <td className="px-4 py-3">
                  {money(load.customer_rate)} / {money(load.carrier_cost)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
