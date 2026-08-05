import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getCurrentProfile } from "@/lib/actions/auth";
import { isDemoUserEmail } from "@/lib/demo-mode";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  // Demo selector for any seeded demo account (portal cards or demo password login).
  const demoMode = isDemoUserEmail(profile.email);

  return (
    <AppShell profile={profile} isDemoMode={demoMode}>
      {children}
    </AppShell>
  );
}
