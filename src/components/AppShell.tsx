import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  ClipboardList,
  FileText,
  FolderOpen,
  HelpCircle,
  LayoutDashboard,
  LineChart,
  LogOut,
  Package,
  Settings,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { ThemeSelector } from "@/components/ThemeSelector";
import type { Profile } from "@/lib/types";
import { ROLE_LABELS, ROLE_PORTAL_BLURB } from "@/lib/roles";

type NavItem = { href: string; label: string; icon: React.ReactNode };

function navFor(role: Profile["role"]): NavItem[] {
  const i = (node: React.ReactNode) => node;
  switch (role) {
    case "manager":
      return [
        { href: "/dashboard", label: "Executive Dashboard", icon: i(<LayoutDashboard className="h-4 w-4" />) },
        { href: "/customers", label: "Customers", icon: i(<Users className="h-4 w-4" />) },
        { href: "/carriers", label: "Carriers", icon: i(<Truck className="h-4 w-4" />) },
        { href: "/contracts", label: "Contracts", icon: i(<ClipboardList className="h-4 w-4" />) },
        { href: "/shipments", label: "Shipments", icon: i(<Package className="h-4 w-4" />) },
        { href: "/invoices", label: "Billing", icon: i(<FileText className="h-4 w-4" />) },
        { href: "/payments", label: "Payments", icon: i(<Wallet className="h-4 w-4" />) },
        { href: "/ar", label: "Accounts Receivable", icon: i(<BarChart3 className="h-4 w-4" />) },
        { href: "/disputes", label: "Disputes", icon: i(<AlertTriangle className="h-4 w-4" />) },
        { href: "/reports", label: "Reports", icon: i(<BarChart3 className="h-4 w-4" />) },
        { href: "/profitability", label: "Profitability", icon: i(<LineChart className="h-4 w-4" />) },
        { href: "/settings", label: "Settings", icon: i(<Settings className="h-4 w-4" />) },
      ];
    case "broker":
      return [
        { href: "/dashboard", label: "Operations Dashboard", icon: i(<LayoutDashboard className="h-4 w-4" />) },
        { href: "/customers", label: "Customers", icon: i(<Users className="h-4 w-4" />) },
        { href: "/contracts", label: "Contracts", icon: i(<ClipboardList className="h-4 w-4" />) },
        { href: "/shipments", label: "Shipments", icon: i(<Package className="h-4 w-4" />) },
        { href: "/carriers", label: "Carriers", icon: i(<Truck className="h-4 w-4" />) },
      ];
    case "billing":
      return [
        { href: "/dashboard", label: "Billing Dashboard", icon: i(<LayoutDashboard className="h-4 w-4" />) },
        { href: "/invoices", label: "Invoices", icon: i(<FileText className="h-4 w-4" />) },
        { href: "/payments", label: "Payments", icon: i(<Wallet className="h-4 w-4" />) },
        { href: "/ar", label: "Accounts Receivable", icon: i(<BarChart3 className="h-4 w-4" />) },
        { href: "/disputes", label: "Disputes", icon: i(<AlertTriangle className="h-4 w-4" />) },
      ];
    case "customer":
      return [
        { href: "/dashboard", label: "My Dashboard", icon: i(<LayoutDashboard className="h-4 w-4" />) },
        { href: "/shipments", label: "My Shipments", icon: i(<Package className="h-4 w-4" />) },
        { href: "/invoices", label: "My Invoices", icon: i(<FileText className="h-4 w-4" />) },
        { href: "/support", label: "Support", icon: i(<HelpCircle className="h-4 w-4" />) },
      ];
    case "carrier":
      return [
        { href: "/dashboard", label: "Assigned Loads", icon: i(<LayoutDashboard className="h-4 w-4" />) },
        { href: "/shipments", label: "My Deliveries", icon: i(<Truck className="h-4 w-4" />) },
        { href: "/documents", label: "Documents", icon: i(<FolderOpen className="h-4 w-4" />) },
      ];
    default:
      return [{ href: "/dashboard", label: "Dashboard", icon: i(<LayoutDashboard className="h-4 w-4" />) }];
  }
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
              <p className="badge badge-outline badge-sm">{ROLE_LABELS[profile.role]}</p>
            </div>
            <form action={signOut}>
              <button type="submit" className="btn btn-ghost btn-sm hidden sm:inline-flex">
                Switch portal
              </button>
            </form>
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
            <p className="mt-1 text-sm font-medium">{ROLE_LABELS[profile.role]}</p>
            <p className="mt-0.5 text-xs opacity-60">{ROLE_PORTAL_BLURB[profile.role]}</p>
          </div>
          <ul className="menu flex-1 gap-1 p-3">
            {links.map((item) => (
              <li key={item.href + item.label}>
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
