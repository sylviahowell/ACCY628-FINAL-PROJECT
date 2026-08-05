"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/** Scroll to and highlight an element matching ?focus=… (id focus-{value}). */
export function FocusScroll() {
  const params = useSearchParams();
  const focus = params.get("focus");

  useEffect(() => {
    if (!focus) return;
    const id = `focus-${focus}`;
    const el =
      document.getElementById(id) ??
      document.querySelector<HTMLElement>(`[data-focus="${CSS.escape(focus)}"]`);
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary", "ring-offset-2", "bg-primary/5");
    const t = window.setTimeout(() => {
      el.classList.remove("ring-2", "ring-primary", "ring-offset-2", "bg-primary/5");
    }, 8000);
    return () => window.clearTimeout(t);
  }, [focus]);

  return null;
}
