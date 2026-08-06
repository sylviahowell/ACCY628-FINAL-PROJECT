import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  ClipboardList,
  FileWarning,
  HandCoins,
  Inbox,
  Package,
  PackageCheck,
  Scale,
  Timer,
  Truck,
  Wallet,
} from "lucide-react";
import { MorningBriefCard } from "@/components/ExecutivePanels";
import { UnbilledQueuePanel } from "@/components/BillingPanels";
import { BrokerTaskBoard } from "@/components/BrokerTaskBoard";
import { CarrierTaskList } from "@/components/CarrierTaskList";
import { CollectionsWorklist } from "@/components/CollectionsWorklist";
import { DashboardStatCard } from "@/components/DashboardStatCard";
import { ExpandableSection } from "@/components/ExpandableSection";
import {
  ShipperInvoicesPanel,
  ShipperShipmentsPanel,
} from "@/components/ShipperDashboardPanels";
import { ProfitabilityHeatmap } from "@/components/ProfitabilityHeatmap";
import { ShipmentMapLazy } from "@/components/ShipmentMapLazy";
import { DecideNowRail } from "@/components/DecideNowRail";
import { EmptyState } from "@/components/EmptyState";
import { requirePathAccess } from "@/lib/authz";
import { buildBrokerTasks, brokerTaskStats } from "@/lib/broker-tasks";
import { latestDeclinesByShipment } from "@/lib/carrier-declines";
import { buildCarrierScorecards } from "@/lib/carrier-scorecard";
import {
  buildCollectionWorklist,
  buildUnbilledQueues,
  computeAging,
} from "@/lib/collections";
import {
  arBalanceAsOf,
  buildDecideNowCandidates,
  countActiveAsOf,
  countLateAsOf,
  rankDecideNowItems,
} from "@/lib/decide-now";
import { openApBalance } from "@/lib/payables";
import { toHeatRows } from "@/lib/heatmap";
import { buildExecutiveKpis, inRange, monthBounds } from "@/lib/kpi";
import { morningBriefGreeting } from "@/lib/morning-brief";
import { isActiveFinalInvoice } from "@/lib/invoice-helpers";
import { buildCarrierTasks } from "@/lib/portal-views";
import {
  creditStatus,
  insuranceRiskStatus,
  openArFromInvoices,
} from "@/lib/risk-credit";
import { computeShipmentHealth } from "@/lib/shipment-health";
import { createClient } from "@/lib/supabase/server";
import { sanitizeDemoText } from "@/lib/display-text";
import { money, statusBadge, formatStatusLabel } from "@/lib/types";

