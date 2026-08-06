import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-box border border-dashed border-base-300 bg-base-100 px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {description ? <p className="mt-1 text-sm opacity-70">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
