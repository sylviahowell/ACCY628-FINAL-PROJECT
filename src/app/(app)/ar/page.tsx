import Link from "next/link";
import { Suspense } from "react";
import { CollectionsWorklist } from "@/components/CollectionsWorklist";
import { EmptyState } from "@/components/EmptyState";
import { FilterBanner, resolveSearchParams } from "@/components/FilterBanner";
import { FocusScroll } from "@/components/FocusScroll";
import { StatusPie } from "@/components/Charts";
import { recordPayment } from "@/lib/actions/freight";
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
import { canManageBilling } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { money, statusBadge } from "@/lib/types";

function arHref(opts: { customer?: string; filter?: string }) {
  const q = new URLSearchParams();
  if (opts.customer) q.set("customer", opts.customer);
  if (opts.filter) q.set("filter", opts.filter);
  const s = q.toString();
  return s ? `/ar?${s}` : "/ar";
}

function paymentMethodLabel(method: string | null | undefined) {
  switch (method) {
    case "ach_simulated":
    case "ach":
      return "ACH";
    case "wire_simulated":
    case "wire":
      return "Wire";
    case "check_simulated":
    case "check":
      return "Check";
    case "write_off_simulated":
    case "write_off":
      return "Write-off";
    default:
      return method?.replace(/_simulated$/i, "").toUpperCase() || "—";
  }
}

