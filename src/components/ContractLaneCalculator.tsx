"use client";

import { useMemo, useState } from "react";
import { calcLaneQuote, type ContractPricingTerms } from "@/lib/contract-pricing";
import { money } from "@/lib/types";

export function ContractLaneCalculator({
  terms,
  defaultMiles = 500,
}: {
  terms: ContractPricingTerms;
  defaultMiles?: number;
}) {
  const [miles, setMiles] = useState(String(defaultMiles));
  const quote = useMemo(() => calcLaneQuote(Number(miles), terms), [miles, terms]);

  return (
    <div className="rounded-box border border-base-300 bg-base-200/40 p-3 text-sm">
      <p className="font-medium">Lane quote calculator</p>
      <p className="mt-0.5 text-xs opacity-60">
        Customer bill = miles × $/mi + fuel %. Carrier pay = miles × carrier $/mi. Downpayment is
        due at booking.
      </p>
      <label className="form-control mt-2 max-w-xs">
        <span className="label-text text-xs">Miles for this lane</span>
        <input
          type="number"
          min={1}
          step={1}
          className="input input-bordered input-sm"
          value={miles}
          onChange={(e) => setMiles(e.target.value)}
        />
      </label>
      {quote ? (
        <dl className="mt-3 grid gap-1 sm:grid-cols-2">
          <div className="flex justify-between gap-2 sm:block">
            <dt className="opacity-60">Customer line-haul</dt>
            <dd className="font-medium">{money(quote.customerLineHaul)}</dd>
          </div>
          <div className="flex justify-between gap-2 sm:block">
            <dt className="opacity-60">Fuel surcharge ({terms.fuel_surcharge_pct ?? 0}%)</dt>
            <dd className="font-medium">{money(quote.fuelSurcharge)}</dd>
          </div>
          <div className="flex justify-between gap-2 sm:block">
            <dt className="opacity-60">Customer total</dt>
            <dd className="font-semibold">{money(quote.customerTotal)}</dd>
          </div>
          <div className="flex justify-between gap-2 sm:block">
            <dt className="opacity-60">
              Downpayment invoice at booking ({quote.downpaymentPct}%)
            </dt>
            <dd className="font-semibold text-primary">{money(quote.downpaymentDue)}</dd>
          </div>
          <div className="flex justify-between gap-2 sm:block">
            <dt className="opacity-60">Balance after downpayment</dt>
            <dd className="font-medium">{money(quote.balanceAfterDownpayment)}</dd>
          </div>
          <div className="flex justify-between gap-2 sm:block">
            <dt className="opacity-60">Carrier pay</dt>
            <dd className="font-medium">{money(quote.carrierPay)}</dd>
          </div>
          <div className="flex justify-between gap-2 sm:col-span-2 sm:block">
            <dt className="opacity-60">Estimated broker margin</dt>
            <dd
              className={`font-semibold ${
                quote.estimatedBrokerMargin < 0 ? "text-error" : "text-success"
              }`}
            >
              {money(quote.estimatedBrokerMargin)}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-2 text-xs opacity-60">
          Enter miles and ensure this contract has customer and carrier $/mi rates.
        </p>
      )}
    </div>
  );
}
