/**
 * Contract-to-cash timeline for a shipment.
 * Steps are complete only when underlying records support them.
 */

export type TimelineState = "complete" | "current" | "blocked" | "not_started";

export type TimelineStep = {
  key: string;
  label: string;
  state: TimelineState;
  at: string | null;
  role: string;
  detail: string | null;
};

type TimelineInput = {
  status: string;
  created_at: string | null;
  carrier_id: string | null;
  picked_up_at?: string | null;
  delivered_at?: string | null;
  pickup_date: string | null;
  delivery_date: string | null;
  hasPod: boolean;
  podAt: string | null;
  invoiceNumber: string | null;
  invoiceAt: string | null;
  amountPaid: number;
  invoiceTotal: number;
  invoiceStatus: string | null;
  statusEvents: { to_status: string; created_at: string }[];
};

function eventAt(events: TimelineInput["statusEvents"], status: string) {
  return events.find((e) => e.to_status === status)?.created_at ?? null;
}

export function buildC2CTimeline(input: TimelineInput): TimelineStep[] {
  const cancelled = input.status === "cancelled";
  const hasCarrier = Boolean(input.carrier_id);
  const picked =
    ["picked_up", "in_transit", "delivered", "completed"].includes(input.status) ||
    Boolean(input.picked_up_at);
  const inTransit =
    ["in_transit", "delivered", "completed"].includes(input.status);
  const delivered =
    ["delivered", "completed"].includes(input.status) || Boolean(input.delivered_at);
  const invoiced = Boolean(input.invoiceNumber);
  const paidFull =
    invoiced &&
    (input.invoiceStatus === "paid" ||
      (input.invoiceTotal > 0 && input.amountPaid >= input.invoiceTotal));
  const closed = input.status === "completed" && paidFull;

  const assignedAt =
    eventAt(input.statusEvents, "assigned") ||
    eventAt(input.statusEvents, "booked") ||
    (hasCarrier ? input.created_at : null);
  const pickupAt =
    input.picked_up_at ||
    eventAt(input.statusEvents, "picked_up") ||
    (picked ? input.pickup_date : null);
  const transitAt =
    eventAt(input.statusEvents, "in_transit") || (inTransit ? pickupAt : null);
  const deliveryAt =
    input.delivered_at ||
    eventAt(input.statusEvents, "delivered") ||
    (delivered ? input.delivery_date : null);

  function stateFor(complete: boolean, isCurrent: boolean, blocked = false): TimelineState {
    if (cancelled && !complete) return "blocked";
    if (complete) return "complete";
    if (blocked) return "blocked";
    if (isCurrent) return "current";
    return "not_started";
  }

  // Determine current step index
  let currentKey = "requested";
  if (closed) currentKey = "closed";
  else if (paidFull) currentKey = "closed";
  else if (invoiced) currentKey = "payment";
  else if (input.hasPod) currentKey = "invoice";
  else if (delivered) currentKey = "pod";
  else if (inTransit) currentKey = "delivery";
  else if (picked) currentKey = "transit";
  else if (hasCarrier) currentKey = "pickup";
  else currentKey = "assign";

  const steps: Omit<TimelineStep, "state">[] = [
    {
      key: "requested",
      label: "Shipment requested",
      at: input.created_at,
      role: "Broker",
      detail: "Load created in the system",
    },
    {
      key: "approved",
      label: "Shipment approved",
      at: input.created_at,
      role: "Broker / Manager",
      detail: cancelled ? "Shipment cancelled" : "Accepted for coverage",
    },
    {
      key: "assign",
      label: "Carrier assigned",
      at: assignedAt,
      role: "Broker",
      detail: hasCarrier ? "Carrier on the load" : "Awaiting carrier assignment",
    },
    {
      key: "pickup",
      label: "Pickup confirmed",
      at: pickupAt,
      role: "Carrier",
      detail: picked ? "Freight picked up" : null,
    },
    {
      key: "transit",
      label: "In transit",
      at: transitAt,
      role: "Carrier",
      detail: inTransit ? "Moving to destination" : null,
    },
    {
      key: "delivery",
      label: "Delivery confirmed",
      at: deliveryAt,
      role: "Carrier",
      detail: delivered ? "Arrived at destination" : null,
    },
    {
      key: "pod",
      label: "Proof of delivery received",
      at: input.podAt,
      role: "Carrier",
      detail: input.hasPod ? "POD on file" : delivered ? "POD required before billing" : null,
    },
    {
      key: "invoice",
      label: "Invoice generated",
      at: input.invoiceAt,
      role: "Billing",
      detail: input.invoiceNumber ? `Invoice ${input.invoiceNumber}` : null,
    },
    {
      key: "payment",
      label: "Payment received",
      at: paidFull ? input.invoiceAt : null,
      role: "Billing",
      detail: invoiced
        ? `Paid ${input.amountPaid.toFixed(0)} / ${input.invoiceTotal.toFixed(0)}`
        : null,
    },
    {
      key: "closed",
      label: "Financially closed",
      at: closed ? input.invoiceAt : null,
      role: "Billing / Manager",
      detail: closed ? "Load completed and paid" : null,
    },
  ];

  const order = steps.map((s) => s.key);
  const currentIdx = order.indexOf(currentKey);

  return steps.map((s, idx) => {
    const complete =
      s.key === "requested" ||
      s.key === "approved" ||
      (s.key === "assign" && hasCarrier) ||
      (s.key === "pickup" && picked) ||
      (s.key === "transit" && inTransit) ||
      (s.key === "delivery" && delivered) ||
      (s.key === "pod" && input.hasPod) ||
      (s.key === "invoice" && invoiced) ||
      (s.key === "payment" && paidFull) ||
      (s.key === "closed" && closed);

    const blocked =
      cancelled ||
      (s.key === "invoice" && delivered && !input.hasPod) ||
      (s.key === "payment" && input.invoiceStatus === "disputed");

    return {
      ...s,
      state: stateFor(complete, idx === currentIdx && !complete, blocked && !complete),
    };
  });
}
