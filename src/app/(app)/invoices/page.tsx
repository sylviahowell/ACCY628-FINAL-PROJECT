import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { FilterBanner, resolveSearchParams } from "@/components/FilterBanner";
import { InvoicesTriage, type InvoiceCardMeta } from "@/components/InvoicesTriage";
import { getCurrentProfile } from "@/lib/actions/auth";
import { generateInvoice, openDispute } from "@/lib/actions/freight";
import { filterInvoices, invoiceFilterLabel } from "@/lib/list-filters";
import { createClient } from "@/lib/supabase/server";
import { money, statusBadge } from "@/lib/types";
import { canManageBilling } from "@/lib/roles";
import { fuelSurchargeAmount, parseNetDays } from "@/lib/contract-terms";

/** Map manager-nav `?status=` shortcuts onto the shared `?filter=` vocabulary. */
function resolveInvoiceFilter(params: Record<string, string | undefined>) {
  if (params.filter) return params.filter;
  if (params.status === "ready") return "ready-to-bill";
  if (params.status === "overdue") return "overdue";
  if (params.status === "open") return "open";
  return undefined;
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "carrier" || profile.role === "broker") redirect("/dashboard");

  const params = await resolveSearchParams(searchParams);
  const filter = resolveInvoiceFilter(params);
  const filterLabel = invoiceFilterLabel(filter);
  const today = new Date().toISOString().slice(0, 10);
  const readyOnly = filter === "ready-to-bill";

  const supabase = await createClient();

  let invoiceQuery = supabase
    .from("invoices")
    .select("*, customers(name), shipments(load_number)")
    .order("issue_date", { ascending: false });
  if (profile.role === "customer" && profile.customer_id) {
    invoiceQuery = invoiceQuery.eq("customer_id", profile.customer_id);
  }
  const { data: invoices } = await invoiceQuery;
  const allInvoices = invoices ?? [];
  const visibleInvoices = readyOnly ? [] : filterInvoices(allInvoices, filter, today);

  const billedIds = new Set(
    allInvoices
      .filter((i) => i.status !== "cancelled" && i.shipment_id)
      .map((i) => i.shipment_id as string),
  );

  type ReadyRow = {
    id: string;
    load_number: string;
    status: string;
    customer_rate: number;
    contract_id: string | null;
    customer_id: string;
    customers: { name?: string } | null;
    proof_of_delivery: { id: string; signed_by: string | null }[] | null;
    contracts: {
      payment_terms: string | null;
      billing_terms: string | null;
      fuel_surcharge_pct: number | null;
    } | null;
  };

  let readyToBill: ReadyRow[] = [];

  if (canManageBilling(profile.role)) {
    const { data } = await supabase
      .from("shipments")
      .select(
        "id, load_number, status, customer_rate, contract_id, customer_id, customers(name), proof_of_delivery(id, signed_by), contracts(payment_terms, billing_terms, fuel_surcharge_pct)",
      )
      .in("status", ["delivered", "completed"]);
    readyToBill = ((data ?? []) as unknown as ReadyRow[]).filter((s) => !billedIds.has(s.id));
  }

  const customerTerms = new Map<string, string>();
  if (readyToBill.length) {
    const ids = [...new Set(readyToBill.map((s) => s.customer_id))];
    const { data: custs } = await supabase
      .from("customers")
      .select("id, payment_terms")
      .in("id", ids);
    for (const c of custs ?? []) {
      customerTerms.set(c.id, c.payment_terms ?? "Net 30");
    }
  }

  let overdueCount = 0;
  let openCount = 0;
  const invoiceCards: InvoiceCardMeta[] = visibleInvoices.map((inv) => {
    const balance = Number(inv.total) - Number(inv.amount_paid);
    const isClosed = ["paid", "cancelled"].includes(inv.status) || balance <= 0;
    const isOpen = !isClosed;
    const isOverdue = isOpen && Boolean(inv.due_date && inv.due_date < today);
    if (isOpen) openCount += 1;
    if (isOverdue) overdueCount += 1;

    return {
      id: inv.id,
      isOverdue,
      isOpen,
      card: (
        <div
          id={`focus-${inv.invoice_number}`}
          data-focus={inv.invoice_number}
          className="card bg-base-100 shadow-sm transition"
        >
          <div className="card-body">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h3 className="font-semibold">{inv.invoice_number}</h3>
                <p className="text-sm opacity-70">
                  {(inv.customers as { name?: string } | null)?.name} · Shipment{" "}
                  {(inv.shipments as { load_number?: string } | null)?.load_number ?? "—"}
                </p>
                <p className="text-sm">
                  Due {inv.due_date} · Total {money(inv.total)} · Paid {money(inv.amount_paid)} ·
                  Balance {money(balance)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <span className={`badge ${statusBadge(inv.status)}`}>{inv.status}</span>
                {isOverdue ? <span className="badge badge-error badge-sm">overdue</span> : null}
              </div>
            </div>
            {profile.role === "customer" ? (
              <form
                action={openDispute}
                className="mt-2 flex flex-wrap gap-2 border-t border-base-200 pt-3"
              >
                <input type="hidden" name="invoice_id" value={inv.id} />
                <input type="hidden" name="shipment_id" value={inv.shipment_id ?? ""} />
                <input
                  name="reason"
                  required
                  placeholder="Dispute reason"
                  className="input input-bordered input-sm grow"
                />
                <input
                  name="amount_disputed"
                  type="number"
                  step="0.01"
                  defaultValue={balance}
                  className="input input-bordered input-sm w-28"
                />
                <button className="btn btn-warning btn-sm">Submit dispute</button>
              </form>
            ) : null}
          </div>
        </div>
      ),
    };
  });

  // Chip counts should reflect the full book when not in a dashboard deep-link,
  // and the filtered subset when one is active.
  if (!filter || filter === "ready-to-bill") {
    overdueCount = 0;
    openCount = 0;
    for (const inv of allInvoices) {
      const balance = Number(inv.total) - Number(inv.amount_paid);
      const isClosed = ["paid", "cancelled"].includes(inv.status) || balance <= 0;
      const isOpen = !isClosed;
      const isOverdue = isOpen && Boolean(inv.due_date && inv.due_date < today);
      if (isOpen) openCount += 1;
      if (isOverdue) overdueCount += 1;
    }
  }

  const showReady = canManageBilling(profile.role);
  const readyWithPod = readyToBill.filter((s) => (s.proof_of_delivery ?? []).length > 0).length;

  const readySection =
    showReady && readyToBill.length > 0 ? (
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <h2 className="card-title text-base">Ready to bill</h2>
          <p className="text-sm opacity-70">
            Delivered loads with POD that still need an invoice.
          </p>
          <div className="space-y-3">
            {readyToBill.map((s) => {
              const pods = s.proof_of_delivery ?? [];
              const contract = Array.isArray(s.contracts) ? s.contracts[0] : s.contracts;
              const terms =
                contract?.payment_terms ||
                contract?.billing_terms ||
                customerTerms.get(s.customer_id) ||
                "Net 30";
              const fuelPct = Number(contract?.fuel_surcharge_pct ?? 0);
              const fuel = fuelSurchargeAmount(Number(s.customer_rate), fuelPct);
              const estimated = Number(s.customer_rate) + fuel;
              return (
                <div
                  key={s.id}
                  id={`focus-${s.load_number}`}
                  data-focus={s.load_number}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-box border border-base-300 p-3 transition"
                >
                  <div>
                    <p className="font-medium">{s.load_number}</p>
                    <p className="text-sm opacity-70">
                      {(s.customers as { name?: string } | null)?.name} · Rate{" "}
                      {money(s.customer_rate)}
                      {fuel > 0 ? ` + fuel ${money(fuel)}` : ""} · Est. {money(estimated)} ·{" "}
                      <span className={`badge badge-sm ${statusBadge(s.status)}`}>{s.status}</span>
                    </p>
                    <p className="text-xs opacity-60">
                      Terms {terms} (due in {parseNetDays(terms)} days
                      {fuelPct > 0 ? `; fuel ${fuelPct}%` : ", no contract fuel"}
                      ) · POD:{" "}
                      {pods.length
                        ? `signed by ${pods[0]?.signed_by ?? "receiver"}`
                        : "missing — cannot invoice until uploaded"}
                    </p>
                  </div>
                  {pods.length ? (
                    <form action={generateInvoice.bind(null, s.id)}>
                      <button className="btn btn-primary btn-sm">Generate invoice</button>
                    </form>
                  ) : (
                    <span className="badge badge-warning">Awaiting POD</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    ) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {profile.role === "customer" ? "My Invoices" : "Invoices"}
        </h1>
        <p className="text-sm opacity-70">
          Generated after delivery + proof of delivery. Due dates and fuel follow contract (or
          customer) payment terms. Use filters to triage ready, overdue, and open invoices.
        </p>
      </div>

      {filterLabel ? <FilterBanner label={filterLabel} clearHref="/invoices" /> : null}

      <InvoicesTriage
        readyCount={showReady ? readyWithPod : 0}
        overdueCount={overdueCount}
        openCount={openCount}
        showReady={showReady}
        readySection={readySection}
        invoices={invoiceCards}
        emptyAll={
          <EmptyState
            title={filterLabel ? "No matching invoices" : "No invoices yet"}
            description={
              filterLabel
                ? "Nothing matches this filter right now."
                : canManageBilling(profile.role)
                  ? "Generate an invoice from a delivered load with POD, or open Ready to bill above."
                  : "Invoices for your account will appear here once billing posts them."
            }
            action={
              filterLabel ? (
                <Link href="/invoices" className="btn btn-outline btn-sm">
                  Show all invoices
                </Link>
              ) : undefined
            }
          />
        }
      />

      {readyOnly && readyToBill.length === 0 ? (
        <EmptyState
          title="No loads ready to bill"
          description="Delivered loads with POD will appear here when they still need an invoice."
          action={
            <Link href="/invoices" className="btn btn-outline btn-sm">
              Show all invoices
            </Link>
          }
        />
      ) : null}
    </div>
  );
}
