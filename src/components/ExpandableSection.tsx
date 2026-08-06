import type { ReactNode } from "react";

type ExpandableSectionProps = {
  id?: string;
  title: string;
  description?: string;
  badge?: string;
  /** When true, section starts expanded (native details open). */
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
};

/**
 * DaisyUI-styled disclosure for dense accounting / reference blocks.
 */
export function ExpandableSection({
  id,
  title,
  description,
  badge,
  defaultOpen = false,
  children,
  className = "",
}: ExpandableSectionProps) {
  return (
    <details
      id={id}
      className={`collapse collapse-arrow rounded-box border border-base-300 bg-base-100 shadow-sm ${className}`}
      open={defaultOpen || undefined}
    >
      <summary className="collapse-title min-h-0 py-4 pr-12">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold">{title}</span>
          {badge ? <span className="badge badge-ghost badge-sm">{badge}</span> : null}
        </div>
        {description ? (
          <p className="mt-1 text-sm font-normal opacity-70">{description}</p>
        ) : null}
      </summary>
      <div className="collapse-content space-y-3 pt-0">{children}</div>
    </details>
  );
}
