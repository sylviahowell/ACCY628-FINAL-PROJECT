export default function AppLoading() {
  return (
    <div className="space-y-4 p-1" aria-busy="true" aria-label="Loading workspace">
      <div className="h-8 w-48 animate-pulse rounded bg-base-300" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded bg-base-300" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-40 animate-pulse rounded-box bg-base-300" />
        <div className="h-40 animate-pulse rounded-box bg-base-300" />
      </div>
      <div className="h-64 animate-pulse rounded-box bg-base-300" />
    </div>
  );
}
