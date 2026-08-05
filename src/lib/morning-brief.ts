export type BriefLine = { label: string; value: string; href?: string };

export type MorningBriefData = {
  greeting: string;
  yesterday: BriefLine[];
  today: BriefLine[];
  attention: BriefLine[];
};

export function buildMorningBrief(input: {
  fullName: string;
  yesterdayDelivered: number;
  yesterdayRevenue: number;
  yesterdayProfit: number;
  yesterdayPayments: number;
  pickupsToday: number;
  deliveriesToday: number;
  invoicesDueToday: number;
  approvalsWaiting: number;
  lateShipments: number;
  unprofitableActive: number;
  overdueInvoices: number;
  insuranceExpiring: number;
  openDisputes: number;
}): MorningBriefData {
  const first = input.fullName.split(" ")[0] || "there";
  return {
    greeting: `Good morning, ${first}.`,
    yesterday: [
      { label: "Shipments delivered", value: String(input.yesterdayDelivered) },
      { label: "Revenue earned (delivered loads)", value: `$${Math.round(input.yesterdayRevenue).toLocaleString()}` },
      { label: "Gross profit on those loads", value: `$${Math.round(input.yesterdayProfit).toLocaleString()}` },
      { label: "Customer payments received", value: `$${Math.round(input.yesterdayPayments).toLocaleString()}` },
    ],
    today: [
      { label: "Pickups scheduled", value: String(input.pickupsToday), href: "/shipments" },
      { label: "Deliveries expected", value: String(input.deliveriesToday), href: "/shipments" },
      { label: "Invoices due", value: String(input.invoicesDueToday), href: "/ar" },
      { label: "Approvals waiting", value: String(input.approvalsWaiting), href: "/approvals" },
    ],
    attention: [
      {
        label: "Late shipments",
        value: String(input.lateShipments),
        href: "/warnings",
      },
      {
        label: "Unprofitable / negative-margin loads",
        value: String(input.unprofitableActive),
        href: "/profitability",
      },
      {
        label: "Overdue invoices",
        value: String(input.overdueInvoices),
        href: "/ar",
      },
      {
        label: "Carrier insurance expiring ≤30 days",
        value: String(input.insuranceExpiring),
        href: "/carriers",
      },
      {
        label: "Open disputes",
        value: String(input.openDisputes),
        href: "/disputes",
      },
    ].filter((a) => Number(a.value) > 0),
  };
}
