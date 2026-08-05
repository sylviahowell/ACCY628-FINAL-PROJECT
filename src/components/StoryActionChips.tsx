import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

type ChipDef = {
  label: string;
  loadNumber?: string;
  invoiceNumber?: string;
  hrefFallback: string;
  /** Prefer shipment detail (optionally with hash); otherwise list + ?focus= */
  preferShipment?: boolean;
  hash?: string;
};

const CHIPS: Record<UserRole, ChipDef[]> = {
  manager: [
    {
      label: "Approve detention · LD-2012-ACC",
      loadNumber: "LD-2012-ACC",
      hrefFallback: "/approvals?type=accessorial",
    },
    {
      label: "Review loss load · LD-2011-LOSS",
      loadNumber: "LD-2011-LOSS",
      hrefFallback: "/shipments",
      preferShipment: true,
    },
    {
      label: "Cash at risk · INV-EDGE-OVERDUE",
      invoiceNumber: "INV-EDGE-OVERDUE",
      hrefFallback: "/ar",
    },
  ],
  broker: [
    {
      label: "Cover open load · LD-2014-OPEN",
      loadNumber: "LD-2014-OPEN",
      hrefFallback: "/shipments",
      preferShipment: true,
    },
    {
      label: "Fix delayed load · LD-2010-LATE",
      loadNumber: "LD-2010-LATE",
      hrefFallback: "/warnings?severity=critical",
      preferShipment: true,
    },
    {
      label: "Accessorial pending · LD-2012-ACC",
      loadNumber: "LD-2012-ACC",
      hrefFallback: "/warnings?severity=info",
      preferShipment: true,
    },
  ],
  billing: [
    {
      label: "Bill after POD · LD-2021-NOPOD",
      loadNumber: "LD-2021-NOPOD",
      hrefFallback: "/invoices",
      preferShipment: true,
    },
    {
      label: "Collect overdue · INV-EDGE-OVERDUE",
      invoiceNumber: "INV-EDGE-OVERDUE",
      hrefFallback: "/ar",
    },
    {
      label: "Pay carriers · Accounts Payable",
      hrefFallback: "/ap",
    },
    {
      label: "Resolve dispute · INV-9003",
      invoiceNumber: "INV-9003",
      hrefFallback: "/disputes",
    },
  ],
  customer: [
    {
      label: "Track delayed freight",
      loadNumber: "LD-2010-LATE",
      hrefFallback: "/shipments",
      preferShipment: true,
    },
    {
      label: "Question invoice · INV-9003",
      invoiceNumber: "INV-9003",
      hrefFallback: "/invoices",
    },
    {
      label: "Open support",
      hrefFallback: "/support",
    },
  ],
  carrier: [
    {
      label: "Upload POD · LD-2021-NOPOD",
      loadNumber: "LD-2021-NOPOD",
      hrefFallback: "/documents",
      preferShipment: true,
      hash: "pod-upload",
    },
    {
      label: "Update delayed load · LD-2010-LATE",
      loadNumber: "LD-2010-LATE",
      hrefFallback: "/shipments",
      preferShipment: true,
    },
    {
      label: "My documents checklist",
      hrefFallback: "/documents",
    },
  ],
};

function withFocus(href: string, focus: string) {
  const join = href.includes("?") ? "&" : "?";
  return `${href}${join}focus=${encodeURIComponent(focus)}`;
}

/** Guided demo chips that deep-link into seeded loads / invoices. */
export async function StoryActionChips({ role }: { role: UserRole }) {
  const defs = CHIPS[role] ?? [];
  if (!defs.length) return null;

  const supabase = await createClient();
  const loadNums = defs.map((d) => d.loadNumber).filter(Boolean) as string[];
  const invNums = defs.map((d) => d.invoiceNumber).filter(Boolean) as string[];

  const loadMap = new Map<string, string>();
  const invMap = new Map<string, string>();

  if (loadNums.length) {
    const { data } = await supabase
      .from("shipments")
      .select("id, load_number")
      .in("load_number", loadNums);
    for (const s of data ?? []) loadMap.set(s.load_number, s.id);
  }
  if (invNums.length) {
    const { data } = await supabase
      .from("invoices")
      .select("id, invoice_number, shipment_id")
      .in("invoice_number", invNums);
    for (const i of data ?? []) invMap.set(i.invoice_number, i.shipment_id ?? i.id);
  }

  const chips = defs.map((d) => {
    let href = d.hrefFallback;
    const focusKey = d.invoiceNumber ?? d.loadNumber;

    if (d.loadNumber && loadMap.has(d.loadNumber) && d.preferShipment) {
      href = `/shipments/${loadMap.get(d.loadNumber)}`;
      if (d.hash) href += `#${d.hash}`;
    } else if (d.invoiceNumber && (d.hrefFallback === "/ar" || d.hrefFallback === "/disputes" || d.hrefFallback === "/invoices")) {
      href = withFocus(d.hrefFallback, d.invoiceNumber);
    } else if (d.loadNumber && loadMap.has(d.loadNumber)) {
      href = withFocus(d.hrefFallback, d.loadNumber);
    } else if (focusKey && d.hrefFallback !== "/support") {
      href = withFocus(d.hrefFallback, focusKey);
    }

    return { label: d.label, href };
  });

  return (
    <div className="rounded-box border border-primary/20 bg-primary/5 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-primary uppercase">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        Suggested actions
      </div>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <Link key={c.label} href={c.href} className="btn btn-outline btn-sm gap-1 border-primary/30">
            {c.label}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        ))}
      </div>
    </div>
  );
}
