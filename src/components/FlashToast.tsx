"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Reads ?toast= / ?toastError= once, shows a daisyUI alert, then clears the query. */
export function FlashToast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [flash, setFlash] = useState<{ message: string; tone: "success" | "error" } | null>(
    null,
  );

  useEffect(() => {
    const ok = params.get("toast");
    const bad = params.get("toastError");
    if (!ok && !bad) return;

    // Defer state write so we sync from the URL without cascading render in the effect body.
    const show = window.setTimeout(() => {
      setFlash({ message: (bad ?? ok) as string, tone: bad ? "error" : "success" });
    }, 0);

    const next = new URLSearchParams(params.toString());
    next.delete("toast");
    next.delete("toastError");
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });

    const hide = window.setTimeout(() => setFlash(null), 4500);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [params, pathname, router]);

  if (!flash) return null;

  return (
    <div className="toast toast-top toast-end z-50">
      <div
        className={`alert shadow-lg ${flash.tone === "error" ? "alert-error" : "alert-success"}`}
      >
        <span>{flash.message}</span>
      </div>
    </div>
  );
}
