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
  acceptLoadOffer,
  cancelShipment,
  declineLoadOffer,
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
import { parseCarrierDeclineReason } from "@/lib/carrier-declines";
import { canManageBilling } from "@/lib/roles";
import { insuranceRiskStatus } from "@/lib/risk-credit";
import { buildCarrierScorecards, suggestCarriersForLoad, tierBadge } from "@/lib/carrier-scorecard";
import { isControlOverrideNote } from "@/lib/control-activity";
import { computeShipmentHealth } from "@/lib/shipment-health";
import { createClient } from "@/lib/supabase/server";
import { formatStatusLabel, isOperations, money, statusBadge, type ShipmentStatus } from "@/lib/types";

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
  const { data: s } = await supabase
    .from("shipments")
    .select("*, customers(name), carriers(name), contracts(contract_number, title)")
    .eq("id", id)
    .maybeSingle();
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
  const latestDeclineReason = (timeline ?? [])
    .map((t) => parseCarrierDeclineReason(t.note as string | null))
    .find((r): r is string => Boolean(r));
  if (canAssign && !s.carrier_id && latestDeclineReason) {
    nextAction = {
      label: `Carrier declined — reassign (${latestDeclineReason})`,
      form: "assign",
      href: `/assign?focus=${s.id}`,
    };
  } else if (canAssign && !s.carrier_id) {
    nextAction = { label: "Assign a carrier to cover this load", form: "assign" };
  } else if (canAssign && s.status === "offered" && s.carrier_id) {
    nextAction = {
      label: "Awaiting carrier acceptance — reassign from Assign carriers if needed",
      href: `/assign?focus=${s.id}`,
    };
  } else if (isCarrier && s.status === "offered") {
    nextAction = { label: "Accept or decline this load offer", href: "/offers" };
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

  async function setStatus(status: ShipmentStatus) {
    "use server";
    await updateShipmentStatus(id, status);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/shipments" className="link link-hover text-sm">
            ← Shipments
          </Link>
          <h1 className="text-2xl font-bold">{s.load_number}</h1>
          <p className="text-sm opacity-70">
            {s.pickup_location} → {s.delivery_location}
          </p>
          <span className={`badge mt-2 ${statusBadge(s.status)}`}>
            {formatStatusLabel(s.status)}
          </span>
          {s.status === "offered" ? (
            <p className="mt-2 text-sm font-medium text-warning">
              {isCarrier
                ? "This load is offered to you — accept it to add it to My Deliveries."
                : "Awaiting carrier acceptance of this offer."}
            </p>
          ) : null}
        </div>
        {isCarrier && s.status === "offered" ? (
          <div className="flex w-full max-w-xs flex-col gap-2 rounded-box border border-warning/40 bg-warning/5 p-3">
            <form action={acceptLoadOffer}>
              <input type="hidden" name="shipment_id" value={s.id} />
              <button className="btn btn-primary btn-sm w-full">Accept offer</button>
            </form>
            <details>
              <summary className="btn btn-ghost btn-xs cursor-pointer">Decline…</summary>
              <form action={declineLoadOffer} className="mt-2 flex flex-col gap-2">
                <input type="hidden" name="shipment_id" value={s.id} />
                <input
                  name="note"
                  required
                  minLength={3}
                  placeholder="Reason for ops"
                  className="input input-bordered input-sm"
                />
                <button className="btn btn-error btn-sm">Confirm decline</button>
              </form>
            </details>
          </div>
        ) : null}
        {canOperate || canBill ? (
          <div className="flex flex-wrap gap-2">
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
          </div>
        ) : null}
      </div>

      {canAssign && !s.carrier_id && latestDeclineReason ? (
        <div className="alert alert-error text-sm">
          <span>
            Carrier declined this offer: {latestDeclineReason}. Reassign from{" "}
            <Link href={`/assign?focus=${s.id}`} className="link font-semibold">
              Assign carriers
            </Link>{" "}
            or use the form below.
          </span>
        </div>
      ) : null}

      {showInternalFinance && profile.role !== "broker" && margin < 0 ? (
        <div className="alert alert-warning">
          <span>
            Warning: this shipment is currently unprofitable ({money(margin)} margin). Booking is
            not blocked — review coverage and rates.
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
              <li key={t.id} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
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
            Assigned carrier has expired insurance (Suspended). Reassign to an eligible carrier —
            saving the current assignment is blocked.
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
                {latestDeclineReason ? "Reassign carrier" : "Assign carrier"}
              </a>
            ) : null}
          </div>
        </div>
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

      {canOperate && isDelayed && isOperations(profile.role) ? (
        <div className="card border border-error/30 bg-error/5 shadow-sm">
          <div className="card-body gap-3 py-4">
            <div>
              <h2 className="card-title text-base text-error">Delayed — update ETA</h2>
              <p className="text-sm opacity-70">
                Log the carrier ETA and customer outreach. Optionally revise the promised delivery
                date.
              </p>
            </div>
            <form action={logDelayUpdate} className="grid gap-2 md:grid-cols-2">
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
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {isCustomer ? (
          <CustomerFriendlyStatusCard health={friendly} />
        ) : (
          <ShipmentHealthCard health={health} audience={isCarrier ? "carrier" : "internal"} />
        )}
        <C2CTimeline steps={c2cSteps} />
      </div>

      {showLoadJournals ? <ShipmentJournalStrip entries={loadJournalEntries} /> : null}

      {showInternalFinance ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="stats bg-base-100 shadow-sm">
              <div className="stat">
                <div className="stat-title">Customer rate</div>
                <div className="stat-value text-2xl">{money(s.customer_rate)}</div>
              </div>
            </div>
            <div className="stats bg-base-100 shadow-sm">
              <div className="stat">
                <div className="stat-title">Carrier cost (COGS)</div>
                <div className="stat-value text-2xl">{money(s.carrier_cost)}</div>
              </div>
            </div>
            <div className="stats bg-base-100 shadow-sm">
              <div className="stat">
                <div className="stat-title">Profit</div>
                <div
                  className={`stat-value text-2xl ${margin < 0 ? "text-error" : "text-success"}`}
                >
                  {money(margin)}
                </div>
              </div>
            </div>
          </div>
          {profile.role !== "broker" ? (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body py-4">
                <h2 className="card-title text-base">Cost & revenue build-up</h2>
                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
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
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {isCustomer ? (
        <div className="stats bg-base-100 shadow-sm w-full max-w-sm">
          <div className="stat">
            <div className="stat-title">Your shipment rate</div>
            <div className="stat-value text-2xl">{money(s.customer_rate)}</div>
          </div>
        </div>
      ) : null}

      {isCarrier ? (
        <div className="stats bg-base-100 shadow-sm w-full max-w-sm">
          <div className="stat">
            <div className="stat-title">Your haul pay</div>
            <div className="stat-value text-2xl">{money(s.carrier_cost)}</div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Details</h2>
            <ul className="space-y-1 text-sm">
              {!isCarrier ? (
                <li>Customer: {(s.customers as { name?: string } | null)?.name}</li>
              ) : null}
              {!isCustomer ? (
                <li>
                  Carrier: {(s.carriers as { name?: string } | null)?.name ?? "Unassigned"}
                </li>
              ) : (
                <li>
                  Carrier:{" "}
                  {(s.carriers as { name?: string } | null)?.name
                    ? "Assigned"
                    : "Pending assignment"}
                </li>
              )}
              {!isCarrier ? (
                <li>
                  Contract:{" "}
                  {(s.contracts as { contract_number?: string } | null)?.contract_number ??
                    "Spot"}
                </li>
              ) : null}
              <li>
                Freight: {s.freight_type ?? "—"} · Weight {s.weight_lbs ?? "—"} lbs
              </li>
              <li>
                Pickup {s.pickup_date ?? "TBD"} · Delivery {s.delivery_date ?? "TBD"}
                {s.promised_delivery_date ? ` · Expected ${s.promised_delivery_date}` : ""}
              </li>
            </ul>
            {canAssign ? (
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
            ) : null}
          </div>
        </div>

        <div id="pod-upload" className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Proof of delivery</h2>
            {(pods ?? []).length ? (
              <ul className="space-y-2 text-sm">
                {(pods ?? []).map((p) => (
                  <li key={p.id} className="rounded-box bg-base-200 p-3">
                    Signed by {p.signed_by ?? "—"} · {new Date(p.delivered_at).toLocaleString()}
                    {sanitizeDemoText(p.notes) ? (
                      <div className="opacity-70">{sanitizeDemoText(p.notes)}</div>
                    ) : null}
                    {normalizePodUrl(p.file_url) ? (
                      <a
                        className="link"
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
              <p className="text-sm opacity-70">No POD on file yet — required before invoicing.</p>
            )}
            {canOperate ? (
              <PodUploadForm
                shipmentId={id}
                defaultSignedBy={profile.role === "carrier" ? "Consignee" : ""}
                replacing={(pods ?? []).length > 0}
              />
            ) : null}
          </div>
        </div>
      </div>

      {showCharges ? (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">
              {isCustomer ? "Extra charges on your shipment" : "Accessorial charges"}
            </h2>
            <ul className="mb-3 space-y-1 text-sm">
              {(charges ?? [])
                .filter((c) => (isCustomer ? c.billable_to_customer : true))
                .map((c) => (
                  <li
                    key={c.id}
                    className="flex justify-between gap-2 border-b border-base-200 py-2"
                  >
                    <span>
                      {c.description}{" "}
                      {!isCustomer ? (
                        <span className="badge badge-ghost badge-xs">{c.approval_status}</span>
                      ) : null}
                    </span>
                    <span>{money(c.amount)}</span>
                  </li>
                ))}
            </ul>
            {canOperate && !isCustomer ? (
              <form action={requestAccessorial} className="grid gap-2 md:grid-cols-2">
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
                  <input type="checkbox" name="payable_to_carrier" className="checkbox checkbox-sm" />
                  <span className="label-text">Payable to carrier</span>
                </label>
                <button className="btn btn-outline btn-sm">Request / add charge</button>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {profile.role === "broker" ? (
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <h2 className="card-title text-base">Billing status</h2>
              {(invoices ?? []).length === 0 ? (
                <p className="text-sm opacity-70">
                  Not invoiced yet. After POD, Billing invoices the customer (AR) and pays the
                  carrier (AP). Brokers do not run bill/pay from this portal.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {(invoices ?? []).map((inv) => (
                    <li key={inv.id}>
                      <span className="font-medium">{inv.invoice_number}</span>{" "}
                      <span className={`badge ${statusBadge(inv.status)}`}>{inv.status}</span>{" "}
                      {money(inv.amount_paid)} / {money(inv.total)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : !isCarrier ? (
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <h2 className="card-title text-base">Invoices</h2>
              {(invoices ?? []).length === 0 ? (
                <p className="text-sm opacity-70">Not billed yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {(invoices ?? []).map((inv) => (
                    <li key={inv.id}>
                      <Link href="/invoices" className="link">
                        {inv.invoice_number}
                      </Link>{" "}
                      <span className={`badge ${statusBadge(inv.status)}`}>{inv.status}</span>{" "}
                      {money(inv.amount_paid)} / {money(inv.total)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <h2 className="card-title text-base">Document checklist</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm">
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
              <Link href="/documents" className="btn btn-ghost btn-sm w-fit">
                Open documents
              </Link>
            </div>
          </div>
        )}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Status history</h2>
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
        </div>
      </div>
    </div>
  );
}
