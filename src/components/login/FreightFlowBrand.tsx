export function FreightFlowBrand({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/*
        Route Network mark (approved reference):
        Origin hub on the left → two flowing routes → destination hubs.
        Single flat FreightFlow blue. No tile, gradient, or shadow.
      */}
      <svg
        width="46"
        height="46"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="FreightFlow"
        className="shrink-0"
      >
        {/* Routes first so hubs sit cleanly on top at junctions */}
        <path
          d="M12 24C18 24 26 14 36 12"
          stroke="#0866D9"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M12 24C18 24 26 34 36 36"
          stroke="#0866D9"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="12" cy="24" r="5.5" fill="#0866D9" />
        <circle cx="36" cy="12" r="5.5" fill="#0866D9" />
        <circle cx="36" cy="36" r="5.5" fill="#0866D9" />
      </svg>

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
