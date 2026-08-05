import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { FilterBanner, resolveSearchParams } from "@/components/FilterBanner";
import { requirePathAccess } from "@/lib/authz";
import { getCurrentProfile } from "@/lib/actions/auth";
import { normalizePodUrl, sanitizeDemoText } from "@/lib/display-text";
import { createClient } from "@/lib/supabase/server";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  await requirePathAccess("/documents");
  const profile = await getCurrentProfile();
  const params = await resolveSearchParams(searchParams);
  const missingOnly = params.filter === "missing-pod";
  const supabase = await createClient();

  const carrierId = profile?.role === "carrier" ? profile.carrier_id : null;

  const { data: myLoads } = carrierId
    ? await supabase
        .from("shipments")
        .select("id, load_number, status, delivery_date")
        .eq("carrier_id", carrierId)
        .in("status", ["delivered", "completed"])
    : { data: [] as { id: string; load_number: string; status: string; delivery_date: string | null }[] };

  const loadIds = (myLoads ?? []).map((s) => s.id);

  const { data: pods } =
    loadIds.length > 0
      ? await supabase
          .from("proof_of_delivery")
          .select("*, shipments(load_number, delivery_location, status)")
          .in("shipment_id", loadIds)
          .order("delivered_at", { ascending: false })
      : { data: [] as never[] };

  const podSet = new Set((pods ?? []).map((p) => p.shipment_id));
  const missing = (myLoads ?? []).filter((s) => !podSet.has(s.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-sm opacity-70">
          Proof of delivery and delivery paperwork for your assigned loads.
        </p>
      </div>

      {missingOnly ? (
        <FilterBanner label="loads still missing POD" clearHref="/documents" />
      ) : null}

      {missing.length > 0 ? (
        <div className="card border border-warning/40 bg-warning/10 shadow-sm">
          <div className="card-body py-4">
            <h2 className="card-title text-base">POD still required</h2>
            <ul className="space-y-2 text-sm">
              {missing.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {s.load_number}
                    {s.delivery_date ? ` · delivered ${s.delivery_date}` : ""}
                  </span>
                  <Link href={`/shipments/${s.id}`} className="btn btn-warning btn-xs">
                    Upload POD
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : missingOnly ? (
        <EmptyState
          title="No missing POD"
          description="All completed loads have proof of delivery on file."
          action={
            <Link href="/documents" className="btn btn-outline btn-sm">
              Show all documents
            </Link>
          }
        />
      ) : null}

      {!missingOnly ? (
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
                    <p className="text-xs opacity-60">{sanitizeDemoText(p.notes)}</p>
                  </div>
                  {normalizePodUrl(p.file_url) ? (
                    <a
                      href={normalizePodUrl(p.file_url)!}
                      className="btn btn-outline btn-sm"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open file
                    </a>
                  ) : (
                    <span className="badge badge-ghost">No file URL</span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {(pods ?? []).length === 0 ? (
            <EmptyState
              title="No delivery documents yet"
              description={
                missing.length > 0
                  ? "Upload POD from a delivered load above to clear the queue."
                  : "Proof of delivery for your assignments will appear here."
              }
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
