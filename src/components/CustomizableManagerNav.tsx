"use client";

import { useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpToLine, MoreHorizontal, Settings2 } from "lucide-react";
import { AppNavLinks, type ShellNavItem } from "@/components/AppNavLinks";
import { useHydrated, useLocalObject } from "@/lib/local-prefs";

export const MANAGER_NAV_PREFS_KEY = "rowanlane-manager-nav-prefs";

type ManagerNavPrefs = {
  /** Hrefs currently in Primary, in order. Empty array = use defaults. */
  primaryHrefs: string[];
};

const DEFAULT_PREFS: ManagerNavPrefs = {
  primaryHrefs: [],
};

function catalogFrom(
  defaultPrimary: ShellNavItem[],
  defaultMore: ShellNavItem[],
): ShellNavItem[] {
  const seen = new Set<string>();
  const out: ShellNavItem[] = [];
  for (const item of [...defaultPrimary, ...defaultMore]) {
    if (seen.has(item.href)) continue;
    seen.add(item.href);
    out.push(item);
  }
  return out;
}

function resolveSections(
  prefs: ManagerNavPrefs,
  defaultPrimary: ShellNavItem[],
  defaultMore: ShellNavItem[],
): { primary: ShellNavItem[]; more: ShellNavItem[] } {
  const catalog = catalogFrom(defaultPrimary, defaultMore);
  const byHref = new Map(catalog.map((item) => [item.href, item]));
  const defaultPrimaryHrefs = defaultPrimary.map((item) => item.href);

  let primaryHrefs =
    prefs.primaryHrefs.length > 0
      ? prefs.primaryHrefs.filter((href) => byHref.has(href))
      : defaultPrimaryHrefs;

  // Never leave Primary empty — fall back to dashboard or first catalog item.
  if (primaryHrefs.length === 0) {
    const fallback =
      byHref.has("/dashboard") ? "/dashboard" : (catalog[0]?.href ?? null);
    primaryHrefs = fallback ? [fallback] : [];
  }

  const primarySet = new Set(primaryHrefs);
  const primary = primaryHrefs
    .map((href) => byHref.get(href))
    .filter((item): item is ShellNavItem => Boolean(item));
  const more = catalog.filter((item) => !primarySet.has(item.href));
  return { primary, more };
}

export function CustomizableManagerNav({
  defaultPrimary,
  defaultMore,
}: {
  defaultPrimary: ShellNavItem[];
  defaultMore: ShellNavItem[];
}) {
  const [prefs, setPrefs] = useLocalObject(MANAGER_NAV_PREFS_KEY, DEFAULT_PREFS);
  const ready = useHydrated();
  const [editing, setEditing] = useState(false);

  const catalog = useMemo(
    () => catalogFrom(defaultPrimary, defaultMore),
    [defaultPrimary, defaultMore],
  );
  const defaultPrimaryHrefs = useMemo(
    () => defaultPrimary.map((item) => item.href),
    [defaultPrimary],
  );

  const { primary, more } = useMemo(
    () => resolveSections(prefs, defaultPrimary, defaultMore),
    [prefs, defaultPrimary, defaultMore],
  );

  const primarySet = useMemo(
    () => new Set(primary.map((item) => item.href)),
    [primary],
  );

  function currentPrimaryHrefs() {
    return prefs.primaryHrefs.length > 0
      ? prefs.primaryHrefs.filter((href) => catalog.some((c) => c.href === href))
      : defaultPrimaryHrefs;
  }

  function moveToPrimary(href: string) {
    const next = currentPrimaryHrefs().filter((h) => h !== href);
    next.push(href);
    setPrefs({ primaryHrefs: next });
  }

  function moveToMore(href: string) {
    const next = currentPrimaryHrefs().filter((h) => h !== href);
    if (next.length === 0) return;
    setPrefs({ primaryHrefs: next });
  }

  function resetDefaults() {
    setPrefs({ primaryHrefs: [] });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-base-300 px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide opacity-60">
          Navigation
        </p>
        <button
          type="button"
          className={`btn btn-ghost btn-xs gap-1 ${editing ? "btn-active" : ""}`}
          onClick={() => setEditing((v) => !v)}
          aria-pressed={editing}
        >
          <Settings2 className="h-3.5 w-3.5" />
          {editing ? "Done" : "Customize"}
        </button>
      </div>

      {editing && ready ? (
        <div className="space-y-3 border-b border-base-300 px-3 py-3 text-sm">
          <p className="text-xs opacity-70">
            Move modules between Primary and More. Changes save on this device.
          </p>
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {catalog.map((item) => {
              const inPrimary = primarySet.has(item.href);
              const onlyPrimary = inPrimary && primary.length === 1;
              return (
                <li
                  key={item.href}
                  className="flex items-center gap-2 rounded-box border border-base-300 bg-base-100 px-2 py-1.5"
                >
                  <span className="shrink-0 opacity-70">{item.icon}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                  <span
                    className={`badge badge-xs ${inPrimary ? "badge-primary" : "badge-ghost"}`}
                  >
                    {inPrimary ? "Primary" : "More"}
                  </span>
                  {inPrimary ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      disabled={onlyPrimary}
                      title={
                        onlyPrimary
                          ? "Keep at least one Primary module"
                          : "Move to More modules"
                      }
                      onClick={() => moveToMore(item.href)}
                    >
                      <ArrowDownToLine className="h-3.5 w-3.5" />
                      More
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      title="Move to Primary"
                      onClick={() => moveToPrimary(item.href)}
                    >
                      <ArrowUpToLine className="h-3.5 w-3.5" />
                      Primary
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <button type="button" className="btn btn-outline btn-xs" onClick={resetDefaults}>
            Reset to defaults
          </button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <AppNavLinks links={primary} />
        {more.length > 0 ? (
          <details className="border-t border-base-300 px-3 py-2" open={editing}>
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium opacity-70">
              <MoreHorizontal className="h-4 w-4" />
              More modules
            </summary>
            <AppNavLinks links={more} />
          </details>
        ) : null}
      </div>
    </div>
  );
}
