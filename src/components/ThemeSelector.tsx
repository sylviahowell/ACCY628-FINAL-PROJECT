"use client";

import { useEffect } from "react";
import { useHydrated, useLocalString } from "@/lib/local-prefs";

export const APPEARANCE_STORAGE_KEY = "rowanlane-theme";
export const DEFAULT_APPEARANCE = "corporate";

/** daisyUI theme ids → labels shown as Application Theme options */
export const APPEARANCE_OPTIONS = [
  { id: "corporate", label: "Corporate" },
  { id: "business", label: "Business Dark" },
  { id: "nord", label: "Nord" },
  { id: "dim", label: "Dim Dark" },
  { id: "silk", label: "Silk" },
] as const;

export type AppearanceId = (typeof APPEARANCE_OPTIONS)[number]["id"];

const ALLOWED = new Set<string>(APPEARANCE_OPTIONS.map((o) => o.id));

export function resolveAppearance(raw: string | null | undefined): AppearanceId {
  if (raw && ALLOWED.has(raw)) return raw as AppearanceId;
  return DEFAULT_APPEARANCE;
}

export function applyAppearance(theme: AppearanceId) {
  document.documentElement.setAttribute("data-theme", theme);
}

/** Settings-only Application Theme control (not used in chrome/login). */
export function ThemeSelector() {
  const [theme, setTheme] = useLocalString<AppearanceId>(
    APPEARANCE_STORAGE_KEY,
    DEFAULT_APPEARANCE,
    resolveAppearance,
  );
  const ready = useHydrated();

  useEffect(() => {
    applyAppearance(theme);
  }, [theme]);

  return (
    <fieldset className="fieldset max-w-xs">
      <legend className="fieldset-legend">Application theme</legend>
      <select
        className="select w-full bg-base-100 text-base-content"
        value={theme}
        onChange={(e) => setTheme(resolveAppearance(e.target.value))}
        aria-label="Application theme"
        disabled={!ready}
      >
        {APPEARANCE_OPTIONS.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
      <p className="fieldset-label">Applies to this browser only.</p>
    </fieldset>
  );
}
