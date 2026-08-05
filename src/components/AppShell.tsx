import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckSquare,
  ClipboardList,
  FileText,
  FolderOpen,
  HelpCircle,
  LayoutDashboard,
  LineChart,
  LogOut,
  MoreHorizontal,
  Package,
  Settings,
  ShieldAlert,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { AppNavLinks, type ShellNavItem } from "@/components/AppNavLinks";
import { DemoRoleSelector } from "@/components/DemoRoleSelector";
import { FlashToast } from "@/components/FlashToast";
import { RowanLaneMark } from "@/components/RowanLaneMark";
import { GlobalSearch } from "@/components/GlobalSearch";
import { signOut } from "@/lib/actions/auth";
import { demoRoleLabel } from "@/lib/demo-mode";
import { searchPlaceholderForRole } from "@/lib/portal-scope";
import type { Profile } from "@/lib/types";
import { ROLE_LABELS, ROLE_PORTAL_BLURB } from "@/lib/roles";

function navFor(role: Profile["role"]): { primary: ShellNavItem[]; more: ShellNavItem[] } {
  const i = (node: ReactNode) => node;
  const settings: ShellNavItem = {
    href: "/settings",
    label: "Settings",
    icon: i(<Settings className="h-4 w-4" />),
  };

  switch (role) {
    case "manager":
      return {
        primary: [
          { href: "/dashboard", label: "Executive Dashboard", icon: i(<LayoutDashboard className="h-4 w-4" />) },
          { href: "/warnings", label: "Warnings", icon: i(<AlertTriangle className="h-4 w-4" />) },
          { href: "/risk", label: "Risk & Credit", icon: i(<ShieldAlert className="h-4 w-4" />) },
          { href: "/approvals", label: "Approvals", icon: i(<CheckSquare className="h-4 w-4" />) },
          { href: "/shipments", label: "Shipments", icon: i(<Package className="h-4 w-4" />) },
          { href: "/invoices", label: "Invoices", icon: i(<FileText className="h-4 w-4" />) },
          { href: "/ar", label: "Accounts Receivable", icon: i(<BarChart3 className="h-4 w-4" />) },
          { href: "/profitability", label: "Profitability", icon: i(<LineChart className="h-4 w-4" />) },
          settings,
        ],
        more: [
          { href: "/customers", label: "Customers", icon: i(<Users className="h-4 w-4" />) },
          { href: "/carriers", label: "Carriers", icon: i(<Truck className="h-4 w-4" />) },
          { href: "/contracts", label: "Contracts", icon: i(<ClipboardList className="h-4 w-4" />) },
          { href: "/payments", label: "Payments", icon: i(<Wallet className="h-4 w-4" />) },
          { href: "/disputes", label: "Disputes", icon: i(<AlertTriangle className="h-4 w-4" />) },
          { href: "/accounting", label: "Accounting", icon: i(<ClipboardList className="h-4 w-4" />) },
        ],
      };
    case "broker":
      return {
        primary: [
          { href: "/dashboard", label: "Broker Operations Dashboard", icon: i(<LayoutDashboard className="h-4 w-4" />) },
          { href: "/warnings", label: "Warnings", icon: i(<AlertTriangle className="h-4 w-4" />) },
          { href: "/shipments", label: "Shipments", icon: i(<Package className="h-4 w-4" />) },
          { href: "/carriers", label: "Carriers", icon: i(<Truck className="h-4 w-4" />) },
          { href: "/customers", label: "Customers", icon: i(<Users className="h-4 w-4" />) },
          { href: "/contracts", label: "Contracts", icon: i(<ClipboardList className="h-4 w-4" />) },
          settings,
        ],
        more: [],
      };
    case "billing":
      return {
        primary: [
          { href: "/dashboard", label: "Billing & Accounting Dashboard", icon: i(<LayoutDashboard className="h-4 w-4" />) },
          { href: "/warnings", label: "Warnings", icon: i(<AlertTriangle className="h-4 w-4" />) },
          { href: "/shipments", label: "Shipments", icon: i(<Package className="h-4 w-4" />) },
          { href: "/invoices", label: "Invoices", icon: i(<FileText className="h-4 w-4" />) },
          { href: "/ar", label: "Accounts Receivable", icon: i(<BarChart3 className="h-4 w-4" />) },
          { href: "/payments", label: "Payments", icon: i(<Wallet className="h-4 w-4" />) },
          { href: "/disputes", label: "Disputes", icon: i(<AlertTriangle className="h-4 w-4" />) },
          { href: "/accounting", label: "Accounting", icon: i(<ClipboardList className="h-4 w-4" />) },
          { href: "/profitability", label: "Profitability", icon: i(<LineChart className="h-4 w-4" />) },
          settings,
        ],
        more: [],
      };
    case "customer":
      return {
        primary: [
          { href: "/dashboard", label: "Shipper Dashboard", icon: i(<LayoutDashboard className="h-4 w-4" />) },
          { href: "/warnings", label: "Alerts", icon: i(<AlertTriangle className="h-4 w-4" />) },
          { href: "/shipments", label: "My Shipments", icon: i(<Package className="h-4 w-4" />) },
          { href: "/invoices", label: "My Invoices", icon: i(<FileText className="h-4 w-4" />) },
          { href: "/support", label: "Support", icon: i(<HelpCircle className="h-4 w-4" />) },
          settings,
        ],
        more: [],
      };
    case "carrier":
      return {
        primary: [
          { href: "/dashboard", label: "Carrier Dashboard", icon: i(<LayoutDashboard className="h-4 w-4" />) },
          { href: "/warnings", label: "Alerts", icon: i(<AlertTriangle className="h-4 w-4" />) },
          { href: "/shipments", label: "My Deliveries", icon: i(<Truck className="h-4 w-4" />) },
          { href: "/documents", label: "Documents", icon: i(<FolderOpen className="h-4 w-4" />) },
          settings,
        ],
        more: [],
      };
    default:
      return {
        primary: [
          { href: "/dashboard", label: "Dashboard", icon: i(<LayoutDashboard className="h-4 w-4" />) },
          settings,
        ],
        more: [],
      };
  }
}

