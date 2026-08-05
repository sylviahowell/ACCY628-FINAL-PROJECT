export type BrokerPriority = "high" | "medium" | "low";

export type BrokerTask = {
  id: string;
  shipmentId: string;
  loadNumber: string;
  customer: string;
  route: string;
  deadline: string | null;
  status: string;
  priority: BrokerPriority;
  action: string;
  category:
    | "pickup_today"
    | "delivery_today"
    | "unassigned"
    | "delayed"
    | "customer_contact"
    | "carrier_pending"
    | "accessorial"
    | "contract";
  createdBy?: string | null;
  href: string;
};

export type BrokerFilter =
  | "all"
  | "my_loads"
  | "due_today"
  | "delayed"
  | "unassigned"
  | "high_priority";

type Ship = {
  id: string;
  load_number: string;
  status: string;
  carrier_id: string | null;
  customer_id: string;
  pickup_date: string | null;
  delivery_date: string | null;
  promised_delivery_date: string | null;
  origin_city: string | null;
  dest_city: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  customer_rate: number;
  carrier_cost: number;
  created_by: string | null;
  customers?: { name?: string } | null;
};

function routeOf(s: Ship) {
  if (s.pickup_location && s.delivery_location) {
    return `${s.pickup_location} → ${s.delivery_location}`;
  }
  return `${s.origin_city ?? "?"} → ${s.dest_city ?? "?"}`;
}

function customerOf(s: Ship) {
  return s.customers?.name ?? "Customer";
}

