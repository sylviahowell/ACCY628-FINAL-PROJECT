"use client";

import { useState, type FormEvent } from "react";
import { useHydrated, useLocalObject, useSavedFlash } from "@/lib/local-prefs";

export const BROKER_OPS_STORAGE_KEY = "freightflow-broker-ops-prefs";

type BrokerOpsPrefs = {
  defaultBookingNotes: string;
  highlightUncovered: boolean;
  showLaneAsCityState: boolean;
};

const DEFAULTS: BrokerOpsPrefs = {
  defaultBookingNotes: "",
  highlightUncovered: true,
  showLaneAsCityState: true,
};

/**
 * Device-local ops prefs for brokers. Notes are a booking draft aid for demos —
 * they are not written to shipments unless a future booking form reads this key.
 */
export function BrokerOpsPreferences() {
  const [stored, setStored] = useLocalObject(BROKER_OPS_STORAGE_KEY, DEFAULTS);
  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  const [flashed, flash] = useSavedFlash();
  const ready = useHydrated();

  const notes = notesDraft ?? stored.defaultBookingNotes;
  const notesDirty = notesDraft !== null && notesDraft !== stored.defaultBookingNotes;

  function saveNotes(e: FormEvent) {
    e.preventDefault();
    setStored({ ...stored, defaultBookingNotes: notes });
    setNotesDraft(null);
    flash();
  }

  function toggle(key: "highlightUncovered" | "showLaneAsCityState") {
    setStored({ ...stored, [key]: !stored[key] });
    flash();
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-base-300 rounded-lg border border-base-300">
        <li>
          <label className="flex cursor-pointer items-center gap-4 px-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Highlight uncovered loads</span>
              <span className="block text-xs opacity-60">
                Emphasize shipments still waiting on a carrier
              </span>
            </span>
            <input
              type="checkbox"
              className="toggle toggle-sm toggle-primary"
              checked={stored.highlightUncovered}
              onChange={() => toggle("highlightUncovered")}
              disabled={!ready}
            />
          </label>
        </li>
        <li>
          <label className="flex cursor-pointer items-center gap-4 px-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">City / state lane labels</span>
              <span className="block text-xs opacity-60">
                Prefer compact origin → destination labels in lists
              </span>
            </span>
            <input
              type="checkbox"
              className="toggle toggle-sm toggle-primary"
              checked={stored.showLaneAsCityState}
              onChange={() => toggle("showLaneAsCityState")}
              disabled={!ready}
            />
          </label>
        </li>
      </ul>

      <form onSubmit={saveNotes} className="space-y-3">
        <fieldset className="fieldset">
          <legend className="fieldset-legend">Default booking notes</legend>
          <textarea
            className="textarea w-full min-h-24"
            value={notes}
            onChange={(e) => setNotesDraft(e.target.value)}
            disabled={!ready}
            placeholder="Optional boilerplate for new bookings (detention policy, appointment windows…)"
          />
          <p className="fieldset-label">Saved on this device for the demo — not written to the database.</p>
        </fieldset>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-primary btn-sm" disabled={!ready || !notesDirty}>
            Save notes
          </button>
          <span
            aria-live="polite"
            className={`text-xs text-success transition-opacity ${flashed ? "opacity-100" : "opacity-0"}`}
          >
            Saved
          </span>
        </div>
      </form>
    </div>
  );
}
