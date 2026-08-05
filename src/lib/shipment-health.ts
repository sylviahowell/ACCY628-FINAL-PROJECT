/**
 * Shipment Health Score (0–100) — rule-based, not AI.
 *
 * Start at 100, subtract penalties for operational / financial issues:
 * - No carrier (scheduled/open): −20
 * - Past promised delivery and not delivered: −25
 * - Delivered/completed without POD: −20
 * - Negative projected margin: −20
 * - Pending accessorial approval: −10
 * - Delivered 3+ days without invoice: −15
 * - Open dispute on related invoice: −15
 * - Overdue AR on related invoice: −10
 *
 * Categories: 85–100 Healthy · 65–84 At Risk · <65 Critical
 */

export type HealthCategory = "Healthy" | "At Risk" | "Critical";

export type HealthInput = {
  status: string;
  carrier_id: string | null;
  promised_delivery_date: string | null;
  delivery_date: string | null;
  margin: number | null;
  hasPod: boolean;
  pendingAccessorials: number;
  daysSinceDeliveryUnbilled: number | null; // null = billed or not delivered
  hasOpenDispute: boolean;
  hasOverdueInvoice: boolean;
  today?: string; // YYYY-MM-DD
};

export type HealthResult = {
  score: number;
  category: HealthCategory;
  reasons: string[];
};

export function healthCategory(score: number): HealthCategory {
  if (score >= 85) return "Healthy";
  if (score >= 65) return "At Risk";
  return "Critical";
}

export function categoryBadgeClass(category: HealthCategory) {
  if (category === "Healthy") return "badge-success";
  if (category === "At Risk") return "badge-warning";
  return "badge-error";
}

export function computeShipmentHealth(input: HealthInput): HealthResult {
  let score = 100;
  const reasons: string[] = [];
  const today = input.today ?? new Date().toISOString().slice(0, 10);

  if (
    !input.carrier_id &&
    !["delivered", "completed", "cancelled"].includes(input.status)
  ) {
    score -= 20;
    reasons.push("No carrier assigned");
  }

  if (
    input.promised_delivery_date &&
    input.promised_delivery_date < today &&
    !["delivered", "completed", "cancelled"].includes(input.status)
  ) {
    score -= 25;
    reasons.push(`Delivery past promised date (${input.promised_delivery_date})`);
  }

  if (["delivered", "completed"].includes(input.status) && !input.hasPod) {
    score -= 20;
    reasons.push("Proof of delivery is missing");
  }

  if (input.margin != null && input.margin < 0) {
    score -= 20;
    reasons.push(`Projected/actual margin is negative`);
  }

  if (input.pendingAccessorials > 0) {
    score -= 10;
    reasons.push(`${input.pendingAccessorials} accessorial charge(s) awaiting approval`);
  }

  if (input.daysSinceDeliveryUnbilled != null && input.daysSinceDeliveryUnbilled >= 3) {
    score -= 15;
    reasons.push(
      `Delivered ${input.daysSinceDeliveryUnbilled} day(s) ago and still unbilled`,
    );
  }

  if (input.hasOpenDispute) {
    score -= 15;
    reasons.push("Related invoice has an open billing dispute");
  }

  if (input.hasOverdueInvoice) {
    score -= 10;
    reasons.push("Related invoice is overdue");
  }

  score = Math.max(0, Math.min(100, score));
  if (reasons.length === 0) {
    reasons.push("On track: carrier, docs, margin, and billing look healthy");
  }

  return { score, category: healthCategory(score), reasons };
}
