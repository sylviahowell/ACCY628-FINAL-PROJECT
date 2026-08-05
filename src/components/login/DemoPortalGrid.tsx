"use client";

import { useState, useTransition } from "react";
import {
  Briefcase,
  Building2,
  FileText,
  Headphones,
  Truck,
} from "lucide-react";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { enterDemoMode } from "@/lib/actions/auth";
import { DEMO_MODE_STORAGE_KEY, DEMO_ROLE_STORAGE_KEY } from "@/lib/demo-mode";
import type { UserRole } from "@/lib/types";
import { DemoPortalCard, type PortalCardVisual } from "@/components/login/DemoPortalCard";

/** Icons ~20% larger than prior h-5 (20px) → h-6 (24px) */
const iconProps = { className: "h-6 w-6", strokeWidth: 2 } as const;

const PORTALS: PortalCardVisual[] = [
  {
    role: "manager",
    titleLines: ["Executive", "Manager"],
    description: "Company overview and analytics",
    tint: "bg-[#EEF5FF]",
    iconWrap: "bg-white text-[#0866D9] shadow-sm ring-1 ring-[#0866D9]/15",
    bar: "bg-[#0866D9]",
    icon: <Briefcase {...iconProps} />,
  },
  {
    role: "broker",
    titleLines: ["Broker", "Operations"],
    description: "Manage shipments and carriers",
    tint: "bg-[#EFFAF3]",
    iconWrap: "bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-500/15",
    bar: "bg-emerald-500",
    icon: <Headphones {...iconProps} />,
  },
  {
    role: "billing",
    titleLines: ["Billing &", "Accounting"],
    description: "Invoices, payments, and collections",
    tint: "bg-[#F5F2FF]",
    iconWrap: "bg-white text-violet-600 shadow-sm ring-1 ring-violet-500/15",
    bar: "bg-violet-500",
    icon: <FileText {...iconProps} />,
  },
  {
    role: "customer",
    titleLines: ["Shipper", "Portal"],
    description: "Track your shipments",
    tint: "bg-[#FFF6EE]",
    iconWrap: "bg-white text-orange-600 shadow-sm ring-1 ring-orange-500/15",
    bar: "bg-orange-500",
    icon: <Building2 {...iconProps} />,
  },
  {
    role: "carrier",
    titleLines: ["Carrier", "Portal"],
    description: "View assigned loads",
    tint: "bg-[#EEF9F8]",
    iconWrap: "bg-white text-teal-600 shadow-sm ring-1 ring-teal-500/15",
    bar: "bg-teal-500",
    icon: <Truck {...iconProps} />,
  },
];

export function DemoPortalGrid() {
  const [pending, startTransition] = useTransition();
  const [activeRole, setActiveRole] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onSelect(role: UserRole) {
    if (pending) return;
    setError(null);
    setActiveRole(role);
    try {
      sessionStorage.setItem(DEMO_MODE_STORAGE_KEY, "1");
      sessionStorage.setItem(DEMO_ROLE_STORAGE_KEY, role);
    } catch {
      /* ignore */
    }
    startTransition(async () => {
      try {
        await enterDemoMode(role);
      } catch (e) {
        // redirect() throws; must not treat as a UI error
        if (isRedirectError(e)) throw e;
        setActiveRole(null);
        setError(e instanceof Error ? e.message : "Demo sign-in failed");
      }
    });
  }

  return (
    <div>
      <h3 className="text-[13px] font-semibold text-[#0A1F3D]">Explore Demo Portals</h3>
      <p className="mt-0.5 text-[11px] leading-snug text-[#7A8BA0]">
        Choose any role to enter Demo Mode. You can switch perspectives at any time from the
        role selector inside the application.
      </p>
      {error ? (
        <p className="mt-2 rounded-lg border border-error/30 bg-error/10 px-2.5 py-1.5 text-[11px] text-error">
          {error}
        </p>
      ) : null}
      <div className="login-portal-grid mt-2.5" aria-busy={pending || undefined}>
        {PORTALS.map((visual) => (
          <DemoPortalCard
            key={visual.role}
            visual={visual}
            disabled={pending}
            pending={pending && activeRole === visual.role}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
