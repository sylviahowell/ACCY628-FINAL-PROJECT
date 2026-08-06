import { RowanLaneMark } from "@/components/RowanLaneMark";

export function RowanLaneBrand({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/*
        Orbital globe mark (team pick):
        Wireframe globe + wrapping orbital path ending in an arrow.
        Single flat brand blue. No tile, gradient, or shadow.
      */}
      <RowanLaneMark size={46} />

      <div className="flex min-w-0 flex-col justify-center">
        <p className="font-brand text-[1.45rem] font-extrabold leading-none text-[#0A1F3D]">
          RowanLane
        </p>
        <p className="mt-1 text-[11px] font-normal leading-snug text-[#9AABBD]">
          Freight Brokerage &amp; Logistics Management System
        </p>
      </div>
    </div>
  );
}
