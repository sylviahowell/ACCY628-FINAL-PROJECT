import { Suspense } from "react";
import { FocusScroll } from "@/components/FocusScroll";
import { CustomerPerformanceExplorer } from "@/components/customer-performance/CustomerPerformanceExplorer";
import { requirePathAccess } from "@/lib/authz";
import {
  classifyShipmentStatus,
  type ExplorerCarrier,
  type ExplorerCustomer,
  type ExplorerShipment,
  type PartnerMode,
} from "@/lib/customer-performance";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/types";
import { redirect } from "next/navigation";

function parseMode(raw: string | null | undefined): PartnerMode {
  return raw === "carrier" ? "carrier" : "shipper";
}

export default async function ProfitabilityPage({
  searchParams,
}: {
  searchParams: Promise<{
    band?: string;
    dim?: string;
    focus?: string;
    customer?: string;
    partner?: string;
    mode?: string;
  }>;
}) {
  const profile = await requirePathAccess("/profitability");
  if (profile.role !== "manager" && profile.role !== "billing") redirect("/dashboard");

  const params = await searchParams;
  const initialMode = parseMode(params.mode);
  const initialPartnerId =
    params.partner?.trim() ||
    (initialMode === "shipper" ? params.customer?.trim() || null : null);
  const initialCustomerId =
    initialMode === "shipper" ? initialPartnerId : params.customer?.trim() || null;

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: profit } = await supabase.from("shipment_profitability").select("*");
  const { data: customers } = await supabase.from("customers").select("id, name");
  const { data: carriers } = await supabase.from("carriers").select("id, name");
  const { data: shipments } = await supabase
    .from("shipments")
    .select(
      "id, load_number, status, created_at, pickup_date, delivery_date, promised_delivery_date, carrier_id, customer_id, origin_city, origin_state, dest_city, dest_state, pickup_location, delivery_location, customer_rate, carrier_cost",
    );

  const names = new Map((customers ?? []).map((c) => [c.id, c.name]));
  const carrierNames = new Map((carriers ?? []).map((c) => [c.id, c.name]));

  const profitByShipment = new Map(
    (profit ?? []).map((p) => [
      p.shipment_id as string,
      {
        billable: Number(p.billable_accessorials),
        payable: Number(p.payable_accessorials),
        discount: Number(p.discount_amount || 0),
        customer_rate: Number(p.customer_rate),
        carrier_cost: Number(p.carrier_cost),
        margin: Number(p.margin),
        load_number: String(p.load_number ?? ""),
      },
    ]),
  );

  const rows = (profit ?? []).map((p) => {
    const billable = Number(p.billable_accessorials);
    const payable = Number(p.payable_accessorials);
    const discount = Number(p.discount_amount || 0);
    const revenue = Number(p.customer_rate) + billable - discount;
    const cogs = Number(p.carrier_cost) + payable;
    const margin = Number(p.margin);
    return {
      customer_id: p.customer_id as string,
      customer: names.get(p.customer_id) ?? "Unknown",
      revenue,
      cogs,
      margin,
    };
  });

  const byCustomer = Object.values(
    rows.reduce<Record<string, { name: string; value: number }>>((acc, r) => {
      acc[r.customer_id] = acc[r.customer_id] || { name: r.customer, value: 0 };
      acc[r.customer_id].value += r.margin;
      return acc;
    }, {}),
  ).sort((a, b) => b.value - a.value);

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalCogs = rows.reduce((s, r) => s + r.cogs, 0);
  const totalProfit = rows.reduce((s, r) => s + r.margin, 0);

  const explorerByCustomer = new Map<string, ExplorerCustomer>();
  for (const c of customers ?? []) {
    explorerByCustomer.set(c.id, { id: c.id, name: c.name, shipments: [] });
  }

  const explorerByCarrier = new Map<string, ExplorerCarrier>();
  for (const c of carriers ?? []) {
    explorerByCarrier.set(c.id, { id: c.id, name: c.name, shipments: [] });
  }

  for (const s of shipments ?? []) {
    const customerId = s.customer_id as string | null;
    const carrierId = s.carrier_id as string | null;

    const p = profitByShipment.get(s.id as string);
    const billable = p?.billable ?? 0;
    const payable = p?.payable ?? 0;
    const discount = p?.discount ?? 0;
    const rate = p?.customer_rate ?? Number(s.customer_rate);
    const carrierCost = p?.carrier_cost ?? Number(s.carrier_cost);
    const revenue = rate + billable - discount;
    const cost = carrierCost + payable;
    const profitAmt = p?.margin ?? revenue - cost;

    const origin =
      [s.origin_city, s.origin_state].filter(Boolean).join(", ") ||
      (s.pickup_location as string) ||
      "—";
    const destination =
      [s.dest_city, s.dest_state].filter(Boolean).join(", ") ||
      (s.delivery_location as string) ||
      "—";

    const promised = (s.promised_delivery_date as string | null) ?? null;
    const delivery = (s.delivery_date as string | null) ?? null;
    const status = String(s.status ?? "");
    const customerName = customerId
      ? (names.get(customerId) ?? "Unknown")
      : "Unknown";
    const carrierName = carrierId
      ? (carrierNames.get(carrierId) ?? "Unassigned")
      : "Unassigned";

    const explorerRow: ExplorerShipment = {
      id: s.id as string,
      loadNumber: String(s.load_number ?? p?.load_number ?? "—"),
      customerName,
      origin,
      destination,
      carrier: carrierName,
      revenue,
      cost,
      profit: profitAmt,
      status,
      displayStatus: classifyShipmentStatus(status, promised, delivery, today),
      date: (delivery || s.pickup_date || s.created_at) as string | null,
      promisedDelivery: promised,
      deliveryDate: delivery,
    };

    if (customerId) {
      explorerByCustomer.get(customerId)?.shipments.push(explorerRow);
    }
    if (carrierId) {
      explorerByCarrier.get(carrierId)?.shipments.push(explorerRow);
    }
  }

  const explorerCustomers = [...explorerByCustomer.values()].filter(
    (c) => c.shipments.length > 0 || byCustomer.some((b) => b.name === c.name),
  );
  const explorerCarriers = [...explorerByCarrier.values()].filter(
    (c) => c.shipments.length > 0,
  );

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <FocusScroll />
      </Suspense>
      <div>
        <h1 className="text-2xl font-bold">Profitability</h1>
        <p className="text-sm opacity-70">
          Per-load economics: customer revenue (rate + billable extras − discounts) minus direct
          costs (carrier buy + payable accessorials).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="stats bg-base-100 shadow-sm">
          <div className="stat">
            <div className="stat-title">Shipment revenue</div>
            <div className="stat-value text-2xl">{money(totalRevenue)}</div>
          </div>
        </div>
        <div className="stats bg-base-100 shadow-sm">
          <div className="stat">
            <div className="stat-title">Direct costs (COGS)</div>
            <div className="stat-value text-2xl">{money(totalCogs)}</div>
          </div>
        </div>
        <div className="stats bg-base-100 shadow-sm">
          <div className="stat">
            <div className="stat-title">Gross profit</div>
            <div
              className={`stat-value text-2xl ${totalProfit < 0 ? "text-error" : "text-success"}`}
            >
              {money(totalProfit)}
            </div>
          </div>
        </div>
        <div className="stats bg-base-100 shadow-sm">
          <div className="stat">
            <div className="stat-title">Customers ranked</div>
            <div className="stat-value text-2xl">{byCustomer.length}</div>
          </div>
        </div>
      </div>

      <CustomerPerformanceExplorer
        customers={explorerCustomers}
        carriers={explorerCarriers}
        initialMode={initialMode}
        initialPartnerId={initialPartnerId}
        initialCustomerId={initialCustomerId}
      />
    </div>
  );
}
