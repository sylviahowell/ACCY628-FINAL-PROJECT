/** Lightweight content placeholder — avoid full-page skeleton flash between modules. */
export default function AppLoading() {
  return (
    <div
      className="h-0.5 w-full overflow-hidden rounded-full bg-base-300"
      aria-busy="true"
      aria-label="Loading workspace"
    >
      <div className="h-full w-1/3 animate-[pulse_0.9s_ease-in-out_infinite] bg-primary" />
    </div>
  );
}
