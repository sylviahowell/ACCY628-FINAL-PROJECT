"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/actions/auth";
import { isOperations, type ShipmentStatus } from "@/lib/types";
import { canManageBilling } from "@/lib/roles";
import {
  dueDateFromTerms,
  fuelSurchargeAmount,
  isDateOutsideContractWindow,
} from "@/lib/contract-terms";

function toastPath(path: string, message: string) {
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}toast=${encodeURIComponent(message)}`;
}
async function logStatus(
  shipmentId: string,
  fromStatus: string | null,
  toStatus: string,
  profileId: string,
  note?: string,
) {
  const supabase = await createClient();
  await supabase.from("shipment_status_updates").insert({
    shipment_id: shipmentId,
    from_status: fromStatus,
    to_status: toStatus,
    changed_by: profileId,
    note: note ?? null,
  });
  await supabase.from("status_events").insert({
    entity_type: "shipment",
    entity_id: shipmentId,
    from_status: fromStatus,
    to_status: toStatus,
    changed_by: profileId,
    note: note ?? null,
  });
}

export async function createCustomer(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !isOperations(profile.role)) throw new Error("Only operations staff can create customers.");
  const supabase = await createClient();
  const { error } = await supabase.from("customers").insert({
    name: String(formData.get("name") || "").trim(),
    contact_name: String(formData.get("contact_name") || "").trim() || null,
    contact_email: String(formData.get("contact_email") || "").trim() || null,
    contact_phone: String(formData.get("contact_phone") || "").trim() || null,
    billing_address: String(formData.get("billing_address") || "").trim() || null,
    shipping_address: String(formData.get("shipping_address") || "").trim() || null,
    payment_terms: String(formData.get("payment_terms") || "Net 30").trim(),
    credit_limit: Number(formData.get("credit_limit") || 50000),
    notes: String(formData.get("notes") || "").trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/customers");
}

export async function createCarrier(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !isOperations(profile.role)) throw new Error("Only operations staff can create carriers.");
  const supabase = await createClient();
  const { error } = await supabase.from("carriers").insert({
    name: String(formData.get("name") || "").trim(),
    dot_number: String(formData.get("dot_number") || "").trim() || null,
    mc_number: String(formData.get("mc_number") || "").trim() || null,
    contact_name: String(formData.get("contact_name") || "").trim() || null,
    contact_email: String(formData.get("contact_email") || "").trim() || null,
    contact_phone: String(formData.get("contact_phone") || "").trim() || null,
    insurance_expiration: String(formData.get("insurance_expiration") || "") || null,
    equipment_type: String(formData.get("equipment_type") || "").trim() || null,
    service_area: String(formData.get("service_area") || "").trim() || null,
    rating: Number(formData.get("rating") || 4),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/carriers");
}

export async function createContract(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !isOperations(profile.role)) throw new Error("Only operations staff can create contracts.");
  const supabase = await createClient();
  const { error } = await supabase.from("contracts").insert({
    contract_number: String(formData.get("contract_number") || "").trim(),
    customer_id: String(formData.get("customer_id") || ""),
    title: String(formData.get("title") || "").trim(),
    start_date: String(formData.get("start_date") || ""),
    end_date: String(formData.get("end_date") || "") || null,
    billing_terms: String(formData.get("payment_terms") || "Net 30"),
    payment_terms: String(formData.get("payment_terms") || "Net 30"),
    fuel_surcharge_pct: Number(formData.get("fuel_surcharge_pct") || 0),
    shipping_rates: String(formData.get("shipping_rates") || "").trim() || null,
    renewal_option: formData.get("renewal_option") === "on",
    notes: String(formData.get("notes") || "").trim() || null,
    status: "active",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/contracts");
}

export async function terminateContract(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !isOperations(profile.role)) {
    throw new Error("Only operations staff can terminate contracts.");
  }
  const id = String(formData.get("contract_id") || "");
  const supabase = await createClient();
  const { error } = await supabase
    .from("contracts")
    .update({ status: "terminated" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/contracts");
  revalidatePath("/shipments/new");
}

export async function markContractExpired(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !isOperations(profile.role)) {
    throw new Error("Only operations staff can expire contracts.");
  }
  const id = String(formData.get("contract_id") || "");
  const supabase = await createClient();
  const { error } = await supabase
    .from("contracts")
    .update({ status: "expired" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/contracts");
  revalidatePath("/shipments/new");
}

/** Extend end date by 12 months when the contract has a renewal option. */
export async function renewContract(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !isOperations(profile.role)) {
    throw new Error("Only operations staff can renew contracts.");
  }
  const id = String(formData.get("contract_id") || "");
  const supabase = await createClient();
  const { data: contract } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", id)
    .single();
  if (!contract) throw new Error("Contract not found");
  if (!contract.renewal_option) {
    throw new Error("This contract has no renewal option.");
  }

  const base = contract.end_date
    ? new Date(contract.end_date + "T00:00:00Z")
    : new Date();
  base.setUTCFullYear(base.getUTCFullYear() + 1);
  const newEnd = base.toISOString().slice(0, 10);

  const { error } = await supabase
    .from("contracts")
    .update({
      end_date: newEnd,
      status: "active",
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/contracts");
  revalidatePath("/shipments/new");
}

export async function createShipment(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !isOperations(profile.role)) throw new Error("Only operations staff can create shipments.");

  const carrierId = String(formData.get("carrier_id") || "") || null;
  const customerId = String(formData.get("customer_id") || "");
  const contractId = String(formData.get("contract_id") || "") || null;
  const customerRate = Number(formData.get("customer_rate") || 0);
  const carrierCost = Number(formData.get("carrier_cost") || 0);
  const discount = Number(formData.get("discount_amount") || 0);
  const pickupDate = String(formData.get("pickup_date") || "") || null;
  const deliveryDate = String(formData.get("delivery_date") || "") || null;

  const pickup = String(formData.get("pickup_location") || "").trim();
  const delivery = String(formData.get("delivery_location") || "").trim();
  const [originCity = pickup, originState = ""] = pickup.split(",").map((s) => s.trim());
  const [destCity = delivery, destState = ""] = delivery.split(",").map((s) => s.trim());

  const status: ShipmentStatus = carrierId ? "assigned" : "scheduled";
  const supabase = await createClient();

  // Credit limit control: open AR + this rate cannot exceed customer credit
  const { data: customer } = await supabase
    .from("customers")
    .select("id, credit_limit, payment_terms, name")
    .eq("id", customerId)
    .single();
  if (!customer) throw new Error("Customer not found");

  const { data: openInvoices } = await supabase
    .from("invoices")
    .select("total, amount_paid, status")
    .eq("customer_id", customerId)
    .neq("status", "cancelled");
  const openAr = (openInvoices ?? []).reduce((sum, inv) => {
    if (["paid", "cancelled"].includes(inv.status)) return sum;
    return sum + Math.max(0, Number(inv.total) - Number(inv.amount_paid));
  }, 0);
  const creditLimit = Number(customer.credit_limit ?? 0);
  const projected = openAr + customerRate;
  if (creditLimit > 0 && projected > creditLimit) {
    if (profile.role !== "manager") {
      throw new Error(
        `Credit limit exceeded for ${customer.name}: open AR ${openAr.toFixed(0)} + rate ${customerRate.toFixed(0)} > limit ${creditLimit.toFixed(0)}. Ask a manager to book this load.`,
      );
    }
  }

  if (contractId) {
    const { data: contract } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", contractId)
      .single();
    if (!contract) throw new Error("Contract not found");
    if (contract.status !== "active") {
      throw new Error("Only active contracts can be used on new shipments.");
    }
    if (contract.customer_id !== customerId) {
      throw new Error("Selected contract does not belong to this customer.");
    }
    const outside =
      isDateOutsideContractWindow(pickupDate, contract.start_date, contract.end_date) ||
      isDateOutsideContractWindow(deliveryDate, contract.start_date, contract.end_date);
    if (outside && formData.get("confirm_outside_contract_dates") !== "on") {
      throw new Error(
        "Pickup/delivery is outside the contract window. Confirm the override on the form, or adjust dates.",
      );
    }
  }

  const { data, error } = await supabase
    .from("shipments")
    .insert({
      load_number: String(formData.get("load_number") || "").trim(),
      customer_id: customerId,
      carrier_id: carrierId,
      contract_id: contractId,
      status,
      pickup_location: pickup,
      delivery_location: delivery,
      origin_city: originCity || "TBD",
      origin_state: originState || "NA",
      dest_city: destCity || "TBD",
      dest_state: destState || "NA",
      pickup_date: pickupDate,
      delivery_date: deliveryDate,
      promised_delivery_date: deliveryDate,
      freight_type: String(formData.get("freight_type") || "").trim() || null,
      weight_lbs: Number(formData.get("weight_lbs") || 0) || null,
      customer_rate: customerRate,
      carrier_cost: carrierCost,
      discount_amount: discount,
      discount_approved: discount === 0 || profile.role === "manager",
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (discount > 0 && profile.role !== "manager") {
    await supabase.from("approval_requests").insert({
      entity_type: "shipment",
      entity_id: data.id,
      request_type: "discount",
      amount: discount,
      reason: "Shipment discount requires manager approval",
      requested_by: profile.id,
      status: "pending",
    });
  }

  if (creditLimit > 0 && projected > creditLimit && profile.role === "manager") {
    await logStatus(
      data.id,
      null,
      status,
      profile.id,
      `Credit override: AR ${openAr.toFixed(0)} + rate ${customerRate.toFixed(0)} > limit ${creditLimit.toFixed(0)}`,
    );
  } else {
    await logStatus(data.id, null, status, profile.id, "Shipment created");
  }

  revalidatePath("/shipments");
  revalidatePath("/dashboard");
  return data.id as string;
}

/** Assign or reassign a carrier on an existing load (ops only). */
export async function assignCarrier(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !isOperations(profile.role)) {
    throw new Error("Only operations staff can assign carriers.");
  }

  const shipmentId = String(formData.get("shipment_id") || "");
  const carrierId = String(formData.get("carrier_id") || "") || null;
  const carrierCostRaw = String(formData.get("carrier_cost") || "").trim();
  const supabase = await createClient();

  const { data: shipment } = await supabase
    .from("shipments")
    .select("id, status, carrier_id, carrier_cost")
    .eq("id", shipmentId)
    .single();
  if (!shipment) throw new Error("Shipment not found");
  if (["delivered", "completed", "cancelled"].includes(shipment.status)) {
    throw new Error("Cannot reassign a delivered, completed, or cancelled load.");
  }

  const patch: {
    carrier_id: string | null;
    status?: string;
    carrier_cost?: number;
  } = { carrier_id: carrierId };

  if (carrierCostRaw !== "") {
    patch.carrier_cost = Number(carrierCostRaw);
  }

  if (carrierId && ["draft", "scheduled"].includes(shipment.status)) {
    patch.status = "assigned";
  }
  if (!carrierId && shipment.status === "assigned") {
    patch.status = "scheduled";
  }

  const { error } = await supabase.from("shipments").update(patch).eq("id", shipmentId);
  if (error) throw new Error(error.message);

  if (carrierId && patch.status === "assigned" && shipment.status !== "assigned") {
    await logStatus(shipmentId, shipment.status, "assigned", profile.id, "Carrier assigned");
  } else if (!carrierId && patch.status === "scheduled") {
    await logStatus(shipmentId, shipment.status, "scheduled", profile.id, "Carrier unassigned");
  }

  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath("/shipments");
  revalidatePath("/dashboard");
}

export async function updateShipmentStatus(shipmentId: string, toStatus: ShipmentStatus) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Not signed in");

  const supabase = await createClient();
  const { data: shipment } = await supabase
    .from("shipments")
    .select("*")
    .eq("id", shipmentId)
    .single();
  if (!shipment) throw new Error("Shipment not found");

  if (profile.role === "carrier" && shipment.carrier_id !== profile.carrier_id) {
    throw new Error("Carriers can only update their assigned loads.");
  }
  if (profile.role === "customer") throw new Error("Customers cannot change shipment status.");

  if (toStatus === "completed" && !shipment.carrier_id) {
    throw new Error("Cannot complete a shipment without an assigned carrier.");
  }
  if (toStatus === "completed") {
    const { data: pods } = await supabase
      .from("proof_of_delivery")
      .select("id")
      .eq("shipment_id", shipmentId)
      .limit(1);
    if (!pods?.length) {
      throw new Error("Proof of delivery is required before completing a shipment.");
    }
  }

  const patch: Record<string, unknown> = { status: toStatus };
  if (toStatus === "delivered" || toStatus === "completed") {
    patch.delivered_at = new Date().toISOString();
    patch.delivered_by = profile.id;
    patch.delivery_date = new Date().toISOString().slice(0, 10);
  }

  const { error } = await supabase.from("shipments").update(patch).eq("id", shipmentId);
  if (error) throw new Error(error.message);

  await logStatus(shipmentId, shipment.status, toStatus, profile.id);
  revalidatePath("/shipments");
  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath("/dashboard");
}

export async function uploadPod(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !["carrier", "manager", "broker"].includes(profile.role)) {
    throw new Error("Not allowed to upload POD.");
  }
  const shipmentId = String(formData.get("shipment_id") || "");
  const supabase = await createClient();
  const { error } = await supabase.from("proof_of_delivery").insert({
    shipment_id: shipmentId,
    uploaded_by: profile.id,
    file_url:
      String(formData.get("file_url") || "").trim() ||
      "https://docs.freightflow.com/pod/signed-bol.pdf",
    notes: String(formData.get("notes") || "").trim() || null,
    signed_by: String(formData.get("signed_by") || "").trim() || null,
    delivered_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);

  await updateShipmentStatus(shipmentId, "delivered");
  revalidatePath("/", "layout");
  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath("/shipments");
  revalidatePath("/invoices");
  revalidatePath("/documents");
  revalidatePath("/dashboard");
  // Query param forces a real navigation so the POD card refreshes after same-route action.
  redirect(toastPath(`/shipments/${shipmentId}?pod=1`, "Proof of delivery saved"));
}

export async function requestAccessorial(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Not signed in");

  const shipmentId = String(formData.get("shipment_id") || "");
  const amount = Number(formData.get("amount") || 0);
  const description = String(formData.get("description") || "").trim();
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("app_settings")
    .select("accessorial_approval_threshold")
    .eq("id", 1)
    .maybeSingle();
  const threshold = Number(settings?.accessorial_approval_threshold ?? 250);
  const needsApproval = amount > threshold && profile.role !== "manager";

  const { data: charge, error } = await supabase
    .from("shipment_charges")
    .insert({
      shipment_id: shipmentId,
      charge_type: "accessorial",
      description,
      amount,
      billable_to_customer: true,
      payable_to_carrier: formData.get("payable_to_carrier") === "on",
      approval_status: needsApproval ? "pending" : "approved",
      requested_by: profile.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (needsApproval) {
    await supabase.from("approval_requests").insert({
      entity_type: "shipment_charge",
      entity_id: charge.id,
      request_type: "accessorial",
      amount,
      reason: description,
      requested_by: profile.id,
      status: "pending",
    });
  }

  revalidatePath(`/shipments/${shipmentId}`);
}

export async function generateInvoice(shipmentId: string, _formData?: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !canManageBilling(profile.role)) {
    throw new Error("Only billing or managers can generate invoices.");
  }

  const supabase = await createClient();
  const { data: shipment } = await supabase
    .from("shipments")
    .select("*")
    .eq("id", shipmentId)
    .single();
  if (!shipment) throw new Error("Shipment not found");
  if (shipment.status === "cancelled") {
    throw new Error("Cannot invoice a cancelled shipment.");
  }
  if (!["delivered", "completed"].includes(shipment.status)) {
    throw new Error("Invoice only after delivery (POD evidence).");
  }

  const { data: pods } = await supabase
    .from("proof_of_delivery")
    .select("id")
    .eq("shipment_id", shipmentId)
    .limit(1);
  if (!pods?.length && shipment.pod_required !== false) {
    throw new Error("Proof of delivery is required before invoicing.");
  }

  const { data: existing } = await supabase
    .from("invoices")
    .select("id")
    .eq("shipment_id", shipmentId)
    .neq("status", "cancelled");
  if (existing?.length) throw new Error("An invoice already exists for this shipment.");

  // Contract / customer terms drive fuel % and Net due date
  let paymentTerms = "Net 30";
  let fuelPct = 0;
  if (shipment.contract_id) {
    const { data: contract } = await supabase
      .from("contracts")
      .select("payment_terms, billing_terms, fuel_surcharge_pct")
      .eq("id", shipment.contract_id)
      .maybeSingle();
    if (contract) {
      paymentTerms = contract.payment_terms || contract.billing_terms || paymentTerms;
      fuelPct = Number(contract.fuel_surcharge_pct ?? 0);
    }
  } else {
    const { data: customer } = await supabase
      .from("customers")
      .select("payment_terms")
      .eq("id", shipment.customer_id)
      .maybeSingle();
    if (customer?.payment_terms) paymentTerms = customer.payment_terms;
  }

  const fuel = fuelSurchargeAmount(Number(shipment.customer_rate), fuelPct);
  if (fuel > 0) {
    const { data: existingFuel } = await supabase
      .from("shipment_charges")
      .select("id")
      .eq("shipment_id", shipmentId)
      .eq("charge_type", "fuel_surcharge")
      .limit(1);
    if (!existingFuel?.length) {
      await supabase.from("shipment_charges").insert({
        shipment_id: shipmentId,
        charge_type: "fuel_surcharge",
        description: `Contract fuel surcharge (${fuelPct}%)`,
        amount: fuel,
        billable_to_customer: true,
        payable_to_carrier: false,
        approval_status: "approved",
        requested_by: profile.id,
      });
    }
  }

  const { data: charges } = await supabase
    .from("shipment_charges")
    .select("amount, billable_to_customer, approval_status")
    .eq("shipment_id", shipmentId);

  const accessorials = (charges ?? [])
    .filter((c) => c.billable_to_customer && c.approval_status === "approved")
    .reduce((s, c) => s + Number(c.amount), 0);
  const discount =
    shipment.discount_approved || profile.role === "manager"
      ? Number(shipment.discount_amount || 0)
      : 0;
  const subtotal = Number(shipment.customer_rate) - discount + accessorials;
  const total = subtotal;
  const issueDate = new Date().toISOString().slice(0, 10);
  const dueDate = dueDateFromTerms(paymentTerms, new Date(issueDate + "T00:00:00Z"));

  const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
  const { error } = await supabase.from("invoices").insert({
    invoice_number: invoiceNumber,
    customer_id: shipment.customer_id,
    shipment_id: shipment.id,
    status: "pending",
    issue_date: issueDate,
    due_date: dueDate,
    subtotal,
    total,
    amount_paid: 0,
  });
  if (error) {
    if (error.message.toLowerCase().includes("duplicate")) {
      throw new Error("Duplicate invoice number blocked by control.");
    }
    throw new Error(error.message);
  }

  await supabase
    .from("shipments")
    .update({ status: "completed" })
    .eq("id", shipmentId);

  revalidatePath("/invoices");
  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath("/dashboard");
  redirect(toastPath("/invoices", `Invoice ${invoiceNumber} generated`));
}

export async function recordPayment(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !canManageBilling(profile.role)) {
    throw new Error("Only billing or managers can record payments.");
  }

  const invoiceId = String(formData.get("invoice_id") || "");
  const amount = Number(formData.get("amount") || 0);
  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === "disputed") {
    throw new Error("Resolve the dispute before applying payment to paid-in-full.");
  }

  const { error } = await supabase.from("payments").insert({
    invoice_id: invoiceId,
    amount,
    payment_date: String(formData.get("payment_date") || new Date().toISOString().slice(0, 10)),
    method: String(formData.get("method") || "ach_simulated"),
    reference: String(formData.get("reference") || "") || null,
    recorded_by: profile.id,
  });
  if (error) throw new Error(error.message);

  const paid = Number(invoice.amount_paid) + amount;
  let status = invoice.status;
  if (paid >= Number(invoice.total)) status = "paid";
  else if (paid > 0) status = "partial";

  await supabase
    .from("invoices")
    .update({ amount_paid: paid, status })
    .eq("id", invoiceId);

  revalidatePath("/payments");
  revalidatePath("/invoices");
  revalidatePath("/ar");
  revalidatePath("/dashboard");
}

export async function openDispute(formData: FormData) {
  const profile = await getCurrentProfile();
  // Shippers open disputes; billing/managers resolve them elsewhere.
  if (!profile || profile.role !== "customer") {
    throw new Error("Only shippers can open billing disputes.");
  }
  if (!profile.customer_id) {
    throw new Error("No customer account linked to this profile.");
  }
  const supabase = await createClient();
  const invoiceId = String(formData.get("invoice_id") || "") || null;
  const { error } = await supabase.from("disputes").insert({
    invoice_id: invoiceId,
    shipment_id: String(formData.get("shipment_id") || "") || null,
    customer_id: profile.customer_id,
    reason: String(formData.get("reason") || "").trim(),
    amount_disputed: Number(formData.get("amount_disputed") || 0),
    opened_by: profile.id,
    status: "open",
  });
  if (error) throw new Error(error.message);
  if (invoiceId) {
    await supabase.from("invoices").update({ status: "disputed" }).eq("id", invoiceId);
  }
  revalidatePath("/invoices");
  revalidatePath("/disputes");
  revalidatePath("/dashboard");
}

/** Close a billing dispute and return the invoice to a collectible status. */
export async function resolveDispute(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !canManageBilling(profile.role)) {
    throw new Error("Only billing or managers can resolve disputes.");
  }

  const disputeId = String(formData.get("dispute_id") || "");
  const decision = String(formData.get("decision") || "resolved");
  if (!["resolved", "rejected"].includes(decision)) {
    throw new Error("Invalid dispute decision.");
  }

  const supabase = await createClient();
  const { data: dispute } = await supabase
    .from("disputes")
    .select("id, invoice_id, status")
    .eq("id", disputeId)
    .single();
  if (!dispute) throw new Error("Dispute not found");
  if (dispute.status !== "open") throw new Error("Dispute is already closed.");

  const { error } = await supabase
    .from("disputes")
    .update({ status: decision })
    .eq("id", disputeId);
  if (error) throw new Error(error.message);

  if (dispute.invoice_id) {
    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, status, total, amount_paid")
      .eq("id", dispute.invoice_id)
      .single();

    if (invoice && invoice.status === "disputed") {
      const paid = Number(invoice.amount_paid);
      const total = Number(invoice.total);
      let nextStatus = "pending";
      if (paid >= total && total > 0) nextStatus = "paid";
      else if (paid > 0) nextStatus = "partial";

      // Keep disputed if another open dispute still exists on this invoice
      const { data: otherOpen } = await supabase
        .from("disputes")
        .select("id")
        .eq("invoice_id", invoice.id)
        .eq("status", "open")
        .limit(1);

      if (!otherOpen?.length) {
        await supabase
          .from("invoices")
          .update({ status: nextStatus })
          .eq("id", invoice.id);
      }
    }
  }

  revalidatePath("/disputes");
  revalidatePath("/invoices");
  revalidatePath("/payments");
  revalidatePath("/ar");
  revalidatePath("/dashboard");
}

export async function reviewApproval(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "manager") throw new Error("Managers only.");
  const id = String(formData.get("approval_id") || "");
  const decision = String(formData.get("decision") || "approved");
  const comment = String(formData.get("comment") || "").trim();
  if (decision === "rejected" && comment.length < 3) {
    throw new Error("A reject comment is required.");
  }
  const supabase = await createClient();
  const { data: req } = await supabase
    .from("approval_requests")
    .select("*")
    .eq("id", id)
    .single();
  if (!req) throw new Error("Request not found");

  const nextReason =
    decision === "rejected"
      ? `${req.reason ?? ""}${req.reason ? "\n" : ""}[Reject note] ${comment}`.trim()
      : req.reason;

  await supabase
    .from("approval_requests")
    .update({
      status: decision,
      reason: nextReason,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (req.request_type === "accessorial" && req.entity_type === "shipment_charge") {
    await supabase
      .from("shipment_charges")
      .update({ approval_status: decision === "approved" ? "approved" : "rejected" })
      .eq("id", req.entity_id);
  }
  if (req.request_type === "discount" && req.entity_type === "shipment") {
    await supabase
      .from("shipments")
      .update({ discount_approved: decision === "approved" })
      .eq("id", req.entity_id);
  }
  revalidatePath("/settings");
  revalidatePath("/approvals");
  revalidatePath("/warnings");
  revalidatePath("/shipments");
  revalidatePath("/dashboard");

  const returnRaw = String(formData.get("return_to") || "").trim();
  const returnTo =
    returnRaw === "/dashboard" || returnRaw === "/approvals" ? returnRaw : "/approvals";

  redirect(
    toastPath(
      returnTo,
      decision === "approved" ? "Request approved" : "Request rejected",
    ),
  );
}

export async function updateAccessorialThreshold(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "manager") {
    throw new Error("Managers only.");
  }
  const threshold = Number(formData.get("accessorial_approval_threshold") || 0);
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new Error("Enter a valid threshold amount.");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: 1, accessorial_approval_threshold: threshold });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/approvals");
  redirect(toastPath("/settings", `Approval threshold set to $${threshold}`));
}

export async function addCollectionNote(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !canManageBilling(profile.role)) {
    throw new Error("Only billing or managers can add collection notes.");
  }
  const invoiceId = String(formData.get("invoice_id") || "");
  const note = String(formData.get("note") || "").trim();
  if (!invoiceId || note.length < 3) {
    throw new Error("Invoice and a short note are required.");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("collection_notes").insert({
    invoice_id: invoiceId,
    note,
    created_by: profile.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/ar");
  revalidatePath("/invoices");
  revalidatePath("/payments");
}
