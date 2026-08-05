/** Approved orbital logo — transparent PNG, no white plate. */
export function FreightFlowMark({
  size = 46,
  className = "",
  title = "FreightFlow",
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- keep full alpha; next/image can plate white
    <img
      src="/brand/freightflow-orbital.png"
      alt={title}
      width={size}
      height={size}
      className={`shrink-0 bg-transparent object-contain ${className}`}
      style={{ backgroundColor: "transparent" }}
      decoding="async"
    />
  );
}
