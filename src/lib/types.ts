export type UserRole =
  | "manager"
  | "broker"
  | "billing"
  | "customer"
  | "carrier";

export type ShipmentStatus =
  | "draft"
  | "booked"
  | "in_transit"
  | "delivered"
  | "cancelled";

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "partial"
  | "paid"
  | "disputed"
  | "cancelled";

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  customer_id: string | null;
  carrier_id: string | null;
};

export const DEMO_PASSWORD = "FreightDemo2026!";

export const DEMO_USERS: {
  email: string;
  full_name: string;
  role: UserRole;
  customer_id?: string;
  carrier_id?: string;
  description: string;
}[] = [
  {
    email: "manager@freight.demo",
    full_name: "Morgan Manager",
    role: "manager",
    description: "Margin, aging, and exception overview",
  },
  {
    email: "broker@freight.demo",
    full_name: "Blake Broker",
    role: "broker",
    description: "Load board and tendering",
  },
  {
    email: "billing@freight.demo",
    full_name: "Bailey Billing",
    role: "billing",
    description: "Invoices, payments, and disputes",
  },
  {
    email: "customer@freight.demo",
    full_name: "Casey Customer",
    role: "customer",
    customer_id: "11111111-1111-1111-1111-111111111101",
    description: "Midwest Retail Group shipper portal",
  },
  {
    email: "carrier@freight.demo",
    full_name: "Chris Carrier",
    role: "carrier",
    carrier_id: "22222222-2222-2222-2222-222222222201",
    description: "Prairie Haulers assigned loads",
  },
];

export function money(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
