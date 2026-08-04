import Link from "next/link";
import { requirePathAccess } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";

export default async function DocumentsPage() {
  await requirePathAccess("/documents");
  const supabase = await createClient();
  const { data: pods } = await supabase
    .from("proof_of_delivery")
    .select("*, shipments(load_number, delivery_location, status)")
    .order("delivered_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-sm opacity-70">
          Proof of delivery and delivery paperwork for your assigned loads.
        </p>
      </div>
      <div className="space-y-3">
        {(pods ?? []).map((p) => (
          <div key={p.id} className="card bg-base-100 shadow-sm">
            <div className="card-body py-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <Link
                    href={`/shipments/${p.shipment_id}`}
                    className="link link-primary font-medium"
                  >
                    {(p.shipments as { load_number?: string } | null)?.load_number ?? "Shipment"}
                  </Link>
                  <p className="text-sm opacity-70">
                    Signed by {p.signed_by ?? "—"} ·{" "}
                    {new Date(p.delivered_at).toLocaleString()}
                  </p>
                  <p className="text-xs opacity-60">{p.notes}</p>
                </div>
                {p.file_url ? (
                  <a href={p.file_url} className="btn btn-outline btn-sm" target="_blank" rel="noreferrer">
                    Open POD
                  </a>
                ) : (
                  <span className="badge badge-ghost">No file URL</span>
                )}
              </div>
            </div>
          </div>
        ))}
        {(pods ?? []).length === 0 ? (
          <p className="text-sm opacity-70">
            No POD documents yet. Upload from a load after delivery.
          </p>
        ) : null}
      </div>
    </div>
  );
}
