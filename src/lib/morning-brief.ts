import { money } from "@/lib/types";

export type BriefLine = { label: string; value: string; href?: string };

export type MorningBriefData = {
  greeting: string;
  yesterday: BriefLine[];
  today: BriefLine[];
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
}): MorningBriefData {
  const first = input.fullName.split(" ")[0] || "there";
  return {
    greeting: `Good morning, ${first}.`,
    yesterday: [
      { label: "Shipments delivered", value: String(input.yesterdayDelivered) },
      { label: "Revenue earned", value: money(input.yesterdayRevenue) },
      { label: "Gross profit", value: money(input.yesterdayProfit) },
      { label: "Payments received", value: money(input.yesterdayPayments) },
    ],
    today: [
      { label: "Pickups scheduled", value: String(input.pickupsToday), href: "/shipments" },
      { label: "Deliveries expected", value: String(input.deliveriesToday), href: "/shipments" },
      { label: "Invoices due", value: String(input.invoicesDueToday), href: "/ar" },
    ],
  };
}
