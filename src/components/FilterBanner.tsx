import Link from "next/link";

export function FilterBanner({
  label,
  clearHref,
}: {
  label: string;
  clearHref: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-box border border-warning/40 bg-warning/10 px-4 py-3">
      <p className="text-sm">
        Showing <span className="font-semibold">{label}</span>.
      </p>
      <Link href={clearHref} className="btn btn-ghost btn-xs">
        Clear filter
      </Link>
    </div>
  );
}

export async function resolveSearchParams(
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>,
): Promise<Record<string, string | undefined>> {
  const raw = await Promise.resolve(searchParams ?? {});
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(raw)) {
    out[key] = Array.isArray(value) ? value[0] : value;
  }
  return out;
}
