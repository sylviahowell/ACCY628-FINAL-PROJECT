import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getCurrentProfile } from "@/lib/actions/auth";
import { isDemoMode } from "@/lib/demo-mode-server";
import { isDemoUserEmail } from "@/lib/demo-mode";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  // Demo selector only when Demo Mode cookie is set AND session is a seeded demo user.
  // Normal accounts never see role switching even if a stale cookie somehow exists.
  const demoMode = (await isDemoMode()) && isDemoUserEmail(profile.email);

  return (
    <AppShell profile={profile} isDemoMode={demoMode}>
      {children}
    </AppShell>
  );
}
