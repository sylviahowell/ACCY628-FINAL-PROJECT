import Link from "next/link";
import {
  BriefcaseBusiness,
  Building2,
  Calculator,
  LayoutDashboard,
  Truck,
} from "lucide-react";
import { loginAsDemo, signIn } from "@/lib/actions/auth";
import { DEMO_USERS, type UserRole } from "@/lib/types";
import { ThemeSelector } from "@/components/ThemeSelector";

function PortalIcon({ role }: { role: UserRole }) {
  const className = "h-5 w-5 shrink-0 text-primary";
  switch (role) {
    case "manager":
      return <LayoutDashboard className={className} />;
    case "broker":
      return <BriefcaseBusiness className={className} />;
    case "billing":
      return <Calculator className={className} />;
    case "customer":
      return <Building2 className={className} />;
    case "carrier":
      return <Truck className={className} />;
    default:
      return <BriefcaseBusiness className={className} />;
  }
}

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

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-2 lg:items-center lg:py-16">
        <section>
          <p className="text-sm uppercase tracking-[0.25em] text-sky-200">
            Freight Brokerage & Logistics
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
            Move freight. Bill accurately. Know your margin.
          </h1>
          <p className="mt-4 max-w-xl text-base text-slate-200/90">
            Five portals for five jobs — executive, broker operations, billing,
            shipper, and carrier. Each view shows only what that role needs for
            contract-to-cash.
          </p>
        </section>

        <section className="card bg-base-100 text-base-content shadow-2xl">
          <div className="card-body gap-4">
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

            <div className="divider text-xs m-0">Enter a portal</div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {DEMO_USERS.map((u) => (
                <form key={u.email} action={loginAsDemo.bind(null, u.email)}>
                  <button
                    type="submit"
                    className="group flex h-full w-full flex-col rounded-box border border-base-300 bg-base-100 p-4 text-left transition hover:border-primary hover:bg-primary/5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-primary/10 p-2">
                          <PortalIcon role={u.role} />
                        </span>
                        <div>
                          <p className="text-sm font-semibold leading-tight">
                            {u.portal}
                          </p>
                          <p className="text-xs opacity-60">{u.full_name}</p>
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 grow text-xs leading-snug opacity-70">
                      {u.description}
                    </p>
                    <span className="mt-3 text-xs font-semibold text-primary group-hover:underline">
                      {u.portalAction} →
                    </span>
                  </button>
                </form>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
