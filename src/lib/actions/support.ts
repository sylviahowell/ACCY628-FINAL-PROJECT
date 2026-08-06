"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/actions/auth";
import { formString, nonEmptyString, parseForm, uuidSchema } from "@/lib/action-schema";
import { createClient } from "@/lib/supabase/server";
import { isStaff } from "@/lib/types";
import { z } from "zod";

function toastPath(path: string, message: string) {
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}toast=${encodeURIComponent(message)}`;
}

function toastErrorPath(path: string, message: string) {
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}toastError=${encodeURIComponent(message)}`;
}

const categorySchema = z.enum(["shipment", "billing", "account", "other"]);
const prioritySchema = z.enum(["low", "normal", "high"]);
const statusSchema = z.enum(["open", "pending", "resolved", "closed"]);

async function nextTicketNumber(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from("support_tickets")
    .select("ticket_number")
    .like("ticket_number", "TKT-%")
    .order("ticket_number", { ascending: false })
    .limit(40);
  let max = 1000;
  for (const row of data ?? []) {
    const n = Number(String(row.ticket_number).replace(/^TKT-/, ""));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `TKT-${max + 1}`;
}

function revalidateSupport(ticketId?: string) {
  revalidatePath("/support");
  if (ticketId) revalidatePath(`/support/${ticketId}`);
}

export async function createSupportTicket(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "customer" && profile.role !== "carrier")) {
    throw new Error("Only shipper or carrier accounts can open support tickets.");
  }
  if (profile.role === "customer" && !profile.customer_id) {
    throw new Error("No customer account linked to this profile.");
  }
  if (profile.role === "carrier" && !profile.carrier_id) {
    throw new Error("No carrier account linked to this profile.");
  }

  const input = parseForm(
    z.object({
      subject: nonEmptyString("Subject", 200),
      body: nonEmptyString("Message", 4000),
      category: categorySchema,
      priority: prioritySchema.default("normal"),
    }),
    {
      subject: formString(formData, "subject"),
      body: formString(formData, "body"),
      category: formString(formData, "category") || "other",
      priority: formString(formData, "priority") || "normal",
    },
  );

  const shipmentRaw = formString(formData, "shipment_id");
  const invoiceRaw = formString(formData, "invoice_id");
  const shipmentId = shipmentRaw
    ? parseForm(z.object({ id: uuidSchema }), { id: shipmentRaw }).id
    : null;
  const invoiceId = invoiceRaw
    ? parseForm(z.object({ id: uuidSchema }), { id: invoiceRaw }).id
    : null;

  const supabase = await createClient();

  if (shipmentId && profile.role === "customer") {
    const { data: ship } = await supabase
      .from("shipments")
      .select("id, customer_id")
      .eq("id", shipmentId)
      .maybeSingle();
    if (!ship || ship.customer_id !== profile.customer_id) {
      redirect(toastErrorPath("/support", "That shipment is not on your account."));
    }
  }
  if (shipmentId && profile.role === "carrier") {
    const { data: ship } = await supabase
      .from("shipments")
      .select("id, carrier_id")
      .eq("id", shipmentId)
      .maybeSingle();
    if (!ship || ship.carrier_id !== profile.carrier_id) {
      redirect(toastErrorPath("/support", "That shipment is not on your account."));
    }
  }
  if (invoiceId && profile.role === "customer") {
    const { data: inv } = await supabase
      .from("invoices")
      .select("id, customer_id")
      .eq("id", invoiceId)
      .maybeSingle();
    if (!inv || inv.customer_id !== profile.customer_id) {
      redirect(toastErrorPath("/support", "That invoice is not on your account."));
    }
  }

  const ticketNumber = await nextTicketNumber(supabase);
  const now = new Date().toISOString();
  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .insert({
      ticket_number: ticketNumber,
      created_by: profile.id,
      customer_id: profile.role === "customer" ? profile.customer_id : null,
      carrier_id: profile.role === "carrier" ? profile.carrier_id : null,
      subject: input.subject,
      category: input.category,
      priority: input.priority,
      status: "open",
      shipment_id: shipmentId,
      invoice_id: profile.role === "customer" ? invoiceId : null,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (error || !ticket) {
    redirect(toastErrorPath("/support", error?.message ?? "Could not create ticket."));
  }

  const { error: msgErr } = await supabase.from("support_ticket_messages").insert({
    ticket_id: ticket.id,
    author_id: profile.id,
    body: input.body,
    is_internal: false,
  });
  if (msgErr) {
    redirect(toastErrorPath(`/support/${ticket.id}`, msgErr.message));
  }

  revalidateSupport(ticket.id);
  redirect(toastPath(`/support/${ticket.id}`, `Ticket ${ticketNumber} opened`));
}

export async function replySupportTicket(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in required.");

  const ticketId = parseForm(z.object({ id: uuidSchema }), {
    id: formString(formData, "ticket_id"),
  }).id;
  const body = parseForm(z.object({ body: nonEmptyString("Reply", 4000) }), {
    body: formString(formData, "body"),
  }).body;

  const supabase = await createClient();
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, status, customer_id, carrier_id")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) {
    redirect(toastErrorPath("/support", "Ticket not found."));
  }

  const staff = isStaff(profile.role);
  if (!staff) {
    const ok =
      (profile.role === "customer" && ticket.customer_id === profile.customer_id) ||
      (profile.role === "carrier" && ticket.carrier_id === profile.carrier_id);
    if (!ok) redirect(toastErrorPath("/support", "Ticket not found."));
  }
  if (["resolved", "closed"].includes(ticket.status) && !staff) {
    redirect(
      toastErrorPath(`/support/${ticketId}`, "This ticket is closed. Open a new ticket if needed."),
    );
  }

  const { error } = await supabase.from("support_ticket_messages").insert({
    ticket_id: ticketId,
    author_id: profile.id,
    body,
    is_internal: false,
  });
  if (error) redirect(toastErrorPath(`/support/${ticketId}`, error.message));

  const now = new Date().toISOString();
  if (!staff) {
    // Portal reply: reopen / return to open so staff sees it in the queue
    await supabase
      .from("support_tickets")
      .update({
        status: "open",
        updated_at: now,
        resolved_at: null,
        resolved_by: null,
      })
      .eq("id", ticketId);
  } else if (ticket.status === "open") {
    await supabase
      .from("support_tickets")
      .update({
        status: "pending",
        assigned_to: profile.id,
        updated_at: now,
      })
      .eq("id", ticketId);
  } else {
    await supabase
      .from("support_tickets")
      .update({
        assigned_to: profile.id,
        updated_at: now,
      })
      .eq("id", ticketId);
  }

  revalidateSupport(ticketId);
  redirect(toastPath(`/support/${ticketId}`, "Reply sent"));
}

