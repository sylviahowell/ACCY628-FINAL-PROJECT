/** Build last-N calendar months of totals from dated rows (real history, not synthetic). */

export type MonthBucket = { month: string; value: number };

export type MonthlyEconomicsBucket = {
  month: string;
  revenue: number;
  cogs: number;
  profit: number;
  marginPct: number;
};

export type MonthlyCustomerProfitSeries = {
  /** Stable series keys for stacked bars (top customers + Other). */
  seriesKeys: string[];
  data: Array<Record<string, string | number> & { month: string; total: number }>;
};

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

function parseRowMonthKey(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return monthKey(d);
}

/**
 * Sum `amount` for each of the last `months` calendar months (UTC), including empty months as 0.
 * `dateField` values may be ISO dates or timestamps.
 */
export function bucketByMonth(
  rows: { date: string | null | undefined; amount: number }[],
  months = 6,
): MonthBucket[] {
  const keys = lastMonthKeys(months);
  const totals = new Map(keys.map((k) => [k, 0]));
  for (const row of rows) {
    const key = parseRowMonthKey(row.date);
    if (!key || !totals.has(key)) continue;
    totals.set(key, (totals.get(key) ?? 0) + Number(row.amount || 0));
  }

  return keys.map((key) => ({
    month: monthLabel(key),
    value: Math.round(totals.get(key) ?? 0),
  }));
}

/**
 * Monthly revenue, COGS, profit, and margin % for the last N calendar months (UTC).
 */
export function bucketMonthlyEconomics(
  rows: {
    date: string | null | undefined;
    revenue: number;
    cogs: number;
    profit: number;
  }[],
  months = 6,
): MonthlyEconomicsBucket[] {
  const keys = lastMonthKeys(months);
  const buckets = new Map(
    keys.map((k) => [k, { revenue: 0, cogs: 0, profit: 0 }]),
  );

  for (const row of rows) {
    const key = parseRowMonthKey(row.date);
    if (!key || !buckets.has(key)) continue;
    const b = buckets.get(key)!;
    b.revenue += Number(row.revenue || 0);
    b.cogs += Number(row.cogs || 0);
    b.profit += Number(row.profit || 0);
  }

  return keys.map((key) => {
    const b = buckets.get(key)!;
    const revenue = Math.round(b.revenue);
    const cogs = Math.round(b.cogs);
    const profit = Math.round(b.profit);
    const marginPct =
      revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0;
    return {
      month: monthLabel(key),
      revenue,
      cogs,
      profit,
      marginPct,
    };
  });
}

/**
 * Monthly margin stacked by top-N customers (by total margin) + Other, with a total line series.
 */
export function bucketMonthlyProfitByCustomer(
  rows: {
    date: string | null | undefined;
    customer: string;
    margin: number;
  }[],
  months = 6,
  topN = 5,
): MonthlyCustomerProfitSeries {
  const keys = lastMonthKeys(months);
  const keySet = new Set(keys);

  const customerTotals = new Map<string, number>();
  for (const row of rows) {
    const key = parseRowMonthKey(row.date);
    if (!key || !keySet.has(key)) continue;
    const name = row.customer || "Unknown";
    customerTotals.set(name, (customerTotals.get(name) ?? 0) + Number(row.margin || 0));
  }

  const ranked = [...customerTotals.entries()].sort((a, b) => b[1] - a[1]);
  const topNames = ranked.slice(0, topN).map(([name]) => name);
  const topSet = new Set(topNames);
  const hasOther = ranked.length > topNames.length;
  const seriesKeys = hasOther ? [...topNames, "Other"] : [...topNames];

  const byMonth = new Map<string, Map<string, number>>();
  for (const k of keys) {
    byMonth.set(k, new Map(seriesKeys.map((s) => [s, 0])));
  }

  for (const row of rows) {
    const key = parseRowMonthKey(row.date);
    if (!key || !byMonth.has(key)) continue;
    const name = row.customer || "Unknown";
    const series = topSet.has(name) ? name : "Other";
    if (!seriesKeys.includes(series)) continue;
    const monthMap = byMonth.get(key)!;
    monthMap.set(series, (monthMap.get(series) ?? 0) + Number(row.margin || 0));
  }

  const data = keys.map((key) => {
    const monthMap = byMonth.get(key)!;
    const point: Record<string, string | number> & { month: string; total: number } = {
      month: monthLabel(key),
      total: 0,
    };
    let total = 0;
    for (const series of seriesKeys) {
      const v = Math.round(monthMap.get(series) ?? 0);
      point[series] = v;
      total += v;
    }
    point.total = total;
    return point;
  });

  return { seriesKeys, data };
}
