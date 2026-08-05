"use client";

import Image from "next/image";

/**
 * US route map — transparent PNG (no white canvas).
 * unoptimized preserves the alpha channel as authored.
 */
export function RouteMapGraphic({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/images/rowanlane-us-route-map.png"
      alt=""
      width={640}
      height={360}
      className={`h-full w-full object-contain ${className}`}
      priority
      unoptimized
    />
  );
}
