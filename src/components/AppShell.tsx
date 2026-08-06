import { Suspense, type ReactNode } from "react";
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  Building2,
  CheckSquare,
  ClipboardList,
  FileText,
  FolderOpen,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  LineChart,
  LogOut,
  MoreHorizontal,
  Package,
  ScrollText,
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
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { ROLE_LABELS, ROLE_PORTAL_BLURB } from "@/lib/roles";

type ShipNavCounts = {
  delayed: number;
  unassigned: number;
  ready: number;
  needsPod: number;
};

type InvoiceNavCounts = {
  ready: number;
  overdue: number;
  open: number;
};

type ProfitNavCounts = {
  losses: number;
  lowMargin: number;
};

async function loadManagerShipCounts(): Promise<ShipNavCounts> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // Narrow columns only — enough to derive badge counts without full row payloads.
  const { data: ships } = await supabase
    .from("shipments")
    .select("id, status, carrier_id, promised_delivery_date");

  const rows = ships ?? [];
  let delayed = 0;
  let unassigned = 0;
  const deliveredIds: string[] = [];

  for (const s of rows) {
    const closed = ["delivered", "completed", "cancelled"].includes(s.status);
    if (s.promised_delivery_date && s.promised_delivery_date < today && !closed) {
      delayed += 1;
    }
    if (!s.carrier_id && !closed) {
      unassigned += 1;
    }
    if (["delivered", "completed"].includes(s.status)) {
      deliveredIds.push(s.id);
    }
  }

  let ready = 0;
  let needsPod = 0;
  if (deliveredIds.length) {
    const [{ data: pods }, { data: invoices }] = await Promise.all([
      supabase.from("proof_of_delivery").select("shipment_id").in("shipment_id", deliveredIds),
      supabase
        .from("invoices")
        .select("shipment_id, status")
        .in("shipment_id", deliveredIds)
        .neq("status", "cancelled"),
    ]);
    const podSet = new Set((pods ?? []).map((p) => p.shipment_id));
    const billedSet = new Set(
      (invoices ?? []).map((i) => i.shipment_id as string).filter(Boolean),
    );
    ready = deliveredIds.filter((id) => podSet.has(id) && !billedSet.has(id)).length;
    needsPod = deliveredIds.filter((id) => !podSet.has(id)).length;
  }

  return { delayed, unassigned, ready, needsPod };
}

async function loadManagerInvoiceCounts(readyFromShips: number): Promise<InvoiceNavCounts> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: invoices } = await supabase
    .from("invoices")
    .select("status, total, amount_paid, due_date")
    .not("status", "in", '("paid","cancelled")');

  let overdue = 0;
  let open = 0;
  for (const inv of invoices ?? []) {
    const balance = Number(inv.total) - Number(inv.amount_paid);
    if (balance <= 0) continue;
    open += 1;
    if (inv.due_date && inv.due_date < today) overdue += 1;
  }

  return {
    ready: readyFromShips,
    overdue,
    open,
  };
}

async function loadManagerProfitCounts(): Promise<ProfitNavCounts> {
  const supabase = await createClient();
  // View columns only — avoid select("*") on every shell render.
  const { data } = await supabase
    .from("shipment_profitability")
    .select("margin, customer_rate, billable_accessorials, discount_amount");

  let losses = 0;
  let lowMargin = 0;
  for (const p of data ?? []) {
    const billable = Number(p.billable_accessorials);
    const discount = Number(p.discount_amount || 0);
    const revenue = Number(p.customer_rate) + billable - discount;
    const margin = Number(p.margin);
    if (margin < 0 || revenue <= 0) {
      losses += 1;
      continue;
    }
    const pct = (margin / revenue) * 100;
    if (pct >= 0 && pct < 12) lowMargin += 1;
  }

  return { losses, lowMargin };
}

async function loadOpenSupportTicketCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("support_tickets")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "pending"]);
  return count ?? 0;
}

