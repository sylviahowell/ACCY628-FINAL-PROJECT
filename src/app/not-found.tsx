export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center gap-3 py-16">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-sm opacity-70">
        That route is not part of this portal, or the record no longer exists.
      </p>
      <a href="/dashboard" className="btn btn-primary btn-sm w-fit">
        Go to dashboard
      </a>
    </div>
  );
}
