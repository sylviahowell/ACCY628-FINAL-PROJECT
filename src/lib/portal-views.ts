import type { HealthResult } from "@/lib/shipment-health";
import type { TimelineStep } from "@/lib/c2c-timeline";

export type CustomerStatusLabel = "On track" | "Needs attention" | "Delayed" | "Delivered";

export type FriendlyHealth = {
  label: CustomerStatusLabel;
  badgeClass: string;
  summary: string;
  reasons: string[];
};

/** Customer-safe shipment status — no margin, COGS, or internal approval language. */
export function customerFacingHealth(input: {
  status: string;
  promised_delivery_date: string | null;
  hasPod: boolean;
  hasCarrier: boolean;
  hasOpenDispute: boolean;
  hasOverdueInvoice: boolean;
  today: string;
}): FriendlyHealth {
  const reasons: string[] = [];
  const delayed =
    Boolean(input.promised_delivery_date) &&
    (input.promised_delivery_date as string) < input.today &&
    !["delivered", "completed", "cancelled"].includes(input.status);

  if (delayed) reasons.push("Delivery is behind the expected date");
  if (!input.hasCarrier && !["delivered", "completed", "cancelled"].includes(input.status)) {
    reasons.push("A carrier has not been assigned yet");
  }
  if (["delivered", "completed"].includes(input.status) && !input.hasPod) {
    reasons.push("Delivery confirmation paperwork is still being finalized");
  }
  if (input.hasOpenDispute) reasons.push("A billing question is open on a related invoice");
  if (input.hasOverdueInvoice) reasons.push("An invoice balance is past due");

  if (["delivered", "completed"].includes(input.status) && reasons.length === 0) {
    return {
      label: "Delivered",
      badgeClass: "badge-success",
      summary: "This shipment has been delivered.",
      reasons: ["Arrived at destination"],
    };
  }
  if (delayed) {
    return {
      label: "Delayed",
      badgeClass: "badge-error",
      summary: "This shipment needs attention — delivery is behind schedule.",
      reasons,
    };
  }
  if (reasons.length > 0) {
    return {
      label: "Needs attention",
      badgeClass: "badge-warning",
      summary: "Something on this shipment needs a follow-up.",
      reasons,
    };
  }
  return {
    label: "On track",
    badgeClass: "badge-success",
    summary: "Your shipment is progressing normally.",
    reasons: ["No customer-facing exceptions right now"],
  };
}

export function filterTimelineForAudience(
  steps: TimelineStep[],
  audience: "internal" | "customer" | "carrier",
): TimelineStep[] {
  if (audience === "carrier") {
    return steps
      .filter((s) =>
        ["requested", "approved", "assign", "pickup", "transit", "delivery", "pod"].includes(
          s.key,
        ),
      )
      .map((s) =>
        s.key === "assign"
          ? { ...s, detail: s.state === "complete" ? "You are assigned to this load" : s.detail }
          : s,
      );
  }
  if (audience === "customer") {
    return steps.map((s) => {
      if (s.key === "assign") {
        return {
          ...s,
          detail:
            s.state === "complete" ? "A carrier has been assigned" : "Waiting for carrier assignment",
        };
      }
      return s;
    });
  }
  return steps;
}

export type CarrierTask = {
  id: string;
  shipmentId: string;
  loadNumber: string;
  route: string;
  deadline: string | null;
  priority: "high" | "medium" | "low";
  action: string;
  href: string;
};

export function buildCarrierTasks(input: {
  shipments: {
    id: string;
    load_number: string;
    status: string;
    pickup_date: string | null;
    delivery_date: string | null;
    promised_delivery_date: string | null;
    pickup_location: string | null;
    delivery_location: string | null;
    origin_city: string | null;
    dest_city: string | null;
  }[];
  podShipmentIds: Set<string>;
  pendingChargeShipmentIds: Set<string>;
  today: string;
}): CarrierTask[] {
  const tasks: CarrierTask[] = [];
  for (const s of input.shipments) {
    if (["cancelled", "completed", "offered"].includes(s.status)) continue;
    const route =
      s.pickup_location && s.delivery_location
        ? `${s.pickup_location} → ${s.delivery_location}`
        : `${s.origin_city ?? "?"} → ${s.dest_city ?? "?"}`;

    if (
      s.pickup_date === input.today &&
      ["assigned", "booked"].includes(s.status)
    ) {
      tasks.push({
        id: `pu-${s.id}`,
        shipmentId: s.id,
        loadNumber: s.load_number,
        route,
        deadline: s.pickup_date,
        priority: "high",
        action: "Confirm pickup today",
        href: `/shipments/${s.id}`,
      });
    }

    if (
      (s.promised_delivery_date === input.today || s.delivery_date === input.today) &&
      !["delivered", "completed"].includes(s.status)
    ) {
      tasks.push({
        id: `del-${s.id}`,
        shipmentId: s.id,
        loadNumber: s.load_number,
        route,
        deadline: s.promised_delivery_date ?? s.delivery_date,
        priority: "high",
        action: "Complete delivery and upload POD",
        href: `/shipments/${s.id}`,
      });
    }

    if (
      s.promised_delivery_date &&
      s.promised_delivery_date < input.today &&
      !["delivered", "completed"].includes(s.status)
    ) {
      tasks.push({
        id: `late-${s.id}`,
        shipmentId: s.id,
        loadNumber: s.load_number,
        route,
        deadline: s.promised_delivery_date,
        priority: "high",
        action: "Update status — delivery is past expected date",
        href: `/shipments/${s.id}`,
      });
    }

    if (["delivered", "completed"].includes(s.status) && !input.podShipmentIds.has(s.id)) {
      tasks.push({
        id: `pod-${s.id}`,
        shipmentId: s.id,
        loadNumber: s.load_number,
        route,
        deadline: s.delivery_date,
        priority: "high",
        action: "Upload missing proof of delivery",
        href: `/shipments/${s.id}`,
      });
    }

    if (["picked_up"].includes(s.status)) {
      tasks.push({
        id: `tr-${s.id}`,
        shipmentId: s.id,
        loadNumber: s.load_number,
        route,
        deadline: s.promised_delivery_date,
        priority: "medium",
        action: "Mark in transit when rolling",
        href: `/shipments/${s.id}`,
      });
    }

    if (input.pendingChargeShipmentIds.has(s.id)) {
      tasks.push({
        id: `acc-${s.id}`,
        shipmentId: s.id,
        loadNumber: s.load_number,
        route,
        deadline: null,
        priority: "low",
        action: "Accessorial request is pending review",
        href: `/shipments/${s.id}`,
      });
    }
  }

  const rank = { high: 0, medium: 1, low: 2 };
  return tasks.sort((a, b) => rank[a.priority] - rank[b.priority]);
}

/** Strip internal financial reasons before showing health to customers. */
export function sanitizeHealthForCustomer(health: HealthResult): HealthResult {
  const blocked = /margin|accessorial|unbilled|carrier cost|COGS|approval/i;
  const reasons = health.reasons.filter((r) => !blocked.test(r));
  return {
    ...health,
    reasons:
      reasons.length > 0
        ? reasons
        : ["Shipment is progressing — open the load for delivery details"],
  };
}
