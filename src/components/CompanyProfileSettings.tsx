"use client";

import { useState, type FormEvent } from "react";
import { useHydrated, useLocalObject, useSavedFlash } from "@/lib/local-prefs";

export const COMPANY_STORAGE_KEY = "rowanlane-company-profile";

export type CompanyProfile = {
  companyName: string;
  mcNumber: string;
  phone: string;
  email: string;
  address: string;
};

export const DEFAULT_COMPANY: CompanyProfile = {
  companyName: "RowanLane Logistics",
  mcNumber: "MC-884291",
  phone: "(312) 555-0140",
  email: "ops@rowanlane.example",
  address: "200 W Madison St, Suite 2100, Chicago, IL 60606",
};

const FIELDS: {
  key: keyof CompanyProfile;
  label: string;
  type?: string;
  wide?: boolean;
  required?: boolean;
}[] = [
  { key: "companyName", label: "Company name", wide: true, required: true },
  { key: "mcNumber", label: "MC number" },
  { key: "phone", label: "Main phone" },
  { key: "email", label: "Operations email", type: "email", wide: true },
  { key: "address", label: "Business address", wide: true },
];

export function CompanyProfileSettings() {
  const [stored, setStored] = useLocalObject(COMPANY_STORAGE_KEY, DEFAULT_COMPANY);
  const [draft, setDraft] = useState<Partial<CompanyProfile>>({});
  const [flashed, flash] = useSavedFlash();
  const ready = useHydrated();

  const value = { ...stored, ...draft };
  const dirty = Object.keys(draft).length > 0;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStored(value);
    setDraft({});
    flash();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-x-4 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <fieldset key={field.key} className={`fieldset ${field.wide ? "sm:col-span-2" : ""}`}>
            <legend className="fieldset-legend">{field.label}</legend>
            <input
              type={field.type ?? "text"}
              className="input w-full"
              value={value[field.key]}
              onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
              disabled={!ready}
              required={field.required}
            />
          </fieldset>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary btn-sm" disabled={!ready || !dirty}>
          Save company profile
        </button>
        <span
          aria-live="polite"
          className={`text-xs text-success transition-opacity ${flashed ? "opacity-100" : "opacity-0"}`}
        >
          Saved
        </span>
      </div>

      <p className="text-xs opacity-60">
        Stored on this browser for demos. Invoices already issued are not rewritten.
      </p>
    </form>
  );
}
