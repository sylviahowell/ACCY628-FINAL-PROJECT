/** Negative-margin booking gate: carrier cost above customer rate. */

export function isNegativeMargin(customerRate: number, carrierCost: number): boolean {
  if (!Number.isFinite(customerRate) || !Number.isFinite(carrierCost)) return false;
  return carrierCost > 0 && carrierCost > customerRate;
}

export function negativeMarginMessage(customerRate: number, carrierCost: number): string {
  const loss = carrierCost - customerRate;
  return `Negative margin: customer rate $${customerRate.toFixed(0)} < carrier cost $${carrierCost.toFixed(0)} (loss $${loss.toFixed(0)}). Ask a manager to book this load.`;
}

export function negativeMarginOverrideNote(
  customerRate: number,
  carrierCost: number,
): string {
  const loss = carrierCost - customerRate;
  return `Margin override: rate ${customerRate.toFixed(0)} < cost ${carrierCost.toFixed(0)} (loss ${loss.toFixed(0)})`;
}
