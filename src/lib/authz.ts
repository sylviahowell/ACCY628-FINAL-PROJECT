import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/actions/auth";
import { canAccessPath } from "@/lib/roles";
import type { UserRole } from "@/lib/types";

/** Send the user home if their role is not allowed on this page. */
export async function requireRoles(allowed: UserRole[]) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!allowed.includes(profile.role)) redirect("/dashboard");
  return profile;
}

export async function requirePathAccess(pathname: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPath(profile.role, pathname)) redirect("/dashboard");
  return profile;
}
