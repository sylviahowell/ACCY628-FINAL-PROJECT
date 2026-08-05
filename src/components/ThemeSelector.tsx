"use client";

import { useEffect, useState } from "react";
import { Palette } from "lucide-react";

export const APPEARANCE_STORAGE_KEY = "freightflow-theme";
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
  const [theme, setTheme] = useState<AppearanceId>(DEFAULT_APPEARANCE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = resolveAppearance(localStorage.getItem(APPEARANCE_STORAGE_KEY));
    setTheme(saved);
    applyAppearance(saved);
    if (localStorage.getItem(APPEARANCE_STORAGE_KEY) !== saved) {
      localStorage.setItem(APPEARANCE_STORAGE_KEY, saved);
    }
    setReady(true);
  }, []);

  function onChange(next: string) {
    const resolved = resolveAppearance(next);
    setTheme(resolved);
    localStorage.setItem(APPEARANCE_STORAGE_KEY, resolved);
    applyAppearance(resolved);
  }

  return (
    <label className="form-control w-full max-w-md">
      <span className="label-text mb-1.5 flex items-center gap-2 font-medium">
        <Palette className="h-4 w-4 opacity-70" aria-hidden />
        Application Theme
      </span>
      <select
        className="select select-bordered w-full min-w-[12rem] bg-base-100 text-base-content"
        value={theme}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Application Theme"
        disabled={!ready}
      >
        {APPEARANCE_OPTIONS.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
