import Link from "next/link";
import {
  BarChart3,
  Building2,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  Truck,
  Users,
  Wallet,
  LineChart,
  ClipboardList,
} from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { ThemeSelector } from "@/components/ThemeSelector";
import type { Profile } from "@/lib/types";
import { isStaff } from "@/lib/types";

type NavItem = { href: string; label: string; icon: React.ReactNode };

function navFor(role: Profile["role"]): NavItem[] {
  const icon = (node: React.ReactNode) => node;
  if (role === "customer") {
    return [
      { href: "/dashboard", label: "Dashboard", icon: icon(<LayoutDashboard className="h-4 w-4" />) },
      { href: "/shipments", label: "My Shipments", icon: icon(<Package className="h-4 w-4" />) },
      { href: "/invoices", label: "Invoices", icon: icon(<FileText className="h-4 w-4" />) },
      { href: "/payments", label: "Payments", icon: icon(<Wallet className="h-4 w-4" />) },
      { href: "/settings", label: "Settings", icon: icon(<Settings className="h-4 w-4" />) },
    ];
  }
  if (role === "carrier") {
    return [
      { href: "/dashboard", label: "My Loads", icon: icon(<LayoutDashboard className="h-4 w-4" />) },
      { href: "/shipments", label: "Assignments", icon: icon(<Truck className="h-4 w-4" />) },
      { href: "/settings", label: "Settings", icon: icon(<Settings className="h-4 w-4" />) },
    ];
  }
  return [
    { href: "/dashboard", label: "Dashboard", icon: icon(<LayoutDashboard className="h-4 w-4" />) },
    { href: "/customers", label: "Customers", icon: icon(<Users className="h-4 w-4" />) },
    { href: "/carriers", label: "Carriers", icon: icon(<Truck className="h-4 w-4" />) },
    { href: "/contracts", label: "Contracts", icon: icon(<ClipboardList className="h-4 w-4" />) },
    { href: "/shipments", label: "Shipments", icon: icon(<Package className="h-4 w-4" />) },
    { href: "/invoices", label: "Invoices", icon: icon(<FileText className="h-4 w-4" />) },
    { href: "/payments", label: "Payments", icon: icon(<Wallet className="h-4 w-4" />) },
    { href: "/profitability", label: "Profitability", icon: icon(<LineChart className="h-4 w-4" />) },
    { href: "/reports", label: "Reports", icon: icon(<BarChart3 className="h-4 w-4" />) },
    { href: "/settings", label: "Settings", icon: icon(<Settings className="h-4 w-4" />) },
  ];
}

export function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const links = navFor(profile.role);

  return (
    <div className="drawer lg:drawer-open min-h-screen bg-base-200">
      <input id="app-drawer" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content flex flex-col">
        <div className="navbar border-b border-base-300 bg-base-100 px-4">
          <div className="flex-none lg:hidden">
            <label htmlFor="app-drawer" className="btn btn-square btn-ghost">
              <Building2 className="h-5 w-5" />
            </label>
          </div>
          <div className="flex-1">
            <div>
              <p className="text-lg font-bold tracking-tight text-primary">FreightFlow</p>
              <p className="hidden text-xs opacity-60 sm:block">
                Freight Brokerage & Logistics Management System
              </p>
            </div>
          </div>
          <div className="flex flex-none items-center gap-2">
            <ThemeSelector compact />
            <div className="hidden text-right text-sm sm:block">
              <p className="font-medium">{profile.full_name}</p>
              <p className="badge badge-outline badge-sm capitalize">{profile.role}</p>
            </div>
            <form action={signOut}>
              <button type="submit" className="btn btn-ghost btn-sm gap-1">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </form>
          </div>
        </div>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>

      <div className="drawer-side z-40">
        <label htmlFor="app-drawer" className="drawer-overlay" aria-label="Close menu" />
        <aside className="flex min-h-full w-72 flex-col bg-base-100 text-base-content">
          <div className="border-b border-base-300 p-5">
            <p className="text-xl font-bold text-primary">FreightFlow</p>
            <p className="mt-1 text-xs opacity-60">
              {isStaff(profile.role)
                ? "Operations & contract-to-cash"
                : profile.role === "carrier"
                  ? "Carrier portal"
                  : "Customer portal"}
            </p>
          </div>
          <ul className="menu flex-1 gap-1 p-3">
            {links.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="gap-3">
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-base-300 p-4">
            <ThemeSelector />
          </div>
        </aside>
      </div>
    </div>
  );
}
