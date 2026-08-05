import Link from "next/link";
import { requirePathAccess } from "@/lib/authz";
import { FilterBanner, resolveSearchParams } from "@/components/FilterBanner";
import { createSupportTicket } from "@/lib/actions/support";
import { createClient } from "@/lib/supabase/server";
import { sanitizeDemoText } from "@/lib/display-text";
import { isStaff, money, statusBadge } from "@/lib/types";

function ageLabel(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.max(0, Math.floor(ms / 3_600_000));
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default async function SupportPage({
  searchParams,
}: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const profile = await requirePathAccess("/support");
  const staff = isStaff(profile.role);
  const params = await resolveSearchParams(searchParams);
  const filter = typeof params.filter === "string" ? params.filter : staff ? "active" : "all";

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  let ticketQuery = supabase
    .from("support_tickets")
    .select(
      "id, ticket_number, subject, category, priority, status, created_at, updated_at, customer_id, carrier_id, customers(name), carriers(name)",
    )
    .order("updated_at", { ascending: false });

  if (!staff) {
    if (profile.role === "customer" && profile.customer_id) {
      ticketQuery = ticketQuery.eq("customer_id", profile.customer_id);
    } else if (profile.role === "carrier" && profile.carrier_id) {
      ticketQuery = ticketQuery.eq("carrier_id", profile.carrier_id);
    }
  }

  const { data: tickets } = await ticketQuery;
  const allTickets = tickets ?? [];

  const visibleTickets = staff
    ? filter === "resolved"
      ? allTickets.filter((t) => t.status === "resolved" || t.status === "closed")
      : allTickets.filter((t) => t.status === "open" || t.status === "pending")
    : allTickets;

  // Portal hub: open operational items (customer only has invoices/disputes context)
  let overdue: { id: string; invoice_number: string; total: number; amount_paid: number }[] = [];
  let delayed: { id: string; load_number: string }[] = [];
  let openDisputes: { id: string; reason: string; amount_disputed: number }[] = [];

  if (profile.role === "customer" && profile.customer_id) {
    const [{ data: invoices }, { data: disputes }, { data: shipments }] = await Promise.all([
      supabase
        .from("invoices")
        .select("id, invoice_number, status, total, amount_paid, due_date")
        .eq("customer_id", profile.customer_id)
        .order("due_date", { ascending: true }),
      supabase
        .from("disputes")
        .select("id, reason, amount_disputed, status")
        .eq("customer_id", profile.customer_id)
        .eq("status", "open"),
      supabase
        .from("shipments")
        .select("id, load_number, status, promised_delivery_date")
        .eq("customer_id", profile.customer_id)
        .not("status", "in", '("completed","cancelled")'),
    ]);
    overdue = (invoices ?? []).filter((i) => {
      const bal = Number(i.total) - Number(i.amount_paid);
      return bal > 0 && i.due_date < today && !["paid", "cancelled"].includes(i.status);
    });
    delayed = (shipments ?? []).filter(
      (s) =>
        s.promised_delivery_date &&
        s.promised_delivery_date < today &&
        !["delivered", "completed"].includes(s.status),
    );
    openDisputes = disputes ?? [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{staff ? "Support inbox" : "Support"}</h1>
        <p className="text-sm opacity-70">
          {staff
            ? "Customer and carrier tickets waiting on the account team."
            : "Help with shipments, invoices, and account questions."}
        </p>
      </div>

      {staff ? (
        <div className="flex flex-wrap gap-2">
          <Link
            href="/support?filter=active"
            className={`btn btn-sm ${filter !== "resolved" ? "btn-primary" : "btn-ghost"}`}
          >
            Open & pending
          </Link>
          <Link
            href="/support?filter=resolved"
            className={`btn btn-sm ${filter === "resolved" ? "btn-primary" : "btn-ghost"}`}
          >
            Resolved
          </Link>
        </div>
      ) : null}

      {staff && filter === "resolved" ? (
        <FilterBanner label="resolved / closed tickets" clearHref="/support?filter=active" />
      ) : null}

      {!staff ? (
        <div className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body gap-3">
            <h2 className="card-title text-base">Open a ticket</h2>
            <p className="text-sm opacity-70">
              {profile.role === "customer"
                ? "For invoice amount disputes, open a billing dispute from My invoices. Use tickets for everything else."
                : "Ask about POD uploads, delivery docs, or account questions — your account team will reply here."}
            </p>
            <form action={createSupportTicket} className="grid gap-3 md:grid-cols-2">
              <label className="form-control md:col-span-2">
                <span className="label-text text-sm">Subject</span>
                <input
                  name="subject"
                  required
                  maxLength={200}
                  className="input input-bordered input-sm"
                  placeholder="Short summary of your question"
                />
              </label>
              <label className="form-control">
                <span className="label-text text-sm">Category</span>
                <select name="category" className="select select-bordered select-sm" defaultValue="other">
                  <option value="shipment">Shipment</option>
                  <option value="billing">Billing question</option>
                  <option value="account">Account / portal</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="form-control">
                <span className="label-text text-sm">Priority</span>
                <select name="priority" className="select select-bordered select-sm" defaultValue="normal">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label className="form-control md:col-span-2">
                <span className="label-text text-sm">Message</span>
                <textarea
                  name="body"
                  required
                  maxLength={4000}
                  rows={4}
                  className="textarea textarea-bordered text-sm"
                  placeholder="Describe what you need help with"
                />
              </label>
              <button type="submit" className="btn btn-primary btn-sm w-fit">
                Submit ticket
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{staff ? "Tickets" : "My tickets"}</h2>
        {visibleTickets.length === 0 ? (
          <p className="text-sm opacity-70">
            {staff
              ? filter === "resolved"
                ? "No resolved tickets yet."
                : "No open or pending tickets."
              : "No tickets yet — open one above."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Subject</th>
                  <th>Category</th>
                  {staff ? <th>Requester</th> : null}
                  <th>Age</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleTickets.map((t) => {
                  const customerName = (t.customers as { name?: string } | null)?.name;
                  const carrierName = (t.carriers as { name?: string } | null)?.name;
                  const requester = customerName ?? carrierName ?? "—";
                  return (
                    <tr key={t.id} className="hover">
                      <td className="font-mono text-xs">
                        <Link className="link link-primary" href={`/support/${t.id}`}>
                          {t.ticket_number}
                        </Link>
                      </td>
                      <td>
                        <Link href={`/support/${t.id}`} className="link link-hover font-medium">
                          {sanitizeDemoText(t.subject)}
                        </Link>
                      </td>
                      <td className="capitalize">{t.category}</td>
                      {staff ? <td>{sanitizeDemoText(requester)}</td> : null}
                      <td className="tabular-nums opacity-70">{ageLabel(t.updated_at)}</td>
                      <td>
                        <span className={`badge badge-sm ${statusBadge(t.status)}`}>{t.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!staff && profile.role === "customer" ? (
        <>
          {(delayed.length > 0 || overdue.length > 0 || openDisputes.length > 0) && (
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
                  {openDisputes.map((d) => (
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
        </>
      ) : null}

      {!staff && profile.role === "carrier" ? (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Brokerage contact</h2>
            <p className="text-sm">
              RowanLane Support Desk ·{" "}
              <span className="font-mono">support@rowanlane.com</span> · (312) 555-0199
            </p>
            <p className="text-xs opacity-60">
              For POD and delivery questions, open a ticket above or use Documents on the load.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
