import Link from "next/link";
import { Suspense } from "react";
import { CollectionsWorklist } from "@/components/CollectionsWorklist";
import { FocusScroll } from "@/components/FocusScroll";
import { StatusPie } from "@/components/Charts";
import { requirePathAccess } from "@/lib/authz";
import {
  agingChartData,
  buildCollectionWorklist,
  computeAging,
} from "@/lib/collections";
import { sanitizeDemoText } from "@/lib/display-text";
import { createClient } from "@/lib/supabase/server";
import { money, statusBadge } from "@/lib/types";

export default async function AccountsReceivablePage() {
  await requirePathAccess("/ar");
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
  const aging = computeAging(invList, today);
  const totalAr =
    aging.current + aging.d1_30 + aging.d31_60 + aging.d61_90 + aging.d90_plus;

  const worklist = buildCollectionWorklist({
    invoices: invList.map((i) => ({
      id: i.id,
      invoice_number: i.invoice_number,
      customer_id: i.customer_id,
      total: Number(i.total),
      amount_paid: Number(i.amount_paid),
      due_date: i.due_date,
      status: i.status,
      customers: i.customers as { name?: string } | null,
    })),
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="stats bg-base-100 shadow-sm">
          <div className="stat">
            <div className="stat-title">Total AR</div>
            <div className="stat-value text-xl">{money(totalAr)}</div>
          </div>
        </div>
        <div className="stats bg-base-100 shadow-sm">
          <div className="stat">
            <div className="stat-title">Current</div>
            <div className="stat-value text-xl">{money(aging.current)}</div>
          </div>
        </div>
        <div className="stats bg-base-100 shadow-sm">
          <div className="stat">
            <div className="stat-title">1–30 days</div>
            <div className="stat-value text-xl">{money(aging.d1_30)}</div>
          </div>
        </div>
        <div className="stats bg-base-100 shadow-sm">
          <div className="stat">
            <div className="stat-title">31–60 days</div>
            <div className="stat-value text-xl">{money(aging.d31_60)}</div>
          </div>
        </div>
        <div className="stats bg-base-100 shadow-sm">
          <div className="stat">
            <div className="stat-title">61–90 days</div>
            <div className="stat-value text-xl">{money(aging.d61_90)}</div>
          </div>
        </div>
        <div className="stats bg-base-100 shadow-sm">
          <div className="stat">
            <div className="stat-title">90+ days</div>
            <div className="stat-value text-xl text-error">{money(aging.d90_plus)}</div>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Aging mix</h2>
          <StatusPie data={agingChartData(aging)} />
        </div>
      </div>

      <CollectionsWorklist items={worklist} />

      <div className="overflow-x-auto rounded-box bg-base-100 shadow-sm">
        <table className="table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Balance</th>
              <th>Due</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {worklist.map((i) => (
              <tr key={i.invoiceId}>
                <td>{i.invoiceNumber}</td>
                <td>{i.customerName}</td>
                <td>
                  <span className={`badge ${statusBadge(i.status)}`}>{i.status}</span>
                </td>
                <td>{money(i.balance)}</td>
                <td className={i.daysOutstanding > 0 ? "text-error font-medium" : ""}>
                  {i.dueDate}
                </td>
                <td>
                  <Link href="/payments" className="link link-primary text-sm">
                    Collect
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
