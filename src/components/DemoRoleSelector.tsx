"use client";

import { useEffect, useState } from "react";
import { Beaker, LogOut } from "lucide-react";
import { activateDemoModeSession, exitDemo } from "@/lib/actions/auth";
import { clientSignInDemoRole } from "@/lib/demo-auth-client";
import {
  DEMO_MODE_STORAGE_KEY,
  DEMO_ROLE_OPTIONS,
  DEMO_ROLE_STORAGE_KEY,
} from "@/lib/demo-mode";
import type { UserRole } from "@/lib/types";

function persistDemoClientState(role: UserRole) {
  try {
    sessionStorage.setItem(DEMO_MODE_STORAGE_KEY, "1");
    sessionStorage.setItem(DEMO_ROLE_STORAGE_KEY, role);
  } catch {
    /* ignore private-mode / unavailable storage */
  }
}

function clearDemoClientState() {
  try {
    sessionStorage.removeItem(DEMO_MODE_STORAGE_KEY);
    sessionStorage.removeItem(DEMO_ROLE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function DemoRoleSelector({ activeRole }: { activeRole: UserRole }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    persistDemoClientState(activeRole);
  }, [activeRole]);

  async function onChange(next: string) {
    if (pending) return;

    if (next === "exit") {
      clearDemoClientState();
      setError(null);
      setPending(true);
      try {
        await exitDemo();
      } catch (e) {
        setPending(false);
        setError(e instanceof Error ? e.message : "Could not exit demo");
      }
      return;
    }

    const role = next as UserRole;
    if (role === activeRole) return;
    persistDemoClientState(role);
    setError(null);
    setPending(true);
    try {
      await clientSignInDemoRole(role);
      await activateDemoModeSession();
      // Full reload so middleware + RSC see the new auth cookies (soft nav races /login).
      window.location.assign(`/dashboard?portal=${encodeURIComponent(role)}`);
    } catch (e) {
      setPending(false);
      setError(e instanceof Error ? e.message : "Could not switch demo role");
    }
  }

  return (
    <div className="flex max-w-full shrink-0 flex-nowrap items-center justify-end gap-1.5 sm:gap-2">
      <span
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#0866D9] uppercase"
        title="Demo Mode"
      >
        <Beaker className="h-3 w-3" aria-hidden />
        <span className="hidden min-[1280px]:inline">Demo Mode</span>
      </span>

      <label className="flex min-w-0 items-center gap-1.5 text-xs">
        <span className="hidden shrink-0 font-medium text-base-content/70 xl:inline">
          Demo Role:
        </span>
        <select
          className="select select-bordered select-sm w-[10.75rem] shrink-0 text-xs font-medium sm:w-[12.5rem]"
          aria-label="Demo Role"
          disabled={pending}
          value={activeRole}
          onChange={(e) => {
            void onChange(e.target.value);
          }}
        >
          {DEMO_ROLE_OPTIONS.map((opt) => (
            <option key={opt.role} value={opt.role}>
              {opt.label}
            </option>
          ))}
          <option value="exit">Exit Demo…</option>
        </select>
      </label>
      {pending ? (
        <span className="shrink-0 text-[11px] text-[#0866D9]">Switching…</span>
      ) : null}
      {error ? (
        <p
          className="basis-full max-w-md text-right text-[11px] leading-snug text-error"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <button
        type="button"
        className="btn btn-ghost btn-sm shrink-0 gap-1 text-xs"
        disabled={pending}
        title="Exit Demo Mode"
        onClick={() => {
          void onChange("exit");
        }}
      >
        <LogOut className="h-3.5 w-3.5" />
        <span className="hidden xl:inline">Exit Demo</span>
      </button>
    </div>
  );
}
