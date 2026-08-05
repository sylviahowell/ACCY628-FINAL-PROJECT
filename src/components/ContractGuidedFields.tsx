"use client";

import { useMemo, useState } from "react";
import type { ContractTermsInfo } from "@/lib/contract-terms";
import {
  isDateOutsideContractWindow,
  suggestedRateFromText,
} from "@/lib/contract-terms";

type Props = {
  contracts: ContractTermsInfo[];
};

export function ContractGuidedFields({ contracts }: Props) {
  const [contractId, setContractId] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [customerRate, setCustomerRate] = useState("");

  const selected = useMemo(
    () => contracts.find((c) => c.id === contractId) ?? null,
    [contracts, contractId],
  );

  const suggested = selected
    ? suggestedRateFromText(selected.shipping_rates)
    : null;

  const outside =
    selected &&
    (isDateOutsideContractWindow(pickupDate, selected.start_date, selected.end_date) ||
      isDateOutsideContractWindow(deliveryDate, selected.start_date, selected.end_date));

  return (
    <>
      <select
        name="contract_id"
        className="select select-bordered"
        value={contractId}
        onChange={(e) => {
          const id = e.target.value;
          setContractId(id);
          const c = contracts.find((x) => x.id === id);
          const rate = c ? suggestedRateFromText(c.shipping_rates) : null;
          if (rate != null && !customerRate) {
            setCustomerRate(String(rate));
          }
        }}
      >
        <option value="">Contract (optional / Spot)…</option>
        {contracts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.contract_number} — {c.title}
          </option>
        ))}
      </select>

      <input
        name="pickup_date"
        type="date"
        className="input input-bordered"
        value={pickupDate}
        onChange={(e) => setPickupDate(e.target.value)}
      />
      <input
        name="delivery_date"
        type="date"
        className="input input-bordered"
        value={deliveryDate}
        onChange={(e) => setDeliveryDate(e.target.value)}
      />

      <input
        name="customer_rate"
        type="number"
        step="0.01"
        required
        placeholder="Rate charged to customer"
        className="input input-bordered"
        value={customerRate}
        onChange={(e) => setCustomerRate(e.target.value)}
      />

      {selected ? (
        <div className="md:col-span-2 rounded-box border border-primary/30 bg-primary/5 p-3 text-sm">
          <p className="font-medium text-primary">Contract terms applied to this booking</p>
          <ul className="mt-1 space-y-0.5 opacity-80">
            <li>
              Window: {selected.start_date} → {selected.end_date ?? "open"}
            </li>
            <li>Payment terms: {selected.payment_terms ?? selected.billing_terms ?? "Net 30"}</li>
            <li>Fuel surcharge: {Number(selected.fuel_surcharge_pct ?? 0)}%</li>
            <li>
              Rate guide: {selected.shipping_rates ?? "—"}
              {suggested != null ? ` (suggested $${suggested.toLocaleString()})` : ""}
            </li>
          </ul>
          {outside ? (
            <div className="mt-3 space-y-2">
              <p className="text-warning font-medium">
                Pickup or delivery falls outside the contract window.
              </p>
              <label className="label cursor-pointer justify-start gap-2">
                <input
                  type="checkbox"
                  name="confirm_outside_contract_dates"
                  className="checkbox checkbox-warning checkbox-sm"
                />
                <span className="label-text">
                  Confirm booking outside contract dates (ops override)
                </span>
              </label>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="md:col-span-2 text-xs opacity-60">
          Spot load (no contract): enter rates manually. Contract loads inherit payment terms and fuel % at invoicing.
        </p>
      )}
    </>
  );
}
