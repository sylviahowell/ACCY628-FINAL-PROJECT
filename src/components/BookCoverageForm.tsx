"use client";

import { useMemo, useState } from "react";
import {
  isDateOutsideContractWindow,
  suggestedRateFromText,
} from "@/lib/contract-terms";
import { calcLaneQuote } from "@/lib/contract-pricing";
import { estimateLaneMiles } from "@/lib/geo";
import { money } from "@/lib/types";

export type CoverageContractOption = {
  id: string;
  contract_number: string;
  title?: string | null;
  downpayment_pct: number | null;
  customer_rate_per_mile: number | null;
  carrier_rate_per_mile: number | null;
  fuel_surcharge_pct: number | null;
  shipping_rates: string | null;
  start_date: string;
  end_date: string | null;
};

type Props = {
  requestId: string;
  contracts: CoverageContractOption[];
  pickupDate?: string | null;
  deliveryDate?: string | null;
  pickupLocation?: string | null;
  deliveryLocation?: string | null;
  /** Contract the shipper already bound on the request. */
  initialContractId?: string | null;
  initialMiles?: number | null;
  initialCustomerRate?: number | null;
  initialCarrierCost?: number | null;
  isManager: boolean;
  onCreditHold?: boolean;
  pastDue?: number;
  customerName?: string;
  /** Broker escalate credit-hold requests to manager Approvals. */
  escalateAction?: (formData: FormData) => Promise<void>;
  alreadyEscalated?: boolean;
  action: (formData: FormData) => Promise<void>;
};

function applyFromContract(
  contract: CoverageContractOption,
  mileStr: string,
  setCustomerRate: (v: string) => void,
  setCarrierCost: (v: string) => void,
) {
  const quote = calcLaneQuote(Number(mileStr), contract);
  if (quote) {
    setCustomerRate(String(quote.customerLineHaul));
    setCarrierCost(String(quote.carrierPay));
    return;
  }
  const suggested = suggestedRateFromText(contract.shipping_rates);
  if (suggested != null) {
    setCustomerRate(String(suggested));
  }
}

function resolveInitialContractId(
  contracts: CoverageContractOption[],
  initialContractId?: string | null,
) {
  if (initialContractId && contracts.some((c) => c.id === initialContractId)) {
    return initialContractId;
  }
  return contracts.length === 1 ? contracts[0].id : "";
}

/**
 * Prefill for review/approve: shipper quote snapshot first, else contract × miles.
 */
function resolveInitialRates(
  contracts: CoverageContractOption[],
  contractId: string,
  miles: string,
  initialCustomerRate?: number | null,
  initialCarrierCost?: number | null,
) {
  if (initialCustomerRate != null && initialCustomerRate > 0) {
    return {
      customerRate: String(initialCustomerRate),
      carrierCost:
        initialCarrierCost != null && initialCarrierCost >= 0
          ? String(initialCarrierCost)
          : "",
      source: "request" as const,
    };
  }
  const contract = contracts.find((c) => c.id === contractId);
  if (contract && Number(miles) > 0) {
    const quote = calcLaneQuote(Number(miles), contract);
    if (quote) {
      return {
        customerRate: String(quote.customerLineHaul),
        carrierCost: String(quote.carrierPay),
        source: "contract" as const,
      };
    }
  }
  if (!contract) return { customerRate: "", carrierCost: "", source: "none" as const };
  const suggested = suggestedRateFromText(contract.shipping_rates);
  return {
    customerRate: suggested != null ? String(suggested) : "",
    carrierCost: "",
    source: suggested != null ? ("contract" as const) : ("none" as const),
  };
}

