/** Helpers for carrier load-offer declines logged on shipment status history. */

export const CARRIER_DECLINE_NOTE_PREFIX = "Carrier declined offer:";

export type CarrierDeclineInfo = {
  shipmentId: string;
  reason: string;
  at: string | null;
};

export function parseCarrierDeclineReason(note: string | null | undefined): string | null {
  if (!note) return null;
  const trimmed = note.trim();
  if (!trimmed.toLowerCase().startsWith(CARRIER_DECLINE_NOTE_PREFIX.toLowerCase())) {
    return null;
  }
  const reason = trimmed.slice(CARRIER_DECLINE_NOTE_PREFIX.length).trim();
  return reason || "No reason given";
}

/** Latest decline per shipment (assumes updates ordered newest-first or we pick max `at`). */
export function latestDeclinesByShipment(
  updates: {
    shipment_id: string;
    note: string | null;
    created_at?: string | null;
  }[],
): Map<string, CarrierDeclineInfo> {
  const map = new Map<string, CarrierDeclineInfo>();
  for (const u of updates) {
    const reason = parseCarrierDeclineReason(u.note);
    if (!reason) continue;
    const existing = map.get(u.shipment_id);
    const at = u.created_at ?? null;
    if (!existing || (at && (!existing.at || at > existing.at))) {
      map.set(u.shipment_id, {
        shipmentId: u.shipment_id,
        reason,
        at,
      });
    }
  }
  return map;
}
