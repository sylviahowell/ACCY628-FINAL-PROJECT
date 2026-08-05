import { redirect } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { requirePathAccess } from "@/lib/authz";
import { createCustomer } from "@/lib/actions/freight";
import {
  isOnCreditHold,
  PAST_DUE_CREDIT_HOLD_THRESHOLD,
  pastDueBalanceFromInvoices,
} from "@/lib/credit-hold";
import { createClient } from "@/lib/supabase/server";
import { isOperations, money } from "@/lib/types";

export default async function CustomersPage() {
  const profile = await requirePathAccess("/customers");
  if (!isOperations(profile.role)) redirect("/dashboard");

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: customers } = await supabase.from("customers").select("*").order("name");
  const { data: shipments } = await supabase.from("shipments").select("customer_id, status");
  const showAr = profile.role === "manager";
  // Ops need due dates to surface credit holds; managers also see full AR dollars.
  const { data: invoices } = await supabase
    .from("invoices")
    .select("customer_id, total, amount_paid, status, due_date");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Customers</h1>
        <p className="text-sm opacity-70">
          Shippers you bill. Create customers, then attach contracts and shipments. Credit hold
          flags when past-due AR reaches {money(PAST_DUE_CREDIT_HOLD_THRESHOLD)}.
        </p>
      </div>

      <details className="collapse collapse-arrow rounded-box border border-base-300 bg-base-100">
        <summary className="collapse-title font-medium">Add customer</summary>
        <div className="collapse-content">
          <form action={createCustomer} className="grid gap-3 md:grid-cols-2">
            <input name="name" required placeholder="Company name" className="input input-bordered" />
            <input name="contact_name" placeholder="Contact name" className="input input-bordered" />
            <input name="contact_email" type="email" placeholder="Email" className="input input-bordered" />
            <input name="contact_phone" placeholder="Phone" className="input input-bordered" />
            <input name="billing_address" placeholder="Billing address" className="input input-bordered md:col-span-2" />
            <input name="shipping_address" placeholder="Shipping address" className="input input-bordered md:col-span-2" />
            <input name="payment_terms" defaultValue="Net 30" placeholder="Payment terms" className="input input-bordered" />
            <input name="credit_limit" type="number" defaultValue={50000} placeholder="Credit limit" className="input input-bordered" />
            <textarea name="notes" placeholder="Notes" className="textarea textarea-bordered md:col-span-2" />
            <button className="btn btn-primary md:col-span-2">Save customer</button>
          </form>
        </div>
      </details>

      <div className="grid gap-4">
        {(customers ?? []).length === 0 ? (
          <EmptyState
            title="No customers yet"
            description="Add a shipper to attach contracts and book loads."
          />
        ) : null}
        {(customers ?? []).map((c) => {
          const openShipments = (shipments ?? []).filter(
            (s) => s.customer_id === c.id && !["completed", "cancelled"].includes(s.status),
          ).length;
          const custInvoices = (invoices ?? []).filter((i) => i.customer_id === c.id);
          const outstanding = custInvoices.reduce(
            (sum, i) => sum + Math.max(0, Number(i.total) - Number(i.amount_paid)),
            0,
          );
          const pastDue = pastDueBalanceFromInvoices(custInvoices, today);
          const onHold = isOnCreditHold(pastDue);
          return (
            <div key={c.id} className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="card-title text-lg">
                      <span className="inline-flex flex-wrap items-center gap-2">
                        {c.name}
                        {onHold ? (
                          <span className="badge badge-warning badge-sm">Credit hold</span>
                        ) : null}
                      </span>
                    </h3>
                    <p className="text-sm opacity-70">
                      {c.contact_name ?? "No contact"} · {c.contact_email ?? "—"} ·{" "}
                      {c.payment_terms ?? "Net 30"}
                    </p>
                    <p className="text-xs opacity-60">{c.billing_address}</p>
                    {onHold ? (
                      <p className="mt-1 text-xs text-warning">
                        Past-due {money(pastDue)} ≥ hold threshold {money(PAST_DUE_CREDIT_HOLD_THRESHOLD)}.
                        Brokers cannot book until cleared or a manager overrides.
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right text-sm">
                    <p>
                      Open shipments: <b>{openShipments}</b>
                    </p>
                    {showAr ? (
                      <>
                        <p>
                          Invoices: <b>{custInvoices.length}</b>
                        </p>
                        <p>
                          Outstanding: <b>{money(outstanding)}</b>
                        </p>
                        <p>
                          Past due: <b>{money(pastDue)}</b>
                        </p>
                      </>
                    ) : (
                      <p className="text-xs opacity-60">
                        {onHold ? `Past due ${money(pastDue)}` : "AR balances managed in Billing"}
                      </p>
                    )}
                    <p>Credit limit: {money(c.credit_limit)}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
