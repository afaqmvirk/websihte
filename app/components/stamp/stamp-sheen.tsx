type StampSheenProps = {
  /** Normalized pointer offset from center, -0.5 … 0.5 */
  tiltX?: number;
  tiltY?: number;
  /** Stronger highlight on hover */
  active?: boolean;
};

/** Gloss + slow sweep + pointer-reactive highlight for stamp frames. */
export default function StampSheen({
  tiltX = 0,
  tiltY = 0,
  active = false,
}: StampSheenProps) {
  const glintX = 50 + tiltX * 42;
  const glintY = 44 + tiltY * 36;
  const bandAngle = 116 + tiltX * 32 - tiltY * 18;

  return (
    <div className="stamp-sheen pointer-events-none absolute inset-0 z-[2]" aria-hidden>
      <div className="stamp-sheen__base absolute inset-0" />
      <div className="stamp-sheen__sweep absolute inset-0" />
      <div
        className="stamp-sheen__glint absolute inset-0"
        style={{
          background: `radial-gradient(
            ellipse 95% 80% at ${glintX}% ${glintY}%,
            rgba(255, 255, 255, ${active ? 0.16 : 0.08}) 0%,
            rgba(255, 255, 255, 0.03) 45%,
            transparent 78%
          )`,
        }}
      />
      <div
        className="stamp-sheen__band absolute inset-0"
        style={{
          background: `linear-gradient(
            ${bandAngle}deg,
            transparent 28%,
            rgba(255, 255, 255, 0.05) 40%,
            rgba(255, 255, 255, ${active ? 0.14 : 0.09}) 50%,
            rgba(255, 255, 255, 0.05) 60%,
            transparent 72%
          )`,
          opacity: active ? 0.55 : 0.35,
        }}
      />
    </div>
  );
}
