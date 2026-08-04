"use client";

import { useEffect, useState } from "react";
import { Palette } from "lucide-react";

const THEMES = ["corporate", "business", "winter", "nord", "emerald"] as const;

export function ThemeSelector({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<string>("corporate");

  useEffect(() => {
    const saved = localStorage.getItem("freightflow-theme") || "corporate";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  function onChange(next: string) {
    setTheme(next);
    localStorage.setItem("freightflow-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  return (
    <label className={`flex items-center gap-2 ${compact ? "" : "w-full"}`}>
      {!compact ? <Palette className="h-4 w-4 opacity-70" /> : null}
      <select
        className={`select select-bordered select-sm ${compact ? "w-28" : "w-full"}`}
        value={theme}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Theme"
      >
        {THEMES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}
