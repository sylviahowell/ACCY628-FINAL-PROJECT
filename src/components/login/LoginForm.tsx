"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { signIn } from "@/lib/actions/auth";
import { DEMO_MODE_STORAGE_KEY, DEMO_ROLE_STORAGE_KEY } from "@/lib/demo-mode";

const inputClass =
  "input input-bordered h-10 w-full rounded-xl border-[#D7E2EF] bg-white text-[#0A1F3D] transition focus:border-[#0866D9] focus:outline-none focus:ring-[3px] focus:ring-[#0866D9]/20";

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);

  function clearDemoClientState() {
    try {
      sessionStorage.removeItem(DEMO_MODE_STORAGE_KEY);
      sessionStorage.removeItem(DEMO_ROLE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  return (
    <div>
      <h2 className="text-[1.65rem] font-bold tracking-tight text-[#0A1F3D] sm:text-[1.75rem]">
        Welcome back
      </h2>
      <p className="mt-0.5 text-sm text-[#607089]">Sign in to access your portal</p>

      <form
        action={signIn}
        onSubmit={clearDemoClientState}
        className="mt-3.5 space-y-2.5"
      >
        <label className="form-control w-full">
          <span className="label-text mb-0.5 text-[13px] font-medium text-[#0A1F3D]">Email</span>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A9BB0]"
              aria-hidden
            />
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              className={`${inputClass} pl-10`}
            />
          </div>
        </label>

        <label className="form-control w-full">
          <span className="label-text mb-0.5 text-[13px] font-medium text-[#0A1F3D]">Password</span>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A9BB0]"
              aria-hidden
            />
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              className={`${inputClass} px-10`}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#8A9BB0] hover:bg-slate-100 hover:text-[#0A1F3D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0866D9]"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>

        <div className="flex items-center justify-between gap-3 pt-0.5">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[#607089]">
            <input
              type="checkbox"
              name="remember"
              className="checkbox checkbox-sm border-[#D7E2EF] [--chkbg:#0866D9] [--chkfg:white]"
            />
            Remember me
          </label>
          <span className="text-sm text-[#607089]">Contact your administrator</span>
        </div>

        <button
          type="submit"
          className="btn mt-0.5 h-12 w-full rounded-xl border-none bg-[#0B6FE8] text-[15px] font-semibold text-white shadow-sm transition hover:bg-[#0757C2] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B6FE8]"
        >
          Sign In
        </button>
      </form>

      <p className="mt-2.5 text-center text-sm text-[#607089]">
        Sign in with your company account, or launch a Demo Portal below to explore RowanLane
        without signing in.
      </p>
    </div>
  );
}
