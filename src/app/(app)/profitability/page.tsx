import { Suspense } from "react";
import { ProfitabilityHeatmap } from "@/components/ProfitabilityHeatmap";
import { FocusScroll } from "@/components/FocusScroll";
import { requirePathAccess } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/types";
import { HorizontalBars, MonthlyBars } from "@/components/Charts";
import { bucketByMonth } from "@/lib/analytics";
import {
  marginBand,
  parseBandParam,
  parseDimParam,
  toHeatRows,
} from "@/lib/heatmap";
import { redirect } from "next/navigation";

export default async function ProfitabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ band?: string; dim?: string; focus?: string }>;
}) {
  const profile = await requirePathAccess("/profitability");
  if (profile.role !== "manager" && profile.role !== "billing") redirect("/dashboard");

  const params = await searchParams;
  const bandFilter = parseBandParam(params.band ?? null);
  const dimFilter = parseDimParam(params.dim ?? null);

  const supabase = await createClient();
  const { data: profit } = await supabase.from("shipment_profitability").select("*");
  const { data: customers } = await supabase.from("customers").select("id, name");
  const { data: carriers } = await supabase.from("carriers").select("id, name");
  const { data: shipments } = await supabase
    .from("shipments")
    .select(
      "id, created_at, pickup_date, delivery_date, carrier_id, origin_city, dest_city",
    );
  const names = new Map((customers ?? []).map((c) => [c.id, c.name]));
  const carrierNames = new Map((carriers ?? []).map((c) => [c.id, c.name]));
  const shipDates = new Map(
    (shipments ?? []).map((s) => [
      s.id as string,
      (s.delivery_date || s.pickup_date || s.created_at) as string,
    ]),
  );

  const rows = (profit ?? [])
    .map((p) => {
      const billable = Number(p.billable_accessorials);
      const payable = Number(p.payable_accessorials);
      const discount = Number(p.discount_amount || 0);
      const revenue = Number(p.customer_rate) + billable - discount;
      const cogs = Number(p.carrier_cost) + payable;
      const margin = Number(p.margin);
      const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
      return {
        ...p,
        customer: names.get(p.customer_id) ?? "Unknown",
        billable,
        payable,
        discount,
        revenue,
        cogs,
        margin,
        band: marginBand(marginPct, revenue),
      };
    })
    .sort((a, b) => a.margin - b.margin);

  const detailRows = bandFilter ? rows.filter((r) => r.band === bandFilter) : rows;

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
  const monthly = bucketByMonth(
    rows.map((r) => ({
      date: shipDates.get(r.shipment_id as string) ?? null,
      amount: r.margin,
    })),
    6,
  );

  const heatRows = toHeatRows({
    profit: (profit ?? []).map((p) => ({
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
    shipments: (shipments ?? []).map((s) => ({
      id: s.id,
      carrier_id: s.carrier_id,
      origin_city: s.origin_city,
      dest_city: s.dest_city,
      pickup_date: s.pickup_date,
      delivery_date: s.delivery_date,
      created_at: s.created_at,
    })),
    customerNames: names,
    carrierNames,
  });

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
          {bandFilter ? ` Filtered to ${bandFilter}.` : ""}
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

      <ProfitabilityHeatmap
        rows={heatRows}
        initialDim={dimFilter}
        initialBand={bandFilter}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h3 className="card-title text-base">Monthly profit</h3>
            <MonthlyBars data={monthly} name="Profit" />
          </div>
        </div>
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h3 className="card-title text-base">Customer profitability</h3>
            <HorizontalBars data={byCustomer} name="Margin" />
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h3 className="card-title text-base">
            Load cost & margin detail
            {bandFilter ? ` · ${bandFilter}` : ""}
          </h3>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Load</th>
                  <th>Customer</th>
                  <th>Revenue</th>
                  <th>Carrier cost</th>
                  <th>Payable extras</th>
                  <th>Billable extras</th>
                  <th>COGS</th>
                  <th>Margin</th>
                </tr>
              </thead>
              <tbody>
                {detailRows.slice(0, bandFilter ? 50 : 15).map((r) => (
                  <tr key={r.shipment_id}>
                    <td>{r.load_number}</td>
                    <td>{r.customer}</td>
                    <td>{money(r.revenue)}</td>
                    <td>{money(r.carrier_cost)}</td>
                    <td>{money(r.payable)}</td>
                    <td>{money(r.billable)}</td>
                    <td>{money(r.cogs)}</td>
                    <td className={r.margin < 0 ? "text-error font-semibold" : "text-success"}>
                      {money(r.margin)}
                    </td>
                  </tr>
                ))}
                {detailRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-sm opacity-70">
                      No loads in this margin band.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