export function buildBrokerTasks(input: {
  shipments: Ship[];
  today: string;
  profileId: string;
  pendingCharges: {
    id: string;
    shipment_id: string;
    description: string;
    amount: number;
  }[];
  contracts: {
    id: string;
    contract_number: string;
    end_date: string | null;
    status: string;
    customers?: { name?: string } | null;
  }[];
  podShipmentIds: Set<string>;
}): BrokerTask[] {
  const tasks: BrokerTask[] = [];
  const { today } = input;

  for (const s of input.shipments) {
    if (s.status === "cancelled") continue;
    const cust = customerOf(s);
    const route = routeOf(s);

    if (s.pickup_date === today && !["picked_up", "in_transit", "delivered", "completed"].includes(s.status)) {
      tasks.push({
        id: `pu-${s.id}`,
        shipmentId: s.id,
        loadNumber: s.load_number,
        customer: cust,
        route,
        deadline: s.pickup_date,
        status: s.status,
        priority: "high",
        action: s.carrier_id ? "Confirm pickup with carrier" : "Assign carrier before pickup window",
        category: "pickup_today",
        createdBy: s.created_by,
        href: `/shipments/${s.id}`,
      });
    }

    if (
      (s.delivery_date === today || s.promised_delivery_date === today) &&
      !["delivered", "completed"].includes(s.status)
    ) {
      tasks.push({
        id: `del-${s.id}`,
        shipmentId: s.id,
        loadNumber: s.load_number,
        customer: cust,
        route,
        deadline: s.promised_delivery_date ?? s.delivery_date,
        status: s.status,
        priority: "high",
        action: "Track delivery and request POD on arrival",
        category: "delivery_today",
        createdBy: s.created_by,
        href: `/shipments/${s.id}`,
      });
    }

    if (!s.carrier_id) {
      tasks.push({
        id: `ua-${s.id}`,
        shipmentId: s.id,
        loadNumber: s.load_number,
        customer: cust,
        route,
        deadline: s.pickup_date,
        status: s.status,
        priority: s.pickup_date && s.pickup_date <= today ? "high" : "medium",
        action: "Assign a covered carrier from scorecards",
        category: "unassigned",
        createdBy: s.created_by,
        href: `/shipments/${s.id}`,
      });
    }

    const delayed =
      s.promised_delivery_date &&
      s.promised_delivery_date < today &&
      !["delivered", "completed"].includes(s.status);
    if (delayed) {
      tasks.push({
        id: `late-${s.id}`,
        shipmentId: s.id,
        loadNumber: s.load_number,
        customer: cust,
        route,
        deadline: s.promised_delivery_date,
        status: s.status,
        priority: "high",
        action: "Call carrier for ETA, then update customer",
        category: "delayed",
        createdBy: s.created_by,
        href: `/shipments/${s.id}`,
      });
      tasks.push({
        id: `cc-${s.id}`,
        shipmentId: s.id,
        loadNumber: s.load_number,
        customer: cust,
        route,
        deadline: s.promised_delivery_date,
        status: s.status,
        priority: "high",
        action: "Customer contact — share delay and revised ETA",
        category: "customer_contact",
        createdBy: s.created_by,
        href: `/shipments/${s.id}`,
      });
    }

    // Carrier assigned but pickup date passed without pickup progress
    if (
      s.carrier_id &&
      s.pickup_date &&
      s.pickup_date < today &&
      ["scheduled", "assigned", "booked"].includes(s.status)
    ) {
      tasks.push({
        id: `cr-${s.id}`,
        shipmentId: s.id,
        loadNumber: s.load_number,
        customer: cust,
        route,
        deadline: s.pickup_date,
        status: s.status,
        priority: "medium",
        action: "Follow up — carrier has not confirmed pickup",
        category: "carrier_pending",
        createdBy: s.created_by,
        href: `/shipments/${s.id}`,
      });
    }

    // Delivered without POD — ops follow-up
    if (["delivered", "completed"].includes(s.status) && !input.podShipmentIds.has(s.id)) {
      tasks.push({
        id: `pod-${s.id}`,
        shipmentId: s.id,
        loadNumber: s.load_number,
        customer: cust,
        route,
        deadline: s.delivery_date,
        status: s.status,
        priority: "medium",
        action: "Request missing POD from carrier",
        category: "customer_contact",
        createdBy: s.created_by,
        href: `/shipments/${s.id}`,
      });
    }
  }

  for (const c of input.pendingCharges) {
    const s = input.shipments.find((x) => x.id === c.shipment_id);
    if (!s) continue;
    tasks.push({
      id: `acc-${c.id}`,
      shipmentId: s.id,
      loadNumber: s.load_number,
      customer: customerOf(s),
      route: routeOf(s),
      deadline: null,
      status: "pending_accessorial",
      priority: Number(c.amount) >= 250 ? "high" : "medium",
      action: `Waiting on manager — ${c.description} ($${Number(c.amount).toFixed(0)})`,
      category: "accessorial",
      createdBy: s.created_by,
      href: `/shipments/${s.id}`,
    });
  }

  for (const ct of input.contracts) {
    if (ct.status !== "active" || !ct.end_date) continue;
    const days = Math.floor(
      (new Date(ct.end_date + "T00:00:00Z").getTime() -
        new Date(today + "T00:00:00Z").getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (days >= 0 && days <= 30) {
      tasks.push({
        id: `ctr-${ct.id}`,
        shipmentId: "",
        loadNumber: ct.contract_number,
        customer: ct.customers?.name ?? "Customer",
        route: "Contract renewal",
        deadline: ct.end_date,
        status: ct.status,
        priority: days <= 14 ? "high" : "medium",
        action: "Discuss renewal / rate update with customer",
        category: "contract",
        href: "/contracts",
      });
    }
  }

  // Dedupe by id (already unique). Sort: high first, then deadline.
  const rank = { high: 0, medium: 1, low: 2 };
  return tasks.sort((a, b) => {
    if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority];
    return (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999");
  });
}

export function filterBrokerTasks(
  tasks: BrokerTask[],
  filter: BrokerFilter,
  profileId: string,
): BrokerTask[] {
  switch (filter) {
    case "my_loads":
      return tasks.filter((t) => t.createdBy === profileId);
    case "due_today":
      return tasks.filter(
        (t) =>
          t.category === "pickup_today" ||
          t.category === "delivery_today" ||
          (t.deadline != null && t.deadline === new Date().toISOString().slice(0, 10)),
      );
    case "delayed":
      return tasks.filter((t) => t.category === "delayed");
    case "unassigned":
      return tasks.filter((t) => t.category === "unassigned");
    case "high_priority":
      return tasks.filter((t) => t.priority === "high");
    default:
      return tasks;
  }
}

export function brokerTaskStats(tasks: BrokerTask[]) {
  return {
    pickupsToday: tasks.filter((t) => t.category === "pickup_today").length,
    deliveriesToday: tasks.filter((t) => t.category === "delivery_today").length,
    unassigned: tasks.filter((t) => t.category === "unassigned").length,
    delayed: tasks.filter((t) => t.category === "delayed").length,
    customerContact: tasks.filter((t) => t.category === "customer_contact").length,
    carrierPending: tasks.filter((t) => t.category === "carrier_pending").length,
    accessorial: tasks.filter((t) => t.category === "accessorial").length,
    contracts: tasks.filter((t) => t.category === "contract").length,
    highPriority: tasks.filter((t) => t.priority === "high").length,
  };
}
