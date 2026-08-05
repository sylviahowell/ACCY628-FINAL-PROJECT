import { AlertTriangle, CheckCircle2, Truck } from "lucide-react";
import { DemoMetricCard } from "@/components/login/DemoMetricCard";

/** Static fictional metrics for the public login page — no Supabase / private data. */
export const STATIC_DEMO_SNAPSHOT = {
  activeShipments: "142",
  deliveriesToday: "27",
  needingAttention: "3",
} as const;

/**
 * Frosted snapshot strip — title on its own row, then three equal metrics.
 * Full labels visible; dividers do not collide with icons/text.
 */
export function DemoSnapshot() {
  return (
    <section
      aria-label="Today's Snapshot, demo data"
      className="login-snapshot relative z-10 rounded-[20px] border-0 bg-white/[0.93] px-5 py-3.5 shadow-[0_12px_36px_rgba(10,31,61,0.07),0_2px_6px_rgba(10,31,61,0.03)] backdrop-blur-[10px] sm:px-6 sm:py-4"
    >
      {/* Title row — full width, not competing with metrics */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-[13px] font-semibold leading-tight text-[#0A1F3D]">
          Today&apos;s Snapshot
        </h2>
        <span className="inline-flex w-fit rounded-full bg-[#0866D9] px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-white uppercase">
          Demo Data
        </span>
      </div>

      {/* Three equal metric columns */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-0">
        <div className="border-b border-[#0A1F3D]/[0.08] pb-3 sm:border-b-0 sm:border-r sm:px-4 sm:pb-0 sm:pr-5">
          <DemoMetricCard
            value={STATIC_DEMO_SNAPSHOT.activeShipments}
            label="Active Shipments"
            helper="Across all lanes"
            accentClass="bg-[#E8F1FC] text-[#0866D9]"
            icon={<Truck className="h-3.5 w-3.5" aria-hidden />}
          />
        </div>
        <div className="border-b border-[#0A1F3D]/[0.08] pb-3 sm:border-b-0 sm:border-r sm:px-4 sm:pb-0 lg:px-5">
          <DemoMetricCard
            value={STATIC_DEMO_SNAPSHOT.deliveriesToday}
            label="Deliveries Today"
            helper="Completed"
            accentClass="bg-emerald-50 text-emerald-600"
            icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
          />
        </div>
        <div className="sm:px-4 sm:pl-5 lg:px-5">
          <DemoMetricCard
            value={STATIC_DEMO_SNAPSHOT.needingAttention}
            label="Attention Needed"
            helper="Requires review"
            accentClass="bg-orange-50 text-orange-600"
            icon={<AlertTriangle className="h-3.5 w-3.5" aria-hidden />}
          />
        </div>
      </div>
    </section>
  );
}