export default async function DashboardPage() {
  const profile = await requirePathAccess("/dashboard");

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: shipments },
    { data: invoices },
    { data: profit },
    { data: customers },
    { data: carriers },
    { data: payments },
    { data: disputes },
    { data: approvals },
    { data: pods },
    { data: charges },
    { data: contracts },
    { data: collectionNotes },
    { data: carrierBills },
    { data: coverageRequests },
    { data: supportTickets },
  ] = await Promise.all([
    supabase
      .from("shipments")
      .select(
        "id, load_number, status, customer_rate, carrier_cost, delivery_date, pickup_date, promised_delivery_date, created_at, created_by, carrier_id, customer_id, origin_city, origin_state, dest_city, dest_state, pickup_location, delivery_location, freight_type, customers(name), carriers(name)",
      ),
    supabase
      .from("invoices")
      .select(
        "id, invoice_number, status, total, amount_paid, due_date, issue_date, shipment_id, customer_id, customers(name)",
      ),
    supabase.from("shipment_profitability").select("*"),
    supabase.from("customers").select("id, name, credit_limit"),
    supabase
      .from("carriers")
      .select("id, name, rating, insurance_expiration, equipment_type, service_area"),
    supabase.from("payments").select("invoice_id, amount, payment_date"),
    supabase
      .from("disputes")
      .select("id, reason, amount_disputed, status, invoice_id, customer_id"),
    supabase.from("approval_requests").select("*").eq("status", "pending"),
    supabase
      .from("proof_of_delivery")
      .select("id, shipment_id, delivered_at, signed_by"),
    supabase
      .from("shipment_charges")
      .select("id, shipment_id, amount, approval_status, description, payable_to_carrier"),
    supabase
      .from("contracts")
      .select("id, contract_number, end_date, status, customer_id, customers(name)"),
    profile.role === "billing" || profile.role === "manager"
      ? supabase
          .from("collection_notes")
          .select("invoice_id, note, created_at")
          .order("created_at", { ascending: false })
      : Promise.resolve({
          data: [] as { invoice_id: string; note: string; created_at: string }[],
        }),
    profile.role === "billing"
      ? supabase
          .from("carrier_bills")
          .select(
            "id, bill_number, status, total, amount_paid, due_date, shipment_id, carrier_id, carriers(name), shipments(load_number)",
          )
      : Promise.resolve({ data: [] as never[] }),
    profile.role === "manager" || profile.role === "broker" || profile.role === "customer"
      ? (() => {
          let q = supabase
            .from("coverage_requests")
            .select(
              "id, status, pickup_location, delivery_location, pickup_date, customer_id, customers(name)",
            )
            .eq("status", "pending")
            .order("created_at", { ascending: true })
            .limit(20);
          if (profile.role === "customer" && profile.customer_id) {
            q = q.eq("customer_id", profile.customer_id);
          }
          return q;
        })()
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("support_tickets")
      .select("id, status, priority")
      .in("status", ["open", "pending"]),
  ]);

  const pendingCoverage = coverageRequests ?? [];
  const pendingCoverageCount = pendingCoverage.length;
  const supportOpenList = supportTickets ?? [];
  const supportOpenCount = supportOpenList.length;
  const supportHighCount = supportOpenList.filter((t) => t.priority === "high").length;
  const customerName = new Map((customers ?? []).map((c) => [c.id, c.name]));
  let shipList = shipments ?? [];
  let invList = invoices ?? [];
  let disputeList = disputes ?? [];
  let podList = pods ?? [];
  let chargeList = charges ?? [];

  // Portal roles only see their own account slice
  if (profile.role === "customer" && profile.customer_id) {
    const cid = profile.customer_id;
    shipList = shipList.filter((s) => s.customer_id === cid);
    invList = invList.filter((i) => i.customer_id === cid);
    disputeList = disputeList.filter((d) => d.customer_id === cid);
    const shipIds = new Set(shipList.map((s) => s.id));
    podList = podList.filter((p) => shipIds.has(p.shipment_id));
    chargeList = chargeList.filter((c) => shipIds.has(c.shipment_id));
  } else if (profile.role === "carrier" && profile.carrier_id) {
    const carId = profile.carrier_id;
    shipList = shipList.filter((s) => s.carrier_id === carId);
    const shipIds = new Set(shipList.map((s) => s.id));
    podList = podList.filter((p) => shipIds.has(p.shipment_id));
    chargeList = chargeList.filter((c) => shipIds.has(c.shipment_id));
  }

  const profitList = profit ?? [];
  const profitByShipment = new Map(
    profitList.map((p) => [p.shipment_id as string, p]),
  );

  // Health inputs shared across map / scorecards
  const overdueCustomerIds = new Set(
    invList
      .filter((i) => {
        const bal = Number(i.total) - Number(i.amount_paid);
        return bal > 0 && i.due_date < today && !["paid", "cancelled"].includes(i.status);
      })
      .map((i) => i.customer_id as string),
  );
  const openDisputeInvoiceIds = new Set(
    disputeList.filter((d) => d.status === "open").map((d) => d.invoice_id as string),
  );
  const disputedShipmentIds = new Set(
    invList
      .filter((i) => openDisputeInvoiceIds.has(i.id) || i.status === "disputed")
      .map((i) => i.shipment_id as string)
      .filter(Boolean),
  );

  const ar = invList.reduce(
    (s, i) => s + Math.max(0, Number(i.total) - Number(i.amount_paid)),
    0,
  );
  const pastDue = invList.filter((i) => {
    const bal = Number(i.total) - Number(i.amount_paid);
    return bal > 0 && i.due_date < today && !["paid", "cancelled"].includes(i.status);
  });

  // ——— EXECUTIVE ———
  if (profile.role === "manager") {
    const activeList = shipList.filter((s) =>
      ["scheduled", "assigned", "booked", "picked_up", "in_transit"].includes(s.status),
    );
    const lateList = shipList.filter(
      (s) =>
        s.promised_delivery_date &&
        s.promised_delivery_date < today &&
        !["delivered", "completed", "cancelled"].includes(s.status),
    );

    const thisMonth = monthBounds(0);
    const lastMonth = monthBounds(-1);
    const weekAgo = new Date();
    weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
    const weekAgoStr = weekAgo.toISOString().slice(0, 10);

    const revInMonth = (start: Date, end: Date) =>
      invList
        .filter((i) => i.status !== "cancelled" && inRange(i.issue_date, start, end))
        .reduce((s, i) => s + Number(i.total), 0);
    const profitInMonth = (start: Date, end: Date) =>
      shipList.reduce((sum, s) => {
        const date = s.delivery_date || s.pickup_date || s.created_at;
        if (!inRange(date, start, end)) return sum;
        const p = profitByShipment.get(s.id);
        return sum + (p ? Number(p.margin) : Number(s.customer_rate) - Number(s.carrier_cost));
      }, 0);

    const revenueThisMonth = revInMonth(thisMonth.start, thisMonth.end);
    const revenueLastMonth = revInMonth(lastMonth.start, lastMonth.end);
    const profitThisMonth = profitInMonth(thisMonth.start, thisMonth.end);
    const profitLastMonth = profitInMonth(lastMonth.start, lastMonth.end);
    const marginThisMonth =
      revenueThisMonth > 0 ? (profitThisMonth / revenueThisMonth) * 100 : 0;
    const marginLastMonth =
      revenueLastMonth > 0 ? (profitLastMonth / revenueLastMonth) * 100 : 0;

    const cashThisMonth = (payments ?? [])
      .filter((p) => inRange(p.payment_date, thisMonth.start, thisMonth.end))
      .reduce((s, p) => s + Number(p.amount), 0);
    const cashLastMonth = (payments ?? [])
      .filter((p) => inRange(p.payment_date, lastMonth.start, lastMonth.end))
      .reduce((s, p) => s + Number(p.amount), 0);

    const activeAsOfWeekAgo = countActiveAsOf(shipList, weekAgoStr);
    const lateAsOfWeekAgo = countLateAsOf(shipList, weekAgoStr);
    const lastMonthEndStr = lastMonth.end.toISOString().slice(0, 10);
    const arLastMonthEnd = arBalanceAsOf({
      invoices: invList.map((i) => ({
        id: i.id,
        total: Number(i.total),
        issue_date: i.issue_date,
        status: i.status,
      })),
      payments: (payments ?? []).map((p) => ({
        invoice_id: (p as { invoice_id?: string }).invoice_id ?? "",
        amount: Number(p.amount),
        payment_date: p.payment_date,
      })),
      asOfExclusive: lastMonthEndStr,
    });

    const kpis = buildExecutiveKpis({
      revenueThisMonth,
      revenueLastMonth,
      profitThisMonth,
      profitLastMonth,
      marginThisMonth,
      marginLastMonth,
      activeShipments: activeList.length,
      activeAsOfWeekAgo,
      lateDeliveries: lateList.length,
      lateAsOfWeekAgo,
      arBalance: ar,
      arLastMonthEnd,
      cashThisMonth,
      cashLastMonth,
    });

    const podSet = new Set(podList.map((p) => p.shipment_id));
    const billedSet = new Set(
      invList.filter((i) => isActiveFinalInvoice(i) && i.shipment_id).map((i) => i.shipment_id),
    );
    const unbilledShipments = shipList.filter(
      (s) =>
        ["delivered", "completed"].includes(s.status) &&
        podSet.has(s.id) &&
        !billedSet.has(s.id),
    );

    const heatRows = toHeatRows({
      profit: profitList.map((p) => ({
        shipment_id: p.shipment_id,
        load_number: p.load_number,
        customer_id: p.customer_id,
        customer_rate: Number(p.customer_rate),
        carrier_cost: Number(p.carrier_cost),
        billable_accessorials: Number(p.billable_accessorials),
        payable_accessorials: Number(p.payable_accessorials),
        discount_amount: p.discount_amount == null ? null : Number(p.discount_amount),
        margin: Number(p.margin),
      })),
      shipments: shipList.map((s) => ({
        id: s.id,
        carrier_id: s.carrier_id,
        origin_city: s.origin_city,
        dest_city: s.dest_city,
        pickup_date: s.pickup_date,
        delivery_date: s.delivery_date,
        created_at: s.created_at,
      })),
      customerNames: customerName,
      carrierNames: new Map((carriers ?? []).map((c) => [c.id, c.name])),
    });

    const mapShipments = shipList
      .filter((s) => s.status !== "cancelled")
      .map((s) => {
        const hasPod = podSet.has(s.id);
        const pendingAccessorials = chargeList.filter(
          (c) => c.shipment_id === s.id && c.approval_status === "pending",
        ).length;
        const p = profitByShipment.get(s.id);
        const margin = p
          ? Number(p.margin)
          : Number(s.customer_rate) - Number(s.carrier_cost);
        const billed = billedSet.has(s.id);
        let daysSinceDeliveryUnbilled: number | null = null;
        if (["delivered", "completed"].includes(s.status) && !billed && s.delivery_date) {
          daysSinceDeliveryUnbilled = Math.floor(
            (new Date(today + "T00:00:00Z").getTime() -
              new Date(s.delivery_date + "T00:00:00Z").getTime()) /
              (1000 * 60 * 60 * 24),
          );
        }
        const health = computeShipmentHealth({
          status: s.status,
          carrier_id: s.carrier_id,
          promised_delivery_date: s.promised_delivery_date,
          delivery_date: s.delivery_date,
          margin,
          hasPod,
          pendingAccessorials,
          daysSinceDeliveryUnbilled,
          hasOpenDispute: disputedShipmentIds.has(s.id),
          hasOverdueInvoice: overdueCustomerIds.has(s.customer_id as string),
          today,
        });
        return {
          id: s.id,
          load_number: s.load_number,
          status: s.status,
          origin_city: s.origin_city,
          origin_state: s.origin_state,
          dest_city: s.dest_city,
          dest_state: s.dest_state,
          pickup_location: s.pickup_location,
          delivery_location: s.delivery_location,
          pickup_date: s.pickup_date,
          promised_delivery_date: s.promised_delivery_date,
          customer_name: (s.customers as { name?: string } | null)?.name ?? "Customer",
          carrier_name: (s.carriers as { name?: string } | null)?.name ?? "Unassigned",
          health_score: health.score,
          health_category: health.category,
        };
      });

    const cashAtRisk =
      pastDue.reduce(
        (s, i) => s + Math.max(0, Number(i.total) - Number(i.amount_paid)),
        0,
      ) +
      disputeList
        .filter((d) => d.status === "open")
        .reduce((s, d) => s + Number(d.amount_disputed), 0);

    const openDisputeCount = disputeList.filter((d) => d.status === "open").length;

    const invoicesByCustomer = new Map<
      string,
      { total: number; amount_paid: number; status: string }[]
    >();
    for (const inv of invList) {
      if (inv.status === "cancelled") continue;
      const list = invoicesByCustomer.get(inv.customer_id as string) ?? [];
      list.push({
        total: Number(inv.total),
        amount_paid: Number(inv.amount_paid),
        status: inv.status,
      });
      invoicesByCustomer.set(inv.customer_id as string, list);
    }
    const insuranceExpired = (carriers ?? []).filter(
      (c) => insuranceRiskStatus(c.insurance_expiration ?? null, today).status === "expired",
    );
    const insuranceExpiringList = (carriers ?? []).filter((c) => {
      const status = insuranceRiskStatus(c.insurance_expiration ?? null, today).status;
      return status === "expiring";
    });
    const overCreditCustomers = (customers ?? []).filter((c) => {
      const openAr = openArFromInvoices(invoicesByCustomer.get(c.id) ?? []);
      return creditStatus(openAr, Number(c.credit_limit ?? 0)) === "over";
    });
    const customersOverCredit = overCreditCustomers.length;
    const riskIssueCount =
      customersOverCredit + insuranceExpired.length + insuranceExpiringList.length;
    const riskDetailParts: string[] = [];
    if (customersOverCredit > 0) {
      riskDetailParts.push(
        `${customersOverCredit} customer${customersOverCredit === 1 ? "" : "s"} over credit`,
      );
    }
    if (insuranceExpired.length > 0) {
      riskDetailParts.push(
        `${insuranceExpired.length} carrier${insuranceExpired.length === 1 ? "" : "s"} insurance expired`,
      );
    }
    if (insuranceExpiringList.length > 0) {
      riskDetailParts.push(
        `${insuranceExpiringList.length} carrier${insuranceExpiringList.length === 1 ? "" : "s"} insurance expiring ≤30d`,
      );
    }
    const riskFocusId =
      insuranceExpired[0]?.id ??
      overCreditCustomers[0]?.id ??
      insuranceExpiringList[0]?.id ??
      null;

    const invoiceNumberById = new Map(
      invList.map((i) => [i.id as string, i.invoice_number as string]),
    );
    const openDisputes = disputeList
      .filter((d) => d.status === "open")
      .map((d) => ({
        id: d.id as string,
        amount_disputed: Number(d.amount_disputed),
        invoice_number: d.invoice_id
          ? (invoiceNumberById.get(d.invoice_id as string) ?? null)
          : null,
      }));

    const resolveLoadNumber = (entityType: string, entityId: string) => {
      if (entityType === "shipment") {
        return shipList.find((s) => s.id === entityId)?.load_number ?? null;
      }
      if (entityType === "shipment_charge") {
        const shipId = chargeList.find((c) => c.id === entityId)?.shipment_id;
        return shipId
          ? (shipList.find((s) => s.id === shipId)?.load_number ?? null)
          : null;
      }
      return null;
    };

    const decideNowItems = rankDecideNowItems(
      buildDecideNowCandidates({
        today,
        coverageCount: pendingCoverageCount,
        coverageFocusId: pendingCoverage[0]?.id ?? null,
        approvals: (approvals ?? []).map((a) => ({
          id: a.id,
          amount: Number(a.amount),
          request_type: a.request_type,
          entity_type: a.entity_type,
          entity_id: a.entity_id,
          created_at: a.created_at ?? null,
        })),
        lateShipments: lateList.map((s) => ({
          id: s.id,
          load_number: s.load_number,
          customer_rate: Number(s.customer_rate),
          promised_delivery_date: s.promised_delivery_date,
          status: s.status,
        })),
        unbilledShipments: unbilledShipments.map((s) => ({
          id: s.id,
          load_number: s.load_number,
          customer_rate: Number(s.customer_rate),
          promised_delivery_date: s.promised_delivery_date,
          status: s.status,
        })),
        pastDueInvoices: pastDue.map((i) => ({
          id: i.id,
          invoice_number: i.invoice_number,
          total: Number(i.total),
          amount_paid: Number(i.amount_paid),
          due_date: i.due_date,
        })),
        openDisputes,
        openDisputeCount,
        cashAtRisk,
        riskIssueCount,
        riskDetail: riskDetailParts.join(" · "),
        riskTone:
          insuranceExpired.length > 0 || customersOverCredit > 0 ? "error" : "warning",
        riskFocusId,
        supportOpenCount,
        supportHighCount,
        supportFocusId:
          supportOpenList.find((t) => t.priority === "high")?.id ??
          supportOpenList[0]?.id ??
          null,
        resolveLoadNumber,
        sanitize: sanitizeDemoText,
      }),
      5,
    );

    return (
      <div className="space-y-6">
        <Header
          title="Executive Dashboard"
          subtitle={`Company performance and exceptions · As of ${today} UTC`}
          action={
            <Link href="/controls" className="link link-hover text-sm opacity-70">
              Recent control overrides →
            </Link>
          }
        />
        <MorningBriefCard
          greeting={morningBriefGreeting(profile.full_name)}
          kpis={kpis}
        />
        <DecideNowRail items={decideNowItems} />
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Network & profitability</h2>
            <p className="text-sm opacity-70">
              Margin concentration and live freight position.
            </p>
          </div>
          <ProfitabilityHeatmap rows={heatRows} />
          <ShipmentMapLazy shipments={mapShipments} today={today} />
        </div>
      </div>
    );
  }

  // ——— BROKER OPS ———
  if (profile.role === "broker") {
    const podSet = new Set(podList.map((p) => p.shipment_id));
    const pendingCharges = chargeList.filter((c) => c.approval_status === "pending");
    const { data: declineUpdates } = await supabase
      .from("shipment_status_updates")
      .select("shipment_id, note, created_at")
      .ilike("note", "Carrier declined offer:%")
      .order("created_at", { ascending: false })
      .limit(200);
    const declinesByShipment = latestDeclinesByShipment(declineUpdates ?? []);
    const brokerTasks = buildBrokerTasks({
      shipments: shipList.map((s) => ({
        id: s.id,
        load_number: s.load_number,
        status: s.status,
        carrier_id: s.carrier_id,
        customer_id: s.customer_id,
        pickup_date: s.pickup_date,
        delivery_date: s.delivery_date,
        promised_delivery_date: s.promised_delivery_date,
        origin_city: s.origin_city,
        dest_city: s.dest_city,
        pickup_location: s.pickup_location,
        delivery_location: s.delivery_location,
        customer_rate: Number(s.customer_rate),
        carrier_cost: Number(s.carrier_cost),
        created_by: s.created_by ?? null,
        customers: s.customers as { name?: string } | null,
      })),
      today,
      profileId: profile.id,
      pendingCharges: pendingCharges.map((c) => ({
        id: c.id,
        shipment_id: c.shipment_id,
        description: c.description,
        amount: Number(c.amount),
      })),
      contracts: (contracts ?? []).map((c) => ({
        id: c.id,
        contract_number: c.contract_number,
        end_date: c.end_date,
        status: c.status,
        customers: c.customers as { name?: string } | null,
      })),
      podShipmentIds: podSet,
      declinesByShipment,
    });
    const stats = brokerTaskStats(brokerTasks);
    const brokerScale = Math.max(
      1,
      pendingCoverageCount,
      stats.pickupsToday,
      stats.deliveriesToday,
      stats.unassigned,
      stats.delayed,
      stats.accessorial,
    );

    const profitMap = new Map(
      profitList.map((p) => [
        p.shipment_id as string,
        { margin: Number(p.margin), carrier_cost: Number(p.carrier_cost) },
      ]),
    );
    const chargeCount = new Map<string, number>();
    for (const c of chargeList) {
      chargeCount.set(c.shipment_id, (chargeCount.get(c.shipment_id) ?? 0) + 1);
    }
    const scorecards = buildCarrierScorecards({
      carriers: (carriers ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        equipment_type: (c as { equipment_type?: string | null }).equipment_type ?? null,
        service_area: (c as { service_area?: string | null }).service_area ?? null,
        rating: c.rating == null ? null : Number(c.rating),
        insurance_expiration: c.insurance_expiration ?? null,
      })),
      shipments: shipList.map((s) => ({
        id: s.id,
        carrier_id: s.carrier_id,
        status: s.status,
        pickup_date: s.pickup_date,
        delivery_date: s.delivery_date,
        promised_delivery_date: s.promised_delivery_date,
        carrier_cost: Number(s.carrier_cost),
        customer_rate: Number(s.customer_rate),
      })),
      profitByShipment: profitMap,
      podShipmentIds: podSet,
      chargesByShipment: chargeCount,
      today,
    });

    const mapShipments = shipList
      .filter((s) => s.status !== "cancelled")
      .map((s) => {
        const hasPod = podSet.has(s.id);
        const pendingAccessorials = chargeList.filter(
          (c) => c.shipment_id === s.id && c.approval_status === "pending",
        ).length;
        const p = profitByShipment.get(s.id);
        const margin = p
          ? Number(p.margin)
          : Number(s.customer_rate) - Number(s.carrier_cost);
        const health = computeShipmentHealth({
          status: s.status,
          carrier_id: s.carrier_id,
          promised_delivery_date: s.promised_delivery_date,
          delivery_date: s.delivery_date,
          margin,
          hasPod,
          pendingAccessorials,
          daysSinceDeliveryUnbilled: null,
          hasOpenDispute: disputedShipmentIds.has(s.id),
          hasOverdueInvoice: overdueCustomerIds.has(s.customer_id as string),
          today,
        });
        return {
          id: s.id,
          load_number: s.load_number,
          status: s.status,
          origin_city: s.origin_city,
          origin_state: s.origin_state,
          dest_city: s.dest_city,
          dest_state: s.dest_state,
          pickup_location: s.pickup_location,
          delivery_location: s.delivery_location,
          pickup_date: s.pickup_date,
          promised_delivery_date: s.promised_delivery_date,
          customer_name: (s.customers as { name?: string } | null)?.name ?? "Customer",
          carrier_name: (s.carriers as { name?: string } | null)?.name ?? "Unassigned",
          health_score: health.score,
          health_category: health.category,
        };
      });

    const delayedLoads = shipList.filter(
      (s) =>
        s.promised_delivery_date &&
        s.promised_delivery_date < today &&
        !["delivered", "completed", "cancelled"].includes(s.status),
    );
    const unassignedLoads = shipList.filter(
      (s) =>
        !s.carrier_id && !["delivered", "completed", "cancelled"].includes(s.status),
    );
    const declinedLoads = unassignedLoads.filter((s) => declinesByShipment.has(s.id));
    const plainUnassigned = unassignedLoads.filter((s) => !declinesByShipment.has(s.id));
    const offeredLoads = shipList.filter((s) => s.status === "offered" && s.carrier_id);
    const watchCarriers = scorecards.filter(
      (c) => c.tier === "Watch List" || c.tier === "Suspended",
    );

    const watchActionItems = [
      ...pendingCoverage.map((r) => ({
        id: `broker-coverage-${r.id}`,
        title: "Load request pending",
        metric: "1",
        metricKind: "count" as const,
        metricUnit: "request",
        detail: `${r.pickup_location} → ${r.delivery_location}`,
        href: `/coverage?focus=${r.id}`,
        tone: "warning" as const,
        cta: "Open",
        score: 50_000,
      })),
      ...delayedLoads.map((s) => ({
        id: `broker-delayed-${s.id}`,
        title: `${s.load_number} is delayed`,
        metric: "1",
        metricKind: "count" as const,
        metricUnit: "load",
        detail: `Promised ${s.promised_delivery_date} · still ${s.status}`,
        href: `/shipments/${s.id}`,
        tone: "error" as const,
        cta: "Open",
        score: 80_000 + Number(s.customer_rate || 0),
      })),
      ...declinedLoads.map((s) => ({
        id: `broker-declined-${s.id}`,
        title: `${s.load_number} — carrier declined`,
        metric: "1",
        metricKind: "count" as const,
        metricUnit: "load",
        detail: declinesByShipment.get(s.id)?.reason ?? "Reassign a carrier",
        href: `/assign?focus=${s.id}`,
        tone: "error" as const,
        cta: "Reassign",
        score: 75_000 + Number(s.customer_rate || 0),
      })),
      ...plainUnassigned.map((s) => ({
        id: `broker-unassigned-${s.id}`,
        title: `${s.load_number} needs a carrier`,
        metric: "1",
        metricKind: "count" as const,
        metricUnit: "load",
        detail: `${s.pickup_location ?? `${s.origin_city}, ${s.origin_state}`} → ${
          s.delivery_location ?? `${s.dest_city}, ${s.dest_state}`
        }`,
        href: `/assign?focus=${s.id}`,
        tone: "warning" as const,
        cta: "Open",
        score: 60_000 + Number(s.customer_rate || 0),
      })),
      ...offeredLoads.map((s) => ({
        id: `broker-offered-${s.id}`,
        title: `${s.load_number} awaiting acceptance`,
        metric: "1",
        metricKind: "count" as const,
        metricUnit: "load",
        detail: "Offer pending — reassign if the carrier is unresponsive",
        href: `/assign?focus=${s.id}`,
        tone: "info" as const,
        cta: "Reassign",
        score: 45_000 + Number(s.customer_rate || 0),
      })),
      ...pendingCharges.map((c) => {
        const ship = shipList.find((s) => s.id === c.shipment_id);
        return {
          id: `broker-accessorial-${c.id}`,
          title: "Accessorial awaiting manager",
          metric: money(Number(c.amount)),
          metricKind: "money" as const,
          detail: `${ship?.load_number ?? "Load"} · ${c.description}`,
          href: `/shipments/${c.shipment_id}`,
          tone: "info" as const,
          cta: "Open",
          score: 30_000 + Number(c.amount),
        };
      }),
      ...watchCarriers.map((c) => ({
        id: `broker-carrier-${c.carrierId}`,
        title: `${c.name} — ${c.tier}`,
        metric: "1",
        metricKind: "count" as const,
        metricUnit: "carrier",
        detail:
          c.insuranceStatus === "Expired"
            ? `Insurance expired${c.insuranceExpiration ? ` ${c.insuranceExpiration}` : ""}`
            : c.tierReasons[0] ?? "Review before assigning",
        href: `/risk?focus=${c.carrierId}`,
        tone: "warning" as const,
        cta: "Open",
        score: c.tier === "Suspended" ? 55_000 : 40_000,
      })),
    ];
    const brokerDecideNow = rankDecideNowItems(watchActionItems, 5);

    return (
      <div className="space-y-6">
        <Header
          title="Broker Operations"
          subtitle="Approve load requests, assign carriers, clear delays"
          action={
            <div className="flex flex-wrap gap-2">
              <Link href="/risk" className="btn btn-outline btn-sm">
                Risk &amp; Credit
              </Link>
              <Link href="/coverage" className="btn btn-outline btn-sm">
                Load requests
                {pendingCoverageCount > 0 ? (
                  <span className="badge badge-warning badge-sm">{pendingCoverageCount}</span>
                ) : null}
              </Link>
              <Link href="/assign" className="btn btn-outline btn-sm">
                Assign carriers
                {stats.unassigned > 0 ? (
                  <span className="badge badge-warning badge-sm">{stats.unassigned}</span>
                ) : null}
              </Link>
              <Link href="/shipments/new" className="btn btn-primary btn-sm">
                New shipment
              </Link>
            </div>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <DashboardStatCard
            title="Load requests"
            value={String(pendingCoverageCount)}
            icon={ClipboardList}
            warn={pendingCoverageCount > 0}
            meter={pendingCoverageCount / brokerScale}
            meterLabel="Share of today's broker load"
            href="/coverage"
          />
          <DashboardStatCard
            title="Today's pickups"
            value={String(stats.pickupsToday)}
            icon={Package}
            meter={stats.pickupsToday / brokerScale}
            meterLabel="Share of today's broker load"
            href="/shipments?filter=pickup-today"
          />
          <DashboardStatCard
            title="Today's deliveries"
            value={String(stats.deliveriesToday)}
            icon={PackageCheck}
            meter={stats.deliveriesToday / brokerScale}
            meterLabel="Share of today's broker load"
            href="/shipments?filter=delivery-today"
          />
          <DashboardStatCard
            title="Needs carrier"
            value={String(stats.unassigned)}
            icon={Truck}
            warn={stats.unassigned > 0}
            meter={stats.unassigned / brokerScale}
            meterLabel="Share of today's broker load"
            href="/assign"
          />
          <DashboardStatCard
            title="Delayed loads"
            value={String(stats.delayed)}
            icon={AlertTriangle}
            warn={stats.delayed > 0}
            meter={stats.delayed / brokerScale}
            meterLabel="Share of today's broker load"
            href="/shipments?filter=delayed"
          />
          <DashboardStatCard
            title="Waiting on manager"
            value={String(stats.accessorial)}
            icon={Scale}
            meter={stats.accessorial / brokerScale}
            meterLabel="Share of today's broker load"
            href="/warnings?severity=info"
          />
        </div>

        <DecideNowRail
          items={brokerDecideNow}
          title="Needs attention"
          subtitle="Each Open goes to that load request, shipment, assign queue, or risk row."
          emptyTitle="No high-priority broker exceptions"
          emptyDescription="Check the work queue for today&apos;s tasks."
        />

        <BrokerTaskBoard tasks={brokerTasks} profileId={profile.id} today={today} />
        <ShipmentMapLazy shipments={mapShipments} today={today} />
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-box border border-base-300 bg-base-100 px-4 py-3">
          <div>
            <p className="font-semibold">Carrier scorecards</p>
            <p className="text-sm opacity-70">
              Prefer Preferred / Approved carriers; Suspended (expired insurance) are blocked.
            </p>
          </div>
          <Link href="/carriers" className="btn btn-outline btn-sm">
            Open carriers
          </Link>
        </div>

        <ExpandableSection
          title="Simplified ops flow"
          description="Quick reminder of request → approve → assign."
        >
          <ol className="list-decimal space-y-1 pl-5 text-sm opacity-80">
            <li>Customer submits a load request on their active contract.</li>
            <li>You approve on Load requests (blocked on credit hold — escalate to manager Approvals).</li>
            <li>You assign a carrier on Assign carriers (blocked if insurance expired).</li>
            <li>Customer tracks the load on My Shipments.</li>
          </ol>
        </ExpandableSection>
      </div>
    );
  }

  // ——— BILLING ———
  if (profile.role === "billing") {
    const thisMonth = monthBounds(0);
    const cashMonth = (payments ?? [])
      .filter((p) => inRange(p.payment_date, thisMonth.start, thisMonth.end))
      .reduce((s, p) => s + Number(p.amount), 0);

    const aging = computeAging(invList, today);
    const pastDueAr = aging.d1_30 + aging.d31_60 + aging.d61_90 + aging.d90_plus;

    const podSet = new Set(podList.map((p) => p.shipment_id));
    const billedSet = new Set(
      invList
        .filter((i) => isActiveFinalInvoice(i) && i.shipment_id)
        .map((i) => i.shipment_id as string),
    );
    const { ready, awaitingDocs } = buildUnbilledQueues({
      shipments: shipList.map((s) => ({
        id: s.id,
        load_number: s.load_number,
        status: s.status,
        delivery_date: s.delivery_date,
        customers: s.customers as { name?: string } | null,
      })),
      billedShipmentIds: billedSet,
      podShipmentIds: podSet,
    });

    const worklist = buildCollectionWorklist({
      invoices: invList.map((i) => ({
        id: i.id,
        invoice_number: i.invoice_number,
        customer_id: i.customer_id,
        total: Number(i.total),
        amount_paid: Number(i.amount_paid),
        due_date: i.due_date,
        status: i.status,
        customers: i.customers as { name?: string } | null,
      })),
      disputes: disputeList.map((d) => ({
        invoice_id: d.invoice_id,
        status: d.status,
      })),
      notes: (collectionNotes ?? []).map((n) => ({
        invoice_id: n.invoice_id,
        note: n.note,
        created_at: n.created_at,
      })),
      today,
    });

    const apOpenBilling = openApBalance(carrierBills ?? []);

    return (
      <div className="space-y-6">
        <Header
          title="Billing & Collections Dashboard"
          subtitle="Unbilled queues, collections follow-up, and cash actions — aging detail lives on AR and AP"
          action={
            <div className="flex flex-wrap gap-2">
              <Link href="/invoices?status=ready" className="btn btn-outline btn-sm">
                Ready to bill
              </Link>
              <Link href="/ap" className="btn btn-outline btn-sm">
                Accounts Payable
              </Link>
              <Link href="/ar?focus=record-payment" className="btn btn-primary btn-sm">
                Record payment
              </Link>
            </div>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardStatCard
            title="Delivered but unbilled"
            value={String(ready.length)}
            icon={ClipboardList}
            warn={ready.length > 0}
            meter={ready.length / Math.max(1, ready.length + awaitingDocs.length)}
            meterLabel={
              ready.length + awaitingDocs.length > 0
                ? `${ready.length} of ${ready.length + awaitingDocs.length} unbilled loads are ready`
                : "No unbilled queue"
            }
            href="/shipments?status=ready"
          />
          <DashboardStatCard
            title="Total AR"
            value={money(ar)}
            icon={Wallet}
            caption={
              pastDueAr > 0
                ? `${Math.round((pastDueAr / Math.max(ar, 1)) * 100)}% is past due · ${money(pastDueAr)}`
                : "Nothing past due"
            }
            href="/ar"
          />
          <DashboardStatCard
            title="Cash this month"
            value={money(cashMonth)}
            icon={Banknote}
            meter={ar > 0 ? Math.min(1, cashMonth / ar) : cashMonth > 0 ? 1 : 0}
            meterLabel={
              ar > 0
                ? `${Math.round(Math.min(100, (cashMonth / ar) * 100))}% of open AR collected this month`
                : "No open AR baseline"
            }
            href="/ar?receipts=month"
          />
          <DashboardStatCard
            title="Open AP"
            value={money(apOpenBilling)}
            icon={HandCoins}
            warn={apOpenBilling > 0}
            meter={
              ar + apOpenBilling > 0 ? apOpenBilling / (ar + apOpenBilling) : 0
            }
            meterLabel="Share of AR+AP open balances"
            href="/ap"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <UnbilledQueuePanel
            title="Delivered & ready to bill"
            items={ready}
            empty="No POD-complete loads waiting for an invoice."
          />
          <UnbilledQueuePanel
            title="Invoices awaiting supporting documents"
            items={awaitingDocs}
            empty="No delivered loads are blocked on missing POD."
          />
        </div>

        <CollectionsWorklist items={worklist} />

        <div className="rounded-box border border-base-300 bg-base-100 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Accounts Payable</p>
              <p className="text-sm opacity-70">
                Open AP {money(apOpenBilling)}. Pay, hold, and aging detail live on the AP workbench.
              </p>
            </div>
            <Link href="/ap" className="btn btn-primary btn-sm">
              Open AP
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ——— SHIPPER ———
  if (profile.role === "customer") {
    const current = shipList.filter(
      (s) => !["completed", "cancelled"].includes(s.status),
    );
    const sortableShipments = shipList.filter((s) => s.status !== "cancelled");
    const recentDeliveries = shipList.filter((s) =>
      ["delivered", "completed"].includes(s.status),
    );
    const overdueMine = invList.filter((i) => {
      const bal = Number(i.total) - Number(i.amount_paid);
      return bal > 0 && i.due_date < today && !["paid", "cancelled"].includes(i.status);
    });
    const openDisputes = disputeList.filter((d) => d.status === "open");
    const myPendingRequests = pendingCoverage.length;

    const soon = new Date(`${today}T00:00:00Z`);
    soon.setUTCDate(soon.getUTCDate() + 30);
    const soonStr = soon.toISOString().slice(0, 10);
    const myContracts = (contracts ?? []).filter(
      (c) => c.customer_id === profile.customer_id,
    );
    const activeContracts = myContracts.filter((c) => c.status === "active");
    const expiringContracts = activeContracts.filter(
      (c) => c.end_date && c.end_date <= soonStr,
    );
    const primaryContract =
      expiringContracts[0] ??
      [...activeContracts].sort((a, b) =>
        String(a.end_date ?? "9999").localeCompare(String(b.end_date ?? "9999")),
      )[0] ??
      null;

    let contractStatusLabel = "None";
    let contractStatusDetail = "No active contract — contact Support";
    let contractWarn = true;
    let contractMeter = 0;
    if (primaryContract) {
      const ended =
        Boolean(primaryContract.end_date) && primaryContract.end_date! < today;
      const expiringSoon =
        Boolean(primaryContract.end_date) &&
        primaryContract.end_date! >= today &&
        primaryContract.end_date! <= soonStr;

      const msPerDay = 86_400_000;
      const daysRemainingRaw = primaryContract.end_date
        ? Math.ceil(
            (new Date(`${primaryContract.end_date}T00:00:00Z`).getTime() -
              new Date(`${today}T00:00:00Z`).getTime()) /
              msPerDay,
          )
        : null;
      const daysRemaining =
        daysRemainingRaw == null ? null : Math.max(0, daysRemainingRaw);
      const daysRemainingOfYear =
        daysRemaining == null ? null : Math.min(365, daysRemaining);
      // Meter = share of a 365-day year already used (closer to expiration = fuller bar).
      contractMeter =
        daysRemainingOfYear == null
          ? 0
          : Math.min(1, Math.max(0, (365 - daysRemainingOfYear) / 365));

      const remainingLabel =
        daysRemainingOfYear == null
          ? null
          : `${daysRemainingOfYear}/365 days remaining`;

      if (!primaryContract.end_date) {
        contractStatusLabel = "Open-ended";
        contractStatusDetail = `${primaryContract.contract_number} · active`;
        contractWarn = false;
        contractMeter = 0;
      } else if (ended) {
        contractStatusLabel = primaryContract.end_date as string;
        contractStatusDetail = `${primaryContract.contract_number} · ended · 0/365 days remaining`;
        contractWarn = true;
        contractMeter = 1;
      } else if (expiringSoon) {
        contractStatusLabel = primaryContract.end_date as string;
        contractStatusDetail = `${primaryContract.contract_number} · active · ${remainingLabel}`;
        contractWarn = true;
      } else {
        contractStatusLabel = primaryContract.end_date as string;
        contractStatusDetail = `${primaryContract.contract_number} · active · ${remainingLabel}`;
        contractWarn = false;
      }
      if (activeContracts.length > 1) {
        contractStatusDetail += ` · ${activeContracts.length} active`;
      }
    }

    function nextShipmentEvent(s: {
      status: string;
      pickup_date: string | null;
      delivery_date: string | null;
      promised_delivery_date: string | null;
    }) {
      if (["delivered", "completed", "cancelled"].includes(s.status)) return null;
      const delivery = s.promised_delivery_date ?? s.delivery_date;
      if (
        s.pickup_date &&
        s.pickup_date >= today &&
        ["scheduled", "assigned", "booked"].includes(s.status)
      ) {
        return `Next pickup ${s.pickup_date}`;
      }
      if (s.status === "in_transit" || s.status === "picked_up") {
        return delivery ? `Next delivery ${delivery}` : "In transit · delivery TBD";
      }
      if (s.pickup_date && s.pickup_date < today && !delivery) {
        return `Pickup was ${s.pickup_date}`;
      }
      if (delivery) {
        if (s.pickup_date && s.pickup_date >= today) {
          return `Pickup ${s.pickup_date} · Delivery ${delivery}`;
        }
        return delivery >= today ? `Next delivery ${delivery}` : `Delivery was ${delivery}`;
      }
      if (s.pickup_date) return `Pickup ${s.pickup_date}`;
      return null;
    }

    const attentionItems = [
      ...pendingCoverage.slice(0, 2).map((r) => ({
        id: `coverage-${r.id}`,
        title: "Load request pending",
        metric: "1",
        metricKind: "count" as const,
        metricUnit: "request",
        detail: `${r.pickup_location} → ${r.delivery_location}`,
        href: `/coverage?focus=${r.id}`,
        tone: "warning" as const,
        cta: "Open",
        score: 50_000,
      })),
      ...(contractWarn && primaryContract
        ? [
            {
              id: `contract-${primaryContract.id}`,
              title: "Contract ending soon",
              metric: "1",
              metricKind: "count" as const,
              metricUnit: "contract",
              detail: `${primaryContract.contract_number} ends ${primaryContract.end_date}`,
              href: `/support?focus=contract&contract=${encodeURIComponent(String(primaryContract.contract_number))}`,
              tone: "warning" as const,
              cta: "Open",
              score: 45_000,
            },
          ]
        : !primaryContract
          ? [
              {
                id: "contract-missing",
                title: "No active contract",
                metric: "0",
                metricKind: "count" as const,
                metricUnit: "contracts",
                detail: "Load requests need an active shipping agreement",
                href: "/support?focus=contract",
                tone: "warning" as const,
                cta: "Open",
                score: 55_000,
              },
            ]
          : []),
      ...current
        .filter(
          (s) =>
            s.promised_delivery_date &&
            s.promised_delivery_date < today &&
            !["delivered", "completed"].includes(s.status),
        )
        .map((s) => ({
          id: `delay-${s.id}`,
          title: `${s.load_number} is delayed`,
          metric: "1",
          metricKind: "count" as const,
          metricUnit: "load",
          detail: "Expected delivery date has passed",
          href: `/shipments/${s.id}`,
          tone: "error" as const,
          cta: "Open",
          score: 80_000,
        })),
      ...overdueMine.slice(0, 3).map((i) => ({
        id: `overdue-${i.id}`,
        title: `${i.invoice_number} is past due`,
        metric: money(Number(i.total) - Number(i.amount_paid)),
        metricKind: "money" as const,
        detail: `Due ${i.due_date}`,
        href: `/invoices/${i.id}`,
        tone: "warning" as const,
        cta: "Open",
        score: 40_000 + (Number(i.total) - Number(i.amount_paid)),
      })),
      ...openDisputes.slice(0, 2).map((d) => ({
        id: `dispute-${d.id}`,
        title: "Open billing question",
        metric: money(Number(d.amount_disputed)),
        metricKind: "money" as const,
        detail: sanitizeDemoText(d.reason),
        href: d.invoice_id
          ? `/invoices/${d.invoice_id}`
          : `/support?focus=${d.id}`,
        tone: "info" as const,
        cta: "Open",
        score: 25_000,
      })),
    ];
    const shipperDecideNow = rankDecideNowItems(attentionItems, 5);
    const shipperScale = Math.max(
      1,
      current.length,
      recentDeliveries.length,
      overdueMine.length,
      myPendingRequests,
      invList.length,
    );

    const shipmentPanelRows = sortableShipments.map((s) => ({
      id: s.id as string,
      load_number: s.load_number as string,
      status: s.status as string,
      carrier_name: (s.carriers as { name?: string } | null)?.name ?? null,
      lane: `${s.pickup_location ?? `${s.origin_city}, ${s.origin_state}`} → ${
        s.delivery_location ?? `${s.dest_city}, ${s.dest_state}`
      }`,
      pickup_date: (s.pickup_date as string | null) ?? null,
      delivery_date: (s.delivery_date as string | null) ?? null,
      next_event: nextShipmentEvent({
        status: s.status as string,
        pickup_date: (s.pickup_date as string | null) ?? null,
        delivery_date: (s.delivery_date as string | null) ?? null,
        promised_delivery_date: (s.promised_delivery_date as string | null) ?? null,
      }),
    }));

    const invoicePanelRows = invList
      .filter((i) => i.status !== "cancelled")
      .map((i) => ({
        id: i.id as string,
        invoice_number: i.invoice_number as string,
        status: i.status as string,
        balance: Math.max(0, Number(i.total) - Number(i.amount_paid)),
        due_date: i.due_date as string,
      }));

    return (
      <div className="space-y-6">
        <Header
          title="My Dashboard"
          subtitle="Your shipments, invoices, and balances — only your account"
          action={
            <div className="flex flex-wrap gap-2">
              <Link href="/coverage" className="btn btn-primary btn-sm">
                Request a load
              </Link>
              <Link href="/warnings" className="btn btn-outline btn-sm">
                My alerts
              </Link>
            </div>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <DashboardStatCard
            title="Pending load requests"
            value={String(myPendingRequests)}
            icon={Inbox}
            warn={myPendingRequests > 0}
            meter={myPendingRequests / shipperScale}
            meterLabel={
              myPendingRequests > 0
                ? "Waiting on Broker Operations"
                : "No pending requests"
            }
            href="/coverage"
          />
          <DashboardStatCard
            title="Contract expiration date"
            value={contractStatusLabel}
            icon={ClipboardList}
            warn={contractWarn}
            meter={contractMeter}
            meterLabel={contractStatusDetail}
            href={
              primaryContract
                ? `/support?focus=contract&contract=${encodeURIComponent(String(primaryContract.contract_number))}`
                : "/support?focus=contract"
            }
          />
          <DashboardStatCard
            title="Current shipments"
            value={String(current.length)}
            icon={Truck}
            meter={current.length / shipperScale}
            meterLabel="Share of your account activity"
            href="/shipments?filter=active"
          />
          <DashboardStatCard
            title="Recent deliveries"
            value={String(recentDeliveries.length)}
            icon={PackageCheck}
            meter={recentDeliveries.length / shipperScale}
            meterLabel="Share of your account activity"
            href="/shipments?filter=delivered"
          />
          <DashboardStatCard
            title="Outstanding balance"
            value={money(ar)}
            icon={Wallet}
            warn={ar > 0}
            meter={ar > 0 ? 1 : 0}
            meterLabel={
              overdueMine.length > 0
                ? `${overdueMine.length} invoice(s) past due`
                : "No past-due invoices"
            }
            href="/invoices?filter=unpaid"
          />
          <DashboardStatCard
            title="Past-due invoices"
            value={String(overdueMine.length)}
            icon={FileWarning}
            warn={overdueMine.length > 0}
            meter={
              invList.length > 0 ? overdueMine.length / Math.max(1, invList.length) : 0
            }
            meterLabel={
              invList.length > 0
                ? `${overdueMine.length} of ${invList.length} invoices`
                : "No invoices on file"
            }
            href="/invoices?filter=overdue"
          />
        </div>

        <DecideNowRail
          items={shipperDecideNow}
          title="Needs your attention"
          subtitle="Delays, load requests, contract, and billing items on your account."
          emptyTitle="You're all caught up"
          emptyDescription="No delayed loads, past-due invoices, or open billing questions."
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <ShipperShipmentsPanel rows={shipmentPanelRows} />
          <ShipperInvoicesPanel rows={invoicePanelRows} />
        </div>
      </div>
    );
  }

  // ——— CARRIER ———
  const pendingOffers = shipList.filter((s) => s.status === "offered");
  const assigned = shipList.filter(
    (s) => !["cancelled", "completed", "offered"].includes(s.status),
  );
  const upcomingPickups = shipList.filter(
    (s) =>
      s.pickup_date &&
      s.pickup_date >= today &&
      ["assigned", "booked"].includes(s.status),
  );
  const dueToday = shipList.filter(
    (s) =>
      (s.promised_delivery_date === today || s.delivery_date === today) &&
      !["completed", "cancelled", "offered"].includes(s.status),
  );
  const completed = shipList.filter((s) =>
    ["delivered", "completed"].includes(s.status),
  );
  const podSetCarrier = new Set(podList.map((p) => p.shipment_id));
  const pendingChargeShips = new Set(
    chargeList
      .filter((c) => c.approval_status === "pending")
      .map((c) => c.shipment_id),
  );
  const carrierTasks = buildCarrierTasks({
    shipments: shipList.map((s) => ({
      id: s.id,
      load_number: s.load_number,
      status: s.status,
      pickup_date: s.pickup_date,
      delivery_date: s.delivery_date,
      promised_delivery_date: s.promised_delivery_date,
      pickup_location: s.pickup_location,
      delivery_location: s.delivery_location,
      origin_city: s.origin_city,
      dest_city: s.dest_city,
    })),
    podShipmentIds: podSetCarrier,
    pendingChargeShipmentIds: pendingChargeShips,
    today,
  });
  const missingPod = completed.filter((s) => !podSetCarrier.has(s.id));
  const carrierScale = Math.max(
    1,
    assigned.length,
    upcomingPickups.length,
    dueToday.length,
    missingPod.length,
  );
  const myCarrier = (carriers ?? []).find((c) => c.id === profile.carrier_id);
  const myInsurance = insuranceRiskStatus(myCarrier?.insurance_expiration ?? null, today);

  return (
    <div className="space-y-6">
      <Header
        title="Assigned Loads"
        subtitle="Accept new offers, then manage pickups, deliveries, and POD"
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/offers" className="btn btn-primary btn-sm">
              Load offers{pendingOffers.length ? ` (${pendingOffers.length})` : ""}
            </Link>
            <Link href="/warnings" className="btn btn-outline btn-sm">
              My alerts
            </Link>
          </div>
        }
      />
      {myInsurance.status === "expired" || myInsurance.status === "expiring" ? (
        <div
          className={`alert ${myInsurance.status === "expired" ? "alert-error" : "alert-warning"}`}
        >
          <span>
            {myInsurance.status === "expired"
              ? "Your insurance is expired — you cannot be assigned new loads until you renew."
              : "Your insurance expires within 30 days. Upload an updated certificate in Settings."}
          </span>
          <Link href="/settings#carrier-insurance" className="btn btn-sm">
            Update insurance
          </Link>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          title="Pending offers"
          value={String(pendingOffers.length)}
          icon={Inbox}
          warn={pendingOffers.length > 0}
          meter={pendingOffers.length / Math.max(1, pendingOffers.length + assigned.length)}
          meterLabel="Offers waiting on your accept/decline"
          href="/offers"
        />
        <DashboardStatCard
          title="Assigned loads"
          value={String(assigned.length)}
          icon={Truck}
          meter={assigned.length / carrierScale}
          meterLabel="Share of your assigned workload"
          href="/shipments?filter=active"
        />
        <DashboardStatCard
          title="Upcoming pickups"
          value={String(upcomingPickups.length)}
          icon={Package}
          meter={upcomingPickups.length / carrierScale}
          meterLabel="Share of your assigned workload"
          href="/shipments?filter=pickup-upcoming"
        />
        <DashboardStatCard
          title="Deliveries due today"
          value={String(dueToday.length)}
          icon={CalendarClock}
          warn={dueToday.length > 0}
          meter={dueToday.length / carrierScale}
          meterLabel="Share of your assigned workload"
          href="/shipments?filter=delivery-due-today"
        />
        <DashboardStatCard
          title="POD still needed"
          value={String(missingPod.length)}
          icon={Timer}
          warn={missingPod.length > 0}
          meter={
            completed.length > 0
              ? missingPod.length / Math.max(1, completed.length)
              : missingPod.length > 0
                ? 1
                : 0
          }
          meterLabel={
            completed.length > 0
              ? `${missingPod.length} of ${completed.length} completed loads`
              : "No completed loads yet"
          }
          href="/documents?filter=missing-pod"
        />
      </div>

      <CarrierTaskList tasks={carrierTasks} />

      <Panel title="Assigned loads">
        <ShipmentList rows={assigned} empty="No assigned loads." />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Upcoming pickups">
          <ShipmentList rows={upcomingPickups} empty="No upcoming pickups." />
        </Panel>
        <Panel title="Document requirements">
          <p className="mb-2 text-sm opacity-70">
            {podList.length} POD on file · {missingPod.length} completed load(s) still need
            paperwork.{" "}
            <Link href="/documents" className="link">
              Open documents
            </Link>
          </p>
          {missingPod.length ? (
            <ul className="space-y-2 text-sm">
              {missingPod.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-box border border-warning/30 bg-warning/10 px-3 py-2"
                >
                  <span>{s.load_number} — upload POD</span>
                  <Link href={`/shipments/${s.id}`} className="btn btn-warning btn-xs">
                    Upload
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <ShipmentList rows={completed.slice(0, 5)} empty="No completed loads yet." />
          )}
        </Panel>
      </div>
    </div>
  );
}

function Header({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm opacity-70">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body">
        <h3 className="card-title text-base">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function MiniTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ShipmentList({
  rows,
  empty,
}: {
  rows: {
    id: string;
    load_number: string;
    status: string;
    customers?: unknown;
    carriers?: unknown;
    pickup_location?: string;
    origin_city?: string;
    dest_city?: string;
  }[];
  empty: string;
}) {
  if (!rows.length) {
    return <EmptyState title={empty} />;
  }
  return (
    <ul className="divide-y divide-base-200">
      {rows.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <div>
            <Link href={`/shipments/${s.id}`} className="link link-primary font-medium">
              {s.load_number}
            </Link>
            <p className="text-xs opacity-60">
              {(s.customers as { name?: string } | null)?.name ?? "Customer"} ·{" "}
              {(s.carriers as { name?: string } | null)?.name ?? "No carrier"}
            </p>
          </div>
          <span className={`badge ${statusBadge(s.status)}`}>
            {formatStatusLabel(s.status)}
          </span>
        </li>
      ))}
    </ul>
  );
}
