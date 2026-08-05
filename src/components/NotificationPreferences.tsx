"use client";

import { useHydrated, useLocalObject, useSavedFlash } from "@/lib/local-prefs";
import type { UserRole } from "@/lib/types";

export const NOTIFY_STORAGE_KEY = "rowanlane-notify-prefs";

type NotifyKey =
  | "approvals"
  | "delayedLoads"
  | "needsCoverage"
  | "readyToBill"
  | "overdueInvoices"
  | "lossLoads"
  | "shipmentUpdates"
  | "disputes";

type NotifyPrefs = Record<NotifyKey, boolean>;

const ROLE_OPTIONS: Record<UserRole, { key: NotifyKey; label: string; hint: string }[]> = {
  manager: [
    { key: "approvals", label: "Pending approvals", hint: "Accessorials and discounts waiting on you" },
    { key: "delayedLoads", label: "Delayed loads", hint: "Past promised delivery, still open" },
    { key: "overdueInvoices", label: "Overdue invoices", hint: "Open AR past due date" },
    { key: "lossLoads", label: "Loss and low-margin loads", hint: "Negative or thin margins on delivered freight" },
  ],
  broker: [
    { key: "delayedLoads", label: "Delayed loads", hint: "Past promised delivery on your book" },
    { key: "needsCoverage", label: "Needs coverage", hint: "Loads without an assigned carrier" },
    { key: "approvals", label: "Approval decisions", hint: "When a manager approves or rejects your request" },
  ],
  billing: [
    { key: "readyToBill", label: "Ready to bill", hint: "Delivered loads with POD and no invoice" },
    { key: "overdueInvoices", label: "Overdue invoices", hint: "Open AR past due date" },
    { key: "disputes", label: "Disputes", hint: "New or escalating invoice disputes" },
  ],
  customer: [
    { key: "shipmentUpdates", label: "Shipment updates", hint: "Status changes on your loads" },
    { key: "overdueInvoices", label: "Invoice reminders", hint: "Open invoices approaching or past due" },
  ],
  carrier: [
    { key: "shipmentUpdates", label: "Assigned loads", hint: "New tenders and status requests" },
    { key: "delayedLoads", label: "Delivery risk", hint: "Loads approaching or past delivery promise" },
  ],
};

const DEFAULTS: NotifyPrefs = {
  approvals: true,
  delayedLoads: true,
  needsCoverage: true,
  readyToBill: true,
  overdueInvoices: true,
  lossLoads: true,
  shipmentUpdates: true,
  disputes: true,
};

export function NotificationPreferences({ role }: { role: UserRole }) {
  const [prefs, setPrefs] = useLocalObject(NOTIFY_STORAGE_KEY, DEFAULTS);
  const [flashed, flash] = useSavedFlash(1500);
  const ready = useHydrated();

  function toggle(key: NotifyKey) {
    setPrefs({ ...prefs, [key]: !prefs[key] });
    flash();
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-base-300 rounded-lg border border-base-300">
        {ROLE_OPTIONS[role].map((opt) => (
          <li key={opt.key}>
            <label className="flex cursor-pointer items-center gap-4 px-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{opt.label}</span>
                <span className="block text-xs opacity-60">{opt.hint}</span>
              </span>
              <input
                type="checkbox"
                className="toggle toggle-sm toggle-primary"
                checked={prefs[opt.key]}
                onChange={() => toggle(opt.key)}
                disabled={!ready}
              />
            </label>
          </li>
        ))}
      </ul>
      <p className="flex flex-wrap items-center gap-2 text-xs">
        <span className="opacity-60">
          Demo mock only — stored in this browser; no outbound email or SMS.
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
