import { Shield } from "lucide-react";
import { RowanLaneBrand } from "@/components/login/RowanLaneBrand";
import { RouteMapGraphic } from "@/components/login/RouteMapGraphic";
import { DemoSnapshot } from "@/components/login/DemoSnapshot";

/**
 * Left login content over the full-page scenic background.
 * Order: brand → headline → snapshot → disclaimer → open truck scenery.
 */
export function FreightLoginHero() {
  return (
    <section className="login-hero relative z-10 flex h-full min-h-0 flex-col overflow-x-hidden overflow-y-auto px-9 py-8 sm:px-10 lg:px-12 lg:py-9 xl:px-14">
      {/* Localized veil for branding/headline only */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[42%] max-w-xl"
        style={{
          background:
            "linear-gradient(180deg, rgba(247,251,255,0.96) 0%, rgba(247,251,255,0.82) 55%, rgba(247,251,255,0.10) 100%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 shrink-0">
        <RowanLaneBrand />
      </div>

      {/* Upper hero: copy | US route map */}
      <div className="relative z-10 mt-5 grid shrink-0 grid-cols-1 items-start gap-4 sm:mt-6 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] sm:gap-5 lg:gap-6">
        <div className="min-w-0 max-w-lg">
          <h1 className="font-bold tracking-tight">
            <span className="block text-[2.05rem] leading-[1.05] text-[#0A1F3D] sm:text-[2.35rem] xl:text-[2.75rem]">
              Move freight.
            </span>
            <span className="mt-0.5 block text-[2.25rem] leading-[1.05] text-[#0866D9] sm:text-[2.55rem] xl:text-[3rem]">
              Protect margins.
            </span>
          </h1>
          <p className="mt-2 text-sm leading-snug text-[#607089] sm:text-[0.925rem]">
            Manage shipments, billing, collections, and profitability in one connected platform.
          </p>
        </div>

        <div
          className="relative mx-auto hidden w-full max-w-[340px] opacity-[0.9] sm:mx-0 sm:ml-auto sm:block sm:max-w-[360px] lg:max-w-[400px]"
          aria-hidden
        >
          <div className="relative aspect-[16/9] w-full">
            <RouteMapGraphic />
          </div>
        </div>
      </div>

      {/* Snapshot + disclaimer — full width of hero column for readable metrics */}
      <div className="relative z-20 mt-5 mr-auto w-full max-w-3xl shrink-0 sm:mt-6">
        <DemoSnapshot />

        <p className="mt-1.5 flex items-start gap-1.5 text-[10px] font-normal leading-[1.2] sm:mt-2">
          <Shield className="mt-0.5 h-3 w-3 shrink-0 text-[#2563EB]" aria-hidden />
          <span>
            <span className="block text-[#315A8A]">Demonstration environment with sample data.</span>
          </span>
        </p>
      </div>

      {/* Open scenic area — truck remains the visual centerpiece below */}
      <div
        className="relative z-0 mt-6 min-h-[200px] flex-1 sm:mt-7 sm:min-h-[240px] lg:min-h-[280px]"
        aria-hidden
      />
    </section>
  );
}