function navFor(
  role: Profile["role"],
  shipCounts?: ShipNavCounts | null,
  invCounts?: InvoiceNavCounts | null,
  profitCounts?: ProfitNavCounts | null,
  supportOpenCount = 0,
): { primary: ShellNavItem[]; more: ShellNavItem[] } {
  const i = (node: ReactNode) => node;
  const settings: ShellNavItem = {
    href: "/settings",
    label: "Settings",
    icon: i(<Settings className="h-4 w-4" />),
  };
  const supportStaff: ShellNavItem = {
    href: "/support",
    label: "Support",
    icon: i(<HelpCircle className="h-4 w-4" />),
    count: supportOpenCount > 0 ? supportOpenCount : undefined,
  };

  switch (role) {
    case "manager": {
      const c = shipCounts ?? { delayed: 0, unassigned: 0, ready: 0, needsPod: 0 };
      const inv = invCounts ?? { ready: 0, overdue: 0, open: 0 };
      const pr = profitCounts ?? { losses: 0, lowMargin: 0 };
      return {
        primary: [
          { href: "/dashboard", label: "Executive Dashboard", icon: i(<LayoutDashboard className="h-4 w-4" />) },
          { href: "/warnings", label: "Warnings", icon: i(<AlertTriangle className="h-4 w-4" />) },
          { href: "/approvals", label: "Approvals", icon: i(<CheckSquare className="h-4 w-4" />) },
          { href: "/risk", label: "Risk & Credit", icon: i(<ShieldAlert className="h-4 w-4" />) },
          { href: "/coverage", label: "Coverage requests", icon: i(<Inbox className="h-4 w-4" />) },
          { href: "/controls", label: "Control activity", icon: i(<ScrollText className="h-4 w-4" />) },
          {
            href: "/shipments",
            label: "Shipments",
            icon: i(<Package className="h-4 w-4" />),
            children: [
              { href: "/shipments?status=delayed", label: "Delayed", count: c.delayed },
              { href: "/shipments?status=unassigned", label: "Needs coverage", count: c.unassigned },
              { href: "/shipments?status=ready", label: "Ready to bill", count: c.ready },
              { href: "/shipments", label: "All loads" },
            ],
          },
          {
            href: "/invoices",
            label: "Invoices",
            icon: i(<FileText className="h-4 w-4" />),
            children: [
              { href: "/invoices?status=ready", label: "Ready to bill", count: inv.ready },
              { href: "/invoices?status=overdue", label: "Overdue", count: inv.overdue },
              { href: "/invoices?status=open", label: "Outstanding", count: inv.open },
              { href: "/invoices", label: "All invoices" },
            ],
          },
          { href: "/ar", label: "Accounts Receivable", icon: i(<BarChart3 className="h-4 w-4" />) },
          { href: "/ap", label: "Accounts Payable", icon: i(<Banknote className="h-4 w-4" />) },
          { href: "/disputes", label: "Disputes", icon: i(<AlertTriangle className="h-4 w-4" />) },
          supportStaff,
          {
            href: "/profitability",
            label: "Profitability",
            icon: i(<LineChart className="h-4 w-4" />),
            children: [
              {
                href: "/profitability?band=unprofitable&dim=shipment&focus=margin-leaderboard",
                label: "Loss loads",
                count: pr.losses,
              },
              {
                href: "/profitability?band=low&dim=shipment&focus=margin-leaderboard",
                label: "Low margin",
                count: pr.lowMargin,
              },
              {
                href: "/profitability?focus=margin-leaderboard",
                label: "Overview",
              },
            ],
          },
          settings,
        ],
        more: [
          { href: "/customers", label: "Customers", icon: i(<Users className="h-4 w-4" />) },
          { href: "/carriers", label: "Carriers", icon: i(<Truck className="h-4 w-4" />) },
          { href: "/contracts", label: "Contracts", icon: i(<ClipboardList className="h-4 w-4" />) },
          { href: "/payments", label: "Payments", icon: i(<Wallet className="h-4 w-4" />) },
          { href: "/accounting", label: "Accounting", icon: i(<ClipboardList className="h-4 w-4" />) },
        ],
      };
    }
    case "broker": {
      const c = shipCounts ?? { delayed: 0, unassigned: 0, ready: 0, needsPod: 0 };
      return {
        primary: [
          { href: "/dashboard", label: "Broker Operations", icon: i(<LayoutDashboard className="h-4 w-4" />) },
          { href: "/warnings", label: "Warnings", icon: i(<AlertTriangle className="h-4 w-4" />) },
          { href: "/coverage", label: "Coverage requests", icon: i(<Inbox className="h-4 w-4" />) },
          { href: "/risk", label: "Risk & Credit", icon: i(<ShieldAlert className="h-4 w-4" />) },
          {
            href: "/shipments",
            label: "Shipments",
            icon: i(<Package className="h-4 w-4" />),
            children: [
              { href: "/shipments?status=delayed", label: "Delayed", count: c.delayed },
              { href: "/shipments?status=unassigned", label: "Needs coverage", count: c.unassigned },
              { href: "/shipments?filter=needs-pod", label: "Needs POD", count: c.needsPod },
              { href: "/shipments", label: "All loads" },
            ],
          },
          { href: "/carriers", label: "Carriers", icon: i(<Truck className="h-4 w-4" />) },
          { href: "/customers", label: "Customers", icon: i(<Users className="h-4 w-4" />) },
          { href: "/contracts", label: "Contracts", icon: i(<ClipboardList className="h-4 w-4" />) },
          supportStaff,
          settings,
        ],
        more: [],
      };
    }
    case "billing":
      return {
        primary: [
          { href: "/dashboard", label: "Billing & Accounting Dashboard", icon: i(<LayoutDashboard className="h-4 w-4" />) },
          { href: "/warnings", label: "Warnings", icon: i(<AlertTriangle className="h-4 w-4" />) },
          { href: "/shipments", label: "Shipments", icon: i(<Package className="h-4 w-4" />) },
          { href: "/invoices", label: "Invoices", icon: i(<FileText className="h-4 w-4" />) },
          { href: "/ar", label: "Accounts Receivable", icon: i(<BarChart3 className="h-4 w-4" />) },
          { href: "/ap", label: "Accounts Payable", icon: i(<Banknote className="h-4 w-4" />) },
          { href: "/payments", label: "Payments", icon: i(<Wallet className="h-4 w-4" />) },
          { href: "/disputes", label: "Disputes", icon: i(<AlertTriangle className="h-4 w-4" />) },
          supportStaff,
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
          { href: "/coverage", label: "Request coverage", icon: i(<Inbox className="h-4 w-4" />) },
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
          { href: "/support", label: "Support", icon: i(<HelpCircle className="h-4 w-4" />) },
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

async function AppShellNav({ profile }: { profile: Profile }) {
  const isManager = profile.role === "manager";
  const isBroker = profile.role === "broker";
  const isBilling = profile.role === "billing";
  const loadSupportCount = isManager || isBroker || isBilling;

  const [shipCounts, profitCounts, supportOpenCount, invBase] = await Promise.all([
    isManager || isBroker ? loadManagerShipCounts() : Promise.resolve(null),
    isManager ? loadManagerProfitCounts() : Promise.resolve(null),
    loadSupportCount ? loadOpenSupportTicketCount() : Promise.resolve(0),
    isManager ? loadManagerInvoiceCounts(0) : Promise.resolve(null),
  ]);
  const invCounts =
    isManager && shipCounts && invBase
      ? { ...invBase, ready: shipCounts.ready }
      : null;
  const { primary, more } = navFor(
    profile.role,
    shipCounts,
    invCounts,
    profitCounts,
    supportOpenCount,
  );

  return (
    <>
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
    </>
  );
}

function AppShellNavFallback({ profile }: { profile: Profile }) {
  const { primary, more } = navFor(profile.role, null, null, null, 0);
  return (
    <>
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
    </>
  );
}

/** Sync shell so page content is not blocked on nav badge queries. */
export function AppShell({
  profile,
  isDemoMode,
  children,
}: {
  profile: Profile;
  isDemoMode: boolean;
  children: React.ReactNode;
}) {
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
          <Suspense fallback={<AppShellNavFallback profile={profile} />}>
            <AppShellNav profile={profile} />
          </Suspense>
        </aside>
      </div>
    </div>
  );
}