export async function addInternalNote(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) {
    throw new Error("Only staff can add internal notes.");
  }

  const ticketId = parseForm(z.object({ id: uuidSchema }), {
    id: formString(formData, "ticket_id"),
  }).id;
  const body = parseForm(z.object({ body: nonEmptyString("Note", 4000) }), {
    body: formString(formData, "body"),
  }).body;

  const supabase = await createClient();
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) redirect(toastErrorPath("/support", "Ticket not found."));

  const { error } = await supabase.from("support_ticket_messages").insert({
    ticket_id: ticketId,
    author_id: profile.id,
    body,
    is_internal: true,
  });
  if (error) redirect(toastErrorPath(`/support/${ticketId}`, error.message));

  await supabase
    .from("support_tickets")
    .update({
      assigned_to: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId);

  revalidateSupport(ticketId);
  redirect(toastPath(`/support/${ticketId}`, "Internal note added"));
}

export async function updateSupportTicketStatus(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) {
    throw new Error("Only staff can update ticket status.");
  }

  const ticketId = parseForm(z.object({ id: uuidSchema }), {
    id: formString(formData, "ticket_id"),
  }).id;
  const status = parseForm(z.object({ status: statusSchema }), {
    status: formString(formData, "status"),
  }).status;
  const assignSelf = formData.get("assign_self") === "on" || formData.get("assign_self") === "true";

  const supabase = await createClient();
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) redirect(toastErrorPath("/support", "Ticket not found."));

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status,
    updated_at: now,
  };
  if (assignSelf) patch.assigned_to = profile.id;
  if (status === "resolved" || status === "closed") {
    patch.resolved_by = profile.id;
    patch.resolved_at = now;
    if (!assignSelf) patch.assigned_to = profile.id;
  } else {
    patch.resolved_by = null;
    patch.resolved_at = null;
  }

  const { error } = await supabase.from("support_tickets").update(patch).eq("id", ticketId);
  if (error) redirect(toastErrorPath(`/support/${ticketId}`, error.message));

  revalidateSupport(ticketId);
  redirect(toastPath(`/support/${ticketId}`, `Ticket marked ${status}`));
}
