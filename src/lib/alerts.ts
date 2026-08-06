import type { Profile, UserRole } from "@/lib/types";
import { isActiveFinalInvoice } from "@/lib/invoice-helpers";

export type AlertSeverity = "info" | "warning" | "critical";

export type AppAlert = {
  id: string;
  severity: AlertSeverity;
  title: string;
  reason: string;
  action: string;
  href: string;
  related: string;
  detectedAt: string;
  roles: UserRole[];
};

type AlertSources = {
  shipments: {
    id: string;
    load_number: string;
    status: string;
    carrier_id: string | null;
    customer_id: string;
    promised_delivery_date: string | null;
    delivery_date: string | null;
    customer_rate: number;
    carrier_cost: number;
    customers?: { name?: string } | { name?: string }[] | null;
  }[];
  invoices: {
    id: string;
    invoice_number: string;
    shipment_id: string | null;
    customer_id: string;
    status: string;
    total: number;
    amount_paid: number;
    due_date: string;
    customers?: { name?: string } | { name?: string }[] | null;
  }[];
  carriers: {
    id: string;
    name: string;
    insurance_expiration: string | null;
  }[];
  contracts: {
    id: string;
    contract_number: string;
    end_date: string | null;
    status: string;
    customer_id: string;
  }[];
  charges: {
    id: string;
    shipment_id: string;
    approval_status: string;
    description: string;
    amount: number;
  }[];
  pods: { shipment_id: string }[];
  disputes: {
    id: string;
    status: string;
    invoice_id: string | null;
    reason: string;
    amount_disputed: number;
  }[];
  approvals: {
    id: string;
    status: string;
    request_type: string;
    amount: number;
    reason: string | null;
  }[];
  coverageRequests?: {
    id: string;
    pickup_location: string;
    delivery_location: string;
    customers?: { name?: string } | { name?: string }[] | null;
  }[];
  supportTickets?: {
    id: string;
    ticket_number: string;
    subject: string;
    status: string;
    priority: string;
    customer_id: string | null;
    carrier_id: string | null;
  }[];
  today: string;
};

function daysBetween(a: string, b: string) {
  return Math.floor(
    (new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) /
      (1000 * 60 * 60 * 24),
  );
}

