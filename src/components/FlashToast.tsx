"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Reads ?toast= message once, shows a daisyUI alert, then clears the query. */
export function FlashToast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const t = params.get("toast");
    if (!t) return;
    setMessage(t);
    const next = new URLSearchParams(params.toString());
    next.delete("toast");
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    const id = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(id);
  }, [params, pathname, router]);

  if (!message) return null;

  return (
    <div className="toast toast-top toast-end z-50">
      <div className="alert alert-success shadow-lg">
        <span>{message}</span>
      </div>
    </div>
  );
}
