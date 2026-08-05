import Link from "next/link";
import { Suspense } from "react";
import { requirePathAccess } from "@/lib/authz";
import { FilterBanner, resolveSearchParams } from "@/components/FilterBanner";
import { FocusScroll } from "@/components/FocusScroll";
import { resolveDispute } from "@/lib/actions/freight";
import { createClient } from "@/lib/supabase/server";
import { sanitizeDemoText } from "@/lib/display-text";
import { money, statusBadge } from "@/lib/types";
import { canManageBilling } from "@/lib/roles";

export default async function DisputesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const profile = await requirePathAccess("/disputes");
  const canResolve = canManageBilling(profile.role);
  const params = await resolveSearchParams(searchParams);
  const openOnly = params.filter === "open";

  const supabase = await createClient();
  const { data: disputes } = await supabase
    .from("disputes")
    .select("*, invoices(invoice_number, status, amount_paid, total), shipments(load_number)")
    .order("created_at", { ascending: false });

  const rows = openOnly
    ? (disputes ?? []).filter((d) => d.status === "open")
    : (disputes ?? []);

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <FocusScroll />
      </Suspense>
      <div>
        <h1 className="text-2xl font-bold">Billing Disputes</h1>
        <p className="text-sm opacity-70">
          Customer challenges to invoices or accessorial charges. Resolve before collecting payment in
          full.
        </p>
      </div>
      {openOnly ? <FilterBanner label="open disputes only" clearHref="/disputes" /> : null}
      <div className="space-y-3">
        {rows.map((d) => {
          const inv = d.invoices as {
            invoice_number?: string;
            status?: string;
            amount_paid?: number;
            total?: number;
          } | null;
          const focusId = inv?.invoice_number ? `focus-${inv.invoice_number}` : undefined;
          return (
            <div
              key={d.id}
              id={focusId}
              data-focus={inv?.invoice_number}
              className="card bg-base-100 shadow-sm transition"
            >
              <div className="card-body gap-3 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{sanitizeDemoText(d.reason)}</p>
                    <p className="text-sm opacity-70">
                      Invoice {inv?.invoice_number ?? "—"} · Load{" "}
                      {(d.shipments as { load_number?: string } | null)?.load_number ?? "—"} ·{" "}
                      {money(d.amount_disputed)}
                    </p>
                    <p className="text-xs opacity-50">
                      Opened {new Date(d.created_at).toLocaleString()}
                      {inv?.status ? ` · Invoice currently ${inv.status}` : ""}
                    </p>
                  </div>
                  <span className={`badge ${statusBadge(d.status)}`}>{d.status}</span>
                </div>
                {canResolve && d.status === "open" ? (
                  <div className="flex flex-wrap gap-2 border-t border-base-200 pt-3">
                    <form action={resolveDispute}>
                      <input type="hidden" name="dispute_id" value={d.id} />
                      <input type="hidden" name="decision" value="resolved" />
                      <button className="btn btn-success btn-sm">Resolve — reinstate invoice</button>
                    </form>
                    <form action={resolveDispute}>
                      <input type="hidden" name="dispute_id" value={d.id} />
                      <input type="hidden" name="decision" value="rejected" />
                      <button className="btn btn-outline btn-sm">
                        Reject dispute — reinstate invoice
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
        {rows.length === 0 ? (
          <p className="text-sm opacity-70">
            {openOnly ? (
              <>
                No open disputes.{" "}
                <Link href="/disputes" className="link">
                  Show all
                </Link>
              </>
            ) : (
              "No disputes on file."
            )}
          </p>
        ) : null}
      </div>
    </div>
  );
}
