/** Partner Performance Explorer — types & pure helpers over demo shipment economics. */

export type ExplorerDisplayStatus = "delivered" | "in_transit" | "delayed" | "other";

export type PartnerMode = "shipper" | "carrier";

export type ExplorerShipment = {
  id: string;
  loadNumber: string;
  customerName: string;
  origin: string;
  destination: string;
  carrier: string;
  revenue: number;
  cost: number;
  profit: number;
  status: string;
  displayStatus: ExplorerDisplayStatus;
  /** Activity date (delivery / pickup / created) ISO */
  date: string | null;
  promisedDelivery: string | null;
  deliveryDate: string | null;
};

/** Shipper or carrier bundle — same shape, different grouping. */
export type ExplorerPartner = {
  id: string;
  name: string;
  shipments: ExplorerShipment[];
};

export type ExplorerCustomer = ExplorerPartner;
export type ExplorerCarrier = ExplorerPartner;

export type MonthlyPoint = {
  month: string;
  revenue: number;
  profit: number;
  cost: number;
  marginPct: number;
  shipments: number;
};

export type PartnerKpis = {
  revenue: number;
  grossProfit: number;
  marginPct: number;
  shipmentCount: number;
  avgRevenue: number;
  onTimePct: number | null;
  avgCost: number;
  /** Total buy / COGS across shipments (useful in carrier mode). */
  totalCost: number;
  /** Month-over-month deltas (percentage points for rates, % change for money/counts). */
  deltas: {
    revenue: number | null;
    grossProfit: number | null;
    marginPct: number | null;
    shipmentCount: number | null;
    avgRevenue: number | null;
    onTimePct: number | null;
    avgCost: number | null;
    totalCost: number | null;
  };
};

/** @deprecated Prefer PartnerKpis */
export type CustomerKpis = PartnerKpis;

export const ALL_PARTNERS_ID = "all";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [, m] = key.split("-");
  return MONTH_LABELS[Number(m) - 1] ?? key;
}

function lastMonthKeys(months: number): string[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(monthKey(d));
  }
  return keys;
}

function parseMonthKey(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return monthKey(d);
}

export function classifyShipmentStatus(
  status: string,
  promisedDelivery: string | null,
  deliveryDate: string | null,
  today: string,
): ExplorerDisplayStatus {
  const s = status.toLowerCase();
  if (s === "delivered" || s === "completed") return "delivered";
  const late =
    Boolean(promisedDelivery) &&
    (promisedDelivery as string) < today &&
    !["delivered", "completed", "cancelled"].includes(s);
  if (late) return "delayed";
  if (["in_transit", "picked_up"].includes(s)) return "in_transit";
  if (deliveryDate && promisedDelivery && deliveryDate > promisedDelivery) {
    return "delayed";
  }
  if (["scheduled", "assigned", "booked"].includes(s)) return "in_transit";
  return "other";
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

function pointChange(current: number, previous: number): number | null {
  return Math.round((current - previous) * 10) / 10;
}

function monthMetrics(shipments: ExplorerShipment[], key: string) {
  const rows = shipments.filter((s) => parseMonthKey(s.date) === key);
  const revenue = rows.reduce((a, s) => a + s.revenue, 0);
  const cost = rows.reduce((a, s) => a + s.cost, 0);
  const profit = rows.reduce((a, s) => a + s.profit, 0);
  const shipmentCount = rows.length;
  const avgRevenue = shipmentCount ? revenue / shipmentCount : 0;
  const avgCost = shipmentCount ? cost / shipmentCount : 0;
  const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;

  const scored = rows.filter(
    (s) =>
      (s.displayStatus === "delivered" || s.status === "delivered" || s.status === "completed") &&
      s.promisedDelivery,
  );
  let onTimePct: number | null = null;
  if (scored.length > 0) {
    const onTime = scored.filter((s) => {
      if (!s.deliveryDate || !s.promisedDelivery) return false;
      return s.deliveryDate <= s.promisedDelivery;
    }).length;
    onTimePct = Math.round((onTime / scored.length) * 1000) / 10;
  }

  return {
    revenue,
    cost,
    profit,
    shipmentCount,
    avgRevenue,
    avgCost,
    marginPct,
    onTimePct,
  };
}

export function buildMonthlySeries(
  shipments: ExplorerShipment[],
  months = 6,
): MonthlyPoint[] {
  const keys = lastMonthKeys(months);
  return keys.map((key) => {
    const m = monthMetrics(shipments, key);
    return {
      month: monthLabel(key),
      revenue: Math.round(m.revenue),
      profit: Math.round(m.profit),
      cost: Math.round(m.cost),
      marginPct: Math.round(m.marginPct * 10) / 10,
      shipments: m.shipmentCount,
    };
  });
}

export function buildPartnerKpis(
  shipments: ExplorerShipment[],
  monthsBack = 6,
): PartnerKpis {
  const keys = lastMonthKeys(Math.max(monthsBack, 2));
  const currentKey = keys[keys.length - 1];
  const prevKey = keys[keys.length - 2];
  const current = monthMetrics(shipments, currentKey);
  const prev = monthMetrics(shipments, prevKey);

  const revenue = shipments.reduce((a, s) => a + s.revenue, 0);
  const cost = shipments.reduce((a, s) => a + s.cost, 0);
  const grossProfit = shipments.reduce((a, s) => a + s.profit, 0);
  const shipmentCount = shipments.length;
  const avgRevenue = shipmentCount ? revenue / shipmentCount : 0;
  const avgCost = shipmentCount ? cost / shipmentCount : 0;
  const marginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  const scored = shipments.filter(
    (s) =>
      (s.displayStatus === "delivered" ||
        s.status === "delivered" ||
        s.status === "completed") &&
      s.promisedDelivery &&
      s.deliveryDate,
  );
  let onTimePct: number | null = null;
  if (scored.length > 0) {
    const onTime = scored.filter(
      (s) => s.deliveryDate! <= s.promisedDelivery!,
    ).length;
    onTimePct = Math.round((onTime / scored.length) * 1000) / 10;
  }

  return {
    revenue,
    grossProfit,
    marginPct: Math.round(marginPct * 10) / 10,
    shipmentCount,
    avgRevenue,
    onTimePct,
    avgCost,
    totalCost: cost,
    deltas: {
      revenue: pctChange(current.revenue, prev.revenue),
      grossProfit: pctChange(current.profit, prev.profit),
      marginPct: pointChange(current.marginPct, prev.marginPct),
      shipmentCount: pctChange(current.shipmentCount, prev.shipmentCount),
      avgRevenue: pctChange(current.avgRevenue, prev.avgRevenue),
      onTimePct:
        current.onTimePct == null || prev.onTimePct == null
          ? null
          : pointChange(current.onTimePct, prev.onTimePct),
      avgCost: pctChange(current.avgCost, prev.avgCost),
      totalCost: pctChange(current.cost, prev.cost),
    },
  };
}

/** @deprecated Prefer buildPartnerKpis */
export const buildCustomerKpis = buildPartnerKpis;

export function recentShipments(
  shipments: ExplorerShipment[],
  limit = 12,
): ExplorerShipment[] {
  return [...shipments]
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))
    .slice(0, limit);
}

export function sortPartnersByRevenue(partners: ExplorerPartner[]): ExplorerPartner[] {
  return [...partners].sort((a, b) => {
    const ar = a.shipments.reduce((s, x) => s + x.revenue, 0);
    const br = b.shipments.reduce((s, x) => s + x.revenue, 0);
    return br - ar;
  });
}
