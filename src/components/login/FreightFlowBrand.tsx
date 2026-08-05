import { FreightFlowMark } from "@/components/FreightFlowMark";

export function FreightFlowBrand({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/*
        Orbital globe mark (team pick):
        Wireframe globe + wrapping orbital path ending in an arrow.
        Single flat FreightFlow blue. No tile, gradient, or shadow.
      */}
      <FreightFlowMark size={46} />

      <div className="flex min-w-0 flex-col justify-center">
        <p className="text-[1.4rem] font-extrabold leading-none tracking-tight text-[#0A1F3D]">
          FreightFlow
        </p>
        <p className="mt-1 text-[11px] font-normal leading-snug text-[#9AABBD]">
          Freight Brokerage &amp; Logistics Management System
        </p>
      </div>
    </div>
  );
}
