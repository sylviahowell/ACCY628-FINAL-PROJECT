import Link from "next/link";
import {
  KpiRibbon,
  MorningBriefCard,
} from "@/components/ExecutivePanels";
import { BillingInsightsPanel, UnbilledQueuePanel } from "@/components/BillingPanels";
import { BrokerTaskBoard } from "@/components/BrokerTaskBoard";
import { CarrierTaskList } from "@/components/CarrierTaskList";
import { CollectionsWorklist } from "@/components/CollectionsWorklist";
import { PayablesWorklist } from "@/components/PayablesWorklist";
import { CustomerFriendlyStatusCard } from "@/components/ShipmentHealthCard";
import { ProfitabilityHeatmap } from "@/components/ProfitabilityHeatmap";
import { ShipmentMapLazy } from "@/components/ShipmentMapLazy";
import { DecideNowRail } from "@/components/DecideNowRail";
import { HorizontalBars, MonthlyBars, StatusPie } from "@/components/Charts";
import { requirePathAccess } from "@/lib/authz";
import { bucketByMonth } from "@/lib/analytics";
import { buildBrokerTasks, brokerTaskStats } from "@/lib/broker-tasks";
import { buildCarrierScorecards } from "@/lib/carrier-scorecard";
import {
  agingChartData,
  buildBillingInsights,
  buildCollectionWorklist,
  buildUnbilledQueues,
  computeAging,
} from "@/lib/collections";
import {
  arBalanceAsOf,
  buildDecideNowCandidates,
  buildExecutiveHealthLine,
  countActiveAsOf,
  countLateAsOf,
  rankDecideNowItems,
} from "@/lib/decide-now";
import {
  computePayableAging,
  openApBalance,
  buildPayableWorklist,
} from "@/lib/payables";
import { toHeatRows } from "@/lib/heatmap";
import { buildExecutiveKpis, inRange, monthBounds } from "@/lib/kpi";
import { buildMorningBrief } from "@/lib/morning-brief";
import { isActiveFinalInvoice } from "@/lib/invoice-helpers";
import {
  buildCarrierTasks,
  customerFacingHealth,
} from "@/lib/portal-views";
import {
  creditStatus,
  insuranceRiskStatus,
  openArFromInvoices,
} from "@/lib/risk-credit";
import { computeShipmentHealth } from "@/lib/shipment-health";
import { createClient } from "@/lib/supabase/server";
import { sanitizeDemoText } from "@/lib/display-text";
import { money, statusBadge } from "@/lib/types";

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
      .select("id, contract_number, end_date, status, customers(name)"),
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
  ]);

  const pendingCoverage = coverageRequests ?? [];
  const pendingCoverageCount = pendingCoverage.length;
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

  const revenue = profitList.reduce(
    (s, p) =>
      s +
      Number(p.customer_rate) +
      Number(p.billable_accessorials) -
      Number(p.discount_amount || 0),
    0,
  );
  const grossProfit = profitList.reduce((s, p) => s + Number(p.margin), 0);
  const marginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const ar = invList.reduce(
    (s, i) => s + Math.max(0, Number(i.total) - Number(i.amount_paid)),
    0,
  );
  const openInvoices = invList.filter((i) =>
    ["pending", "sent", "partial", "overdue", "disputed"].includes(i.status),
  );
  const pastDue = invList.filter((i) => {
    const bal = Number(i.total) - Number(i.amount_paid);
    return bal > 0 && i.due_date < today && !["paid", "cancelled"].includes(i.status);
  });

  // Real monthly series: invoice issue dates for revenue; shipment activity dates for margin
  const monthlyRev = bucketByMonth(
    invList
      .filter((i) => i.status !== "cancelled")
      .map((i) => ({ date: i.issue_date, amount: Number(i.total) })),
    6,
  );
  const monthlyProfit = bucketByMonth(
    shipList.map((s) => {
      const p = profitByShipment.get(s.id);
      const amount = p
        ? Number(p.margin)
        : Number(s.customer_rate) - Number(s.carrier_cost);
      return {
        date: s.delivery_date || s.pickup_date || s.created_at,
        amount,
      };
    }),
    6,
  );

  const topCustomers = Object.entries(
    profitList.reduce<Record<string, number>>((acc, p) => {
      acc[p.customer_id] = (acc[p.customer_id] || 0) + Number(p.margin);
      return acc;
    }, {}),
  )
    .map(([id, value]) => ({ name: customerName.get(id) ?? "Customer", value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const leastProfitable = [...profitList]
    .map((p) => ({
      load: p.load_number,
      customer: customerName.get(p.customer_id) ?? "—",
      margin: Number(p.margin),
    }))
    .sort((a, b) => a.margin - b.margin)
    .slice(0, 5);

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
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

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

    const yDeliveredSafe = shipList.filter((s) => s.delivery_date === yesterdayStr);
    const yRev = yDeliveredSafe.reduce((sum, s) => {
      const p = profitByShipment.get(s.id);
      return (
        sum +
        (p
          ? Number(p.customer_rate) +
            Number(p.billable_accessorials) -
            Number(p.discount_amount || 0)
          : Number(s.customer_rate))
      );
    }, 0);
    const yProfit = yDeliveredSafe.reduce((sum, s) => {
      const p = profitByShipment.get(s.id);
      return sum + (p ? Number(p.margin) : Number(s.customer_rate) - Number(s.carrier_cost));
    }, 0);
    const yPay = (payments ?? [])
      .filter((p) => p.payment_date === yesterdayStr)
      .reduce((s, p) => s + Number(p.amount), 0);

    const insuranceExpiring = (carriers ?? []).filter((c) => {
      if (!c.insurance_expiration) return false;
      const days = Math.floor(
        (new Date(c.insurance_expiration + "T00:00:00Z").getTime() -
          new Date(today + "T00:00:00Z").getTime()) /
          (1000 * 60 * 60 * 24),
      );
      return days >= 0 && days <= 30;
    }).length;

    const brief = buildMorningBrief({
      fullName: profile.full_name,
      yesterdayDelivered: yDeliveredSafe.length,
      yesterdayRevenue: yRev,
      yesterdayProfit: yProfit,
      yesterdayPayments: yPay,
      pickupsToday: shipList.filter((s) => s.pickup_date === today).length,
      deliveriesToday: shipList.filter(
        (s) => s.delivery_date === today || s.promised_delivery_date === today,
      ).length,
      invoicesDueToday: invList.filter((i) => i.due_date === today).length,
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
    const customersOverCredit = (customers ?? []).filter((c) => {
      const openAr = openArFromInvoices(invoicesByCustomer.get(c.id) ?? []);
      return creditStatus(openAr, Number(c.credit_limit ?? 0)) === "over";
    }).length;
    const insuranceExpired = (carriers ?? []).filter(
      (c) => insuranceRiskStatus(c.insurance_expiration ?? null, today).status === "expired",
    ).length;
    const riskIssueCount = customersOverCredit + insuranceExpired + insuranceExpiring;
    const riskDetailParts: string[] = [];
    if (customersOverCredit > 0) {
      riskDetailParts.push(
        `${customersOverCredit} customer${customersOverCredit === 1 ? "" : "s"} over credit`,
      );
    }
    if (insuranceExpired > 0) {
      riskDetailParts.push(
        `${insuranceExpired} carrier${insuranceExpired === 1 ? "" : "s"} insurance expired`,
      );
    }
    if (insuranceExpiring > 0) {
      riskDetailParts.push(
        `${insuranceExpiring} carrier${insuranceExpiring === 1 ? "" : "s"} insurance expiring ≤30d`,
      );
    }

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
          total: Number(i.total),
          amount_paid: Number(i.amount_paid),
          due_date: i.due_date,
        })),
        openDisputeCount,
        cashAtRisk,
        riskIssueCount,
        riskDetail: riskDetailParts.join(" · "),
        riskTone:
          insuranceExpired > 0 || customersOverCredit > 0 ? "error" : "warning",
        resolveLoadNumber,
        sanitize: sanitizeDemoText,
      }),
      3,
    );

    const healthLine = buildExecutiveHealthLine({
      topItems: decideNowItems,
      marginPct: marginThisMonth,
      lateCount: lateList.length,
      cashAtRisk,
    });

    return (
      <div className="space-y-6">
        <Header
          title="Executive Dashboard"
          subtitle={`Company performance and exceptions · As of ${today}`}
          action={
            <Link href="/controls" className="link link-hover text-sm opacity-70">
              Recent control overrides →
            </Link>
          }
        />
        <p className="rounded-box border border-base-300 bg-base-100 px-4 py-2.5 text-sm font-medium -mt-2">
          {healthLine}
        </p>
        <DecideNowRail items={decideNowItems} />
        <MorningBriefCard
          greeting={brief.greeting}
          yesterday={brief.yesterday}
          today={brief.today}
        />
        <KpiRibbon items={kpis} />
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Network & profitability</h2>
            <p className="text-sm opacity-70">
              Where margin concentrates and how live freight is moving across the map.
            </p>
          </div>
          <ProfitabilityHeatmap rows={heatRows} />
          <ShipmentMapLazy shipments={mapShipments} today={today} />
        </div>
        <details className="rounded-box border border-base-300 bg-base-100">
          <summary className="cursor-pointer list-none px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="flex flex-wrap items-end justify-between gap-2">
              <span>
                <span className="block text-lg font-bold tracking-tight">
                  Performance trends
                </span>
                <span className="text-sm font-normal opacity-70">
                  Monthly revenue and profit, top customers by margin, and weakest loads
                </span>
              </span>
              <span className="text-xs opacity-60">Expand</span>
            </span>
          </summary>
          <div className="grid gap-4 border-t border-base-300 p-4 lg:grid-cols-2">
            <Panel title="Monthly revenue">
              <MonthlyBars data={monthlyRev} name="Revenue" />
            </Panel>
            <Panel title="Monthly profit">
              <MonthlyBars data={monthlyProfit} name="Profit" />
            </Panel>
            <Panel title="Top customers">
              <HorizontalBars data={topCustomers} name="Margin" />
            </Panel>
            <Panel title="Least profitable shipments">
              <MiniTable
                headers={["Load", "Customer", "Margin"]}
                rows={leastProfitable.map((r) => [r.load, r.customer, money(r.margin)])}
              />
            </Panel>
          </div>
        </details>
      </div>
    );
  }

  // ——— BROKER OPS ———
  if (profile.role === "broker") {
    const podSet = new Set(podList.map((p) => p.shipment_id));
    const pendingCharges = chargeList.filter((c) => c.approval_status === "pending");
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
    });
    const stats = brokerTaskStats(brokerTasks);

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
          promised_delivery_date: s.promised_delivery_date,
          customer_name: (s.customers as { name?: string } | null)?.name ?? "Customer",
          carrier_name: (s.carriers as { name?: string } | null)?.name ?? "Unassigned",
          health_score: health.score,
          health_category: health.category,
        };
      });

    const watchActions = [
      ...(pendingCoverageCount
        ? [
            {
              title: `${pendingCoverageCount} shipper coverage request(s)`,
              action: "Book a load from the request, then assign from scorecards",
              href: "/coverage",
            },
          ]
        : []),
      ...(stats.delayed
        ? [
            {
              title: `${stats.delayed} delayed load(s)`,
              action: "Call carriers for ETAs and notify customers",
              href: "/warnings?severity=critical",
            },
          ]
        : []),
      ...(stats.unassigned
        ? [
            {
              title: `${stats.unassigned} unassigned load(s)`,
              action: "Cover with a Preferred / Approved carrier from scorecards",
              href: "/shipments?filter=unassigned",
            },
          ]
        : []),
      ...(stats.accessorial
        ? [
            {
              title: `${stats.accessorial} accessorial(s) awaiting manager approval`,
              action: "Escalate to a manager — only managers can approve or reject",
              href: "/warnings?severity=info",
            },
          ]
        : []),
      ...(scorecards.filter((c) => c.tier === "Watch List" || c.tier === "Suspended").length
        ? [
            {
              title: "Carrier insurance or performance watch",
              action: "Review Watch List / Suspended carriers before booking",
              href: "/carriers",
            },
          ]
        : []),
      {
        title: "Risk & Credit review",
        action: "Check customer credit utilization and carrier insurance expiry",
        href: "/risk",
      },
    ];

    return (
      <div className="space-y-6">
        <Header
          title="Broker Operations"
          subtitle="Intake shipper requests, cover loads, clear delays, keep freight moving"
          action={
            <div className="flex flex-wrap gap-2">
              <Link href="/risk" className="btn btn-outline btn-sm">
                Risk &amp; Credit
              </Link>
              <Link href="/coverage" className="btn btn-outline btn-sm">
                Coverage requests
                {pendingCoverageCount > 0 ? (
                  <span className="badge badge-warning badge-sm">{pendingCoverageCount}</span>
                ) : null}
              </Link>
              <Link href="/shipments/new" className="btn btn-primary btn-sm">
                New shipment
              </Link>
            </div>
          }
        />
        <div className="rounded-box border border-primary/20 bg-base-100 px-4 py-3 text-sm shadow-sm">
          <p className="font-semibold">Coverage process</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5 opacity-80">
            <li>Shipper submits a coverage request (lane + dates).</li>
            <li>You review and book an unassigned load from the request.</li>
            <li>Assign a Preferred / Approved carrier from scorecards.</li>
            <li>Shipper tracks the load on My Shipments.</li>
          </ol>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <Stat
            title="Coverage requests"
            value={String(pendingCoverageCount)}
            warn={pendingCoverageCount > 0}
            href="/coverage"
          />
          <Stat
            title="Today's pickups"
            value={String(stats.pickupsToday)}
            href="/shipments?filter=pickup-today"
          />
          <Stat
            title="Today's deliveries"
            value={String(stats.deliveriesToday)}
            href="/shipments?filter=delivery-today"
          />
          <Stat
            title="Awaiting carrier"
            value={String(stats.unassigned)}
            warn={stats.unassigned > 0}
            href="/shipments?filter=unassigned"
          />
          <Stat
            title="Delayed loads"
            value={String(stats.delayed)}
            warn={stats.delayed > 0}
            href="/shipments?filter=delayed"
          />
          <Stat
            title="Waiting on manager"
            value={String(stats.accessorial)}
            href="/warnings?severity=info"
          />
        </div>

        {watchActions.length > 0 ? (
          <Panel title="Recommended actions">
            <ul className="space-y-2">
              {watchActions.slice(0, 3).map((w, i) => (
                <li
                  key={`${w.href}-${w.title}-${i}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-box border border-warning/30 bg-warning/10 px-3 py-2"
                >
                  <div>
                    <p className="font-medium text-sm">{w.title}</p>
                    <p className="text-xs opacity-70">{w.action}</p>
                  </div>
                  <Link href={w.href} className="btn btn-warning btn-xs">
                    Open
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/warnings" className="btn btn-ghost btn-sm mt-2">
              Full warning center
            </Link>
          </Panel>
        ) : (
          <div className="alert alert-success">
            <span>No high-priority broker exceptions right now. Check the work queue for today&apos;s tasks.</span>
          </div>
        )}

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
      </div>
    );
  }

  // ——— BILLING ———
  if (profile.role === "billing") {
    const thisMonth = monthBounds(0);
    const paidToday = (payments ?? [])
      .filter((p) => p.payment_date === today)
      .reduce((s, p) => s + Number(p.amount), 0);
    const cashMonth = (payments ?? [])
      .filter((p) => inRange(p.payment_date, thisMonth.start, thisMonth.end))
      .reduce((s, p) => s + Number(p.amount), 0);

    const aging = computeAging(invList, today);
    const agingChart = agingChartData(aging);
    const openDisputes = disputeList.filter((d) => d.status === "open");
    const disputedBalance = openDisputes.reduce(
      (s, d) => s + Number(d.amount_disputed),
      0,
    );

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

    const billingInsights = buildBillingInsights({
      aging,
      unbilledReady: ready.length,
      awaitingDocs: awaitingDocs.length,
      disputedBalance,
      cashToday: paidToday,
      cashMonth,
      overdueCount: pastDue.length,
    });

    const apOpenBilling = openApBalance(carrierBills ?? []);
    const apAgingBilling = computePayableAging(carrierBills ?? [], today);
    const apAgingChart = agingChartData(apAgingBilling);
    const apPastDueBilling =
      apAgingBilling.d1_30 +
      apAgingBilling.d31_60 +
      apAgingBilling.d61_90 +
      apAgingBilling.d90_plus;

    const payableWorklist = buildPayableWorklist({
      bills: (carrierBills ?? []).map((b) => ({
        id: b.id,
        bill_number: b.bill_number,
        carrier_id: b.carrier_id,
        shipment_id: b.shipment_id,
        total: Number(b.total),
        amount_paid: Number(b.amount_paid),
        due_date: b.due_date,
        status: b.status,
        carriers: b.carriers as { name?: string } | null,
        shipments: b.shipments as { load_number?: string } | null,
      })),
      today,
    });

    return (
      <div className="space-y-6">
        <Header
          title="Billing & Collections Dashboard"
          subtitle="AR aging, AP payables, unbilled queues, disputes, and collection actions"
          action={
            <div className="flex flex-wrap gap-2">
              <Link href="/invoices" className="btn btn-outline btn-sm">
                Ready to bill
              </Link>
              <Link href="/ap" className="btn btn-outline btn-sm">
                Accounts Payable
              </Link>
              <Link href="/payments" className="btn btn-primary btn-sm">
                Record payment
              </Link>
            </div>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat title="Total AR" value={money(ar)} href="/ar" />
          <Stat title="Current AR" value={money(aging.current)} href="/ar?filter=current" />
          <Stat
            title="1–30 days past due"
            value={money(aging.d1_30)}
            warn={aging.d1_30 > 0}
            href="/ar?filter=d1_30"
          />
          <Stat
            title="31–60 days past due"
            value={money(aging.d31_60)}
            warn={aging.d31_60 > 0}
            href="/ar?filter=d31_60"
          />
          <Stat
            title="61–90 days past due"
            value={money(aging.d61_90)}
            warn={aging.d61_90 > 0}
            href="/ar?filter=d61_90"
          />
          <Stat
            title="More than 90 days"
            value={money(aging.d90_plus)}
            warn={aging.d90_plus > 0}
            href="/ar?filter=d90_plus"
          />
          <Stat
            title="Cash received today"
            value={money(paidToday)}
            href="/payments?filter=today"
          />
          <Stat
            title="Cash received this month"
            value={money(cashMonth)}
            href="/payments?filter=month"
          />
          <Stat title="Open AP" value={money(apOpenBilling)} warn={apOpenBilling > 0} href="/ap" />
          <Stat
            title="AP past due"
            value={money(apPastDueBilling)}
            warn={apPastDueBilling > 0}
            href="/ap"
          />
          <Stat
            title="Delivered but unbilled"
            value={String(ready.length)}
            warn={ready.length > 0}
            href="/shipments?filter=ready-to-bill"
          />
          <Stat
            title="Awaiting supporting docs"
            value={String(awaitingDocs.length)}
            warn={awaitingDocs.length > 0}
            href="/shipments?filter=awaiting-docs"
          />
          <Stat
            title="Disputed invoice balance"
            value={money(disputedBalance)}
            warn={disputedBalance > 0}
            href="/disputes?filter=open"
          />
          <Stat
            title="Open invoices"
            value={String(openInvoices.length)}
            href="/invoices?filter=open"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="AP aging">
            <StatusPie data={apAgingChart} />
          </Panel>
          <Panel title="Invoice aging">
            <StatusPie data={agingChart} />
          </Panel>
        </div>

        <BillingInsightsPanel insights={billingInsights} />

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

        <PayablesWorklist items={payableWorklist} />

        <Panel title="Open billing disputes">
          {openDisputes.length === 0 ? (
            <p className="text-sm opacity-70">No open disputes.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {openDisputes.map((d) => (
                <li key={d.id} className="rounded-box bg-warning/15 p-3">
                  {sanitizeDemoText(d.reason)} — {money(d.amount_disputed)}
                </li>
              ))}
            </ul>
          )}
          <Link href="/disputes" className="btn btn-ghost btn-sm mt-3">
            View all disputes
          </Link>
        </Panel>
      </div>
    );
  }

  // ——— SHIPPER ———
  if (profile.role === "customer") {
    const current = shipList.filter(
      (s) => !["completed", "cancelled"].includes(s.status),
    );
    const recentDeliveries = shipList.filter((s) =>
      ["delivered", "completed"].includes(s.status),
    );
    const podSet = new Set(podList.map((p) => p.shipment_id));
    const overdueMine = invList.filter((i) => {
      const bal = Number(i.total) - Number(i.amount_paid);
      return bal > 0 && i.due_date < today && !["paid", "cancelled"].includes(i.status);
    });
    const openDisputes = disputeList.filter((d) => d.status === "open");

    const statusCards = current.slice(0, 4).map((s) => {
      const friendly = customerFacingHealth({
        status: s.status,
        promised_delivery_date: s.promised_delivery_date,
        hasPod: podSet.has(s.id),
        hasCarrier: Boolean(s.carrier_id),
        hasOpenDispute: disputedShipmentIds.has(s.id),
        hasOverdueInvoice: overdueMine.length > 0,
        today,
      });
      return { s, friendly };
    });

    const attention = [
      ...pendingCoverage.slice(0, 2).map((r) => ({
        key: `coverage-${r.id}`,
        title: "Coverage request pending",
        detail: `${r.pickup_location} → ${r.delivery_location}`,
        href: "/coverage",
      })),
      ...current
        .filter(
          (s) =>
            s.promised_delivery_date &&
            s.promised_delivery_date < today &&
            !["delivered", "completed"].includes(s.status),
        )
        .map((s) => ({
          key: `delay-${s.id}`,
          title: `${s.load_number} is delayed`,
          detail: "Expected delivery date has passed",
          href: `/shipments/${s.id}`,
        })),
      ...overdueMine.slice(0, 3).map((i) => ({
        key: `overdue-${i.id}`,
        title: `${i.invoice_number} is past due`,
        detail: `Balance ${money(Number(i.total) - Number(i.amount_paid))}`,
        href: "/invoices",
      })),
      ...openDisputes.slice(0, 2).map((d) => ({
        key: `dispute-${d.id}`,
        title: "Open billing question",
        detail: sanitizeDemoText(d.reason),
        href: "/support",
      })),
    ];

    return (
      <div className="space-y-6">
        <Header
          title="My Dashboard"
          subtitle="Your shipments, deliveries, invoices, and balances — only your account"
          action={
            <div className="flex flex-wrap gap-2">
              <Link href="/coverage" className="btn btn-primary btn-sm">
                Request coverage
              </Link>
              <Link href="/warnings" className="btn btn-outline btn-sm">
                My alerts
              </Link>
            </div>
          }
        />
        <div className="rounded-box border border-primary/20 bg-base-100 px-4 py-3 text-sm shadow-sm">
          <p className="font-semibold">Need a carrier?</p>
          <p className="mt-1 opacity-80">
            Submit a coverage request with your lane and dates. Broker Operations books the load,
            assigns a carrier, then you track it on My Shipments.
          </p>
          <Link href="/coverage" className="btn btn-primary btn-sm mt-3">
            Open request form
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            title="Current shipments"
            value={String(current.length)}
            href="/shipments?filter=active"
          />
          <Stat
            title="Recent deliveries"
            value={String(recentDeliveries.length)}
            href="/shipments?filter=delivered"
          />
          <Stat
            title="Outstanding balance"
            value={money(ar)}
            warn={ar > 0}
            href="/invoices?filter=unpaid"
          />
          <Stat
            title="Past-due invoices"
            value={String(overdueMine.length)}
            warn={overdueMine.length > 0}
            href="/invoices?filter=overdue"
          />
        </div>

        {attention.length > 0 ? (
          <Panel title="Needs your attention">
            <ul className="space-y-2">
              {attention.map((a) => (
                <li
                  key={a.key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-box border border-warning/30 bg-warning/10 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs opacity-70">{a.detail}</p>
                  </div>
                  <Link href={a.href} className="btn btn-warning btn-xs">
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {statusCards.map(({ s, friendly }) => (
            <div key={s.id} className="space-y-2">
              <div className="flex items-center justify-between gap-2 px-1">
                <Link href={`/shipments/${s.id}`} className="link link-primary font-semibold">
                  {s.load_number}
                </Link>
                <span className={`badge badge-sm ${statusBadge(s.status)}`}>{s.status}</span>
              </div>
              <CustomerFriendlyStatusCard health={friendly} />
            </div>
          ))}
        </div>

        <Panel title="Active shipments">
          <ShipmentList rows={current} empty="No active shipments." />
        </Panel>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Recent deliveries">
            <ShipmentList rows={recentDeliveries.slice(0, 5)} empty="No deliveries yet." />
          </Panel>
          <Panel title="Your invoices">
            <MiniTable
              headers={["Invoice", "Status", "Balance", "Due"]}
              rows={invList.slice(0, 8).map((i) => [
                i.invoice_number,
                i.status,
                money(Number(i.total) - Number(i.amount_paid)),
                i.due_date,
              ])}
            />
            <Link href="/invoices" className="btn btn-ghost btn-sm mt-2">
              All invoices
            </Link>
            <Link href="/support" className="btn btn-ghost btn-sm mt-2">
              Support & disputes
            </Link>
          </Panel>
        </div>
      </div>
    );
  }

  // ——— CARRIER ———
  const assigned = shipList.filter((s) => !["cancelled", "completed"].includes(s.status));
  const upcomingPickups = shipList.filter(
    (s) =>
      s.pickup_date &&
      s.pickup_date >= today &&
      ["assigned", "scheduled", "booked"].includes(s.status),
  );
  const dueToday = shipList.filter(
    (s) =>
      (s.promised_delivery_date === today || s.delivery_date === today) &&
      !["completed", "cancelled"].includes(s.status),
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

  return (
    <div className="space-y-6">
      <Header
        title="Assigned Loads"
        subtitle="Your pickups, deliveries, documents, and status updates"
        action={
          <Link href="/warnings" className="btn btn-outline btn-sm">
            My alerts
          </Link>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          title="Assigned loads"
          value={String(assigned.length)}
          href="/shipments?filter=active"
        />
        <Stat
          title="Upcoming pickups"
          value={String(upcomingPickups.length)}
          href="/shipments?filter=pickup-upcoming"
        />
        <Stat
          title="Deliveries due today"
          value={String(dueToday.length)}
          warn={dueToday.length > 0}
          href="/shipments?filter=delivery-due-today"
        />
        <Stat
          title="POD still needed"
          value={String(missingPod.length)}
          warn={missingPod.length > 0}
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
                  className="flex flex-wrap items-center justify-between gap-2 rounded-box bg-warning/10 px-3 py-2"
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

function Stat({
  title,
  value,
  warn,
  href,
}: {
  title: string;
  value: string;
  warn?: boolean;
  href?: string;
}) {
  const inner = (
    <div className="stat py-3">
      <div className="stat-title text-xs">{title}</div>
      <div className={`stat-value text-2xl ${warn ? "text-error" : "text-primary"}`}>
        {value}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="stats block w-full bg-base-100 shadow-sm transition hover:border-primary/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="stats w-full bg-base-100 shadow-sm">
      {inner}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card bg-base-100 shadow-sm">
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
  if (!rows.length) return <p className="text-sm opacity-70">{empty}</p>;
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
          <span className={`badge ${statusBadge(s.status)}`}>{s.status}</span>
        </li>
      ))}
    </ul>
  );
}
