"use client";

import { useHydrated, useLocalObject, useSavedFlash } from "@/lib/local-prefs";

export const BILLING_PREFS_STORAGE_KEY = "freightflow-billing-prefs";

type BillingPrefs = {
  prioritizeOverdue: boolean;
  surfaceReadyToBill: boolean;
};

const DEFAULTS: BillingPrefs = {
  prioritizeOverdue: true,
  surfaceReadyToBill: true,
};

const HOUSE_TERMS = [
  { label: "Standard payment terms", value: "Net 30 (customer / contract may override)" },
  { label: "Invoice trigger", value: "Delivery + proof of delivery on file" },
  { label: "Disputes", value: "Cannot mark paid in full until the dispute is resolved" },
  { label: "Cancelled loads", value: "Cannot be invoiced" },
];

/**
 * Light billing workspace prefs + read-only house terms reminder for the pitch.
 * Toggles are device-local only — no fake AR / invoice writes.
 */
export function BillingPreferences() {
  const [prefs, setPrefs] = useLocalObject(BILLING_PREFS_STORAGE_KEY, DEFAULTS);
  const [flashed, flash] = useSavedFlash(1500);
  const ready = useHydrated();

  function toggle(key: keyof BillingPrefs) {
    setPrefs({ ...prefs, [key]: !prefs[key] });
    flash();
  }

  return (
    <div className="space-y-4">
      <dl className="divide-y divide-base-300 rounded-lg border border-base-300">
        {HOUSE_TERMS.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-4 px-3 py-2.5">
            <dt className="shrink-0 text-xs uppercase tracking-wide opacity-55">{row.label}</dt>
            <dd className="min-w-0 text-right text-sm font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>

      <ul className="divide-y divide-base-300 rounded-lg border border-base-300">
        <li>
          <label className="flex cursor-pointer items-center gap-4 px-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Prioritize overdue AR</span>
              <span className="block text-xs opacity-60">
                Prefer overdue balances when scanning collections work
              </span>
            </span>
            <input
              type="checkbox"
              className="toggle toggle-sm toggle-primary"
              checked={prefs.prioritizeOverdue}
              onChange={() => toggle("prioritizeOverdue")}
              disabled={!ready}
            />
          </label>
        </li>
        <li>
          <label className="flex cursor-pointer items-center gap-4 px-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Surface ready-to-bill</span>
              <span className="block text-xs opacity-60">
                Keep delivered + POD loads without an invoice visible
              </span>
            </span>
            <input
              type="checkbox"
              className="toggle toggle-sm toggle-primary"
              checked={prefs.surfaceReadyToBill}
              onChange={() => toggle("surfaceReadyToBill")}
              disabled={!ready}
            />
          </label>
        </li>
      </ul>

      <p className="flex flex-wrap items-center gap-2 text-xs">
        <span className="opacity-60">
          House terms are reminders only. Display prefs save on this device for the demo.
        </span>
        <span
          aria-live="polite"
          className={`text-success transition-opacity ${flashed ? "opacity-100" : "opacity-0"}`}
        >
          Updated
        </span>
      </p>
    </div>
  );
}
