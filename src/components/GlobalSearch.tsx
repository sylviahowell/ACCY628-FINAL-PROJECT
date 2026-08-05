"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useDeferredValue, useEffect, useState, useTransition } from "react";
import { globalSearch, type SearchHit } from "@/lib/actions/search";

export function GlobalSearch({ placeholder = "Search…" }: { placeholder?: string }) {
  const [q, setQ] = useState("");
  const deferred = useDeferredValue(q);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (deferred.trim().length < 2) {
      setHits([]);
      setSearched(false);
      return;
    }
    startTransition(async () => {
      const results = await globalSearch(deferred);
      setHits(results);
      setSearched(true);
      setOpen(true);
    });
  }, [deferred]);

  return (
    <div className="relative hidden min-w-[14rem] max-w-md flex-1 md:block">
      <label className="input input-bordered input-sm flex items-center gap-2">
        <Search className="h-4 w-4 opacity-50" />
        <input
          type="search"
          className="grow"
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => (hits.length > 0 || searched) && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && hits[0]) {
              window.location.href = hits[0].href;
            }
          }}
          aria-label="Global search"
        />
        {pending ? <span className="loading loading-spinner loading-xs" /> : null}
      </label>
      {open && deferred.trim().length >= 2 ? (
        <ul className="menu absolute z-50 mt-1 max-h-80 w-full overflow-auto rounded-box border border-base-300 bg-base-100 p-2 shadow-lg">
          {hits.length === 0 && searched && !pending ? (
            <li className="px-3 py-2 text-sm opacity-60">No matches for “{deferred.trim()}”</li>
          ) : (
            hits.map((h) => (
              <li key={`${h.type}-${h.id}`}>
                <Link href={h.href} onClick={() => setOpen(false)}>
                  <span className="badge badge-ghost badge-xs capitalize">{h.type}</span>
                  <span className="font-medium">{h.title}</span>
                  <span className="truncate text-xs opacity-60">{h.subtitle}</span>
                </Link>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