export function AppShell({
  profile,
  isDemoMode,
  children,
}: {
  profile: Profile;
  isDemoMode: boolean;
  children: React.ReactNode;
}) {
  const { primary, more } = navFor(profile.role);
  const showDemoSelector = isDemoMode;
  const roleDisplay = showDemoSelector
    ? demoRoleLabel(profile.role)
    : ROLE_LABELS[profile.role];

  return (
    <div className="drawer lg:drawer-open min-h-screen bg-base-200">
      <input id="app-drawer" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content flex flex-col">
        <div className="navbar min-h-16 flex-wrap gap-y-2 border-b border-base-300 bg-base-100 px-3 py-2 sm:px-4">
          <div className="flex-none lg:hidden">
            <label htmlFor="app-drawer" className="btn btn-square btn-ghost">
              <Building2 className="h-5 w-5" />
            </label>
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
            <div className="flex shrink-0 items-center gap-2">
              <RowanLaneMark size={34} />
              <div className="min-w-0">
                <p className="text-lg font-bold tracking-tight text-primary">RowanLane</p>
                <p className="hidden text-xs opacity-60 sm:block">
                  Freight Brokerage & Logistics Management System
                </p>
              </div>
            </div>
            <GlobalSearch placeholder={searchPlaceholderForRole(profile.role)} />
          </div>
          <div className="flex w-full flex-none flex-col items-stretch gap-2 sm:ml-auto sm:w-auto sm:items-end lg:flex-row lg:items-center lg:gap-3">
            {showDemoSelector ? (
              <DemoRoleSelector activeRole={profile.role} />
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <div className="hidden text-right text-sm sm:block">
                <p className="font-medium">{profile.full_name}</p>
                <p className="badge badge-outline badge-sm">{roleDisplay}</p>
              </div>
              {!showDemoSelector ? (
                <form action={signOut}>
                  <button type="submit" className="btn btn-ghost btn-sm gap-1" title="Sign out">
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Sign out</span>
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </div>
        <main className="relative flex-1 p-4 md:p-6">
          <Suspense fallback={null}>
            <FlashToast />
          </Suspense>
          {children}
        </main>
      </div>

      <div className="drawer-side z-40">
        <label htmlFor="app-drawer" className="drawer-overlay" aria-label="Close menu" />
        <aside className="flex min-h-full w-72 flex-col bg-base-100 text-base-content">
          <div className="border-b border-base-300 p-5">
            <div className="flex items-center gap-2.5">
              <RowanLaneMark size={36} />
              <p className="text-xl font-bold text-primary">RowanLane</p>
            </div>
            <p className="mt-1 text-sm font-medium">{roleDisplay}</p>
            <p className="mt-0.5 text-xs opacity-60">{ROLE_PORTAL_BLURB[profile.role]}</p>
            {showDemoSelector ? (
              <p className="mt-2 text-[10px] font-medium tracking-wide text-[#0866D9] uppercase">
                Demo Mode · sample data
              </p>
            ) : null}
          </div>
          <AppNavLinks links={primary} />
          {more.length > 0 ? (
            <details className="border-t border-base-300 px-3 py-2">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium opacity-70">
                <MoreHorizontal className="h-4 w-4" />
                More modules
              </summary>
              <AppNavLinks links={more} />
            </details>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
