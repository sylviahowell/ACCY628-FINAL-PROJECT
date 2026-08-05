import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePathAccess } from "@/lib/authz";
import {
  addInternalNote,
  replySupportTicket,
  updateSupportTicketStatus,
} from "@/lib/actions/support";
import { createClient } from "@/lib/supabase/server";
import { sanitizeDemoText } from "@/lib/display-text";
import { isStaff, statusBadge } from "@/lib/types";

export default async function SupportTicketPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const profile = await requirePathAccess("/support");
  const { id } = await Promise.resolve(params);
  const staff = isStaff(profile.role);
  const supabase = await createClient();

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select(
      "*, customers(name), carriers(name), shipments(load_number), invoices(invoice_number)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!ticket) notFound();

  if (!staff) {
    const ok =
      (profile.role === "customer" && ticket.customer_id === profile.customer_id) ||
      (profile.role === "carrier" && ticket.carrier_id === profile.carrier_id);
    if (!ok) redirect("/support");
  }

  let messagesQuery = supabase
    .from("support_ticket_messages")
    .select("id, body, is_internal, created_at, author_id, profiles(full_name, role)")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  if (!staff) {
    messagesQuery = messagesQuery.eq("is_internal", false);
  }

  const [{ data: messages }, { data: assigneeRow }] = await Promise.all([
    messagesQuery,
    ticket.assigned_to
      ? supabase.from("profiles").select("full_name").eq("id", ticket.assigned_to).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const customerName = (ticket.customers as { name?: string } | null)?.name;
  const carrierName = (ticket.carriers as { name?: string } | null)?.name;
  const loadNumber = (ticket.shipments as { load_number?: string } | null)?.load_number;
  const invoiceNumber = (ticket.invoices as { invoice_number?: string } | null)?.invoice_number;
  const assignee = assigneeRow?.full_name;
  const closed = ticket.status === "resolved" || ticket.status === "closed";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/support" className="link link-hover text-sm opacity-70">
            ← Back to Support
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{sanitizeDemoText(ticket.subject)}</h1>
          <p className="mt-1 text-sm opacity-70">
            <span className="font-mono">{ticket.ticket_number}</span>
            {" · "}
            <span className="capitalize">{ticket.category}</span>
            {" · "}
            <span className="capitalize">{ticket.priority}</span> priority
            {customerName ? ` · ${sanitizeDemoText(customerName)}` : null}
            {carrierName ? ` · ${sanitizeDemoText(carrierName)}` : null}
          </p>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {loadNumber && ticket.shipment_id ? (
              <Link className="link link-primary" href={`/shipments/${ticket.shipment_id}`}>
                Load {loadNumber}
              </Link>
            ) : null}
            {invoiceNumber && ticket.invoice_id ? (
              <Link className="link link-primary" href="/invoices">
                Invoice {invoiceNumber}
              </Link>
            ) : null}
            {assignee ? <span className="opacity-70">Assigned: {assignee}</span> : null}
          </p>
        </div>
        <span className={`badge ${statusBadge(ticket.status)}`}>{ticket.status}</span>
      </div>

      {staff ? (
        <div className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body gap-3 py-4">
            <h2 className="card-title text-base">Update status</h2>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["pending", "Mark pending"],
                  ["resolved", "Resolve"],
                  ["closed", "Close"],
                  ["open", "Reopen"],
                ] as const
              ).map(([status, label]) => (
                <form key={status} action={updateSupportTicketStatus}>
                  <input type="hidden" name="ticket_id" value={ticket.id} />
                  <input type="hidden" name="status" value={status} />
                  <input type="hidden" name="assign_self" value="true" />
                  <button
                    type="submit"
                    className={`btn btn-sm ${ticket.status === status ? "btn-primary" : "btn-outline"}`}
                    disabled={ticket.status === status}
                  >
                    {label}
                  </button>
                </form>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Conversation</h2>
        {(messages ?? []).length === 0 ? (
          <p className="text-sm opacity-70">No messages yet.</p>
        ) : (
          <ul className="space-y-3">
            {(messages ?? []).map((m) => {
              const author = m.profiles as { full_name?: string; role?: string } | null;
              // Portals cannot SELECT other profiles (RLS) — fall back so staff replies aren't "User".
              const authorName =
                author?.full_name ??
                (m.author_id === profile.id ? profile.full_name : "RowanLane Support");
              const authorRole =
                author?.role ?? (m.author_id === profile.id ? profile.role : "staff");
              return (
                <li
                  key={m.id}
                  className={`rounded-box border px-4 py-3 ${
                    m.is_internal
                      ? "border-warning/40 bg-warning/10"
                      : "border-base-300 bg-base-100"
                  }`}
                >
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-xs opacity-70">
                    <span>
                      {authorName}
                      {authorRole ? ` · ${authorRole}` : ""}
                      {m.is_internal ? " · internal note" : ""}
                    </span>
                    <span suppressHydrationWarning>
                      {new Date(m.created_at).toLocaleString("en-US", { timeZone: "UTC" })} UTC
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{sanitizeDemoText(m.body)}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!closed || staff ? (
        <div className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body gap-3">
            <h2 className="card-title text-base">{staff ? "Reply to requester" : "Reply"}</h2>
            <form action={replySupportTicket} className="space-y-3">
              <input type="hidden" name="ticket_id" value={ticket.id} />
              <textarea
                name="body"
                required
                maxLength={4000}
                rows={4}
                className="textarea textarea-bordered w-full text-sm"
                placeholder={staff ? "Visible to the requester…" : "Add more detail…"}
              />
              <button type="submit" className="btn btn-primary btn-sm">
                Send reply
              </button>
            </form>
          </div>
        </div>
      ) : (
        <p className="text-sm opacity-70">
          This ticket is {ticket.status}. Open a new ticket from Support if you still need help.
        </p>
      )}

      {staff ? (
        <div className="card border border-warning/30 bg-base-100 shadow-sm">
          <div className="card-body gap-3">
            <h2 className="card-title text-base">Internal note</h2>
            <p className="text-sm opacity-70">Only visible to manager, broker, and billing.</p>
            <form action={addInternalNote} className="space-y-3">
              <input type="hidden" name="ticket_id" value={ticket.id} />
              <textarea
                name="body"
                required
                maxLength={4000}
                rows={3}
                className="textarea textarea-bordered w-full text-sm"
                placeholder="Staff-only note…"
              />
              <button type="submit" className="btn btn-warning btn-outline btn-sm">
                Add note
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
