import Link from "next/link";
import { notFound } from "next/navigation";
import { AssignCarrierForm } from "@/components/AssignCarrierForm";
import { C2CTimeline } from "@/components/C2CTimeline";
import {
  CustomerFriendlyStatusCard,
  ShipmentHealthCard,
} from "@/components/ShipmentHealthCard";
import { requirePathAccess } from "@/lib/authz";
import {
  assignCarrier,
  cancelShipment,
  generateCarrierBill,
  generateInvoice,
  logDelayUpdate,
  requestAccessorial,
  updateShipmentStatus,
} from "@/lib/actions/freight";
import { PodUploadForm } from "@/components/PodUploadForm";
import { ShipmentJournalStrip } from "@/components/ShipmentJournalStrip";
import {
  buildFollowTheCashSteps,
  FollowTheCashRail,
} from "@/components/FollowTheCashRail";
import {
  buildAccountingEntries,
  filterEntriesForShipment,
} from "@/lib/accounting-entries";
import { buildC2CTimeline } from "@/lib/c2c-timeline";
import { normalizePodUrl, sanitizeDemoText } from "@/lib/display-text";
import { isActiveFinalInvoice, isDepositInvoice } from "@/lib/invoice-helpers";
import {
  customerFacingHealth,
  filterTimelineForAudience,
} from "@/lib/portal-views";
import { canManageBilling } from "@/lib/roles";
import { insuranceRiskStatus } from "@/lib/risk-credit";
import { buildCarrierScorecards, suggestCarriersForLoad, tierBadge } from "@/lib/carrier-scorecard";
import { isControlOverrideNote } from "@/lib/control-activity";
import { computeShipmentHealth } from "@/lib/shipment-health";
import { createClient } from "@/lib/supabase/server";
import { isOperations, money, statusBadge, type ShipmentStatus } from "@/lib/types";

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requirePathAccess("/shipments");

  const isCustomer = profile.role === "customer";
  const isCarrier = profile.role === "carrier";
  const showInternalFinance =
    isOperations(profile.role) || profile.role === "billing";

  const supabase = await createClient();
  const shipmentQuery = await supabase
    .from("shipments")
    .select("*, customers(name), carriers(name), contracts(contract_number, title)")
    .eq("id", id)
    .maybeSingle();
  let s = shipmentQuery.data;
  // If nested selects fail (relationship/RLS quirks), fall back to the base row
  // then load party names separately so the detail page does not hard-404.
  if (!s && shipmentQuery.error) {
    const { data: plain } = await supabase
      .from("shipments")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (plain) {
      const [{ data: customer }, { data: carrier }, { data: contract }] = await Promise.all([
        plain.customer_id
          ? supabase.from("customers").select("name").eq("id", plain.customer_id).maybeSingle()
          : Promise.resolve({ data: null }),
        plain.carrier_id
          ? supabase.from("carriers").select("name").eq("id", plain.carrier_id).maybeSingle()
          : Promise.resolve({ data: null }),
        plain.contract_id
          ? supabase
              .from("contracts")
              .select("contract_number, title")
              .eq("id", plain.contract_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      s = {
        ...plain,
        customers: customer,
        carriers: carrier,
        contracts: contract,
      } as typeof plain & {
        customers: { name?: string } | null;
        carriers: { name?: string } | null;
        contracts: { contract_number?: string; title?: string } | null;
      };
    }
  }
  if (!s) notFound();

  if (isCustomer) {
    if (!profile.customer_id || s.customer_id !== profile.customer_id) notFound();
  }
  if (isCarrier) {
    if (!profile.carrier_id || s.carrier_id !== profile.carrier_id) notFound();
  }

  const { data: profit } = showInternalFinance
    ? await supabase.from("shipment_profitability").select("*").eq("shipment_id", id).maybeSingle()
    : { data: null };
  const { data: charges } = await supabase
    .from("shipment_charges")
    .select("*")
    .eq("shipment_id", id);
  const { data: pods } = await supabase
    .from("proof_of_delivery")
    .select("*")
    .eq("shipment_id", id);
  const { data: timeline } = await supabase
    .from("shipment_status_updates")
    .select("*")
    .eq("shipment_id", id)
    .order("created_at", { ascending: false });
  const { data: invoices } =
    isCarrier
      ? { data: [] as {
          id: string;
          invoice_number: string;
          status: string;
          amount_paid: number;
          total: number;
          created_at: string;
          due_date: string;
          issue_date?: string;
          shipment_id?: string | null;
          customer_id?: string;
        }[] }
      : await supabase.from("invoices").select("*").eq("shipment_id", id);
  const { data: carrierBills } =
    showInternalFinance || canManageBilling(profile.role)
      ? await supabase
          .from("carrier_bills")
          .select(
            "id, bill_number, status, total, issue_date, shipment_id, carriers(name), shipments(load_number)",
          )
          .eq("shipment_id", id)
      : {
          data: [] as {
            id: string;
            bill_number: string;
            status: string;
            total?: number;
            issue_date?: string;
            shipment_id?: string;
            carriers?: { name?: string } | null;
            shipments?: { load_number?: string } | null;
          }[],
        };
  const invoiceIds = (invoices ?? []).map((inv) => inv.id);
  const { data: loadPayments } =
    invoiceIds.length > 0 && (showInternalFinance || canManageBilling(profile.role))
      ? await supabase
          .from("payments")
          .select(
            "id, invoice_id, amount, payment_date, method, invoices(invoice_number, shipment_id, customers(name))",
          )
          .in("invoice_id", invoiceIds)
      : { data: [] as never[] };
  const carrierBillIds = (carrierBills ?? []).map((b) => b.id);
  const { data: loadCarrierPayments } =
    carrierBillIds.length > 0 && (showInternalFinance || canManageBilling(profile.role))
      ? await supabase
          .from("carrier_payments")
          .select(
            "id, carrier_bill_id, amount, payment_date, carrier_bills(bill_number, shipment_id, shipments(load_number))",
          )
          .in("carrier_bill_id", carrierBillIds)
      : { data: [] as never[] };
  const { data: disputes } =
    invoiceIds.length > 0
      ? await supabase
          .from("disputes")
          .select("id, status, invoice_id")
          .in("invoice_id", invoiceIds)
      : { data: [] as { id: string; status: string; invoice_id: string }[] };
  const { data: allCarriers } = isOperations(profile.role)
    ? await supabase
        .from("carriers")
        .select("id, name, insurance_expiration, equipment_type, service_area, rating")
        .order("name")
    : {
        data: [] as {
          id: string;
          name: string;
          insurance_expiration: string | null;
          equipment_type: string | null;
          service_area: string | null;
          rating: number | null;
        }[],
      };

  const today = new Date().toISOString().slice(0, 10);

  const assignableCarriers = (allCarriers ?? []).filter((c) => {
    if (c.id === s.carrier_id) return true;
    return insuranceRiskStatus(c.insurance_expiration ?? null, today).status !== "expired";
  });
  const currentCarrierExpired =
    Boolean(s.carrier_id) &&
    (allCarriers ?? []).some(
      (c) =>
        c.id === s.carrier_id &&
        insuranceRiskStatus(c.insurance_expiration ?? null, today).status === "expired",
    );

  const overrideEvents = (timeline ?? []).filter((t) => isControlOverrideNote(t.note));
  const overrideActorIds = [
    ...new Set(overrideEvents.map((t) => t.changed_by).filter(Boolean) as string[]),
  ];
  const { data: overrideActors } =
    showInternalFinance && overrideActorIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", overrideActorIds)
      : { data: [] as { id: string; full_name: string }[] };
  const actorName = new Map((overrideActors ?? []).map((p) => [p.id, p.full_name]));

  const margin = Number(profit?.margin ?? Number(s.customer_rate) - Number(s.carrier_cost));
  const hasPod = (pods ?? []).length > 0;
  const pendingAccessorials = (charges ?? []).filter(
    (c) => c.approval_status === "pending",
  ).length;
  const finalInvoices = (invoices ?? []).filter((inv) => isActiveFinalInvoice(inv));
  const depositInvoices = (invoices ?? []).filter(
    (inv) => inv.status !== "cancelled" && isDepositInvoice(inv),
  );
  const primaryInvoice = finalInvoices[0] ?? depositInvoices[0] ?? null;
  const billed = finalInvoices.length > 0;
  const hasCarrierBill = (carrierBills ?? []).some((b) => b.status !== "cancelled");
  let daysSinceDeliveryUnbilled: number | null = null;
  if (["delivered", "completed"].includes(s.status) && !billed && s.delivery_date) {
    daysSinceDeliveryUnbilled = Math.floor(
      (new Date(today + "T00:00:00Z").getTime() -
        new Date(s.delivery_date + "T00:00:00Z").getTime()) /
        (1000 * 60 * 60 * 24),
    );
  }
  const hasOpenDispute = (disputes ?? []).some((d) => d.status === "open");
  const hasOverdueInvoice = (invoices ?? []).some((inv) => {
    const bal = Number(inv.total) - Number(inv.amount_paid);
    return (
      bal > 0 &&
      inv.due_date < today &&
      !["paid", "cancelled"].includes(inv.status)
    );
  });

  // Health for internal/carrier — omit margin penalty for carrier view
  const health = computeShipmentHealth({
    status: s.status,
    carrier_id: s.carrier_id,
    promised_delivery_date: s.promised_delivery_date,
    delivery_date: s.delivery_date,
    margin: isCarrier ? null : showInternalFinance ? margin : null,
    hasPod,
    pendingAccessorials: isCustomer ? 0 : pendingAccessorials,
    daysSinceDeliveryUnbilled: isCustomer || isCarrier ? null : daysSinceDeliveryUnbilled,
    hasOpenDispute: isCarrier ? false : hasOpenDispute,
    hasOverdueInvoice: isCarrier ? false : hasOverdueInvoice,
    today,
  });

  const friendly = customerFacingHealth({
    status: s.status,
    promised_delivery_date: s.promised_delivery_date,
    hasPod,
    hasCarrier: Boolean(s.carrier_id),
    hasOpenDispute,
    hasOverdueInvoice,
    today,
  });

  const audience = isCustomer ? "customer" : isCarrier ? "carrier" : "internal";
  const c2cSteps = filterTimelineForAudience(
    buildC2CTimeline({
      status: s.status,
      created_at: s.created_at,
      carrier_id: s.carrier_id,
      pickup_date: s.pickup_date,
      delivery_date: s.delivery_date,
      hasPod,
      podAt: (pods ?? [])[0]?.delivered_at ?? null,
      invoiceNumber: isCarrier ? null : primaryInvoice?.invoice_number ?? null,
      invoiceAt: isCarrier ? null : primaryInvoice?.created_at ?? null,
      amountPaid: isCarrier ? 0 : Number(primaryInvoice?.amount_paid ?? 0),
      invoiceTotal: isCarrier ? 0 : Number(primaryInvoice?.total ?? 0),
      invoiceStatus: isCarrier ? null : primaryInvoice?.status ?? null,
      statusEvents: (timeline ?? []).map((t) => ({
        to_status: t.to_status,
        created_at: t.created_at,
      })),
    }),
    audience,
  );

  const canOperate =
    isOperations(profile.role) ||
    (profile.role === "carrier" && profile.carrier_id === s.carrier_id);
  const canBill = canManageBilling(profile.role);
  const showLoadJournals = showInternalFinance || canBill;
  const loadJournalEntries = showLoadJournals
    ? filterEntriesForShipment(
        buildAccountingEntries({
          shipments: [
            {
              id: s.id,
              load_number: s.load_number,
              status: s.status,
              customer_rate: s.customer_rate,
              carrier_cost: s.carrier_cost,
              carrier_id: s.carrier_id,
              discount_amount: s.discount_amount,
              discount_approved: s.discount_approved,
              delivery_date: s.delivery_date,
              customers: (Array.isArray(s.customers) ? s.customers[0] : s.customers) as {
                name?: string;
              } | null,
            },
          ],
          charges: (charges ?? []).map((c) => ({
            shipment_id: c.shipment_id,
            amount: c.amount,
            billable_to_customer: c.billable_to_customer,
            payable_to_carrier: c.payable_to_carrier,
            approval_status: c.approval_status,
          })),
          pods: (pods ?? []).map((p) => ({
            shipment_id: p.shipment_id,
            delivered_at: p.delivered_at,
          })),
          invoices: (invoices ?? []).map((inv) => ({
            id: inv.id,
            shipment_id: inv.shipment_id ?? id,
            invoice_number: inv.invoice_number,
            status: inv.status,
            total: inv.total,
            issue_date: inv.issue_date ?? inv.created_at?.slice(0, 10) ?? today,
            customers: (Array.isArray(s.customers) ? s.customers[0] : s.customers) as {
              name?: string;
            } | null,
          })),
          payments: (loadPayments ?? []).map((p) => {
            const inv = (Array.isArray(p.invoices) ? p.invoices[0] : p.invoices) as {
              invoice_number?: string;
              shipment_id?: string | null;
              customers?: { name?: string } | { name?: string }[] | null;
            } | null;
            const cust = inv?.customers
              ? Array.isArray(inv.customers)
                ? inv.customers[0]
                : inv.customers
              : null;
            return {
              id: p.id,
              invoice_id: p.invoice_id,
              amount: p.amount,
              payment_date: p.payment_date,
              method: p.method,
              invoices: inv
                ? {
                    invoice_number: inv.invoice_number,
                    shipment_id: inv.shipment_id ?? id,
                    customers: cust,
                  }
                : null,
            };
          }),
          carrierBills: (carrierBills ?? []).map((b) => ({
            id: b.id,
            bill_number: b.bill_number,
            status: b.status,
            total: b.total ?? 0,
            issue_date: b.issue_date ?? today,
            shipment_id: b.shipment_id ?? id,
            carriers: (Array.isArray(b.carriers) ? b.carriers[0] : b.carriers) as {
              name?: string;
            } | null,
            shipments: (Array.isArray(b.shipments) ? b.shipments[0] : b.shipments) as {
              load_number?: string;
            } | null,
          })),
          carrierPayments: (loadCarrierPayments ?? []).map((p) => {
            const bill = (Array.isArray(p.carrier_bills)
              ? p.carrier_bills[0]
              : p.carrier_bills) as {
              bill_number?: string;
              shipment_id?: string;
              shipments?: { load_number?: string } | { load_number?: string }[] | null;
            } | null;
            const ship = bill?.shipments
              ? Array.isArray(bill.shipments)
                ? bill.shipments[0]
                : bill.shipments
              : null;
            return {
              id: p.id,
              carrier_bill_id: p.carrier_bill_id,
              amount: p.amount,
              payment_date: p.payment_date,
              carrier_bills: bill
                ? {
                    bill_number: bill.bill_number,
                    shipment_id: bill.shipment_id ?? id,
                    shipments: ship,
                  }
                : null,
            };
          }),
        }),
        id,
      )
    : [];
  const canAssign =
    isOperations(profile.role) &&
    !["delivered", "completed", "cancelled"].includes(s.status);
  const showCharges =
    showInternalFinance || isCarrier || (isCustomer && (charges ?? []).some((c) => c.billable_to_customer));
  const isDelayed =
    Boolean(s.promised_delivery_date) &&
    (s.promised_delivery_date as string) < today &&
    !["delivered", "completed", "cancelled"].includes(s.status);

  let suggestedCarriers: ReturnType<typeof suggestCarriersForLoad> = [];
  if (canAssign && (allCarriers ?? []).length) {
    const [{ data: networkShips }, { data: networkPods }, { data: networkProfit }, { data: networkCharges }] =
      await Promise.all([
        supabase
          .from("shipments")
          .select(
            "id, carrier_id, status, pickup_date, delivery_date, promised_delivery_date, carrier_cost, customer_rate",
          ),
        supabase.from("proof_of_delivery").select("shipment_id"),
        supabase.from("shipment_profitability").select("shipment_id, margin, carrier_cost"),
        supabase.from("shipment_charges").select("shipment_id"),
      ]);
    const profitMap = new Map(
      (networkProfit ?? []).map((p) => [
        p.shipment_id as string,
        { margin: Number(p.margin), carrier_cost: Number(p.carrier_cost) },
      ]),
    );
    const chargeCount = new Map<string, number>();
    for (const ch of networkCharges ?? []) {
      chargeCount.set(ch.shipment_id, (chargeCount.get(ch.shipment_id) ?? 0) + 1);
    }
    const scorecards = buildCarrierScorecards({
      carriers: (allCarriers ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        equipment_type: c.equipment_type ?? null,
        service_area: c.service_area ?? null,
        rating: c.rating == null ? null : Number(c.rating),
        insurance_expiration: c.insurance_expiration ?? null,
      })),
      shipments: (networkShips ?? []).map((row) => ({
        id: row.id,
        carrier_id: row.carrier_id,
        status: row.status,
        pickup_date: row.pickup_date,
        delivery_date: row.delivery_date,
        promised_delivery_date: row.promised_delivery_date,
        carrier_cost: Number(row.carrier_cost),
        customer_rate: Number(row.customer_rate),
      })),
      profitByShipment: profitMap,
      podShipmentIds: new Set((networkPods ?? []).map((p) => p.shipment_id)),
      chargesByShipment: chargeCount,
      today,
    });
    suggestedCarriers = suggestCarriersForLoad(scorecards, {
      equipmentHint: s.freight_type,
      preferLowCost: true,
    }).filter((c) => assignableCarriers.some((a) => a.id === c.carrierId));
  }

  let nextAction: {
    label: string;
    href?: string;
    form?: "invoice" | "pod" | "assign" | "carrier_bill";
  } | null = null;
  if (canAssign && !s.carrier_id) {
    nextAction = { label: "Assign a carrier to cover this load", form: "assign" };
  } else if (canOperate && ["delivered", "completed"].includes(s.status) && !hasPod) {
    nextAction = { label: "Confirm delivery and attach proof of delivery", form: "pod" };
  } else if (canBill && ["delivered", "completed"].includes(s.status) && hasPod && !billed) {
    nextAction = { label: "Generate customer invoice — POD is on file", form: "invoice" };
  } else if (
    canBill &&
    ["delivered", "completed"].includes(s.status) &&
    hasPod &&
    s.carrier_id &&
    !hasCarrierBill
  ) {
    nextAction = {
      label: "Ready for carrier bill — create AP payable",
      form: "carrier_bill",
    };
  } else if (profile.role === "manager" && pendingAccessorials > 0) {
    nextAction = { label: "Review pending accessorial in Approvals", href: "/approvals" };
  } else if (profile.role === "broker" && pendingAccessorials > 0) {
    nextAction = {
      label: "Accessorial waiting on manager — escalate from Warnings if needed",
      href: "/warnings?severity=info",
    };
  } else if (isCustomer && hasOverdueInvoice) {
    nextAction = { label: "Review past-due balance on My Invoices", href: "/invoices" };
  } else if (isCustomer && hasOpenDispute) {
    nextAction = { label: "Check Support for your open billing question", href: "/support" };
  }

  async function setStatus(status: ShipmentStatus, _fd?: FormData) {
    "use server";
    await updateShipmentStatus(id, status);
  }

  const visibleCharges = (charges ?? []).filter((c) =>
    isCustomer ? c.billable_to_customer : true,
  );

  const progressTitle = isCustomer
    ? "Progress"
    : isCarrier
      ? "Load progress"
      : "Contract-to-cash timeline";
  const progressDescription = isCustomer
    ? "Milestones for this shipment from booking through invoice."
    : isCarrier
      ? "Pickup, transit, and delivery documentation milestones."
      : "Operational and billing milestones. A step is complete only when supporting records exist.";

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link href="/shipments" className="link link-hover text-sm">
          ← Shipments
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{s.load_number}</h1>
            <p className="text-sm opacity-70">
              {s.pickup_location} → {s.delivery_location}
            </p>
            <p className="mt-1 text-sm opacity-60">
              Pickup {s.pickup_date ?? "TBD"}
              {s.promised_delivery_date ? ` · Expected ${s.promised_delivery_date}` : ""}
              {s.delivery_date ? ` · Delivered ${s.delivery_date}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge badge-lg ${statusBadge(s.status)}`}>
              {s.status.replaceAll("_", " ")}
            </span>
            {canOperate || canBill ? (
              <>
                {canOperate && ["assigned", "booked"].includes(s.status) ? (
                  <form action={setStatus.bind(null, "picked_up")}>
                    <button className="btn btn-sm">Confirm pickup</button>
                  </form>
                ) : null}
                {canOperate && s.status === "picked_up" ? (
                  <form action={setStatus.bind(null, "in_transit")}>
                    <button className="btn btn-sm btn-outline">Mark in transit</button>
                  </form>
                ) : null}
                {canBill &&
                ["delivered", "completed"].includes(s.status) &&
                hasPod &&
                !billed ? (
                  <form action={generateInvoice.bind(null, id)}>
                    <button className="btn btn-sm btn-primary">Generate invoice</button>
                  </form>
                ) : null}
                {canBill &&
                ["delivered", "completed"].includes(s.status) &&
                hasPod &&
                s.carrier_id &&
                !hasCarrierBill ? (
                  <form action={generateCarrierBill.bind(null, id)}>
                    <button className="btn btn-sm btn-outline">Create carrier bill</button>
                  </form>
                ) : null}
                {isOperations(profile.role) &&
                !["delivered", "completed", "cancelled"].includes(s.status) ? (
                  <details className="dropdown dropdown-end">
                    <summary className="btn btn-ghost btn-sm">Cancel load…</summary>
                    <div className="dropdown-content z-10 mt-1 w-72 rounded-box border border-base-300 bg-base-100 p-3 shadow">
                      <form action={cancelShipment} className="flex flex-col gap-2">
                        <input type="hidden" name="shipment_id" value={id} />
                        <input
                          name="reason"
                          required
                          minLength={3}
                          placeholder="Reason for cancel"
                          className="input input-bordered input-sm"
                        />
                        <button className="btn btn-error btn-sm">Confirm cancel</button>
                      </form>
                    </div>
                  </details>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </header>

      {(showInternalFinance && profile.role !== "broker" && margin < 0) ||
      (showInternalFinance && overrideEvents.length > 0) ||
      (canAssign && currentCarrierExpired) ||
      nextAction ||
      (canOperate && isDelayed && isOperations(profile.role)) ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Needs attention</h2>
            <p className="text-sm opacity-60">Alerts and the next step for this load.</p>
          </div>
          <div className="space-y-3">
            {showInternalFinance && profile.role !== "broker" && margin < 0 ? (
              <div className="alert alert-warning">
                <span>
                  Warning: this shipment is currently unprofitable ({money(margin)} margin).
                  Booking is not blocked — review coverage and rates.
                </span>
              </div>
            ) : null}

            {showInternalFinance && overrideEvents.length > 0 ? (
              <div className="rounded-box border border-warning/40 bg-warning/10 px-4 py-3">
                <p className="text-xs font-semibold tracking-wide text-warning-content uppercase opacity-80">
                  {profile.role === "broker" ? "Manager override logged" : "Control overrides"}
                </p>
                <ul className="mt-2 space-y-2 text-sm">
                  {overrideEvents.map((t) => (
                    <li
                      key={t.id}
                      className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3"
                    >
                      <span className="shrink-0 text-xs opacity-60">
                        {new Date(t.created_at).toLocaleString()}
                      </span>
                      <span>
                        <span className="font-medium">
                          {t.changed_by ? actorName.get(t.changed_by) ?? "Staff" : "Staff"}
                        </span>
                        {" — "}
                        {sanitizeDemoText(t.note) || "Logged override"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {canAssign && currentCarrierExpired ? (
              <div className="alert alert-error">
                <span>
                  Assigned carrier has expired insurance (Suspended). Reassign to an eligible
                  carrier — saving the current assignment is blocked.
                </span>
              </div>
            ) : null}

            {nextAction ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-box border border-primary/30 bg-primary/10 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                    Next action
                  </p>
                  <p className="font-medium">{nextAction.label}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {nextAction.href ? (
                    <Link href={nextAction.href} className="btn btn-primary btn-sm">
                      Go
                    </Link>
                  ) : null}
                  {nextAction.form === "invoice" ? (
                    <form action={generateInvoice.bind(null, id)}>
                      <button className="btn btn-primary btn-sm">Generate invoice</button>
                    </form>
                  ) : null}
                  {nextAction.form === "carrier_bill" ? (
                    <form action={generateCarrierBill.bind(null, id)}>
                      <button className="btn btn-primary btn-sm">Create carrier bill</button>
                    </form>
                  ) : null}
                  {nextAction.form === "pod" ? (
                    <a href="#pod-upload" className="btn btn-success btn-sm">
                      Upload POD
                    </a>
                  ) : null}
                  {nextAction.form === "assign" ? (
                    <a href="#assign-carrier" className="btn btn-primary btn-sm">
                      Assign carrier
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}

            {canOperate && isDelayed && isOperations(profile.role) ? (
              <div className="rounded-box border border-error/30 bg-error/5 px-4 py-4">
                <h3 className="text-sm font-semibold text-error">Delayed — update ETA</h3>
                <p className="mt-1 text-sm opacity-70">
                  Log the carrier ETA and customer outreach. Optionally revise the promised
                  delivery date.
                </p>
                <form action={logDelayUpdate} className="mt-3 grid gap-2 md:grid-cols-2">
                  <input type="hidden" name="shipment_id" value={id} />
                  <input
                    name="note"
                    required
                    minLength={3}
                    placeholder="ETA / customer note (required)"
                    className="input input-bordered input-sm md:col-span-2"
                  />
                  <label className="form-control w-full">
                    <span className="label-text text-xs">Revised promised delivery (optional)</span>
                    <input
                      name="promised_delivery_date"
                      type="date"
                      defaultValue={s.promised_delivery_date ?? ""}
                      className="input input-bordered input-sm"
                    />
                  </label>
                  <div className="flex items-end">
                    <button className="btn btn-error btn-sm">Log delay update</button>
                  </div>
                </form>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {showLoadJournals ? (
        <FollowTheCashRail
          loadNumber={s.load_number}
          steps={buildFollowTheCashSteps({
            hasPod,
            delivered: ["delivered", "completed"].includes(s.status),
            recognized: loadJournalEntries.some((e) => e.type === "recognize"),
            billed,
            invoiceId: primaryInvoice?.id ?? null,
            invoiceNumber: primaryInvoice?.invoice_number ?? null,
            invoiceBalance: primaryInvoice
              ? Math.max(
                  0,
                  Number(primaryInvoice.total) - Number(primaryInvoice.amount_paid),
                )
              : 0,
            invoiceStatus: primaryInvoice?.status ?? null,
            cashCollected: (loadPayments ?? [])
              .filter((p) => !(p.method ?? "").toLowerCase().includes("write_off"))
              .reduce((sum, p) => sum + Number(p.amount), 0),
            wroteOff: (loadPayments ?? []).some((p) =>
              (p.method ?? "").toLowerCase().includes("write_off"),
            ),
            journalCount: loadJournalEntries.length,
          })}
        />
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Where is it?</h2>
          <p className="text-sm opacity-60">Live status and progress for this load.</p>
        </div>
        <div className="grid items-start gap-6 rounded-box border border-base-300 bg-base-100 p-4 lg:grid-cols-[minmax(0,18rem)_1fr] lg:gap-0 lg:p-5">
          <div className="lg:pr-5">
            {isCustomer ? (
              <CustomerFriendlyStatusCard health={friendly} embedded hideTitle />
            ) : (
              <ShipmentHealthCard
                health={health}
                audience={isCarrier ? "carrier" : "internal"}
                embedded
              />
            )}
          </div>
          <div className="border-t border-base-200 pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
            <C2CTimeline
              steps={c2cSteps}
              embedded
              title={progressTitle}
              description={progressDescription}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Load & documents</h2>
          <p className="text-sm opacity-60">
            {canAssign
              ? "Shipment facts, carrier assignment, and proof of delivery."
              : "Shipment facts and proof of delivery."}
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div
            id={canAssign ? "assign-carrier" : undefined}
            className="rounded-box border border-base-300 bg-base-100 p-4 sm:p-5"
          >
            <h3 className="text-sm font-semibold">Details</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {!isCarrier ? (
                <li className="flex justify-between gap-3">
                  <span className="opacity-60">Customer</span>
                  <span className="text-right font-medium">
                    {(s.customers as { name?: string } | null)?.name ?? "—"}
                  </span>
                </li>
              ) : null}
              <li className="flex justify-between gap-3">
                <span className="opacity-60">Carrier</span>
                <span className="text-right font-medium">
                  {isCustomer
                    ? s.carrier_id
                      ? "Assigned"
                      : "Pending assignment"
                    : (s.carriers as { name?: string } | null)?.name ?? "Unassigned"}
                </span>
              </li>
              {!isCarrier ? (
                <li className="flex justify-between gap-3">
                  <span className="opacity-60">Contract</span>
                  <span className="text-right font-medium">
                    {(s.contracts as { contract_number?: string } | null)?.contract_number ??
                      "Spot"}
                  </span>
                </li>
              ) : null}
              <li className="flex justify-between gap-3">
                <span className="opacity-60">Freight</span>
                <span className="text-right font-medium">{s.freight_type ?? "—"}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="opacity-60">Weight</span>
                <span className="text-right font-medium">
                  {s.weight_lbs != null ? `${s.weight_lbs} lbs` : "—"}
                </span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="opacity-60">Pickup</span>
                <span className="text-right font-medium">{s.pickup_date ?? "TBD"}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="opacity-60">Delivery</span>
                <span className="text-right font-medium">{s.delivery_date ?? "TBD"}</span>
              </li>
            </ul>
            {canAssign ? (
              <div className="mt-4 border-t border-base-200 pt-4">
                <AssignCarrierForm
                  shipmentId={id}
                  customerRate={Number(s.customer_rate) || 0}
                  defaultCarrierCost={s.carrier_cost ?? ""}
                  defaultCarrierId={currentCarrierExpired ? "" : (s.carrier_id ?? "")}
                  isManager={profile.role === "manager"}
                  action={assignCarrier}
                  suggestedCarriers={suggestedCarriers.map((c) => ({
                    carrierId: c.carrierId,
                    name: c.name,
                    tier: c.tier,
                    onTimeDeliveryPct: c.onTimeDeliveryPct,
                    avgCarrierCost: c.avgCarrierCost,
                    insuranceExpiration: c.insuranceExpiration,
                    tierBadgeClass: tierBadge(c.tier),
                  }))}
                  carriers={assignableCarriers
                    .filter(
                      (c) =>
                        c.id !== s.carrier_id ||
                        insuranceRiskStatus(c.insurance_expiration ?? null, today).status !==
                          "expired",
                    )
                    .map((c) => {
                      const risk = insuranceRiskStatus(c.insurance_expiration ?? null, today);
                      const insuranceLabel =
                        risk.status === "expiring"
                          ? ` · insurance ${c.insurance_expiration} (≤30d)`
                          : risk.status === "unknown"
                            ? " · insurance unknown"
                            : c.insurance_expiration
                              ? ` · insured thru ${c.insurance_expiration}`
                              : "";
                      return { id: c.id, name: c.name, insuranceLabel };
                    })}
                />
              </div>
            ) : null}
          </div>

          <div
            id="pod-upload"
            className="rounded-box border border-base-300 bg-base-100 p-4 sm:p-5"
          >
            <h3 className="text-sm font-semibold">Proof of delivery</h3>
            {(pods ?? []).length ? (
              <ul className="mt-3 space-y-2 text-sm">
                {(pods ?? []).map((p) => (
                  <li key={p.id} className="rounded-box bg-base-200/70 p-3">
                    Signed by {p.signed_by ?? "—"} · {new Date(p.delivered_at).toLocaleString()}
                    {sanitizeDemoText(p.notes) ? (
                      <div className="mt-1 opacity-70">{sanitizeDemoText(p.notes)}</div>
                    ) : null}
                    {normalizePodUrl(p.file_url) ? (
                      <a
                        className="link mt-1 inline-block"
                        href={normalizePodUrl(p.file_url)!}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open delivery document
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm opacity-70">
                {isCustomer
                  ? "No proof of delivery on file yet."
                  : "No POD on file yet — required before invoicing."}
              </p>
            )}
            {canOperate ? (
              <div className="mt-4">
                <PodUploadForm
                  shipmentId={id}
                  defaultSignedBy={profile.role === "carrier" ? "Consignee" : ""}
                  replacing={(pods ?? []).length > 0}
                />
              </div>
            ) : null}
            {isCarrier ? (
              <div className="mt-4 border-t border-base-200 pt-4">
                <h4 className="text-sm font-semibold">Document checklist</h4>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  <li>Pickup confirmed when freight is on the truck</li>
                  <li>In-transit update while moving</li>
                  <li>
                    POD required after delivery{" "}
                    {hasPod ? (
                      <span className="badge badge-success badge-xs">Done</span>
                    ) : (
                      <span className="badge badge-warning badge-xs">Needed</span>
                    )}
                  </li>
                </ul>
                <Link href="/documents" className="btn btn-ghost btn-sm mt-2 w-fit">
                  Open documents
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">
            {isCustomer ? "Billing" : isCarrier ? "Pay & charges" : "Money"}
          </h2>
          <p className="text-sm opacity-60">
            {isCustomer
              ? "Your rate, extra charges, and invoices."
              : isCarrier
                ? "Your haul pay and accessorial charges."
                : "Rates, margin, accessorials, and invoices."}
          </p>
        </div>
        <div className="space-y-4 rounded-box border border-base-300 bg-base-100 p-4 sm:p-5">
          {isCustomer ? (
            <div className="border-b border-base-200 pb-4">
              <p className="text-xs font-medium tracking-wide uppercase opacity-50">
                Your shipment rate
              </p>
              <p className="text-2xl font-semibold tabular-nums">{money(s.customer_rate)}</p>
            </div>
          ) : null}

          {isCarrier ? (
            <div className="border-b border-base-200 pb-4">
              <p className="text-xs font-medium tracking-wide uppercase opacity-50">
                Your haul pay
              </p>
              <p className="text-2xl font-semibold tabular-nums">{money(s.carrier_cost)}</p>
            </div>
          ) : null}

          {showInternalFinance ? (
            <>
              <div className="grid gap-4 border-b border-base-200 pb-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium tracking-wide uppercase opacity-50">
                    Customer rate
                  </p>
                  <p className="text-2xl font-semibold tabular-nums">{money(s.customer_rate)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium tracking-wide uppercase opacity-50">
                    Carrier cost (COGS)
                  </p>
                  <p className="text-2xl font-semibold tabular-nums">{money(s.carrier_cost)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium tracking-wide uppercase opacity-50">Profit</p>
                  <p
                    className={`text-2xl font-semibold tabular-nums ${
                      margin < 0 ? "text-error" : "text-success"
                    }`}
                  >
                    {money(margin)}
                  </p>
                </div>
              </div>
              {profile.role !== "broker" ? (
                <div className="grid gap-2 border-b border-base-200 pb-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="opacity-60">Billable accessorials / fuel</p>
                    <p className="font-medium">{money(profit?.billable_accessorials)}</p>
                  </div>
                  <div>
                    <p className="opacity-60">Payable to carrier</p>
                    <p className="font-medium">{money(profit?.payable_accessorials)}</p>
                  </div>
                  <div>
                    <p className="opacity-60">Discount</p>
                    <p className="font-medium">{money(s.discount_amount)}</p>
                  </div>
                  <div>
                    <p className="opacity-60">Direct COGS</p>
                    <p className="font-medium">
                      {money(Number(s.carrier_cost) + Number(profit?.payable_accessorials ?? 0))}
                    </p>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {showCharges ? (
            <div>
              <h3 className="text-sm font-semibold">
                {isCustomer ? "Extra charges" : "Accessorial charges"}
              </h3>
              {visibleCharges.length === 0 ? (
                <p className="mt-2 text-sm opacity-70">
                  {isCustomer ? "No extra charges on this shipment." : "No accessorials yet."}
                </p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {visibleCharges.map((c) => (
                    <li
                      key={c.id}
                      className="flex justify-between gap-2 border-b border-base-200 py-2 last:border-0"
                    >
                      <span>
                        {c.description}{" "}
                        {!isCustomer ? (
                          <span className="badge badge-ghost badge-xs">{c.approval_status}</span>
                        ) : null}
                      </span>
                      <span className="font-medium tabular-nums">{money(c.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {canOperate && !isCustomer ? (
                <form action={requestAccessorial} className="mt-3 grid gap-2 md:grid-cols-2">
                  <input type="hidden" name="shipment_id" value={id} />
                  <input
                    name="description"
                    required
                    placeholder="Charge description"
                    className="input input-bordered input-sm"
                  />
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    required
                    placeholder="Amount"
                    className="input input-bordered input-sm"
                  />
                  <label className="label cursor-pointer justify-start gap-2">
                    <input
                      type="checkbox"
                      name="payable_to_carrier"
                      className="checkbox checkbox-sm"
                    />
                    <span className="label-text">Payable to carrier</span>
                  </label>
                  <button className="btn btn-outline btn-sm">Request / add charge</button>
                </form>
              ) : null}
            </div>
          ) : null}

          {!isCarrier ? (
            <div className="border-t border-base-200 pt-4">
              <h3 className="text-sm font-semibold">
                {profile.role === "broker" ? "Billing status" : "Invoices"}
              </h3>
              {(invoices ?? []).length === 0 ? (
                <p className="mt-2 text-sm opacity-70">
                  {profile.role === "broker"
                    ? "Not invoiced yet. After POD, Billing invoices the customer (AR) and pays the carrier (AP). Brokers do not run bill/pay from this portal."
                    : "Not billed yet."}
                </p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {(invoices ?? []).map((inv) => (
                    <li
                      key={inv.id}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span>
                        {profile.role === "broker" ? (
                          <span className="font-medium">{inv.invoice_number}</span>
                        ) : (
                          <Link href="/invoices" className="link font-medium">
                            {inv.invoice_number}
                          </Link>
                        )}{" "}
                        <span className={`badge ${statusBadge(inv.status)}`}>{inv.status}</span>
                      </span>
                      <span className="tabular-nums opacity-80">
                        {money(inv.amount_paid)} / {money(inv.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {showLoadJournals ? (
            <div className="border-t border-base-200 pt-4">
              <ShipmentJournalStrip entries={loadJournalEntries} />
            </div>
          ) : null}
        </div>
      </section>

      <details className="group rounded-box border border-base-300 bg-base-100">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold marker:content-none sm:px-5">
          <span className="flex items-center justify-between gap-2">
            Status history
            <span className="text-xs font-normal opacity-50 group-open:hidden">Show</span>
            <span className="hidden text-xs font-normal opacity-50 group-open:inline">Hide</span>
          </span>
        </summary>
        <div className="border-t border-base-200 px-4 py-3 sm:px-5">
          {(timeline ?? []).length === 0 ? (
            <p className="text-sm opacity-70">No status changes logged yet.</p>
          ) : (
            <ul className="timeline timeline-vertical timeline-compact">
              {(timeline ?? []).map((t) => (
                <li key={t.id}>
                  <hr />
                  <div className="timeline-start text-xs opacity-60">
                    {new Date(t.created_at).toLocaleString()}
                  </div>
                  <div className="timeline-middle">
                    <div className="h-3 w-3 rounded-full bg-primary" />
                  </div>
                  <div className="timeline-end timeline-box text-sm">
                    {t.from_status ?? "—"} → {t.to_status}
                    {t.note ? ` · ${sanitizeDemoText(t.note)}` : ""}
                  </div>
                  <hr />
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </div>
  );
}

