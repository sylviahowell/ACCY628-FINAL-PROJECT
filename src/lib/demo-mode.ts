import { DEMO_USERS, type UserRole } from "@/lib/types";

/** Cookie flag for Demo Mode (server-readable). Not production authorization. */
export const DEMO_MODE_COOKIE = "rowanlane_demo_mode";

/** sessionStorage keys mirrored on the client for Demo Mode UI. */
export const DEMO_MODE_STORAGE_KEY = "rowanlane_demo_mode";
export const DEMO_ROLE_STORAGE_KEY = "rowanlane_demo_role";

export const DEMO_ROLE_OPTIONS: {
  role: UserRole;
  label: string;
  fullName: string;
}[] = [
  { role: "manager", label: "Executive / Manager", fullName: "Morgan Manager" },
  { role: "broker", label: "Broker Operations", fullName: "Blake Broker" },
  { role: "billing", label: "Billing & Accounting", fullName: "Bailey Billing" },
  { role: "customer", label: "Customer", fullName: "Casey Customer" },
  { role: "carrier", label: "Carrier", fullName: "Chris Carrier" },
];

export function isDemoUserEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return DEMO_USERS.some((u) => u.email === email);
}

export function demoUserForRole(role: UserRole) {
  const user = DEMO_USERS.find((u) => u.role === role);
  if (!user) throw new Error(`Missing demo user for role ${role}`);
  return user;
}

export function demoRoleLabel(role: UserRole): string {
  return DEMO_ROLE_OPTIONS.find((o) => o.role === role)?.label ?? role;
}
