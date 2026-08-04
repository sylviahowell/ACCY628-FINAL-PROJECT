import { loginAsDemo } from "@/lib/actions/auth";
import { DEMO_PASSWORD, DEMO_USERS } from "@/lib/types";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(ellipse_at_top_left,_#17385f_0%,_#0f2744_40%,_#1a1f24_100%)] text-white">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-4 py-12">
        <p className="text-sm uppercase tracking-[0.25em] text-sky-300/90">
          LaneLedger Freight
        </p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Freight brokerage contract-to-cash
        </h1>
        <p className="mt-4 max-w-2xl text-base text-slate-200/90">
          Demo access for panel and teammates. Pick a role — no logout dance
          required between perspectives. Shared Supabase project:{" "}
          <span className="font-mono text-sky-200">ACCY628-Final-Project</span>.
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {DEMO_USERS.map((user) => (
            <form key={user.email} action={loginAsDemo.bind(null, user.email)}>
              <button
                type="submit"
                className="w-full rounded-lg border border-white/15 bg-white/5 p-4 text-left transition hover:border-sky-300/50 hover:bg-white/10"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-lg font-medium">{user.full_name}</span>
                  <span className="rounded bg-amber-300/20 px-2 py-0.5 text-xs uppercase tracking-wide text-amber-100">
                    {user.role}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{user.description}</p>
                <p className="mt-3 font-mono text-xs text-slate-400">
                  {user.email}
                </p>
              </button>
            </form>
          ))}
        </div>

        <p className="mt-8 text-xs text-slate-400">
          Demo password (all accounts):{" "}
          <span className="font-mono text-slate-200">{DEMO_PASSWORD}</span>
        </p>
      </div>
    </div>
  );
}
