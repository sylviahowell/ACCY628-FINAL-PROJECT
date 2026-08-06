import { money } from "@/lib/types";

export type KpiTone = "good" | "bad" | "neutral";

export type KpiItem = {
  id: string;
  label: string;
  value: string;
  deltaLabel: string;
  tone: KpiTone;
  status: string;
  href?: string;
};

function pctChange(current: number, prior: number) {
  if (prior === 0) {
    if (current === 0) return 0;
    return current > 0 ? 100 : -100;
  }
  return ((current - prior) / Math.abs(prior)) * 100;
}

function formatPct(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function formatPts(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)} pts`;
}

function formatCountDelta(n: number, unit: string) {
  if (n === 0) return `Flat vs ${unit}`;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n} vs ${unit}`;
}

/** Period helpers (UTC month windows). */
export function monthBounds(offset = 0) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 1));
  return { start, end };
}

export function inRange(dateStr: string | null | undefined, start: Date, end: Date) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  return d >= start && d < end;
}

export function buildExecutiveKpis(input: {
  revenueThisMonth: number;
  revenueLastMonth: number;
  profitThisMonth: number;
  profitLastMonth: number;
  marginThisMonth: number;
  marginLastMonth: number;
  activeShipments: number;
  activeAsOfWeekAgo: number;
  lateDeliveries: number;
  lateAsOfWeekAgo: number;
  arBalance: number;
  arLastMonthEnd: number;
  cashThisMonth: number;
  cashLastMonth: number;
}): KpiItem[] {
  const revDelta = pctChange(input.revenueThisMonth, input.revenueLastMonth);
  const profitDelta = pctChange(input.profitThisMonth, input.profitLastMonth);
  const marginDelta = input.marginThisMonth - input.marginLastMonth;
  const lateDelta = input.lateDeliveries - input.lateAsOfWeekAgo;
  const arDelta = pctChange(input.arBalance, input.arLastMonthEnd);
  const cashDelta = pctChange(input.cashThisMonth, input.cashLastMonth);
  const activeDelta = input.activeShipments - input.activeAsOfWeekAgo;

  return [
    {
      id: "rev",
      label: "Revenue this month",
      value: money(input.revenueThisMonth),
      deltaLabel: `${formatPct(revDelta)} from last month`,
      tone: revDelta >= 0 ? "good" : "bad",
      status: revDelta >= 0 ? "Improving" : "Soft",
      href: "/profitability",
    },
    {
      id: "gp",
      label: "Gross profit",
      value: money(input.profitThisMonth),
      deltaLabel: `${formatPct(profitDelta)} from last month`,
      tone: profitDelta >= 0 ? "good" : "bad",
      status: input.profitThisMonth >= 0 ? "On track" : "Loss",
      href: "/profitability",
    },
    {
      id: "gm",
      label: "Gross margin %",
      value: `${input.marginThisMonth.toFixed(1)}%`,
      deltaLabel: `${formatPts(marginDelta)} vs last month`,
      tone: marginDelta >= 0 ? "good" : "bad",
      status: input.marginThisMonth >= 15 ? "Healthy" : "Watch",
      href: "/profitability",
    },
    {
      id: "active",
      label: "Active shipments",
      value: String(input.activeShipments),
      deltaLabel: formatCountDelta(activeDelta, "7d ago"),
      tone: "neutral",
      status: "In network",
      href: "/shipments",
    },
    {
      id: "late",
      label: "Delayed loads",
      value: String(input.lateDeliveries),
      deltaLabel: formatCountDelta(lateDelta, "7d ago"),
      tone: lateDelta <= 0 ? "good" : "bad",
      status: input.lateDeliveries === 0 ? "Clear" : "Attention",
      href: "/shipments?status=delayed",
    },
    {
      id: "ar",
      label: "Accounts receivable",
      value: money(input.arBalance),
      deltaLabel: `${formatPct(arDelta)} vs end of last month`,
      tone: arDelta <= 0 ? "good" : "bad",
      status: input.arBalance > 0 ? "Outstanding" : "Cleared",
      href: "/ar",
    },
    {
      id: "cash",
      label: "Cash collected this month",
      value: money(input.cashThisMonth),
      deltaLabel: `${formatPct(cashDelta)} from last month`,
      tone: cashDelta >= 0 ? "good" : "bad",
      status: cashDelta >= 0 ? "Strong" : "Slower",
      href: "/ar?receipts=month",
    },
  ];
}
