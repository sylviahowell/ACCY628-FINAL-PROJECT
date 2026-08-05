"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "error",
        action: "app_error_boundary",
        error: error.message,
        digest: error.digest ?? null,
      }),
    );
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 py-16">
      <h1 className="text-2xl font-bold">This page failed to load</h1>
      <p className="text-sm opacity-70">
        {error.message || "An unexpected error occurred while rendering this workspace."}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={reset}>
          Try again
        </button>
        <Link href="/dashboard" className="btn btn-outline btn-sm">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
