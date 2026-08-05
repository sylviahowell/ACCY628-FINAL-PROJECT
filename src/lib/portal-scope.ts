import type { Profile, UserRole } from "@/lib/types";

/** True when this role should only see its own customer/carrier slice of data. */
export function isPortalRole(role: UserRole) {
  return role === "customer" || role === "carrier";
}

export function scopeShipmentsByProfile<
  T extends { customer_id?: string | null; carrier_id?: string | null },
>(rows: T[], profile: Profile): T[] {
  if (profile.role === "customer" && profile.customer_id) {
    return rows.filter((r) => r.customer_id === profile.customer_id);
  }
  if (profile.role === "carrier" && profile.carrier_id) {
    return rows.filter((r) => r.carrier_id === profile.carrier_id);
  }
  return rows;
}

export function scopeInvoicesByProfile<T extends { customer_id?: string | null }>(
  rows: T[],
  profile: Profile,
): T[] {
  if (profile.role === "customer" && profile.customer_id) {
    return rows.filter((r) => r.customer_id === profile.customer_id);
  }
  return rows;
}

export function scopeDisputesByProfile<T extends { customer_id?: string | null }>(
  rows: T[],
  profile: Profile,
): T[] {
  if (profile.role === "customer" && profile.customer_id) {
    return rows.filter((r) => r.customer_id === profile.customer_id);
  }
  return rows;
}

/** Keep POD rows whose shipment_id is in the allowed set (portal-scoped loads). */
export function scopePodsByShipmentIds<T extends { shipment_id: string }>(
  rows: T[],
  shipmentIds: Set<string>,
): T[] {
  if (shipmentIds.size === 0) return [];
  return rows.filter((r) => shipmentIds.has(r.shipment_id));
}

export function searchPlaceholderForRole(role: UserRole): string {
  switch (role) {
    case "broker":
      return "Search loads, customers, carriers…";
    case "billing":
      return "Search loads, invoices…";
    case "manager":
      return "Search loads, invoices, customers…";
    case "customer":
      return "Search my shipments & invoices…";
    case "carrier":
      return "Search my assigned loads…";
    default:
      return "Search…";
  }
}
