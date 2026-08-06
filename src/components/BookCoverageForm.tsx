"use client";

import { useState } from "react";
import { money } from "@/lib/types";

type ContractOption = {
  id: string;
  contract_number: string;
  downpayment_pct: number | null;
};

type Props = {
  requestId: string;
  contracts: ContractOption[];
  isManager: boolean;
  onCreditHold?: boolean;
  pastDue?: number;
  customerName?: string;
  action: (formData: FormData) => Promise<void>;
};

export function BookCoverageForm({
  requestId,
  contracts,
  isManager,
  onCreditHold = false,
  pastDue = 0,
  customerName,
  action,
}: Props) {
  const [customerRate, setCustomerRate] = useState("");
  const [carrierCost, setCarrierCost] = useState("");

  const rateNum = Number(customerRate) || 0;
  const costNum = Number(carrierCost) || 0;
  const negativeMargin = costNum > 0 && costNum > rateNum;
  const blockSubmit = (onCreditHold || negativeMargin) && !isManager;
  const estLoss = costNum - rateNum;
  const noContracts = contracts.length === 0;

  return (
    <form action={action} className="flex w-52 flex-col gap-2">
      <input type="hidden" name="request_id" value={requestId} />
      <select
        name="contract_id"
        required
        className="select select-bordered select-sm w-full"
        defaultValue=""
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
      {onCreditHold ? (
        <p className="text-xs font-medium text-warning">
          Credit hold{customerName ? ` — ${customerName}` : ""}: past-due AR {money(pastDue)}
          {isManager
            ? " — manager override will be logged on submit."
            : " — ask a manager to book this load, or clear past-due balances first."}
        </p>
      ) : null}
      {negativeMargin ? (
        <p className="text-xs font-medium text-error">
          Loss {money(estLoss)}. Brokers cannot book; managers may override (logged).
        </p>
      ) : null}
      <label className="flex items-start gap-2 text-xs opacity-70">
        <input
          type="checkbox"
          name="confirm_outside_contract_dates"
          className="checkbox checkbox-xs mt-0.5"
        />
        Dates outside contract window (override)
      </label>
      {noContracts ? (
        <p className="text-xs text-error">
          No active contract for this customer — create one first.
        </p>
      ) : (
        <button className="btn btn-primary btn-sm w-full" disabled={blockSubmit}>
          {blockSubmit
            ? onCreditHold
              ? "Ask a manager — credit hold"
              : "Ask a manager — negative margin"
            : "Book load"}
        </button>
      )}
    </form>
  );
}