export default async function AccountsReceivablePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const profile = await requirePathAccess("/ar");
  const params = await resolveSearchParams(searchParams);
  const filter = params.filter;
  const customerId = params.customer;
  const filterLabel = arFilterLabel(filter);
  const preselectedInvoiceId = params.invoice_id;
  const receiptsFilter = params.receipts;
  const monthPrefix = new Date().toISOString().slice(0, 7);
  const today = new Date().toISOString().slice(0, 10);

  const supabase = await createClient();

  const [
    { data: invoices },
    { data: disputes },
    { data: notes },
    { data: payments },
    { data: openInvoices },
  ] = await Promise.all([
    supabase.from("invoices").select("*, customers(name)").order("due_date"),
    supabase.from("disputes").select("invoice_id, status"),
    supabase
      .from("collection_notes")
      .select("invoice_id, note, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select("*, invoices(invoice_number, total, amount_paid, status, customers(name))")
      .order("payment_date", { ascending: false }),
    supabase
      .from("invoices")
      .select("id, invoice_number, total, amount_paid, status, customers(name)")
      .in("status", ["pending", "sent", "partial", "overdue"]),
  ]);

  const invList = invoices ?? [];
  const scopedInvList = customerId
    ? invList.filter((i) => i.customer_id === customerId)
    : invList;

  let resolvedCustomerName: string | null =
    ((scopedInvList[0]?.customers as { name?: string } | null)?.name ?? null) || null;
  if (customerId && !resolvedCustomerName) {
    const { data: cust } = await supabase
      .from("customers")
      .select("name")
      .eq("id", customerId)
      .maybeSingle();
    resolvedCustomerName = cust?.name ?? null;
  }

  const mappedInvoices = scopedInvList.map((i) => ({
    id: i.id,
    invoice_number: i.invoice_number,
    customer_id: i.customer_id,
    total: Number(i.total),
    amount_paid: Number(i.amount_paid),
    due_date: i.due_date,
    status: i.status,
    customers: i.customers as { name?: string } | null,
  }));

  const aging = computeAging(scopedInvList, today);
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

  const preselected = (openInvoices ?? []).find((i) => i.id === preselectedInvoiceId);
  const defaultAmount = preselected
    ? Math.max(0, Number(preselected.total) - Number(preselected.amount_paid))
    : undefined;

  const recorderIds = [
    ...new Set((payments ?? []).map((p) => p.recorded_by).filter(Boolean) as string[]),
  ];
  const { data: recorders } = recorderIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", recorderIds)
    : { data: [] as { id: string; full_name: string }[] };
  const recorderName = new Map((recorders ?? []).map((p) => [p.id, p.full_name]));

  const allReceipts = payments ?? [];
  const receiptRows =
    receiptsFilter === "today"
      ? allReceipts.filter((p) => p.payment_date === today)
      : receiptsFilter === "month"
        ? allReceipts.filter((p) => (p.payment_date ?? "").startsWith(monthPrefix))
        : allReceipts;
  const receiptsLabel =
    receiptsFilter === "today"
      ? "cash receipts today"
      : receiptsFilter === "month"
        ? "cash receipts this month"
        : null;

  const tileClass = (active: boolean) =>
    `stats block w-full bg-base-100 shadow-sm transition hover:shadow-md ${
      active ? "ring-2 ring-primary" : ""
    }`;

  const bannerLabel = (() => {
    const parts: string[] = [];
    if (customerId) {
      parts.push(
        resolvedCustomerName
          ? `AR for ${resolvedCustomerName}`
          : "AR for selected customer",
      );
    }
    if (filterLabel) parts.push(filterLabel);
    if (receiptsLabel) parts.push(receiptsLabel);
    return parts.length ? parts.join(" · ") : null;
  })();

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <FocusScroll />
      </Suspense>
      <div>
        <h1 className="text-2xl font-bold">Accounts Receivable</h1>
        <p className="text-sm opacity-70">
          Aging, collections worklist, and customer cash receipts in one place.
        </p>
      </div>

      {bannerLabel ? <FilterBanner label={bannerLabel} clearHref="/ar" /> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href={arHref({ customer: customerId })}
          className={tileClass(!filter)}
        >
          <div className="stat">
            <div className="stat-title">Total AR</div>
            <div className="stat-value text-xl">{money(totalAr)}</div>
          </div>
        </Link>
        <Link
          href={arHref({ customer: customerId, filter: "current" })}
          className={tileClass(filter === "current")}
        >
          <div className="stat">
            <div className="stat-title">Current</div>
            <div className="stat-value text-xl">{money(aging.current)}</div>
          </div>
        </Link>
        <Link
          href={arHref({ customer: customerId, filter: "past-due" })}
          className={tileClass(filter === "past-due")}
        >
          <div className="stat">
            <div className="stat-title">Past due</div>
            <div className="stat-value text-xl">{money(pastDue)}</div>
          </div>
        </Link>
        <Link
          href={arHref({ customer: customerId, filter: "d90_plus" })}
          className={tileClass(filter === "d90_plus")}
        >
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
            <h2 className="card-title text-base">
              {customerId ? "Customer open AR" : "Customers by open AR"}
            </h2>
            <p className="text-sm opacity-70">
              {customerId
                ? "Balances for this customer only."
                : "Concentration of who owes us."}
            </p>
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

      {canManageBilling(profile.role) ? (
        <div
          id="record-payment"
          data-focus="record-payment"
          className="card bg-base-100 shadow-sm"
        >
          <div className="card-body">
            <h2 className="card-title text-base">Record collection</h2>
            <p className="text-sm opacity-70">
              Apply customer cash to an open invoice. Balances update automatically.
            </p>
            {preselected ? (
              <p className="text-sm opacity-70">
                Prefilling {preselected.invoice_number} · balance{" "}
                {money(Number(preselected.total) - Number(preselected.amount_paid))}.
              </p>
            ) : null}
            <form action={recordPayment} className="grid gap-3 md:grid-cols-2">
              <select
                name="invoice_id"
                required
                className="select select-bordered md:col-span-2"
                defaultValue={preselected?.id ?? ""}
              >
                <option value="">Open invoice…</option>
                {(openInvoices ?? []).map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} · {(inv.customers as { name?: string } | null)?.name} · bal{" "}
                    {money(Number(inv.total) - Number(inv.amount_paid))}
                  </option>
                ))}
              </select>
              <input
                name="payment_date"
                type="date"
                defaultValue={today}
                className="input input-bordered"
              />
              <input
                name="amount"
                type="number"
                step="0.01"
                required
                placeholder="Amount"
                className="input input-bordered"
                defaultValue={defaultAmount != null && defaultAmount > 0 ? defaultAmount : undefined}
              />
              <select name="method" className="select select-bordered">
                <option value="ach_simulated">ACH</option>
                <option value="wire_simulated">Wire</option>
                <option value="check_simulated">Check</option>
              </select>
              <input name="reference" placeholder="Reference #" className="input input-bordered" />
              <button className="btn btn-primary md:col-span-2">Save collection</button>
            </form>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Recent cash receipts</h2>
          <p className="text-sm opacity-70">Customer remittances applied to invoices.</p>
        </div>
        {receiptRows.length === 0 ? (
          <EmptyState
            title={receiptsLabel ? "No matching receipts" : "No cash receipts yet"}
            description={
              receiptsLabel
                ? "Nothing matches this filter right now."
                : "When you collect against an open invoice, the receipt appears here and the invoice balance updates."
            }
            action={
              receiptsLabel ? (
                <Link href="/ar" className="btn btn-outline btn-sm">
                  Show all receipts
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-box bg-base-100 shadow-sm">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Recorded by</th>
                  <th>Invoice status</th>
                </tr>
              </thead>
              <tbody>
                {receiptRows.map((p) => (
                  <tr key={p.id}>
                    <td>{p.payment_date}</td>
                    <td>
                      {(p.invoices as { invoice_number?: string } | null)?.invoice_number}
                    </td>
                    <td>{money(p.amount)}</td>
                    <td>{paymentMethodLabel(p.method)}</td>
                    <td className="text-sm">
                      {p.recorded_by ? recorderName.get(p.recorded_by) ?? "Staff" : "—"}
                    </td>
                    <td>
                      <span
                        className={`badge ${statusBadge((p.invoices as { status?: string } | null)?.status ?? "")}`}
                      >
                        {(p.invoices as { status?: string } | null)?.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
