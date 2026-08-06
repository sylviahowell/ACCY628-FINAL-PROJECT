"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/actions/auth";
import { formString, nonEmptyString, parseForm, uuidSchema } from "@/lib/action-schema";
import { isDateOutsideContractWindow } from "@/lib/contract-terms";
import { calcLaneQuote } from "@/lib/contract-pricing";
import { depositAmountDue } from "@/lib/invoice-helpers";
import { expirePastEndContracts } from "@/lib/actions/contracts-lifecycle";
import {
  creditHoldMessage,
  creditHoldOverrideNote,
  isOnCreditHold,
  pastDueBalanceFromInvoices,
} from "@/lib/credit-hold";
import {
  isNegativeMargin,
  negativeMarginMessage,
  negativeMarginOverrideNote,
} from "@/lib/margin-gate";
import { isOperations } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

function toastPath(path: string, message: string) {
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}toast=${encodeURIComponent(message)}`;
}

function toastErrorPath(path: string, message: string) {
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}toastError=${encodeURIComponent(message)}`;
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

/** Shipper asks RowanLane ops to cover a lane (find/assign a carrier). */
export async function createCoverageRequest(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "customer" || !profile.customer_id) {
    throw new Error("Only customer accounts can request coverage.");
  }

  const input = parseForm(
    z.object({
      contract_id: uuidSchema,
      pickup_location: nonEmptyString("Pickup location", 200),
      delivery_location: nonEmptyString("Delivery location", 200),
      pickup_date: z.string().trim().optional(),
      delivery_date: z.string().trim().optional(),
      freight_type: z.string().trim().max(200).optional(),
      weight_lbs: z.coerce.number().finite().min(0).optional(),
      miles: z.coerce.number().finite().min(0).optional(),
      quoted_customer_rate: z.coerce.number().finite().min(0).optional(),
      quoted_carrier_cost: z.coerce.number().finite().min(0).optional(),
      notes: z.string().trim().max(2000).optional(),
    }),
    {
      contract_id: formString(formData, "contract_id"),
      pickup_location: formString(formData, "pickup_location"),
      delivery_location: formString(formData, "delivery_location"),
      pickup_date: formString(formData, "pickup_date") || undefined,
      delivery_date: formString(formData, "delivery_date") || undefined,
      freight_type: formString(formData, "freight_type") || undefined,
      weight_lbs: formData.get("weight_lbs") || undefined,
      miles: formData.get("miles") || undefined,
      quoted_customer_rate: formData.get("quoted_customer_rate") || undefined,
      quoted_carrier_cost: formData.get("quoted_carrier_cost") || undefined,
      notes: formString(formData, "notes") || undefined,
    },
  );

  const supabase = await createClient();
  const { data: contract } = await supabase
    .from("contracts")
    .select(
      "id, customer_id, status, start_date, end_date, customer_rate_per_mile, carrier_rate_per_mile, shipping_rates, downpayment_pct, fuel_surcharge_pct",
    )
    .eq("id", input.contract_id)
    .maybeSingle();

  if (!contract || contract.status !== "active") {
    redirect(
      toastErrorPath("/coverage", "Select an active contract for this coverage request."),
    );
  }
  if (contract.customer_id !== profile.customer_id) {
    redirect(toastErrorPath("/coverage", "That contract is not linked to your account."));
  }

  const hasMileRates =
    Number(contract.customer_rate_per_mile ?? 0) > 0 &&
    Number(contract.carrier_rate_per_mile ?? 0) > 0;
  if (hasMileRates && !(Number(input.miles) > 0)) {
    redirect(
      toastErrorPath(
        "/coverage",
        "Enter lane miles so we can apply your contract per-mile rates.",
      ),
    );
  }

  const liveQuote =
    input.miles && input.miles > 0 ? calcLaneQuote(input.miles, contract) : null;
  const quotedCustomer =
    input.quoted_customer_rate != null && input.quoted_customer_rate > 0
      ? input.quoted_customer_rate
      : liveQuote?.customerLineHaul ?? null;
  const quotedCarrier =
    input.quoted_carrier_cost != null && input.quoted_carrier_cost >= 0
      ? input.quoted_carrier_cost
      : liveQuote?.carrierPay ?? null;

  const { error } = await supabase.from("coverage_requests").insert({
    customer_id: profile.customer_id,
    requested_by: profile.id,
    status: "pending",
    contract_id: input.contract_id,
    pickup_location: input.pickup_location,
    delivery_location: input.delivery_location,
    pickup_date: input.pickup_date || null,
    delivery_date: input.delivery_date || null,
    freight_type: input.freight_type || null,
    weight_lbs: input.weight_lbs || null,
    miles: input.miles && input.miles > 0 ? input.miles : null,
    quoted_customer_rate: quotedCustomer,
    quoted_carrier_cost: quotedCarrier,
    notes: input.notes || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/coverage");
  revalidatePath("/assign");
  revalidatePath("/contracts");
  revalidatePath("/dashboard");
  revalidatePath("/warnings");
  redirect(toastPath("/coverage", "Load request sent to Broker Operations"));
}

export async function cancelCoverageRequest(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "customer" || !profile.customer_id) {
    throw new Error("Only the requesting customer can cancel.");
  }
  const id = parseForm(z.object({ id: uuidSchema }), {
    id: formString(formData, "request_id"),
  }).id;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("coverage_requests")
    .select("id, customer_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.customer_id !== profile.customer_id) {
    throw new Error("Request not found.");
  }
  if (row.status !== "pending") {
    throw new Error("Only pending requests can be cancelled.");
  }

  const { error } = await supabase
    .from("coverage_requests")
    .update({ status: "cancelled", reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/coverage");
  revalidatePath("/contracts");
  revalidatePath("/dashboard");
  redirect(toastPath("/coverage", "Coverage request cancelled"));
}

/**
 * Ops converts a pending coverage request into an unassigned scheduled load
 * with contract + rates, then the broker assigns a carrier from scorecards.
 */
export async function acceptCoverageRequest(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !isOperations(profile.role)) {
    throw new Error("Only broker or manager operations can book from a request.");
  }

  const id = parseForm(z.object({ id: uuidSchema }), {
    id: formString(formData, "request_id"),
  }).id;
  const contractId = parseForm(z.object({ id: uuidSchema }), {
    id: formString(formData, "contract_id"),
  }).id;
  const customerRate = Number(formData.get("customer_rate") || 0);
  const carrierCost = Number(formData.get("carrier_cost") || 0);
  if (!(customerRate > 0)) {
    throw new Error("Customer rate is required to book from a coverage request.");
  }
  if (!(carrierCost >= 0)) {
    throw new Error("Carrier cost must be zero or greater.");
  }

  await expirePastEndContracts();

  const supabase = await createClient();
  const { data: req } = await supabase
    .from("coverage_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!req) throw new Error("Request not found.");
  if (req.status !== "pending") throw new Error("Request is no longer pending.");

  const { data: contract } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .maybeSingle();
  if (!contract || contract.status !== "active") {
    throw new Error("Select an active contract for this customer.");
  }
  if (contract.customer_id !== req.customer_id) {
    throw new Error("Contract does not belong to the requesting customer.");
  }

  const outside =
    isDateOutsideContractWindow(req.pickup_date, contract.start_date, contract.end_date) ||
    isDateOutsideContractWindow(req.delivery_date, contract.start_date, contract.end_date);
  if (outside && formData.get("confirm_outside_contract_dates") !== "on") {
    throw new Error(
      "Request dates are outside the contract window. Check the override box, or pick another contract.",
    );
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("id, credit_limit, name")
    .eq("id", req.customer_id)
    .single();
  if (!customer) throw new Error("Customer not found.");

  const today = new Date().toISOString().slice(0, 10);
  const { data: openInvoices } = await supabase
    .from("invoices")
    .select("total, amount_paid, status, due_date")
    .eq("customer_id", req.customer_id)
    .neq("status", "cancelled");
  const openAr = (openInvoices ?? []).reduce((sum, inv) => {
    if (["paid", "cancelled"].includes(inv.status)) return sum;
    return sum + Math.max(0, Number(inv.total) - Number(inv.amount_paid));
  }, 0);
  const pastDue = pastDueBalanceFromInvoices(openInvoices ?? [], today);
  const onCreditHold = isOnCreditHold(pastDue);
  if (onCreditHold && profile.role !== "manager") {
    redirect(toastErrorPath("/coverage", creditHoldMessage(customer.name, pastDue)));
  }

  const creditLimit = Number(customer.credit_limit ?? 0);
  const projected = openAr + customerRate;
  const overCredit = creditLimit > 0 && projected > creditLimit;
  if (overCredit && profile.role !== "manager") {
    redirect(
      toastErrorPath(
        "/coverage",
        `Credit limit exceeded for ${customer.name}: open AR ${openAr.toFixed(0)} + rate ${customerRate.toFixed(0)} > limit ${creditLimit.toFixed(0)}. Ask a manager to book.`,
      ),
    );
  }

  const lossLoad = isNegativeMargin(customerRate, carrierCost);
  if (lossLoad && profile.role !== "manager") {
    redirect(toastErrorPath("/coverage", negativeMarginMessage(customerRate, carrierCost)));
  }

  const pickup = String(req.pickup_location || "").trim();
  const delivery = String(req.delivery_location || "").trim();
  const [originCity = pickup, originState = ""] = pickup.split(",").map((s: string) => s.trim());
  const [destCity = delivery, destState = ""] = delivery.split(",").map((s: string) => s.trim());

  const loadNumber = `LD-REQ-${Date.now().toString().slice(-6)}`;
  const { data: ship, error: shipErr } = await supabase
    .from("shipments")
    .insert({
      load_number: loadNumber,
      customer_id: req.customer_id,
      carrier_id: null,
      contract_id: contractId,
      status: "scheduled",
      pickup_location: pickup,
      delivery_location: delivery,
      origin_city: originCity || "TBD",
      origin_state: originState || "NA",
      dest_city: destCity || "TBD",
      dest_state: destState || "NA",
      pickup_date: req.pickup_date,
      delivery_date: req.delivery_date,
      promised_delivery_date: req.delivery_date,
      freight_type: req.freight_type,
      weight_lbs: req.weight_lbs,
      customer_rate: customerRate,
      carrier_cost: carrierCost,
      discount_amount: 0,
      discount_approved: true,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (shipErr) throw new Error(shipErr.message);

  await logStatus(
    ship.id,
    null,
    "scheduled",
    profile.id,
    `Created from customer coverage request${req.notes ? `: ${req.notes}` : ""}.`,
  );

  if (profile.role === "manager") {
    if (onCreditHold) {
      await logStatus(ship.id, null, "scheduled", profile.id, creditHoldOverrideNote(pastDue));
    }
    if (overCredit) {
      await logStatus(
        ship.id,
        null,
        "scheduled",
        profile.id,
        `Credit override: AR ${openAr.toFixed(0)} + rate ${customerRate.toFixed(0)} > limit ${creditLimit.toFixed(0)}`,
      );
    }
    if (lossLoad) {
      await logStatus(
        ship.id,
        null,
        "scheduled",
        profile.id,
        negativeMarginOverrideNote(customerRate, carrierCost),
      );
    }
  }

  const depositAmt = depositAmountDue(customerRate, Number(contract.downpayment_pct ?? 0));
  if (depositAmt > 0) {
    const issueDate = new Date().toISOString().slice(0, 10);
    const invoiceNumber = `DEP-${Date.now().toString().slice(-8)}`;
    const { error: depErr } = await supabase.from("invoices").insert({
      invoice_number: invoiceNumber,
      customer_id: req.customer_id,
      shipment_id: ship.id,
      status: "sent",
      issue_date: issueDate,
      due_date: issueDate,
      subtotal: depositAmt,
      total: depositAmt,
      amount_paid: 0,
    });
    if (depErr) throw new Error(depErr.message);
    await logStatus(
      ship.id,
      "scheduled",
      "scheduled",
      profile.id,
      `Downpayment invoice ${invoiceNumber} created (${Number(contract.downpayment_pct ?? 0)}%)`,
    );
  }

  const { error: updErr } = await supabase
    .from("coverage_requests")
    .update({
      status: "accepted",
      shipment_id: ship.id,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updErr) throw new Error(updErr.message);

  // Close any broker → manager credit-hold escalations for this request.
  await supabase
    .from("approval_requests")
    .update({
      status: "approved",
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("entity_type", "coverage_request")
    .eq("entity_id", id)
    .eq("status", "pending")
    .in("request_type", ["credit_hold", "credit_override"]);

  revalidatePath("/coverage");
  revalidatePath("/contracts");
  revalidatePath("/shipments");
  revalidatePath("/assign");
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath("/warnings");
  revalidatePath("/approvals");
  redirect(
    toastPath(
      `/assign?focus=${ship.id}`,
      "Request approved — assign a carrier next",
    ),
  );
}

/**
 * Broker escalates a credit-hold (or credit-limit) blocked request to the manager Approvals inbox.
 */
export async function requestCoverageManagerOverride(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "broker") {
    throw new Error("Only brokers can escalate load requests to a manager.");
  }

  const id = parseForm(z.object({ id: uuidSchema }), {
    id: formString(formData, "request_id"),
  }).id;
  const note = String(formData.get("note") || "").trim();

  const supabase = await createClient();
  const { data: req } = await supabase
    .from("coverage_requests")
    .select(
      "id, status, customer_id, pickup_location, delivery_location, customers(name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!req) {
    redirect(toastErrorPath("/coverage", "Request not found."));
  }
  if (req.status !== "pending") {
    redirect(toastErrorPath("/coverage", "Only pending requests can be escalated."));
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: openInvoices } = await supabase
    .from("invoices")
    .select("total, amount_paid, status, due_date")
    .eq("customer_id", req.customer_id)
    .neq("status", "cancelled");
  const pastDue = pastDueBalanceFromInvoices(openInvoices ?? [], today);
  const onCreditHold = isOnCreditHold(pastDue);
  if (!onCreditHold) {
    redirect(
      toastErrorPath(
        "/coverage",
        "This customer is not on credit hold — you can approve the request yourself.",
      ),
    );
  }

  const { data: existing } = await supabase
    .from("approval_requests")
    .select("id")
    .eq("entity_type", "coverage_request")
    .eq("entity_id", id)
    .eq("status", "pending")
    .in("request_type", ["credit_hold", "credit_override"])
    .limit(1);
  if ((existing ?? []).length > 0) {
    redirect(
      toastPath(
        "/coverage",
        "Already sent to a manager — waiting in Approvals.",
      ),
    );
  }

  const customerName =
    (req.customers as { name?: string } | null)?.name ?? "Customer";
  const lane = `${req.pickup_location} → ${req.delivery_location}`;
  const reasonParts = [
    `Credit hold override needed for ${customerName} (${lane}).`,
    `Past-due AR ${pastDue.toFixed(2)}.`,
    note ? `Broker note: ${note}` : null,
  ].filter(Boolean);

  const { error } = await supabase.from("approval_requests").insert({
    request_type: "credit_hold",
    entity_type: "coverage_request",
    entity_id: id,
    amount: pastDue,
    reason: reasonParts.join(" "),
    status: "pending",
    requested_by: profile.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/coverage");
  revalidatePath("/approvals");
  revalidatePath("/dashboard");
  revalidatePath("/warnings");
  redirect(
    toastPath(
      "/coverage",
      "Sent to manager Approvals for credit-hold override",
    ),
  );
}

export async function declineCoverageRequest(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !isOperations(profile.role)) {
    throw new Error("Only broker or manager operations can decline requests.");
  }
  const id = parseForm(z.object({ id: uuidSchema }), {
    id: formString(formData, "request_id"),
  }).id;
  const note = formString(formData, "note");

  const supabase = await createClient();
  const { data: req } = await supabase
    .from("coverage_requests")
    .select("id, status, notes")
    .eq("id", id)
    .maybeSingle();
  if (!req) throw new Error("Request not found.");
  if (req.status !== "pending") throw new Error("Request is no longer pending.");

  const nextNotes =
    note.length >= 3
      ? `${req.notes ?? ""}${req.notes ? "\n" : ""}[Declined] ${note}`.trim()
      : req.notes;

  const { error } = await supabase
    .from("coverage_requests")
    .update({
      status: "declined",
      notes: nextNotes,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/coverage");
  revalidatePath("/contracts");
  revalidatePath("/dashboard");
  revalidatePath("/warnings");
  redirect(toastPath("/coverage", "Coverage request declined"));
}
