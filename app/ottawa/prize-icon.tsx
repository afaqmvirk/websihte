const ICONS = {
  metric: (
    <>
      <path d="M4 4v16h16M8 15l4-5 4 3 4-7M16 6h4v4" />
    </>
  ),
  button: (
    <>
      <rect x="5" y="5" width="14" height="14" rx="4" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v1M21 12h1M12 21v1M2 12h1" />
    </>
  ),
  api: <path d="m8 6-6 6 6 6M16 6l6 6-6 6M14 4l-4 16" />,
  ai: (
    <>
      <rect x="4" y="7" width="16" height="13" rx="3" />
      <path d="M12 3v4M2 12v4M22 12v4M9 16h6" />
      <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="3" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  bob: (
    <>
      <path d="m3 6 5 4 4-6 4 6 5-4-2 12H5L3 6ZM6 21h12" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 3h10v5a5 5 0 0 1-10 0V3ZM7 5H3v3a4 4 0 0 0 4 4M17 5h4v3a4 4 0 0 1-4 4M12 13v5M8 21v-3h8v3M6 21h12" />
    </>
  ),
  medal: (
    <>
      <path d="m8 12-4-9h5l3 7 3-7h5l-4 9" />
      <circle cx="12" cy="16" r="6" />
      <circle cx="12" cy="16" r="2" />
    </>
  ),
  ribbon: (
    <>
      <circle cx="12" cy="8" r="6" />
      <circle cx="12" cy="8" r="2" />
      <path d="m8 13-2 9 6-3 6 3-2-9" />
    </>
  ),
};

export type PrizeIconName = keyof typeof ICONS;

export function PrizeIcon({ name, className }: { name: PrizeIconName; className: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  );
}
