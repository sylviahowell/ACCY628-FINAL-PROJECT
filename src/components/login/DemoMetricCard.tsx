import type { ReactNode } from "react";

/** Compact horizontal metric: icon | number + label + helper */
export function DemoMetricCard({
  value,
  label,
  helper,
  icon,
  accentClass,
}: {
  value: string;
  label: string;
  helper: string;
  icon: ReactNode;
  accentClass: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span
        className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${accentClass}`}
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[20px] font-bold leading-none tracking-tight text-[#0A1F3D] tabular-nums">
          {value}
        </p>
        <p className="mt-1 text-[12px] font-semibold leading-snug text-[#0A1F3D]">
          {label}
        </p>
        <p className="mt-0.5 text-[10px] leading-snug text-[#7A8BA0]">{helper}</p>
      </div>
    </div>
  );
}
