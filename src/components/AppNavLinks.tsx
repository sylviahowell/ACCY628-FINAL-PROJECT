"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type ShellNavItem = { href: string; label: string; icon: ReactNode };

export function AppNavLinks({ links }: { links: ShellNavItem[] }) {
  const pathname = usePathname();

  return (
    <ul className="menu flex-1 gap-1 p-3">
      {links.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
        return (
          <li key={item.href + item.label}>
            <Link href={item.href} className={`gap-3 ${active ? "active" : ""}`}>
              {item.icon}
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
