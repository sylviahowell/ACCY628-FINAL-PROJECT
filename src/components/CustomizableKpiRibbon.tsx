"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp, Eye, EyeOff, Settings2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { KpiItem } from "@/lib/kpi";
import { useHydrated, useLocalObject } from "@/lib/local-prefs";

export const EXEC_KPI_PREFS_KEY = "rowanlane-exec-kpi-prefs";

type ExecKpiPrefs = {
  order: string[];
  hidden: string[];
};

const DEFAULT_PREFS: ExecKpiPrefs = {
  order: [],
  hidden: [],
};

function resolveLayout(prefs: ExecKpiPrefs, availableIds: string[]) {
  const available = new Set(availableIds);
  const order = [
    ...prefs.order.filter((id) => available.has(id)),
    ...availableIds.filter((id) => !prefs.order.includes(id)),
  ];
  const hidden = new Set(prefs.hidden.filter((id) => available.has(id)));
  return { order, hidden };
}

function toneClass(tone: KpiItem["tone"]) {
  if (tone === "good") return "text-success";
  if (tone === "bad") return "text-error";
  return "text-base-content/70";
}

function arrow(tone: KpiItem["tone"], deltaLabel: string) {
  if (deltaLabel.toLowerCase().includes("flat")) return "→";
  if (tone === "good") return "▲";
  if (tone === "bad") return "▼";
  return "•";
}

function KpiCell({ item, editing }: { item: KpiItem; editing: boolean }) {
  const body = (
    <>
      <p className="text-[11px] font-medium uppercase tracking-wide opacity-60">
        {item.label}
      </p>
      <p className="mt-1 text-lg font-bold tabular-nums text-primary sm:text-xl">{item.value}</p>
      <p className={`mt-1 text-xs ${toneClass(item.tone)}`}>
        <span className="mr-1" aria-hidden>
          {arrow(item.tone, item.deltaLabel)}
        </span>
        {item.deltaLabel}
      </p>
      <p className="mt-0.5 text-[11px] opacity-50">{item.status}</p>
    </>
  );

  const shell =
    "block h-full min-w-[8.5rem] flex-1 basis-0 px-3 py-3 transition-colors sm:min-w-[9.5rem] sm:px-4";

  if (item.href && !editing) {
    return (
      <Link
        href={item.href}
        className={`${shell} hover:bg-base-200/70 focus-visible:bg-base-200/70 focus-visible:outline-none`}
      >
        {body}
      </Link>
    );
  }

  return <div className={shell}>{body}</div>;
}

export function CustomizableKpiRibbon({ items }: { items: KpiItem[] }) {
  const [prefs, setPrefs] = useLocalObject(EXEC_KPI_PREFS_KEY, DEFAULT_PREFS);
  const ready = useHydrated();
  const [editing, setEditing] = useState(false);

  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const availableIds = useMemo(() => items.map((item) => item.id), [items]);
  const layout = useMemo(
    () => resolveLayout(prefs, availableIds),
    [prefs, availableIds],
  );

  const visibleItems = layout.order
    .filter((id) => !layout.hidden.has(id))
    .map((id) => byId.get(id))
    .filter((item): item is KpiItem => Boolean(item));

  function persist(next: { order: string[]; hidden: Set<string> }) {
    setPrefs({
      order: next.order,
      hidden: [...next.hidden],
    });
  }

  function move(id: string, direction: -1 | 1) {
    const index = layout.order.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= layout.order.length) return;
    const order = [...layout.order];
    [order[index], order[target]] = [order[target], order[index]];
    persist({ order, hidden: layout.hidden });
  }

  function toggleHidden(id: string) {
    const hidden = new Set(layout.hidden);
    if (hidden.has(id)) hidden.delete(id);
    else hidden.add(id);
    persist({ order: layout.order, hidden });
  }

  function reset() {
    setPrefs({ order: availableIds, hidden: [] });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {editing ? (
          <button type="button" className="btn btn-ghost btn-xs" onClick={reset} disabled={!ready}>
            Reset
          </button>
        ) : null}
        <button
          type="button"
          className={`btn btn-xs ${editing ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setEditing((v) => !v)}
          disabled={!ready}
        >
          <Settings2 className="h-3.5 w-3.5" aria-hidden />
          {editing ? "Done" : "Customize"}
        </button>
      </div>

      {editing ? (
        <ul className="divide-y divide-base-300 rounded-box border border-base-300">
          {layout.order.map((id, index) => {
            const item = byId.get(id);
            if (!item) return null;
            const isHidden = layout.hidden.has(id);
            return (
              <li
                key={id}
                className={`flex items-center gap-2 px-3 py-2 ${isHidden ? "opacity-55" : ""}`}
              >
                <span className="min-w-0 flex-1 text-sm font-medium">{item.label}</span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-square"
                    aria-label={`Move ${item.label} up`}
                    disabled={index === 0}
                    onClick={() => move(id, -1)}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-square"
                    aria-label={`Move ${item.label} down`}
                    disabled={index === layout.order.length - 1}
                    onClick={() => move(id, 1)}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs gap-1"
                    aria-label={isHidden ? `Show ${item.label}` : `Hide ${item.label}`}
                    onClick={() => toggleHidden(id)}
                  >
                    {isHidden ? (
                      <>
                        <EyeOff className="h-3.5 w-3.5" aria-hidden />
                        Hidden
                      </>
                    ) : (
                      <>
                        <Eye className="h-3.5 w-3.5" aria-hidden />
                        Visible
                      </>
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {visibleItems.length === 0 ? (
        <p className="rounded-box border border-dashed border-base-300 px-4 py-6 text-center text-sm opacity-70">
          No metrics shown. Use Customize to add boxes back.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
          <div className="flex min-w-max divide-x divide-base-300 sm:min-w-0">
            {visibleItems.map((item) => (
              <KpiCell key={item.id} item={item} editing={editing} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
