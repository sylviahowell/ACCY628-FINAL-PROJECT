/** Build last-N calendar months of totals from dated rows (real history, not synthetic). */

export type MonthBucket = { month: string; value: number };

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

/**
 * Sum `amount` for each of the last `months` calendar months (UTC), including empty months as 0.
 * `dateField` values may be ISO dates or timestamps.
 */
export function bucketByMonth(
  rows: { date: string | null | undefined; amount: number }[],
  months = 6,
): MonthBucket[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(monthKey(d));
  }

  const totals = new Map(keys.map((k) => [k, 0]));
  for (const row of rows) {
    if (!row.date) continue;
    const d = new Date(row.date);
    if (Number.isNaN(d.getTime())) continue;
    const key = monthKey(d);
    if (!totals.has(key)) continue;
    totals.set(key, (totals.get(key) ?? 0) + Number(row.amount || 0));
  }

  return keys.map((key) => ({
    month: monthLabel(key),
    value: Math.round(totals.get(key) ?? 0),
  }));
}
