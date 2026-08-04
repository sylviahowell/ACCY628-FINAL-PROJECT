import Link from "next/link";
import { signOut } from "@/lib/actions/auth";
import type { Profile } from "@/lib/types";

const NAV: Record<string, { href: string; label: string }[]> = {
  manager: [
    { href: "/workspace", label: "Overview" },
    { href: "/workspace/loads", label: "Loads" },
    { href: "/workspace/billing", label: "AR & Margin" },
  ],
  broker: [
    { href: "/workspace", label: "Load board" },
    { href: "/workspace/loads", label: "All loads" },
    { href: "/workspace/loads/new", label: "New load" },
  ],
  billing: [
    { href: "/workspace", label: "Billing desk" },
    { href: "/workspace/billing", label: "Invoices" },
    { href: "/workspace/loads", label: "Delivered loads" },
  ],
  customer: [
    { href: "/workspace", label: "My shipments" },
    { href: "/workspace/billing", label: "My invoices" },
  ],
  carrier: [
    { href: "/workspace", label: "My assignments" },
    { href: "/workspace/loads", label: "Load details" },
  ],
};

export function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const links = NAV[profile.role] ?? NAV.broker;

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#e8eef5_0%,_#f4f6f8_45%,_#ebe7df_100%)] text-slate-900">
      <header className="border-b border-slate-300/70 bg-[#0f2744] text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-200/80">
              LaneLedger Freight
            </p>
            <h1 className="text-lg font-semibold tracking-tight">
              Contract-to-cash brokerage
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="rounded-md bg-white/10 px-3 py-1.5">
              <span className="text-sky-100">{profile.full_name}</span>
              <span className="mx-2 text-white/40">·</span>
              <span className="uppercase tracking-wide text-amber-200">
                {profile.role}
              </span>
            </div>
            <Link
              href="/login"
              className="rounded-md border border-white/25 px-3 py-1.5 hover:bg-white/10"
            >
              Switch role
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md bg-white px-3 py-1.5 font-medium text-[#0f2744] hover:bg-sky-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-4 pb-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-1.5 text-sm text-sky-100 hover:bg-white/10 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
