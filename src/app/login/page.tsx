import Link from "next/link";
import { loginAsDemo, signIn } from "@/lib/actions/auth";
import { DEMO_PASSWORD, DEMO_USERS } from "@/lib/types";
import { ThemeSelector } from "@/components/ThemeSelector";

export default function LoginPage() {
  return (
    <div className="freight-hero min-h-screen text-white">
      <div className="navbar px-4 lg:px-8">
        <div className="flex-1">
          <span className="text-xl font-bold tracking-tight">FreightFlow</span>
        </div>
        <div className="flex-none">
          <div className="rounded-box bg-base-100/10 p-1 backdrop-blur">
            <ThemeSelector compact />
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-2 lg:items-center lg:py-20">
        <section>
          <p className="text-sm uppercase tracking-[0.25em] text-sky-200">
            Freight Brokerage & Logistics
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
            Move freight. Bill accurately. Know your margin.
          </h1>
          <p className="mt-4 max-w-xl text-base text-slate-200/90">
            FreightFlow helps your team manage customers, carriers, contracts,
            shipments, invoices, and profitability in one place — from the first
            booking to the final payment.
          </p>
        </section>

        <section className="card bg-base-100 text-base-content shadow-2xl">
          <div className="card-body">
            <h2 className="card-title">Sign in</h2>
            <form action={signIn} className="space-y-3">
              <label className="form-control w-full">
                <span className="label-text">Email</span>
                <input
                  name="email"
                  type="email"
                  required
                  className="input input-bordered w-full"
                  placeholder="you@company.com"
                />
              </label>
              <label className="form-control w-full">
                <span className="label-text">Password</span>
                <input
                  name="password"
                  type="password"
                  required
                  className="input input-bordered w-full"
                />
              </label>
              <button type="submit" className="btn btn-primary w-full">
                Login
              </button>
            </form>
            <p className="text-sm">
              New here?{" "}
              <Link href="/signup" className="link link-primary">
                Create an account
              </Link>
            </p>

            <div className="divider text-xs">Demo roles (panel / classmates)</div>
            <div className="grid gap-2">
              {DEMO_USERS.map((u) => (
                <form key={u.email} action={loginAsDemo.bind(null, u.email)}>
                  <button type="submit" className="btn btn-outline btn-sm w-full justify-between">
                    <span>{u.full_name}</span>
                    <span className="badge badge-ghost capitalize">{u.role}</span>
                  </button>
                </form>
              ))}
            </div>
            <p className="text-xs opacity-60">
              Demo password: <code>{DEMO_PASSWORD}</code>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
