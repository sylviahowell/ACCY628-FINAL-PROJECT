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
  portal: string;
  portalAction: string;
  customer_id?: string;
  carrier_id?: string;
  description: string;
}[] = [
  {
    email: "manager@rowanlane.example",
    full_name: "Morgan Manager",
    role: "manager",
    portal: "Executive Portal",
    portalAction: "Enter as leadership",
    description: "Company-wide margin, AR, approvals, and controls",
  },
  {
    email: "broker@rowanlane.example",
    full_name: "Blake Broker",
    role: "broker",
    portal: "Broker Ops Portal",
    portalAction: "Enter as operations",
    description: "Book loads, assign carriers, manage contracts",
  },
  {
    email: "billing@rowanlane.example",
    full_name: "Bailey Billing",
    role: "billing",
    portal: "Billing & Accounting Portal",
    portalAction: "Enter as billing",
    description: "Invoices, payments, AR aging, and disputes",
  },
  {
    email: "customer@rowanlane.example",
    full_name: "Casey Customer",
    role: "customer",
    portal: "Shipper Portal",
    portalAction: "Enter as shipper",
    customer_id: "11111111-1111-1111-1111-111111111101",
    description: "Track your freight, invoices, and open disputes",
  },
  {
    email: "carrier@rowanlane.example",
    full_name: "Chris Carrier",
    role: "carrier",
    portal: "Carrier Portal",
    portalAction: "Enter as carrier",
    carrier_id: "22222222-2222-2222-2222-222222222201",
    description: "Assigned loads, POD uploads, and delivery updates",
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

/** Ops staff who book/assign freight (not billing-only). */
export function isOperations(role: UserRole) {
  return role === "manager" || role === "broker";
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
    resolved: "badge-success",
    closed: "badge-ghost",
    rejected: "badge-error",
    on_hold: "badge-warning",
  };
  return map[status] ?? "badge-ghost";
}

/** Human-readable status for badges and lists (e.g. in_transit → In Transit). */
export function formatStatusLabel(status: string) {
  if (!status) return "";
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
