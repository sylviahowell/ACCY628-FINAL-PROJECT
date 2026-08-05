export type Insight = {
  id: string;
  observation: string;
  whyItMatters: string;
  action: string;
  href: string;
};

export function buildBusinessInsights(input: {
  revenueThisMonth: number;
  revenueLastMonth: number;
  marginThisMonth: number;
  marginLastMonth: number;
  carrierCostThisMonth: number;
  carrierCostLastMonth: number;
  topRevenueCustomer: { name: string; revenue: number; marginPct: number } | null;
  unbilledDelivered: number;
  overdueByCustomer: { name: string; balance: number }[];
  weakLane: { lane: string; marginPct: number; loads: number } | null;
  highAccessorialCarrier: { name: string; accessorialRate: number; loads: number } | null;
}): Insight[] {
  const insights: Insight[] = [];

  if (
    input.revenueThisMonth > input.revenueLastMonth &&
    input.marginThisMonth < input.marginLastMonth &&
    input.carrierCostThisMonth > input.carrierCostLastMonth
  ) {
    insights.push({
      id: "rev-up-margin-down",
      observation:
        "Revenue is up versus last month, but gross margin declined as carrier costs rose.",
      whyItMatters:
        "Top-line growth without margin protection can shrink operating cash even while loads move.",
      action: "Review high-cost lanes and renegotiate buy rates on weak lanes.",
      href: "/profitability",
    });
  }

  if (input.topRevenueCustomer && input.topRevenueCustomer.marginPct < 12) {
    insights.push({
      id: "high-rev-low-margin-customer",
      observation: `${input.topRevenueCustomer.name} drives substantial revenue but margins are about ${input.topRevenueCustomer.marginPct.toFixed(1)}%.`,
      whyItMatters: "High-volume, low-margin accounts can crowd out capacity for better work.",
      action: "Review contract rates, accessorials, and lane mix for this customer.",
      href: "/customers",
    });
  }

  if (input.unbilledDelivered > 0) {
    insights.push({
      id: "unbilled",
      observation: `${input.unbilledDelivered} delivered shipment(s) still have no invoice.`,
      whyItMatters: "Earned revenue sitting unbilled delays cash and understates AR.",
      action: "Open Ready-to-bill and generate invoices for POD-complete loads.",
      href: "/invoices",
    });
  }

  const topOverdue = [...input.overdueByCustomer]
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 2);
  if (topOverdue.length > 0 && topOverdue[0].balance > 0) {
    const names = topOverdue.map((c) => c.name).join(" and ");
    insights.push({
      id: "ar-concentration",
      observation: `Overdue receivables are concentrated in ${names}.`,
      whyItMatters: "Collection risk is not evenly spread — a few accounts drive most past-due dollars.",
      action: "Prioritize collection calls and check dispute status for those customers.",
      href: "/ar",
    });
  }

  if (input.weakLane && input.weakLane.loads >= 1 && input.weakLane.marginPct < 10) {
    insights.push({
      id: "weak-lane",
      observation: `The ${input.weakLane.lane} lane is running about ${input.weakLane.marginPct.toFixed(1)}% margin across ${input.weakLane.loads} load(s).`,
      whyItMatters: "Repeated weak lanes drag portfolio margin even when overall volume looks fine.",
      action: "Reprice the lane or prefer stronger carriers on that route.",
      href: "/profitability",
    });
  }

  if (
    input.highAccessorialCarrier &&
    input.highAccessorialCarrier.accessorialRate >= 0.3 &&
    input.highAccessorialCarrier.loads >= 2
  ) {
    insights.push({
      id: "accessorial-carrier",
      observation: `${input.highAccessorialCarrier.name} shows accessorials on roughly ${Math.round(input.highAccessorialCarrier.accessorialRate * 100)}% of loads.`,
      whyItMatters: "Frequent extras inflate cost and create approval backlog.",
      action: "Review accessorial patterns before assigning similar freight.",
      href: "/carriers",
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "stable",
      observation: "No material exceptions from the current rule checks.",
      whyItMatters: "Margins, billing lag, and AR concentration look within demo thresholds.",
      action: "Scan the Warning Center for day-to-day exceptions.",
      href: "/warnings",
    });
  }

  return insights.slice(0, 5);
}
