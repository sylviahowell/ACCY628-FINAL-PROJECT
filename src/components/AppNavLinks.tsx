"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";

export type ShellNavChild = { href: string; label: string; count?: number };

export type ShellNavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  /** Optional badge count on the top-level link (e.g. open support tickets). */
  count?: number;
  children?: ShellNavChild[];
};

function pathOnly(href: string) {
  return href.split("?")[0] ?? href;
}

/** Compare triage query keys (status/band/dim); ignore focus. */
function childQueryActive(childHref: string, searchParams: URLSearchParams, onList: boolean, base: string) {
  if (!onList) return false;
  const q = childHref.includes("?") ? childHref.slice(childHref.indexOf("?") + 1) : "";
  const childQ = new URLSearchParams(q);
  const keys = [...childQ.keys()].filter((k) => k !== "focus");
  if (keys.length === 0) {
    return (
      pathOnly(childHref) === base &&
      !searchParams.get("status") &&
      !searchParams.get("band")
    );
  }
  return keys.every((k) => searchParams.get(k) === childQ.get(k));
}

export function AppNavLinks({ links }: { links: ShellNavItem[] }) {
  return (
    <Suspense fallback={<AppNavLinksFallback links={links} />}>
      <AppNavLinksInner links={links} />
    </Suspense>
  );
}

function ChildLabel({ label, count }: { label: string; count?: number }) {
  return (
    <span className="flex w-full items-center gap-2">
      <span className="flex-1">{label}</span>
      {typeof count === "number" ? (
        <span className="tabular-nums text-xs opacity-60">{count}</span>
      ) : null}
    </span>
  );
}

function AppNavLinksFallback({ links }: { links: ShellNavItem[] }) {
  return (
    <ul className="menu flex-1 gap-1 p-3">
      {links.map((item) => (
        <li key={item.href + item.label}>
          <Link href={item.href} className="gap-3">
            {item.icon}
            <span className="flex-1">{item.label}</span>
            {typeof item.count === "number" && item.count > 0 ? (
              <span className="tabular-nums text-xs opacity-60">{item.count}</span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function AppNavLinksInner({ links }: { links: ShellNavItem[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <ul className="menu flex-1 gap-1 p-3">
      {links.map((item) => {
        if (item.children?.length) {
          const base = pathOnly(item.href);
          const onList = pathname === base;
          const openByDefault = onList || pathname.startsWith(base + "/");
          return (
            <li key={item.href + item.label}>
              <details {...(openByDefault ? { open: true } : {})}>
                <summary className={openByDefault ? "active" : undefined}>
                  <span className="flex flex-1 items-center gap-3">
                    {item.icon}
                    <span className="flex-1">{item.label}</span>
                  </span>
                </summary>
                <ul>
                  {item.children.map((child) => {
                    const childActive = childQueryActive(child.href, searchParams, onList, base);
                    return (
                      <li key={child.href + child.label}>
                        <Link href={child.href} className={childActive ? "active" : undefined}>
                          <ChildLabel label={child.label} count={child.count} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </details>
            </li>
          );
        }

        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));

        return (
          <li key={item.href + item.label}>
            <Link href={item.href} className={`gap-3 ${active ? "active" : ""}`}>
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {typeof item.count === "number" && item.count > 0 ? (
                <span className="tabular-nums text-xs opacity-60">{item.count}</span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
