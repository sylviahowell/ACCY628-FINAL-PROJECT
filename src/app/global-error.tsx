"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
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
        action: "global_error",
        error: error.message,
        digest: error.digest ?? null,
      }),
    );
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-base-200 p-6 text-base-content">
        <div className="card max-w-md border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body gap-3">
            <h1 className="text-xl font-bold">Something went wrong</h1>
            <p className="text-sm opacity-70">
              RowanLane hit an unexpected error. You can try again or return to the login
              screen.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary btn-sm" onClick={reset}>
                Try again
              </button>
              <Link href="/login" className="btn btn-outline btn-sm">
                Back to login
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
