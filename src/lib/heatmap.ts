export type MarginBand = "Strong Profit" | "Acceptable" | "Low Margin" | "Unprofitable";

export type HeatCell = {
  key: string;
  label: string;
  revenue: number;
  carrierCost: number;
  otherDirect: number;
  grossProfit: number;
  marginPct: number;
  shipments: number;
  band: MarginBand;
  href: string;
};

export type HeatDimension = "customer" | "carrier" | "lane" | "month" | "shipment";

export function marginBand(marginPct: number, revenue: number): MarginBand {
  if (revenue <= 0 || marginPct < 0) return "Unprofitable";
  if (marginPct >= 20) return "Strong Profit";
  if (marginPct >= 12) return "Acceptable";
  if (marginPct >= 0) return "Low Margin";
  return "Unprofitable";
}

export function bandClasses(band: MarginBand) {
  switch (band) {
    case "Strong Profit":
      return "bg-success/25 border-success text-success-content";
    case "Acceptable":
      return "bg-info/20 border-info";
    case "Low Margin":
      return "bg-warning/25 border-warning";
    default:
      return "bg-error/20 border-error";
  }
}

type ProfitRow = {
  shipment_id: string;
  load_number: string;
  customer_id: string;
  customer_name: string;
  carrier_id: string | null;
  carrier_name: string;
  lane: string;
  monthKey: string;
  monthLabel: string;
  revenue: number;
  carrierCost: number;
  otherDirect: number;
  grossProfit: number;
};

export function buildHeatmap(rows: ProfitRow[], dimension: HeatDimension): HeatCell[] {
  const buckets = new Map<
    string,
    {
      label: string;
      revenue: number;
      carrierCost: number;
      otherDirect: number;
      grossProfit: number;
      shipments: number;
      href: string;
    }
  >();

  for (const r of rows) {
    let key = "";
    let label = "";
    let href = "/profitability";
    switch (dimension) {
      case "customer":
        key = r.customer_id;
        label = r.customer_name;
        href = "/customers";
        break;
      case "carrier":
        key = r.carrier_id ?? "unassigned";
        label = r.carrier_name;
        href = "/carriers";
        break;
      case "lane":
        key = r.lane;
        label = r.lane;
        href = "/shipments";
        break;
      case "month":
        key = r.monthKey;
        label = r.monthLabel;
        href = "/ar";
        break;
      case "shipment":
        key = r.shipment_id;
        label = r.load_number;
        href = `/shipments/${r.shipment_id}`;
        break;
    }
    const b = buckets.get(key) ?? {
      label,
      revenue: 0,
      carrierCost: 0,
      otherDirect: 0,
      grossProfit: 0,
      shipments: 0,
      href,
    };
    b.revenue += r.revenue;
    b.carrierCost += r.carrierCost;
    b.otherDirect += r.otherDirect;
    b.grossProfit += r.grossProfit;
    b.shipments += 1;
    buckets.set(key, b);
  }

  return [...buckets.entries()]
    .map(([key, b]) => {
      const marginPct = b.revenue > 0 ? (b.grossProfit / b.revenue) * 100 : 0;
      return {
        key,
        label: b.label,
        revenue: b.revenue,
        carrierCost: b.carrierCost,
        otherDirect: b.otherDirect,
        grossProfit: b.grossProfit,
        marginPct,
        shipments: b.shipments,
        band: marginBand(marginPct, b.revenue),
        href: b.href,
      };
    })
    .sort((a, b) => a.marginPct - b.marginPct);
}

export function toHeatRows(input: {
  profit: {
    shipment_id: string;
    load_number: string;
    customer_id: string;
    customer_rate: number;
    carrier_cost: number;
    billable_accessorials: number;
    payable_accessorials: number;
    discount_amount: number | null;
    margin: number;
  }[];
  shipments: {
    id: string;
    carrier_id: string | null;
    origin_city: string | null;
    dest_city: string | null;
    pickup_date: string | null;
    delivery_date: string | null;
    created_at: string | null;
  }[];
  customerNames: Map<string, string>;
  carrierNames: Map<string, string>;
}) {
  const shipById = new Map(input.shipments.map((s) => [s.id, s]));
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return input.profit.map((p) => {
    const s = shipById.get(p.shipment_id);
    const dateStr = s?.delivery_date || s?.pickup_date || s?.created_at || null;
    const d = dateStr ? new Date(dateStr) : new Date();
    const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const revenue =
      Number(p.customer_rate) +
      Number(p.billable_accessorials) -
      Number(p.discount_amount || 0);
    const otherDirect = Number(p.payable_accessorials);
    return {
      shipment_id: p.shipment_id,
      load_number: p.load_number,
      customer_id: p.customer_id,
      customer_name: input.customerNames.get(p.customer_id) ?? "Customer",
      carrier_id: s?.carrier_id ?? null,
      carrier_name: s?.carrier_id
        ? (input.carrierNames.get(s.carrier_id) ?? "Carrier")
        : "Unassigned",
      lane: `${s?.origin_city ?? "?"} → ${s?.dest_city ?? "?"}`,
      monthKey,
      monthLabel: `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
      revenue,
      carrierCost: Number(p.carrier_cost),
      otherDirect,
      grossProfit: Number(p.margin),
    };
  });
}
