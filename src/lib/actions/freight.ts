"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/actions/auth";

export async function createLoad(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !["manager", "broker"].includes(profile.role)) {
    return { error: "Only brokers or managers can create loads." };
  }

  const supabase = await createClient();
  const loadNumber = String(formData.get("load_number") || "").trim();
  const customerId = String(formData.get("customer_id") || "");
  const carrierId = String(formData.get("carrier_id") || "") || null;
  const contractId = String(formData.get("contract_id") || "") || null;
  const originCity = String(formData.get("origin_city") || "").trim();
  const originState = String(formData.get("origin_state") || "").trim();
  const destCity = String(formData.get("dest_city") || "").trim();
  const destState = String(formData.get("dest_state") || "").trim();
  const customerRate = Number(formData.get("customer_rate") || 0);
  const carrierCost = Number(formData.get("carrier_cost") || 0);
  const pickupDate = String(formData.get("pickup_date") || "") || null;
  const promised = String(formData.get("promised_delivery_date") || "") || null;

  const { data, error } = await supabase
    .from("shipments")
    .insert({
      load_number: loadNumber,
      customer_id: customerId,
      carrier_id: carrierId,
      contract_id: contractId,
      status: carrierId ? "booked" : "draft",
      origin_city: originCity,
      origin_state: originState,
      dest_city: destCity,
      dest_state: destState,
      customer_rate: customerRate,
      carrier_cost: carrierCost,
      pickup_date: pickupDate,
      promised_delivery_date: promised,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await supabase.from("status_events").insert({
    entity_type: "shipment",
    entity_id: data.id,
    from_status: null,
    to_status: carrierId ? "booked" : "draft",
    changed_by: profile.id,
    note: "Load created",
  });

  revalidatePath("/workspace");
  revalidatePath("/workspace/loads");
  return { success: true, id: data.id };
}

export async function markInTransit(shipmentId: string, _formData?: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !["manager", "broker", "carrier"].includes(profile.role)) {
    throw new Error("Not allowed.");
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("shipments")
    .select("status")
    .eq("id", shipmentId)
    .single();

  const { error } = await supabase
    .from("shipments")
    .update({ status: "in_transit" })
    .eq("id", shipmentId);

  if (error) throw new Error(error.message);

  await supabase.from("status_events").insert({
    entity_type: "shipment",
    entity_id: shipmentId,
    from_status: existing?.status ?? null,
    to_status: "in_transit",
    changed_by: profile.id,
    note: "Marked in transit",
  });

  revalidatePath("/workspace");
  revalidatePath(`/workspace/loads/${shipmentId}`);
}

export async function confirmDelivery(shipmentId: string, _formData?: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !["manager", "broker", "carrier"].includes(profile.role)) {
    throw new Error("Not allowed to confirm delivery.");
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("shipments")
    .select("status")
    .eq("id", shipmentId)
    .single();

  const { error } = await supabase
    .from("shipments")
    .update({
      status: "delivered",
      delivered_at: new Date().toISOString(),
      delivered_by: profile.id,
      delivery_date: new Date().toISOString().slice(0, 10),
    })
    .eq("id", shipmentId);

  if (error) throw new Error(error.message);

  await supabase.from("status_events").insert({
    entity_type: "shipment",
    entity_id: shipmentId,
    from_status: existing?.status ?? null,
    to_status: "delivered",
    changed_by: profile.id,
    note: "Proof of delivery confirmed",
  });

  revalidatePath("/workspace");
  revalidatePath(`/workspace/loads/${shipmentId}`);
}

export async function addAccessorial(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !["manager", "broker", "billing", "carrier"].includes(profile.role)) {
    throw new Error("Not allowed.");
  }

  const supabase = await createClient();
  const shipmentId = String(formData.get("shipment_id") || "");
  const description = String(formData.get("description") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  const billable = formData.get("billable_to_customer") === "on";
  const payable = formData.get("payable_to_carrier") === "on";

  const { error } = await supabase.from("shipment_charges").insert({
    shipment_id: shipmentId,
    charge_type: "accessorial",
    description,
    amount,
    billable_to_customer: billable,
    payable_to_carrier: payable,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/workspace/loads/${shipmentId}`);
}

export async function generateInvoice(shipmentId: string, _formData?: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !["manager", "billing", "broker"].includes(profile.role)) {
    throw new Error("Only billing, brokers, or managers can invoice.");
  }

  const supabase = await createClient();
  const { data: shipment, error: shipError } = await supabase
    .from("shipments")
    .select("id, customer_id, customer_rate, status, load_number")
    .eq("id", shipmentId)
    .single();

  if (shipError || !shipment) throw new Error(shipError?.message ?? "Shipment not found");
  if (shipment.status !== "delivered") {
    throw new Error("Invoice only after delivery (revenue earned / POD evidence).");
  }

  const { data: existing } = await supabase
    .from("invoices")
    .select("id")
    .eq("shipment_id", shipmentId)
    .neq("status", "cancelled")
    .limit(1);

  if (existing && existing.length > 0) {
    throw new Error("An open invoice already exists for this shipment.");
  }

  const { data: charges } = await supabase
    .from("shipment_charges")
    .select("amount, billable_to_customer")
    .eq("shipment_id", shipmentId);

  const accessorials = (charges ?? [])
    .filter((c) => c.billable_to_customer)
    .reduce((sum, c) => sum + Number(c.amount), 0);
  const total = Number(shipment.customer_rate) + accessorials;
  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
  const due = new Date();
  due.setDate(due.getDate() + 30);

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      invoice_number: invoiceNumber,
      customer_id: shipment.customer_id,
      shipment_id: shipment.id,
      status: "sent",
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: due.toISOString().slice(0, 10),
      subtotal: total,
      total,
      amount_paid: 0,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("status_events").insert({
    entity_type: "invoice",
    entity_id: invoice.id,
    from_status: null,
    to_status: "sent",
    changed_by: profile.id,
    note: `Billed ${shipment.load_number} after delivery confirmation`,
  });

  revalidatePath("/workspace");
  revalidatePath("/workspace/billing");
  revalidatePath(`/workspace/loads/${shipmentId}`);
}

export async function recordPayment(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !["manager", "billing"].includes(profile.role)) {
    throw new Error("Only billing or managers can record payments.");
  }

  const supabase = await createClient();
  const invoiceId = String(formData.get("invoice_id") || "");
  const amount = Number(formData.get("amount") || 0);
  const reference = String(formData.get("reference") || "").trim();

  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  if (invError || !invoice) throw new Error(invError?.message ?? "Invoice not found");
  if (invoice.status === "disputed") {
    throw new Error(
      "Cannot mark paid in full while a dispute is open — resolve dispute first.",
    );
  }

  const { error: payError } = await supabase.from("payments").insert({
    invoice_id: invoiceId,
    amount,
    method: "ach_simulated",
    reference: reference || null,
    recorded_by: profile.id,
  });

  if (payError) throw new Error(payError.message);

  const newPaid = Number(invoice.amount_paid) + amount;
  let status = invoice.status;
  if (newPaid >= Number(invoice.total)) status = "paid";
  else if (newPaid > 0) status = "partial";

  await supabase
    .from("invoices")
    .update({ amount_paid: newPaid, status })
    .eq("id", invoiceId);

  await supabase.from("status_events").insert({
    entity_type: "invoice",
    entity_id: invoiceId,
    from_status: invoice.status,
    to_status: status,
    changed_by: profile.id,
    note: `Payment recorded: ${amount}`,
  });

  revalidatePath("/workspace/billing");
}

export async function openDispute(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !["customer", "billing", "manager"].includes(profile.role)) {
    throw new Error("Not allowed.");
  }

  const supabase = await createClient();
  const invoiceId = String(formData.get("invoice_id") || "") || null;
  const shipmentId = String(formData.get("shipment_id") || "") || null;
  const reason = String(formData.get("reason") || "").trim();
  const amount = Number(formData.get("amount_disputed") || 0);

  const { error } = await supabase.from("disputes").insert({
    invoice_id: invoiceId,
    shipment_id: shipmentId,
    reason,
    amount_disputed: amount,
    opened_by: profile.id,
    status: "open",
  });

  if (error) throw new Error(error.message);

  if (invoiceId) {
    await supabase
      .from("invoices")
      .update({ status: "disputed" })
      .eq("id", invoiceId);
  }

  revalidatePath("/workspace/billing");
  revalidatePath("/workspace");
}
