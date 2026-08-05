export type CarrierTier = "Preferred" | "Approved" | "Watch List" | "Suspended";

export type CarrierScorecard = {
  carrierId: string;
  name: string;
  equipmentType: string | null;
  serviceArea: string | null;
  rating: number | null;
  totalLoads: number;
  onTimePickupPct: number | null;
  onTimeDeliveryPct: number | null;
  avgDelayDays: number | null;
  avgCarrierCost: number | null;
  avgMargin: number | null;
  documentationPct: number | null;
  accessorialFrequency: number;
  acceptanceRate: number | null;
  insuranceStatus: "Current" | "Expiring soon" | "Expired" | "Unknown";
  insuranceExpiration: string | null;
  tier: CarrierTier;
  tierReasons: string[];
  activeLoads: number;
};

type CarrierRow = {
  id: string;
  name: string;
  equipment_type: string | null;
  service_area: string | null;
  rating: number | null;
  insurance_expiration: string | null;
};

type ShipRow = {
  id: string;
  carrier_id: string | null;
  status: string;
  pickup_date: string | null;
  delivery_date: string | null;
  promised_delivery_date: string | null;
  carrier_cost: number;
  customer_rate: number;
};

function insuranceStatus(
  expiration: string | null,
  today: string,
): CarrierScorecard["insuranceStatus"] {
  if (!expiration) return "Unknown";
  if (expiration < today) return "Expired";
  const days = Math.floor(
    (new Date(expiration + "T00:00:00Z").getTime() -
      new Date(today + "T00:00:00Z").getTime()) /
      (1000 * 60 * 60 * 24),
  );
  if (days <= 30) return "Expiring soon";
  return "Current";
}

