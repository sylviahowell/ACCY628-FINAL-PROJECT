import { AlertTriangle, CheckCircle2, Truck } from "lucide-react";
import { DemoMetricCard } from "@/components/login/DemoMetricCard";

/** Static fictional metrics for the public login page — no Supabase / private data. */
export const STATIC_DEMO_SNAPSHOT = {
  activeShipments: "142",
  deliveriesToday: "27",
  needingAttention: "3",
} as const;

/**
 * Compact frosted snapshot strip — floats over the scenic hero.
 * Equal three-column metrics; no border, soft shadow only.
 */
export function DemoSnapshot() {
  return (
    <section
      aria-label="Today's Snapshot, demo data"
      className="login-snapshot relative z-10 flex min-h-[80px] items-center rounded-[20px] border-0 bg-white/[0.93] px-4 py-2 shadow-[0_12px_36px_rgba(10,31,61,0.07),0_2px_6px_rgba(10,31,61,0.03)] backdrop-blur-[10px] sm:min-h-[84px] sm:px-5 sm:py-2.5 lg:px-6"
    >
      <div className="flex w-full flex-col gap-2.5 md:flex-row md:items-center md:gap-0">
        {/* Compact title */}
        <div className="flex shrink-0 flex-row items-center gap-2 md:w-[18%] md:max-w-[9.5rem] md:flex-col md:items-start md:justify-center md:gap-1 md:pr-3">
          <h2 className="text-[13px] font-semibold leading-tight whitespace-nowrap text-[#0A1F3D]">
            Today&apos;s Snapshot
          </h2>
          <span className="inline-flex w-fit rounded-full bg-[#0866D9] px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-white uppercase">
            Demo Data
          </span>
        </div>

        <div className="hidden h-10 w-px shrink-0 bg-[#0A1F3D]/[0.08] md:block" aria-hidden />

        {/* Three equal columns */}
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-0 md:pl-4">
          <div className="min-w-0 border-b border-[#0A1F3D]/[0.08] pb-2.5 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3 lg:pr-4">
            <DemoMetricCard
              value={STATIC_DEMO_SNAPSHOT.activeShipments}
              label="Active Shipments"
              helper="Across all lanes"
              accentClass="bg-[#E8F1FC] text-[#0866D9]"
              icon={<Truck className="h-3.5 w-3.5" aria-hidden />}
            />
          </div>
          <div className="min-w-0 border-b border-[#0A1F3D]/[0.08] pb-2.5 sm:border-b-0 sm:border-r sm:pb-0 sm:px-3 lg:px-4">
            <DemoMetricCard
              value={STATIC_DEMO_SNAPSHOT.deliveriesToday}
              label="Deliveries Today"
              helper="Completed"
              accentClass="bg-emerald-50 text-emerald-600"
              icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
            />
          </div>
          <div className="min-w-0 overflow-visible sm:pl-3 lg:pl-4">
            <DemoMetricCard
              value={STATIC_DEMO_SNAPSHOT.needingAttention}
              label="Shipments Needing Attention"
              helper="Requires review"
              accentClass="bg-orange-50 text-orange-600"
              icon={<AlertTriangle className="h-3.5 w-3.5" aria-hidden />}
              labelWrap
            />
          </div>
        </div>
      </div>
    </section>
  );
}