export function buildAlerts(src: AlertSources): AppAlert[] {
  const alerts: AppAlert[] = [];
  const podSet = new Set(src.pods.map((p) => p.shipment_id));
  const billed = new Set(
    src.invoices
      .filter((i) => isActiveFinalInvoice(i) && i.shipment_id)
      .map((i) => i.shipment_id as string),
  );

  for (const s of src.shipments) {
    if (
      s.promised_delivery_date &&
      s.promised_delivery_date < src.today &&
      !["delivered", "completed", "cancelled"].includes(s.status)
    ) {
      alerts.push({
        id: `delay-${s.id}`,
        severity: "critical",
        title: "Shipment delayed",
        reason: `${s.load_number} promised ${s.promised_delivery_date}, still ${s.status}`,
        action: "Contact carrier and update ETA",
        href: `/shipments/${s.id}`,
        related: s.load_number,
        detectedAt: src.today,
        roles: ["manager", "broker", "customer", "carrier"],
      });
    }

    if (!s.carrier_id && !["cancelled", "delivered", "completed"].includes(s.status)) {
      alerts.push({
        id: `unassigned-${s.id}`,
        severity: "warning",
        title: "No carrier assigned",
        reason: `${s.load_number} needs coverage`,
        action: "Assign a carrier",
        href: `/shipments/${s.id}`,
        related: s.load_number,
        detectedAt: src.today,
        roles: ["manager", "broker"],
      });
    }

    if (["delivered", "completed"].includes(s.status) && !podSet.has(s.id)) {
      alerts.push({
        id: `pod-${s.id}`,
        severity: "warning",
        title: "Proof of delivery missing",
        reason: `${s.load_number} is delivered without POD`,
        action: "Upload POD before invoicing",
        href: `/shipments/${s.id}`,
        related: s.load_number,
        detectedAt: src.today,
        roles: ["manager", "broker", "billing", "carrier"],
      });
    }

    if (
      ["delivered", "completed"].includes(s.status) &&
      podSet.has(s.id) &&
      !billed.has(s.id)
    ) {
      const days = s.delivery_date ? daysBetween(s.delivery_date, src.today) : 0;
      alerts.push({
        id: `unbilled-${s.id}`,
        severity: days >= 3 ? "critical" : "warning",
        title: "Delivered but not invoiced",
        reason: `${s.load_number} has POD and is ready to bill`,
        action: "Generate invoice from Ready to bill",
        href: "/invoices",
        related: s.load_number,
        detectedAt: src.today,
        roles: ["manager", "billing"],
      });
    }

    const margin = Number(s.customer_rate) - Number(s.carrier_cost);
    if (margin < 0 && s.status !== "cancelled") {
      alerts.push({
        id: `loss-${s.id}`,
        severity: "warning",
        title: "Shipment projected to lose money",
        reason: `${s.load_number} margin about ${margin.toFixed(0)}`,
        action: "Review rates or accessorials",
        href: `/shipments/${s.id}`,
        related: s.load_number,
        detectedAt: src.today,
        roles: ["manager", "broker"],
      });
    }
  }

  for (const inv of src.invoices) {
    const bal = Number(inv.total) - Number(inv.amount_paid);
    if (bal > 0 && inv.due_date < src.today && !["paid", "cancelled"].includes(inv.status)) {
      alerts.push({
        id: `overdue-${inv.id}`,
        severity: "critical",
        title: "Invoice overdue",
        reason: `${inv.invoice_number} balance due since ${inv.due_date}`,
        action: "Follow up for collection",
        href: "/ar",
        related: inv.invoice_number,
        detectedAt: src.today,
        roles: ["manager", "billing", "customer"],
      });
    }
  }

  for (const d of src.disputes) {
    if (d.status === "open") {
      alerts.push({
        id: `dispute-${d.id}`,
        severity: "warning",
        title: "Open billing dispute",
        reason: d.reason,
        action: "Review and resolve dispute",
        href: "/disputes",
        related: `Dispute ${d.amount_disputed}`,
        detectedAt: src.today,
        roles: ["manager", "billing", "customer"],
      });
    }
  }

  for (const c of src.charges) {
    if (c.approval_status === "pending") {
      const chargeShip = src.shipments.find((s) => s.id === c.shipment_id);
      const chargeRelated = chargeShip?.load_number ?? c.description;
      alerts.push({
        id: `charge-${c.id}`,
        severity: "info",
        title: "Accessorial awaits approval",
        reason: `${c.description} (${c.amount})`,
        action: "Review in Approvals",
        href: "/approvals",
        related: chargeRelated,
        detectedAt: src.today,
        roles: ["manager"],
      });
      alerts.push({
        id: `charge-esc-${c.id}`,
        severity: "info",
        title: "Accessorial awaits manager approval",
        reason: `${c.description} (${c.amount})`,
        action: "Escalate to a manager — only managers can approve",
        href: `/shipments/${c.shipment_id}`,
        related: chargeRelated,
        detectedAt: src.today,
        roles: ["broker", "billing"],
      });
    }
  }

  for (const a of src.approvals) {
    if (a.status === "pending") {
      alerts.push({
        id: `approval-${a.id}`,
        severity: "info",
        title: `Pending ${a.request_type} approval`,
        reason: a.reason ?? "Needs manager review",
        action: "Open Approval Inbox",
        href: "/approvals",
        related: a.request_type,
        detectedAt: src.today,
        roles: ["manager"],
      });
    }
  }

  for (const car of src.carriers) {
    if (car.insurance_expiration) {
      const days = daysBetween(src.today, car.insurance_expiration);
      if (days < 0) {
        alerts.push({
          id: `ins-exp-${car.id}`,
          severity: "critical",
          title: "Carrier insurance expired",
          reason: `${car.name} expired ${car.insurance_expiration}`,
          action: "Do not book until updated",
          href: "/carriers",
          related: car.name,
          detectedAt: src.today,
          roles: ["manager", "broker"],
        });
      } else if (days <= 30) {
        alerts.push({
          id: `ins-soon-${car.id}`,
          severity: "warning",
          title: "Carrier insurance expiring soon",
          reason: `${car.name} expires ${car.insurance_expiration}`,
          action: "Request updated certificate",
          href: "/carriers",
          related: car.name,
          detectedAt: src.today,
          roles: ["manager", "broker"],
        });
      }
    }
  }

  for (const c of src.contracts) {
    if (c.status === "active" && c.end_date) {
      const days = daysBetween(src.today, c.end_date);
      if (days >= 0 && days <= 30) {
        alerts.push({
          id: `contract-${c.id}`,
          severity: "info",
          title: "Contract nearing expiration",
          reason: `${c.contract_number} ends ${c.end_date}`,
          action: "Discuss renewal with customer",
          href: "/contracts?filter=expiring",
          related: c.contract_number,
          detectedAt: src.today,
          roles: ["manager", "broker"],
        });
      }
    }
  }

  for (const r of src.coverageRequests ?? []) {
    const cust = Array.isArray(r.customers)
      ? r.customers[0]?.name
      : r.customers?.name;
    alerts.push({
      id: `coverage-${r.id}`,
      severity: "warning",
      title: "Shipper coverage request",
      reason: `${cust ?? "Customer"}: ${r.pickup_location} → ${r.delivery_location}`,
      action: "Book load, then assign a Preferred / Approved carrier",
      href: `/coverage#focus-${r.id}`,
      related: cust ?? "Coverage",
      detectedAt: src.today,
      roles: ["manager", "broker"],
    });
  }

  const supportTickets = (src.supportTickets ?? []).filter(
    (t) => t.status === "open" || t.status === "pending",
  );
  if (supportTickets.length > 0) {
    const highCount = supportTickets.filter((t) => t.priority === "high").length;
    alerts.push({
      id: "support-queue",
      severity: highCount > 0 ? "warning" : "info",
      title: "Support tickets waiting",
      reason:
        highCount > 0
          ? `${supportTickets.length} open/pending · ${highCount} high priority`
          : `${supportTickets.length} open or pending ticket${supportTickets.length === 1 ? "" : "s"}`,
      action: "Review and reply in Support inbox",
      href: "/support",
      related: "Support",
      detectedAt: src.today,
      roles: ["manager", "broker", "billing"],
    });

    for (const t of supportTickets) {
      alerts.push({
        id: `support-ticket-${t.id}`,
        severity: t.priority === "high" ? "warning" : "info",
        title: `Support ${t.ticket_number}`,
        reason: t.subject,
        action: "Open ticket thread",
        href: `/support/${t.id}`,
        related: t.ticket_number,
        detectedAt: src.today,
        roles: ["customer", "carrier"],
      });
    }
  }

  return alerts;
}

export function filterAlertsForProfile(alerts: AppAlert[], profile: Profile): AppAlert[] {
  return alerts
    .filter((a) => a.roles.includes(profile.role))
    .map((a) => {
      // Shipper portal cannot open AR/Disputes staff routes — send them to invoices.
      if (profile.role === "customer" && (a.href === "/ar" || a.href === "/disputes")) {
        return { ...a, href: "/invoices", action: "Review on My Invoices" };
      }
      // Non-managers cannot use Approvals inbox — send them to Warnings.
      if (
        (profile.role === "broker" || profile.role === "billing") &&
        a.href === "/approvals"
      ) {
        return {
          ...a,
          href: "/warnings?severity=info",
          action: "Escalate to a manager — only managers can approve",
        };
      }
      return a;
    });
}

export function severityBadge(severity: AlertSeverity) {
  if (severity === "critical") return "badge-error";
  if (severity === "warning") return "badge-warning";
  return "badge-info";
}
