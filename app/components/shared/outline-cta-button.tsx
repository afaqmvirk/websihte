type OutlineCtaButtonProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

export default function OutlineCtaButton({
  href,
  children,
  className,
}: OutlineCtaButtonProps) {
  return (
    <div
      className={`flex items-center gap-1 ${className ?? ""}`}
    >
      <span
        className="shrink-0 text-white"
        style={{ fontSize: "clamp(16px, 1.32vw, 20px)", letterSpacing: "-0.4px" }}
        aria-hidden
      >
        ⊹₊ ⋆
      </span>
      <a
        href={href}
        className="inline-flex shrink-0 items-center justify-center rounded-full border border-white px-4 py-1 font-arial-narrow lowercase text-white no-underline transition-opacity hover:opacity-70"
        style={{
          fontSize: "clamp(16px, 1.32vw, 20px)",
          letterSpacing: "-0.4px",
        }}
      >
        {children}
      </a>
    </div>
  );
}