export function BookCoverageForm({
  requestId,
  contracts,
  pickupDate = null,
  deliveryDate = null,
  pickupLocation = null,
  deliveryLocation = null,
  initialContractId = null,
  initialMiles = null,
  initialCustomerRate = null,
  initialCarrierCost = null,
  isManager,
  onCreditHold = false,
  pastDue = 0,
  customerName,
  escalateAction,
  alreadyEscalated = false,
  action,
}: Props) {
  const defaultContractId = resolveInitialContractId(contracts, initialContractId);
  const estimatedMiles = estimateLaneMiles(pickupLocation, deliveryLocation);
  const defaultMiles =
    initialMiles != null && Number(initialMiles) > 0
      ? String(Number(initialMiles))
      : estimatedMiles != null && estimatedMiles > 0
        ? String(estimatedMiles)
        : "";
  const defaults = resolveInitialRates(
    contracts,
    defaultContractId,
    defaultMiles,
    initialCustomerRate,
    initialCarrierCost,
  );
  const milesSource =
    initialMiles != null && Number(initialMiles) > 0
      ? "request"
      : estimatedMiles != null && estimatedMiles > 0
        ? "lane"
        : "none";

  const [contractId, setContractId] = useState(defaultContractId);
  const [miles, setMiles] = useState(defaultMiles);
  const [customerRate, setCustomerRate] = useState(defaults.customerRate);
  const [carrierCost, setCarrierCost] = useState(defaults.carrierCost);

  const selected = useMemo(
    () => contracts.find((c) => c.id === contractId) ?? null,
    [contracts, contractId],
  );

  const hasMileRates =
    Boolean(selected) &&
    Number(selected!.customer_rate_per_mile) > 0 &&
    Number(selected!.carrier_rate_per_mile) > 0;

  const showMiles = true;
  const quote = selected && hasMileRates ? calcLaneQuote(Number(miles), selected) : null;
  const suggested = selected ? suggestedRateFromText(selected.shipping_rates) : null;
  const prefilled =
    Boolean(defaultMiles) ||
    (initialCustomerRate != null && initialCustomerRate > 0) ||
    (initialCarrierCost != null && initialCarrierCost >= 0);

  const outside = Boolean(
    selected &&
      (isDateOutsideContractWindow(pickupDate, selected.start_date, selected.end_date) ||
        isDateOutsideContractWindow(deliveryDate, selected.start_date, selected.end_date)),
  );

  const rateNum = Number(customerRate) || 0;
  const costNum = Number(carrierCost) || 0;
  const negativeMargin = costNum > 0 && costNum > rateNum;
  const blockSubmit = (onCreditHold || negativeMargin) && !isManager;
  const estLoss = costNum - rateNum;
  const noContracts = contracts.length === 0;
  const readyToApprove =
    Boolean(contractId) && rateNum > 0 && costNum >= 0 && (!hasMileRates || Number(miles) > 0);

  function onContractChange(id: string) {
    setContractId(id);
    const contract = contracts.find((c) => c.id === id);
    if (!contract) {
      setCustomerRate("");
      setCarrierCost("");
      return;
    }
    applyFromContract(contract, miles, setCustomerRate, setCarrierCost);
  }

  function onMilesChange(next: string) {
    setMiles(next);
    if (selected) {
      applyFromContract(selected, next, setCustomerRate, setCarrierCost);
    }
  }

  return (
    <form action={action} className="flex w-72 flex-col gap-2">
      <input type="hidden" name="request_id" value={requestId} />
      <div className="rounded-box border border-primary/30 bg-primary/5 px-2 py-1.5 text-[11px] leading-snug">
        <p className="font-semibold text-primary">Review &amp; approve</p>
        <p className="opacity-80">
          {prefilled
            ? "Miles and rates are filled from the customer request or lane. Confirm, then approve."
            : "Could not estimate this lane — enter miles, then rates fill from the contract."}
        </p>
      </div>

      <select
        name="contract_id"
        required
        className="select select-bordered select-sm w-full"
        value={contractId}
        onChange={(e) => onContractChange(e.target.value)}
        disabled={noContracts}
      >
        <option value="" disabled>
          Active contract…
        </option>
        {contracts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.contract_number}
            {c.downpayment_pct != null ? ` · ${c.downpayment_pct}% down` : ""}
          </option>
        ))}
      </select>

      {selected ? (
        <div className="rounded-box border border-base-300 bg-base-200/50 px-2 py-1.5 text-[11px] leading-snug opacity-80">
          <p>
            {selected.start_date} → {selected.end_date ?? "open"} · fuel{" "}
            {Number(selected.fuel_surcharge_pct ?? 0)}% · down{" "}
            {Number(selected.downpayment_pct ?? 20)}%
          </p>
          {hasMileRates ? (
            <p>
              $/mi customer {money(selected.customer_rate_per_mile)} · carrier{" "}
              {money(selected.carrier_rate_per_mile)}
            </p>
          ) : suggested != null ? (
            <p>Rate guide suggests {money(suggested)}</p>
          ) : null}
          {initialContractId && initialContractId === contractId ? (
            <p className="text-success">Customer requested on this contract.</p>
          ) : null}
        </div>
      ) : null}

      {showMiles ? (
        <label className="form-control w-full">
          <span className="label-text text-[11px]">
            Miles
            {milesSource === "request"
              ? " (from customer request)"
              : milesSource === "lane"
                ? " (estimated from lane)"
                : ""}
          </span>
          <input
            name="miles"
            type="number"
            min={1}
            step={1}
            className="input input-bordered input-sm"
            value={miles}
            onChange={(e) => onMilesChange(e.target.value)}
            placeholder="e.g. 520"
            required={hasMileRates}
          />
        </label>
      ) : null}

      {quote ? (
        <p className="text-[11px] opacity-70">
          Live calc: line-haul {money(quote.customerLineHaul)}
          {quote.fuelSurcharge > 0 ? ` + fuel ${money(quote.fuelSurcharge)}` : ""} · carrier{" "}
          {money(quote.carrierPay)} · margin {money(quote.estimatedBrokerMargin)}
          {quote.downpaymentDue > 0
            ? ` · down ${money(quote.downpaymentDue)} (${quote.downpaymentPct}%)`
            : ""}
        </p>
      ) : null}

      <label className="form-control w-full">
        <span className="label-text text-[11px]">
          Customer rate $
          {defaults.source === "request"
            ? " (from request)"
            : defaults.source === "contract"
              ? " (from contract × miles)"
              : ""}
        </span>
        <input
          name="customer_rate"
          type="number"
          step="0.01"
          min="0.01"
          required
          placeholder="Customer rate $"
          className="input input-bordered input-sm"
          value={customerRate}
          onChange={(e) => setCustomerRate(e.target.value)}
        />
      </label>
      <label className="form-control w-full">
        <span className="label-text text-[11px]">
          Carrier cost $
          {defaults.source === "request"
            ? " (from request)"
            : defaults.source === "contract"
              ? " (from contract × miles)"
              : ""}
        </span>
        <input
          name="carrier_cost"
          type="number"
          step="0.01"
          min="0"
          required
          placeholder="Carrier cost $"
          className="input input-bordered input-sm"
          value={carrierCost}
          onChange={(e) => setCarrierCost(e.target.value)}
        />
      </label>
      {prefilled ? (
        <p className="text-[11px] opacity-60">
          Edit only if you need to override. Changing miles recalculates from contract $/mi.
        </p>
      ) : null}
      {onCreditHold ? (
        <p className="text-xs font-medium text-warning">
          Credit hold{customerName ? ` — ${customerName}` : ""}: past-due AR {money(pastDue)}
          {isManager
            ? " — manager override will be logged on submit."
            : " — brokers cannot approve. Escalate to a manager, or clear past-due balances first."}
        </p>
      ) : null}
      {onCreditHold && !isManager && escalateAction ? (
        alreadyEscalated ? (
          <p className="rounded-box border border-warning/40 bg-warning/10 px-2 py-1.5 text-[11px] font-medium">
            Waiting on manager — visible in Approvals for override.
          </p>
        ) : (
          <details className="rounded-box border border-warning/40 bg-warning/5 px-2 py-1.5">
            <summary className="btn btn-warning btn-xs cursor-pointer">
              Send to manager for override…
            </summary>
            <form action={escalateAction} className="mt-2 flex flex-col gap-2">
              <input type="hidden" name="request_id" value={requestId} />
              <input
                name="note"
                placeholder="Optional note for manager"
                className="input input-bordered input-sm"
              />
              <button className="btn btn-warning btn-sm">Request manager override</button>
            </form>
          </details>
        )
      ) : null}
      {negativeMargin ? (
        <p className="text-xs font-medium text-error">
          Loss {money(estLoss)}. Brokers cannot approve; managers may override (logged).
        </p>
      ) : null}
      {outside ? (
        <p className="text-xs font-medium text-warning">
          Request dates fall outside this contract window.
        </p>
      ) : null}
      <label className="flex items-start gap-2 text-xs opacity-70">
        <input
          type="checkbox"
          name="confirm_outside_contract_dates"
          className="checkbox checkbox-xs mt-0.5"
          defaultChecked={outside}
        />
        Dates outside contract window (override)
      </label>
      {noContracts ? (
        <p className="text-xs text-error">
          No active contract for this customer — create one first.
        </p>
      ) : (
        <button
          className="btn btn-primary btn-sm w-full"
          disabled={blockSubmit || !readyToApprove}
        >
          {blockSubmit
            ? onCreditHold
              ? "Ask a manager — credit hold"
              : "Ask a manager — negative margin"
            : "Approve request"}
        </button>
      )}
    </form>
  );
}
