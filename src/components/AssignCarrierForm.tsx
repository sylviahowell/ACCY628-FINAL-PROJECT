"use client";

import { useState } from "react";
import { money } from "@/lib/types";

type CarrierOption = {
  id: string;
  name: string;
  insuranceLabel: string;
};

type SuggestedCarrier = {
  carrierId: string;
  name: string;
  tier: string;
  onTimeDeliveryPct: number | null;
  avgCarrierCost: number | null;
  insuranceExpiration: string | null;
  tierBadgeClass: string;
};

type Props = {
  shipmentId: string;
  customerRate: number;
  defaultCarrierCost: number | "";
  defaultCarrierId: string;
  carriers: CarrierOption[];
  suggestedCarriers: SuggestedCarrier[];
  isManager: boolean;
  action: (formData: FormData) => Promise<void>;
  /** After assign, stay on this path (e.g. /assign). */
  returnTo?: string;
  compact?: boolean;
};

export function AssignCarrierForm({
  shipmentId,
  customerRate,
  defaultCarrierCost,
  defaultCarrierId,
  carriers,
  suggestedCarriers,
  isManager,
  action,
  returnTo,
  compact = false,
}: Props) {
  const [carrierCost, setCarrierCost] = useState(
    defaultCarrierCost === "" ? "" : String(defaultCarrierCost),
  );

  const costNum =
    carrierCost.trim() === ""
      ? Number(defaultCarrierCost) || 0
      : Number(carrierCost) || 0;
  const rateNum = Number(customerRate) || 0;
  const negativeMargin = costNum > 0 && costNum > rateNum;
  const blockSubmit = negativeMargin && !isManager;
  const estLoss = costNum - rateNum;

  return (
    <form
      id={compact ? undefined : "assign-carrier"}
      action={action}
      className={
        compact
          ? "grid gap-2"
          : "mt-4 grid gap-2 border-t border-base-200 pt-3"
      }
    >
      <input type="hidden" name="shipment_id" value={shipmentId} />
      {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
      <p className="text-xs opacity-60">
        {compact
          ? "Sends an offer to the carrier. They must accept before the load appears in My Deliveries. Expired insurance is blocked."
          : "Match using scorecards → confirm insurance → send offer. Carrier must accept before pickup."}
      </p>
      {suggestedCarriers.length > 0 ? (
        <div className="rounded-box border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Suggested for this load
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {suggestedCarriers.map((c) => (
              <li key={c.carrierId} className="flex flex-wrap items-center gap-2">
                <span className={`badge badge-sm ${c.tierBadgeClass}`}>{c.tier}</span>
                <span className="font-medium">{c.name}</span>
                <span className="text-xs opacity-60">
                  OTD {c.onTimeDeliveryPct ?? "—"}%
                  {c.avgCarrierCost != null ? ` · avg cost ${money(c.avgCarrierCost)}` : ""}
                  {c.insuranceExpiration ? ` · insured thru ${c.insuranceExpiration}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <label className="form-control w-full">
        <span className="label-text text-xs">Assign / reassign carrier</span>
        <select
          name="carrier_id"
          className="select select-bordered select-sm"
          defaultValue={defaultCarrierId}
        >
          <option value="">Unassigned</option>
          {carriers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.insuranceLabel}
            </option>
          ))}
        </select>
        <span className="label-text-alt opacity-60">
          Suspended carriers (expired insurance) are hidden and blocked server-side.
        </span>
      </label>
      <label className="form-control w-full">
        <span className="label-text text-xs">Carrier cost (optional update)</span>
        <input
          name="carrier_cost"
          type="number"
          step="0.01"
          value={carrierCost}
          onChange={(e) => setCarrierCost(e.target.value)}
          className="input input-bordered input-sm"
        />
      </label>
      {negativeMargin ? (
        <p className="text-sm font-medium text-error">
          Estimated loss {money(estLoss)} — customer rate {money(rateNum)} &lt; carrier cost{" "}
          {money(costNum)}. Brokers cannot assign; managers may override (logged).
        </p>
      ) : null}
      {isManager && negativeMargin ? (
        <p className="text-xs opacity-60">Managers may override negative margin; overrides are logged.</p>
      ) : null}
      <button className="btn btn-primary btn-sm" disabled={blockSubmit}>
        {blockSubmit
          ? "Ask a manager — negative margin"
          : compact
            ? "Send offer"
            : "Send carrier offer"}
      </button>
    </form>
  );
}
