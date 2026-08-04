import type { UserRole } from "@/lib/types";

/** Plain-English portal names shown in the UI */
export const ROLE_LABELS: Record<UserRole, string> = {
  manager: "Executive / Manager",
  broker: "Broker Operations",
  billing: "Billing & Accounting",
  customer: "Shipper",
  carrier: "Carrier",
};

export const ROLE_PORTAL_BLURB: Record<UserRole, string> = {
  manager: "Company-wide oversight & approvals",
  broker: "Daily freight operations",
  billing: "Invoicing, AR & collections",
  customer: "Your shipments & invoices",
  carrier: "Assigned loads & delivery docs",
};

/**
 * Which URL paths each role may open.
 * Used by navigation and by page guards.
 */
export function allowedPaths(role: UserRole): string[] {
  switch (role) {
    case "manager":
      return [
        "/dashboard",
        "/customers",
        "/carriers",
        "/contracts",
        "/shipments",
        "/invoices",
        "/payments",
        "/ar",
        "/disputes",
        "/reports",
        "/profitability",
        "/settings",
      ];
    case "broker":
      return [
        "/dashboard",
        "/customers",
        "/contracts",
        "/shipments",
        "/carriers",
      ];
    case "billing":
      return [
        "/dashboard",
        "/invoices",
        "/payments",
        "/ar",
        "/disputes",
      ];
    case "customer":
      return [
        "/dashboard",
        "/shipments",
        "/invoices",
        "/support",
      ];
    case "carrier":
      return [
        "/dashboard",
        "/shipments",
        "/documents",
      ];
    default:
      return ["/dashboard"];
  }
}

export function canAccessPath(role: UserRole, pathname: string): boolean {
  const allowed = allowedPaths(role);
  if (allowed.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return true;
  }
  // Shipments detail / new under /shipments
  if (pathname.startsWith("/shipments") && allowed.includes("/shipments")) {
    return true;
  }
  return false;
}

export function canManageOperations(role: UserRole) {
  return role === "manager" || role === "broker";
}

export function canManageBilling(role: UserRole) {
  return role === "manager" || role === "billing";
}

export function canApprove(role: UserRole) {
  return role === "manager";
}

export function isInternalStaff(role: UserRole) {
  return role === "manager" || role === "broker" || role === "billing";
}
