"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createCoverageRequest } from "@/lib/actions/coverage";
import {
  isDateOutsideContractWindow,
  suggestedRateFromText,
} from "@/lib/contract-terms";
import { calcLaneQuote } from "@/lib/contract-pricing";
import { estimateLaneMiles } from "@/lib/geo";
import { money } from "@/lib/types";
import type { CoverageContractOption } from "@/components/BookCoverageForm";

type Props = {
  contracts: CoverageContractOption[];
};

export function CoverageRequestForm({ contracts }: Props) {
  const defaultId = contracts.length === 1 ? contracts[0].id : "";
  const [contractId, setContractId] = useState(defaultId);
  const [miles, setMiles] = useState("");
  const [milesHint, setMilesHint] = useState<string | null>(null);
  const milesAutoRef = useRef(false);
  const [pickupLocation, setPickupLocation] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");

  const selected = useMemo(
    () => contracts.find((c) => c.id === contractId) ?? null,
    [contracts, contractId],
  );

  const hasMileRates =
    Boolean(selected) &&
    Number(selected!.customer_rate_per_mile) > 0 &&
    Number(selected!.carrier_rate_per_mile) > 0;

  useEffect(() => {
    const estimated = estimateLaneMiles(pickupLocation, deliveryLocation);
    if (estimated != null && estimated > 0) {
      setMiles(String(estimated));
      milesAutoRef.current = true;
      setMilesHint(`Estimated from ${pickupLocation.trim()} → ${deliveryLocation.trim()}`);
      return;
    }
    if (pickupLocation.trim() && deliveryLocation.trim()) {
      setMilesHint(
        "Couldn’t match those cities — enter miles manually (try City, ST like Chicago, IL).",
      );
      if (milesAutoRef.current) {
        setMiles("");
        milesAutoRef.current = false;
      }
      return;
    }
    setMilesHint(null);
    if (milesAutoRef.current) {
      setMiles("");
      milesAutoRef.current = false;
    }
  }, [pickupLocation, deliveryLocation]);

  const quote = selected && hasMileRates ? calcLaneQuote(Number(miles), selected) : null;
  const suggested = selected ? suggestedRateFromText(selected.shipping_rates) : null;

  const outside = Boolean(
    selected &&
      (isDateOutsideContractWindow(pickupDate, selected.start_date, selected.end_date) ||
        isDateOutsideContractWindow(deliveryDate, selected.start_date, selected.end_date)),
  );

  const quotedCustomer = quote
    ? quote.customerLineHaul
    : suggested != null
      ? suggested
      : null;
  const quotedCarrier = quote ? quote.carrierPay : null;

  const needsMiles = hasMileRates;
  const blockForMiles = needsMiles && !(Number(miles) > 0 && quote);

  if (contracts.length === 0) {
    return (
      <div className="rounded-box border border-warning/40 bg-warning/10 p-4 text-sm">
        <p className="font-medium">No active contract on file</p>
        <p className="mt-1 opacity-80">
          Coverage requests use your shipping agreement for rates and downpayment. Contact RowanLane
          operations to set up or renew a contract first.
        </p>
        <Link href="/support" className="btn btn-warning btn-sm mt-3">
          Open Support
        </Link>
      </div>
    );
  }

  return (
    <form action={createCoverageRequest} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="contract_id" value={contractId} />
      {quotedCustomer != null ? (
        <input type="hidden" name="quoted_customer_rate" value={quotedCustomer} />
      ) : null}
      {quotedCarrier != null ? (
        <input type="hidden" name="quoted_carrier_cost" value={quotedCarrier} />
      ) : null}

      <div className="flex w-full flex-col gap-3 md:col-span-2">
        <label htmlFor="coverage-contract" className="text-sm font-medium leading-5">
          Active contract
        </label>
        <select
          id="coverage-contract"
          className="select select-bordered h-12 w-full"
          value={contractId}
          onChange={(e) => setContractId(e.target.value)}
          required
        >
          <option value="" disabled>
            Select contract…
          </option>
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.contract_number}
              {c.title ? ` — ${c.title}` : ""}
            </option>
          ))}
        </select>
      </div>

      {selected ? (
        <div className="md:col-span-2 rounded-box border border-primary/20 bg-primary/5 p-3 text-sm">
          <p className="font-medium text-primary">Contract terms on this request</p>
          <ul className="mt-1 space-y-0.5 opacity-80">
            <li>
              Window: {selected.start_date} → {selected.end_date ?? "open"}
            </li>
            <li>Downpayment: {Number(selected.downpayment_pct ?? 20)}% at booking</li>
            <li>Fuel surcharge: {Number(selected.fuel_surcharge_pct ?? 0)}%</li>
            {hasMileRates ? (
              <li>
                $/mi: customer {money(selected.customer_rate_per_mile)} · carrier{" "}
                {money(selected.carrier_rate_per_mile)}
              </li>
            ) : suggested != null ? (
              <li>Rate guide suggests {money(suggested)} customer line-haul</li>
            ) : (
              <li>Broker Operations will confirm rates when booking.</li>
            )}
          </ul>
          {quote ? (
            <p className="mt-2 font-medium">
              Quote: customer {money(quote.customerLineHaul)}
              {quote.fuelSurcharge > 0 ? ` + fuel ${money(quote.fuelSurcharge)}` : ""} · carrier{" "}
              {money(quote.carrierPay)} · downpayment {money(quote.downpaymentDue)} (
              {quote.downpaymentPct}%)
            </p>
          ) : null}
          {outside ? (
            <p className="mt-2 text-warning font-medium">
              Pickup or delivery is outside this contract window — Broker Operations must confirm
              when booking.
            </p>
          ) : null}
        </div>
      ) : null}

      <input
        name="pickup_location"
        required
        placeholder="Pickup (City, ST)"
        className="input input-bordered"
        value={pickupLocation}
        onChange={(e) => setPickupLocation(e.target.value)}
      />
      <input
        name="delivery_location"
        required
        placeholder="Delivery (City, ST)"
        className="input input-bordered"
        value={deliveryLocation}
        onChange={(e) => setDeliveryLocation(e.target.value)}
      />
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
      {needsMiles ? (
        <label className="flex w-full flex-col gap-1.5">
          <span className="text-sm font-medium">Miles (auto from City, ST)</span>
          <input
            name="miles"
            type="number"
            min={1}
            step={1}
            required
            className="input input-bordered w-full"
            value={miles}
            onChange={(e) => {
              setMiles(e.target.value);
              milesAutoRef.current = false;
              setMilesHint("Miles edited manually");
            }}
            placeholder="e.g. 520"
          />
          {milesHint ? <span className="label-text-alt opacity-60">{milesHint}</span> : null}
        </label>
      ) : (
        <input type="hidden" name="miles" value={miles} />
      )}
      <input
        name="freight_type"
        placeholder="Freight type (e.g. Dry van)"
        className="input input-bordered"
      />
      <input
        name="weight_lbs"
        type="number"
        placeholder="Weight (lbs)"
        className="input input-bordered"
      />
      <textarea
        name="notes"
        className="textarea textarea-bordered md:col-span-2"
        placeholder="Appointment windows, special handling, preferred equipment…"
      />
      <button
        className="btn btn-primary md:col-span-2"
        disabled={!contractId || blockForMiles}
      >
        {blockForMiles
          ? "Enter City, ST for pickup & delivery to estimate miles"
          : "Send to Broker Operations"}
      </button>
      <p className="text-xs opacity-60 md:col-span-2">
        Miles are estimated from known demo cities (e.g. Chicago, IL → Dallas, TX). You can override
        the miles field. Rates and downpayment come from your active contract.
      </p>
    </form>
  );
}