function pct(num: number, den: number) {
  if (den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

export function buildCarrierScorecards(input: {
  carriers: CarrierRow[];
  shipments: ShipRow[];
  profitByShipment: Map<string, { margin: number; carrier_cost: number }>;
  podShipmentIds: Set<string>;
  chargesByShipment: Map<string, number>;
  today: string;
}): CarrierScorecard[] {
  return input.carriers
    .map((c) => {
      const loads = input.shipments.filter((s) => s.carrier_id === c.id);
      const delivered = loads.filter((s) =>
        ["delivered", "completed"].includes(s.status),
      );
      const cancelled = loads.filter((s) => s.status === "cancelled");
      const active = loads.filter((s) =>
        ["assigned", "booked", "picked_up", "in_transit"].includes(s.status),
      );

      // On-time pickup proxy: picked up / in transit / delivered where pickup_date exists
      // and status advanced on or before pickup_date, OR pickup_date >= today still pending.
      // Simpler: among loads with pickup_date that reached picked_up+, count pickup_date <= promised or just completed progression without delay flag.
      // Use: delivered/picked loads where we don't have late flag before pickup — if pickup_date and status past pickup, count on-time if not delayed before pickup.
      const pickupEligible = loads.filter(
        (s) =>
          s.pickup_date &&
          ["picked_up", "in_transit", "delivered", "completed"].includes(s.status),
      );
      // Without a promised pickup timestamp, treat as on-time when pickup_date is set and load progressed (demo proxy)
      const onTimePickup = pickupEligible.length;

      const deliveryEligible = delivered.filter((s) => s.promised_delivery_date && s.delivery_date);
      const onTimeDelivery = deliveryEligible.filter(
        (s) => (s.delivery_date as string) <= (s.promised_delivery_date as string),
      ).length;

      const delayDays: number[] = [];
      for (const s of deliveryEligible) {
        const days = Math.floor(
          (new Date((s.delivery_date as string) + "T00:00:00Z").getTime() -
            new Date((s.promised_delivery_date as string) + "T00:00:00Z").getTime()) /
            (1000 * 60 * 60 * 24),
        );
        if (days > 0) delayDays.push(days);
      }

      const margins: number[] = [];
      const costs: number[] = [];
      for (const s of loads) {
        if (s.status === "cancelled") continue;
        const p = input.profitByShipment.get(s.id);
        costs.push(p ? p.carrier_cost : Number(s.carrier_cost));
        margins.push(
          p ? p.margin : Number(s.customer_rate) - Number(s.carrier_cost),
        );
      }

      const withPod = delivered.filter((s) => input.podShipmentIds.has(s.id)).length;
      const withAccessorial = loads.filter(
        (s) => (input.chargesByShipment.get(s.id) ?? 0) > 0,
      ).length;

      const accepted = loads.length - cancelled.length;
      const acceptanceRate = pct(accepted, loads.length);
      const onTimeDeliveryPct = pct(onTimeDelivery, deliveryEligible.length);
      const onTimePickupPct = pct(onTimePickup, pickupEligible.length);
      const documentationPct = pct(withPod, delivered.length);
      const accessorialFrequency =
        loads.length > 0 ? withAccessorial / loads.length : 0;
      const avgDelayDays =
        delayDays.length > 0
          ? Math.round((delayDays.reduce((a, b) => a + b, 0) / delayDays.length) * 10) / 10
          : null;
      const avgCarrierCost =
        costs.length > 0
          ? Math.round(costs.reduce((a, b) => a + b, 0) / costs.length)
          : null;
      const avgMargin =
        margins.length > 0
          ? Math.round(margins.reduce((a, b) => a + b, 0) / margins.length)
          : null;

      const ins = insuranceStatus(c.insurance_expiration, input.today);
      const reasons: string[] = [];
      let tier: CarrierTier = "Approved";

      if (ins === "Expired") {
        tier = "Suspended";
        reasons.push("Insurance expired — do not book until certificate updated (manager review)");
      } else if (
        (onTimeDeliveryPct != null && onTimeDeliveryPct < 70) ||
        accessorialFrequency >= 0.4 ||
        ins === "Expiring soon"
      ) {
        tier = "Watch List";
        if (onTimeDeliveryPct != null && onTimeDeliveryPct < 70) {
          reasons.push(`On-time delivery ${onTimeDeliveryPct}% is below 70%`);
        }
        if (accessorialFrequency >= 0.4) {
          reasons.push(
            `Accessorials on ${Math.round(accessorialFrequency * 100)}% of loads`,
          );
        }
        if (ins === "Expiring soon") reasons.push("Insurance expiring within 30 days");
      } else if (
        (onTimeDeliveryPct == null || onTimeDeliveryPct >= 90) &&
        (documentationPct == null || documentationPct >= 90) &&
        ins === "Current" &&
        loads.length >= 1
      ) {
        tier = "Preferred";
        reasons.push("Strong on-time / documentation with current insurance");
      } else {
        reasons.push("Meets baseline booking criteria");
      }

      return {
        carrierId: c.id,
        name: c.name,
        equipmentType: c.equipment_type,
        serviceArea: c.service_area,
        rating: c.rating == null ? null : Number(c.rating),
        totalLoads: loads.length,
        onTimePickupPct,
        onTimeDeliveryPct,
        avgDelayDays,
        avgCarrierCost,
        avgMargin,
        documentationPct,
        accessorialFrequency,
        acceptanceRate,
        insuranceStatus: ins,
        insuranceExpiration: c.insurance_expiration,
        tier,
        tierReasons: reasons,
        activeLoads: active.length,
      };
    })
    .sort((a, b) => {
      const order: Record<CarrierTier, number> = {
        Preferred: 0,
        Approved: 1,
        "Watch List": 2,
        Suspended: 3,
      };
      if (order[a.tier] !== order[b.tier]) return order[a.tier] - order[b.tier];
      return (b.onTimeDeliveryPct ?? 0) - (a.onTimeDeliveryPct ?? 0);
    });
}

export function tierBadge(tier: CarrierTier) {
  if (tier === "Preferred") return "badge-success";
  if (tier === "Approved") return "badge-info";
  if (tier === "Watch List") return "badge-warning";
  return "badge-error";
}

/** Suggest carriers for a load based on equipment, insurance, performance, cost. */
export function suggestCarriersForLoad(
  scorecards: CarrierScorecard[],
  opts: { equipmentHint?: string | null; preferLowCost?: boolean },
): CarrierScorecard[] {
  return scorecards
    .filter((c) => c.tier !== "Suspended")
    .filter((c) => {
      if (!opts.equipmentHint || !c.equipmentType) return true;
      return c.equipmentType.toLowerCase().includes(opts.equipmentHint.toLowerCase());
    })
    .sort((a, b) => {
      if (a.tier !== b.tier) {
        const order: Record<CarrierTier, number> = {
          Preferred: 0,
          Approved: 1,
          "Watch List": 2,
          Suspended: 3,
        };
        return order[a.tier] - order[b.tier];
      }
      if (opts.preferLowCost) {
        return (a.avgCarrierCost ?? 999999) - (b.avgCarrierCost ?? 999999);
      }
      return (b.onTimeDeliveryPct ?? 0) - (a.onTimeDeliveryPct ?? 0);
    })
    .slice(0, 5);
}
