/** Mile-based and downpayment helpers for contract pricing. */

export type ContractPricingTerms = {
  fuel_surcharge_pct?: number | null;
  downpayment_pct?: number | null;
  customer_rate_per_mile?: number | null;
  carrier_rate_per_mile?: number | null;
  shipping_rates?: string | null;
};

export type LaneQuote = {
  miles: number;
  customerLineHaul: number;
  fuelSurcharge: number;
  customerTotal: number;
  downpaymentDue: number;
  balanceAfterDownpayment: number;
  carrierPay: number;
  estimatedBrokerMargin: number;
  downpaymentPct: number;
  customerRatePerMile: number;
  carrierRatePerMile: number;
};

export function calcLaneQuote(
  miles: number,
  terms: ContractPricingTerms,
): LaneQuote | null {
  const m = Number(miles);
  if (!Number.isFinite(m) || m <= 0) return null;

  const customerRpm = Number(terms.customer_rate_per_mile ?? 0);
  const carrierRpm = Number(terms.carrier_rate_per_mile ?? 0);
  if (!(customerRpm > 0) || !(carrierRpm > 0)) return null;

  const fuelPct = Number(terms.fuel_surcharge_pct ?? 0);
  const downPct = Number(terms.downpayment_pct ?? 20);

  const customerLineHaul = round2(m * customerRpm);
  const fuelSurcharge =
    fuelPct > 0 ? round2(customerLineHaul * (fuelPct / 100)) : 0;
  const customerTotal = round2(customerLineHaul + fuelSurcharge);
  const downpaymentDue = round2(customerTotal * (Math.max(0, downPct) / 100));
  const balanceAfterDownpayment = round2(customerTotal - downpaymentDue);
  const carrierPay = round2(m * carrierRpm);
  const estimatedBrokerMargin = round2(customerTotal - carrierPay);

  return {
    miles: m,
    customerLineHaul,
    fuelSurcharge,
    customerTotal,
    downpaymentDue,
    balanceAfterDownpayment,
    carrierPay,
    estimatedBrokerMargin,
    downpaymentPct: downPct,
    customerRatePerMile: customerRpm,
    carrierRatePerMile: carrierRpm,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
