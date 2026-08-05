import Link from "next/link";
import { Suspense } from "react";
import { CollectionsWorklist } from "@/components/CollectionsWorklist";
import { FilterBanner, resolveSearchParams } from "@/components/FilterBanner";
import { FocusScroll } from "@/components/FocusScroll";
import { StatusPie } from "@/components/Charts";
import { requirePathAccess } from "@/lib/authz";
import {
  agingChartData,
  buildCollectionWorklist,
  buildCustomerArRollup,
  computeAging,
} from "@/lib/collections";
import { sanitizeDemoText } from "@/lib/display-text";
import {
  agingBucketForInvoice,
  arFilterLabel,
} from "@/lib/list-filters";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/types";

export default async function AccountsReceivablePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  await requirePathAccess("/ar");
  const params = await resolveSearchParams(searchParams);
  const filter = params.filter;
  const filterLabel = arFilterLabel(filter);

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*, customers(name)")
    .order("due_date");
  const { data: disputes } = await supabase.from("disputes").select("invoice_id, status");
  const { data: notes } = await supabase
    .from("collection_notes")
    .select("invoice_id, note, created_at")
    .order("created_at", { ascending: false });

  const invList = invoices ?? [];
  const mappedInvoices = invList.map((i) => ({
    id: i.id,
    invoice_number: i.invoice_number,
    customer_id: i.customer_id,
    total: Number(i.total),
    amount_paid: Number(i.amount_paid),
    due_date: i.due_date,
    status: i.status,
    customers: i.customers as { name?: string } | null,
  }));

  const aging = computeAging(invList, today);
  const totalAr =
    aging.current + aging.d1_30 + aging.d31_60 + aging.d61_90 + aging.d90_plus;
  const pastDue = aging.d1_30 + aging.d31_60 + aging.d61_90 + aging.d90_plus;

  const customerRollup = buildCustomerArRollup(mappedInvoices, today).slice(0, 8);

  const worklist = buildCollectionWorklist({
    invoices: mappedInvoices,
    disputes: (disputes ?? []).map((d) => ({
      invoice_id: d.invoice_id,
      status: d.status,
    })),
    notes: (notes ?? []).map((n) => ({
      invoice_id: n.invoice_id,
      note: sanitizeDemoText(n.note),
      created_at: n.created_at,
    })),
    today,
  });

  const filteredWorklist = (() => {
    switch (filter) {
      case "current":
        return worklist.filter((i) => agingBucketForInvoice(i.dueDate, today) === "current");
      case "past-due":
        return worklist.filter((i) => i.daysOutstanding > 0);
      case "cash-at-risk":
        return worklist.filter((i) => i.daysOutstanding > 0 || i.disputeStatus === "open");
      case "d1_30":
        return worklist.filter((i) => agingBucketForInvoice(i.dueDate, today) === "d1_30");
      case "d31_60":
        return worklist.filter((i) => agingBucketForInvoice(i.dueDate, today) === "d31_60");
      case "d61_90":
        return worklist.filter((i) => agingBucketForInvoice(i.dueDate, today) === "d61_90");
      case "d90_plus":
        return worklist.filter((i) => agingBucketForInvoice(i.dueDate, today) === "d90_plus");
      default:
        return worklist;
    }
  })().sort((a, b) => b.daysOutstanding - a.daysOutstanding || b.balance - a.balance);

  const tileClass = (active: boolean) =>
    `stats block w-full bg-base-100 shadow-sm transition hover:shadow-md ${
      active ? "ring-2 ring-primary" : ""
    }`;

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <FocusScroll />
      </Suspense>
      <div>
        <h1 className="text-2xl font-bold">Accounts Receivable</h1>
        <p className="text-sm opacity-70">
          Who owes us money, how old the balance is, and what to collect next.
        </p>
      </div>

      {filterLabel ? <FilterBanner label={filterLabel} clearHref="/ar" /> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/ar" className={tileClass(!filter)}>
          <div className="stat">
            <div className="stat-title">Total AR</div>
            <div className="stat-value text-xl">{money(totalAr)}</div>
          </div>
        </Link>
        <Link href="/ar?filter=current" className={tileClass(filter === "current")}>
          <div className="stat">
            <div className="stat-title">Current</div>
            <div className="stat-value text-xl">{money(aging.current)}</div>
          </div>
        </Link>
        <Link href="/ar?filter=past-due" className={tileClass(filter === "past-due")}>
          <div className="stat">
            <div className="stat-title">Past due</div>
            <div className="stat-value text-xl">{money(pastDue)}</div>
          </div>
        </Link>
        <Link href="/ar?filter=d90_plus" className={tileClass(filter === "d90_plus")}>
          <div className="stat">
            <div className="stat-title">90+ days</div>
            <div className="stat-value text-xl text-error">{money(aging.d90_plus)}</div>
          </div>
        </Link>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Aging mix</h2>
          <StatusPie data={agingChartData(aging)} />
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <div>
            <h2 className="card-title text-base">Customers by open AR</h2>
            <p className="text-sm opacity-70">Concentration of who owes us.</p>
          </div>
          {customerRollup.length === 0 ? (
            <p className="text-sm opacity-70">No open balances.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Open AR</th>
                    <th>Past due</th>
                    <th># Invoices</th>
                    <th>Oldest (days)</th>
                  </tr>
                </thead>
                <tbody>
                  {customerRollup.map((row) => (
                    <tr key={row.customerId} className="hover">
                      <td className="font-medium">{row.customerName}</td>
                      <td>{money(row.openBalance)}</td>
                      <td
                        className={
                          row.pastDueBalance > 0 ? "font-medium text-warning" : ""
                        }
                      >
                        {money(row.pastDueBalance)}
                      </td>
                      <td>{row.invoiceCount}</td>
                      <td
                        className={
                          row.oldestDays > 60
                            ? "font-semibold text-error"
                            : row.oldestDays > 0
                              ? "text-warning"
                              : ""
                        }
                      >
                        {Math.max(0, row.oldestDays)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <CollectionsWorklist items={filteredWorklist} />
    </div>
  );
}
