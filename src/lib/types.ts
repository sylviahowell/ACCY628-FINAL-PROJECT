export type UserRole = "manager" | "broker" | "billing" | "customer" | "carrier";

export type ShipmentStatus =
  | "draft"
  | "scheduled"
  | "assigned"
  | "booked"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "completed"
  | "cancelled";

export type InvoiceStatus =
  | "draft"
  | "pending"
  | "sent"
  | "partial"
  | "paid"
  | "overdue"
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
    email: "manager@freightflow.example",
    full_name: "Morgan Manager",
    role: "manager",
    description: "Full access — dashboards, approvals, and financials",
  },
  {
    email: "broker@freightflow.example",
    full_name: "Blake Broker",
    role: "broker",
    description: "Customers, contracts, carriers, and shipments",
  },
  {
    email: "customer@freightflow.example",
    full_name: "Casey Customer",
    role: "customer",
    customer_id: "11111111-1111-1111-1111-111111111101",
    description: "Track your freight and invoices",
  },
  {
    email: "carrier@freightflow.example",
    full_name: "Chris Carrier",
    role: "carrier",
    carrier_id: "22222222-2222-2222-2222-222222222201",
    description: "Assigned loads, POD, and status updates",
  },
];

export const SHIPMENT_FLOW: ShipmentStatus[] = [
  "scheduled",
  "assigned",
  "picked_up",
  "in_transit",
  "delivered",
  "completed",
];

export function money(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function isStaff(role: UserRole) {
  return role === "manager" || role === "broker" || role === "billing";
}

export function statusBadge(status: string) {
  const map: Record<string, string> = {
    scheduled: "badge-info",
    assigned: "badge-primary",
    picked_up: "badge-secondary",
    in_transit: "badge-warning",
    delivered: "badge-success",
    completed: "badge-success",
    cancelled: "badge-error",
    pending: "badge-warning",
    partial: "badge-warning",
    paid: "badge-success",
    overdue: "badge-error",
    disputed: "badge-error",
    sent: "badge-info",
    open: "badge-warning",
  };
  return map[status] ?? "badge-ghost";
}
