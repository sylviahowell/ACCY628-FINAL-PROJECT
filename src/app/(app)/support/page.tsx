import Link from "next/link";
import { requirePathAccess } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { sanitizeDemoText } from "@/lib/display-text";
import { money } from "@/lib/types";

export default async function SupportPage() {
  const profile = await requirePathAccess("/support");
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const customerId = profile.customer_id;

  let invoiceQuery = supabase
    .from("invoices")
    .select("id, invoice_number, status, total, amount_paid, due_date, customer_id")
    .order("due_date", { ascending: true });
  let shipmentQuery = supabase
    .from("shipments")
    .select("id, load_number, status, promised_delivery_date, customer_id")
    .not("status", "in", '("completed","cancelled")');
  let disputeQuery = supabase
    .from("disputes")
    .select("id, reason, amount_disputed, status, customer_id")
    .eq("status", "open");

  if (customerId) {
    invoiceQuery = invoiceQuery.eq("customer_id", customerId);
    shipmentQuery = shipmentQuery.eq("customer_id", customerId);
    disputeQuery = disputeQuery.eq("customer_id", customerId);
  }

  const [{ data: invoices }, { data: disputes }, { data: shipments }] = await Promise.all([
    invoiceQuery,
    disputeQuery,
    shipmentQuery,
  ]);

  const overdue = (invoices ?? []).filter((i) => {
    const bal = Number(i.total) - Number(i.amount_paid);
    return bal > 0 && i.due_date < today && !["paid", "cancelled"].includes(i.status);
  });
  const delayed = (shipments ?? []).filter(
    (s) =>
      s.promised_delivery_date &&
      s.promised_delivery_date < today &&
      !["delivered", "completed"].includes(s.status),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Support</h1>
        <p className="text-sm opacity-70">
          Help with your shipments, invoices, and billing questions.
        </p>
      </div>

      {(delayed.length > 0 || overdue.length > 0 || (disputes ?? []).length > 0) && (
        <div className="card border border-warning/30 bg-warning/10 shadow-sm">
          <div className="card-body py-4">
            <h2 className="card-title text-base">Open items</h2>
            <ul className="space-y-1 text-sm">
              {delayed.map((s) => (
                <li key={s.id}>
                  Delayed shipment{" "}
                  <Link className="link link-primary" href={`/shipments/${s.id}`}>
                    {s.load_number}
                  </Link>
                </li>
              ))}
              {overdue.map((i) => (
                <li key={i.id}>
                  Past-due invoice {i.invoice_number} —{" "}
                  {money(Number(i.total) - Number(i.amount_paid))}
                </li>
              ))}
              {(disputes ?? []).map((d) => (
                <li key={d.id}>
                  Open dispute: {sanitizeDemoText(d.reason)} ({money(d.amount_disputed)})
                </li>
              ))}
            </ul>
            <Link href="/warnings" className="btn btn-warning btn-sm w-fit">
              View all alerts
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Track a shipment</h2>
            <p className="text-sm opacity-70">
              See status, timeline, and delivery details for your freight.
            </p>
            <Link href="/shipments" className="btn btn-primary btn-sm w-fit">
              My shipments
            </Link>
          </div>
        </div>
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Question a charge</h2>
            <p className="text-sm opacity-70">
              Open a billing dispute from an invoice if an accessorial or amount looks wrong.
            </p>
            <Link href="/invoices" className="btn btn-outline btn-sm w-fit">
              My invoices
            </Link>
          </div>
        </div>
        <div className="card bg-base-100 shadow-sm md:col-span-2">
          <div className="card-body">
            <h2 className="card-title text-base">Brokerage contact</h2>
            <p className="text-sm">
              RowanLane Support Desk ·{" "}
              <span className="font-mono">support@rowanlane.com</span> · (312) 555-0199
            </p>
            <p className="text-xs opacity-60">
              Support hours Mon–Fri 8am–6pm CT · tickets are routed to your account team.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
