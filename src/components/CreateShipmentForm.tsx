"use client";

import { useMemo, useState } from "react";
import type { ContractTermsInfo } from "@/lib/contract-terms";
import {
  isDateOutsideContractWindow,
  suggestedRateFromText,
} from "@/lib/contract-terms";
import { calcLaneQuote } from "@/lib/contract-pricing";
import { money } from "@/lib/types";

export type BookingCustomer = {
  id: string;
  name: string;
  creditLimit: number;
  openAr: number;
  pastDue?: number;
  onCreditHold?: boolean;
};

export type BookingCarrier = {
  id: string;
  name: string;
};

type Props = {
  customers: BookingCustomer[];
  carriers: BookingCarrier[];
  contracts: ContractTermsInfo[];
  isManager: boolean;
  action: (formData: FormData) => Promise<void>;
};

export function CreateShipmentForm({
  customers,
  carriers,
  contracts,
  isManager,
  action,
}: Props) {
  const [customerId, setCustomerId] = useState("");
  const [contractId, setContractId] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [customerRate, setCustomerRate] = useState("");
  const [carrierCost, setCarrierCost] = useState("");
  const [miles, setMiles] = useState("");

  const customer = customers.find((c) => c.id === customerId) ?? null;
  const customerContracts = useMemo(
    () => (customerId ? contracts.filter((c) => c.customer_id === customerId) : []),
    [contracts, customerId],
  );

  const selected = customerContracts.find((c) => c.id === contractId) ?? null;
  const suggested = selected ? suggestedRateFromText(selected.shipping_rates) : null;
  const outside =
    selected &&
    (isDateOutsideContractWindow(pickupDate, selected.start_date, selected.end_date) ||
      isDateOutsideContractWindow(deliveryDate, selected.start_date, selected.end_date));

  const quote = selected ? calcLaneQuote(Number(miles), selected) : null;

  const rateNum = Number(customerRate) || 0;
  const projected = customer ? customer.openAr + rateNum : 0;
  const overCredit =
    Boolean(customer) &&
    customer!.creditLimit > 0 &&
    rateNum > 0 &&
    projected > customer!.creditLimit;
  const onHold = Boolean(customer?.onCreditHold);
  const blockSubmit = (overCredit || onHold) && !isManager;

  function applyQuoteFromContract(contract: ContractTermsInfo, mileStr: string) {
    const q = calcLaneQuote(Number(mileStr), contract);
    if (!q) return;
    setCustomerRate(String(q.customerLineHaul));
    setCarrierCost(String(q.carrierPay));
  }

  function onCustomerChange(id: string) {
    setCustomerId(id);
    const matched = contracts.filter((c) => c.customer_id === id);
    if (matched.length === 1) {
      setContractId(matched[0].id);
      if (miles) applyQuoteFromContract(matched[0], miles);
      else {
        const rate = suggestedRateFromText(matched[0].shipping_rates);
        if (rate != null && !customerRate) setCustomerRate(String(rate));
      }
    } else {
      setContractId("");
    }
  }

  return (
    <form action={action} className="card bg-base-100 shadow-sm">
      <div className="card-body grid gap-3 md:grid-cols-2">
        <input
          name="load_number"
          required
          placeholder="Shipment number (LD-2001)"
          className="input input-bordered"
        />
        <select
          name="customer_id"
          required
          className="select select-bordered"
          value={customerId}
          onChange={(e) => onCustomerChange(e.target.value)}
        >
          <option value="">Customer…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.onCreditHold ? " · CREDIT HOLD" : ""}
            </option>
          ))}
        </select>
        <select name="carrier_id" className="select select-bordered">
          <option value="">Carrier (optional)…</option>
          {carriers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          name="contract_id"
          className="select select-bordered"
          value={contractId}
          disabled={!customerId}
          onChange={(e) => {
            const id = e.target.value;
            setContractId(id);
            const c = customerContracts.find((x) => x.id === id);
            if (c && miles) applyQuoteFromContract(c, miles);
            else if (c) {
              const rate = suggestedRateFromText(c.shipping_rates);
              if (rate != null && !customerRate) setCustomerRate(String(rate));
            }
          }}
        >
          <option value="">
            {customerId
              ? customerContracts.length
                ? "Contract (optional / Spot)…"
                : "No active contract — spot booking"
              : "Select a customer first…"}
          </option>
          {customerContracts.map((c) => (
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

        {selected && Number(selected.customer_rate_per_mile) > 0 ? (
          <div className="md:col-span-2 grid gap-3 rounded-box border border-primary/30 bg-primary/5 p-3 md:grid-cols-2">
            <label className="form-control w-full">
              <span className="label-text text-xs">Miles (applies contract $/mi)</span>
              <input
                type="number"
                min={1}
                step={1}
                className="input input-bordered"
                value={miles}
                onChange={(e) => {
                  setMiles(e.target.value);
                  applyQuoteFromContract(selected, e.target.value);
                }}
                placeholder="e.g. 520"
              />
            </label>
            <div className="text-sm">
              <p className="font-medium text-primary">Mile-based quote</p>
              {quote ? (
                <ul className="mt-1 space-y-0.5 opacity-80">
                  <li>
                    Customer line-haul {money(quote.customerLineHaul)} + fuel{" "}
                    {money(quote.fuelSurcharge)} = {money(quote.customerTotal)}
                  </li>
                  <li>
                    Downpayment invoice at booking ({quote.downpaymentPct}%):{" "}
                    <span className="font-semibold">{money(quote.downpaymentDue)}</span>
                  </li>
                  <li>Carrier pay {money(quote.carrierPay)}</li>
                  <li>Est. margin {money(quote.estimatedBrokerMargin)}</li>
                </ul>
              ) : (
                <p className="mt-1 text-xs opacity-60">Enter miles to calculate rates.</p>
              )}
            </div>
          </div>
        ) : null}

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
          <div className="md:col-span-2 rounded-box border border-base-300 bg-base-200/50 p-3 text-sm">
            <p className="font-medium">Contract terms</p>
            <ul className="mt-1 space-y-0.5 opacity-80">
              <li>
                Window: {selected.start_date} → {selected.end_date ?? "open"}
              </li>
              <li>
                Payment terms: {selected.payment_terms ?? selected.billing_terms ?? "Net 30"}
              </li>
              <li>Fuel surcharge: {Number(selected.fuel_surcharge_pct ?? 0)}%</li>
              <li>
                Downpayment: {Number(selected.downpayment_pct ?? 20)}% billed as DEP invoice at
                booking
              </li>
              <li>
                $/mi: customer {money(selected.customer_rate_per_mile)} · carrier{" "}
                {money(selected.carrier_rate_per_mile)}
              </li>
              {suggested != null ? (
                <li>Rate guide text suggests ${suggested.toLocaleString()}</li>
              ) : null}
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
            Spot load (no contract): enter rates manually. Contract loads inherit payment terms and
            fuel % at invoicing.
          </p>
        )}

        {customer && customer.onCreditHold ? (
          <div className="md:col-span-2 rounded-box border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm">
            <p className="font-medium">Credit hold — {customer.name}</p>
            <p className="opacity-80">
              Past-due AR {money(customer.pastDue ?? 0)} meets the hold threshold
              {isManager
                ? " — manager override will be logged on submit."
                : " — ask a manager to book this load, or clear past-due balances first."}
            </p>
          </div>
        ) : null}

        {customer && customer.creditLimit > 0 ? (
          <div
            className={`md:col-span-2 rounded-box border px-3 py-2.5 text-sm ${
              overCredit ? "border-error/40 bg-error/10" : "border-base-300 bg-base-200/60"
            }`}
          >
            <p className="font-medium">Credit headroom — {customer.name}</p>
            <p className="opacity-80">
              Open AR {money(customer.openAr)} + this rate {money(rateNum)} = {money(projected)} vs
              limit {money(customer.creditLimit)}
              {overCredit
                ? isManager
                  ? " — over limit; manager override will be logged."
                  : " — over limit; ask a manager to book this load."
                : "."}
            </p>
          </div>
        ) : null}

        <input
          name="pickup_location"
          required
          placeholder="Pickup location (City, ST)"
          className="input input-bordered"
        />
        <input
          name="delivery_location"
          required
          placeholder="Delivery location (City, ST)"
          className="input input-bordered"
        />
        <input name="freight_type" placeholder="Freight type" className="input input-bordered" />
        <input
          name="weight_lbs"
          type="number"
          placeholder="Weight (lbs)"
          className="input input-bordered"
        />
        <input
          name="carrier_cost"
          type="number"
          step="0.01"
          required
          placeholder="Carrier cost"
          className="input input-bordered"
          value={carrierCost}
          onChange={(e) => setCarrierCost(e.target.value)}
        />
        <input
          name="discount_amount"
          type="number"
          step="0.01"
          defaultValue={0}
          placeholder="Discount (needs manager approval)"
          className="input input-bordered"
        />
        {isManager ? (
          <p className="md:col-span-2 text-xs opacity-60">
            Managers may override credit limit and past-due credit holds; overrides are logged.
          </p>
        ) : (
          <p className="md:col-span-2 text-xs opacity-60">
            Booking is blocked if open AR + this rate exceeds the credit limit, or if past-due AR
            meets the credit-hold threshold.
          </p>
        )}
        <button className="btn btn-primary md:col-span-2" disabled={blockSubmit}>
          {blockSubmit
            ? onHold
              ? "Ask a manager — credit hold"
              : "Ask a manager — over credit limit"
            : "Create shipment"}
        </button>
      </div>
    </form>
  );
}
