"use client";

import dynamic from "next/dynamic";
import type { MapShipment } from "@/components/ShipmentMap";

const ShipmentMapInner = dynamic(
  () => import("@/components/ShipmentMap").then((m) => m.ShipmentMap),
  {
    ssr: false,
    loading: () => (
      <div className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body">
          <div className="skeleton h-8 w-48" />
          <div className="skeleton mt-3 h-[420px] w-full" />
        </div>
      </div>
    ),
  },
);

export function ShipmentMapLazy({
  shipments,
  today,
}: {
  shipments: MapShipment[];
  today: string;
}) {
  return <ShipmentMapInner shipments={shipments} today={today} />;
}
