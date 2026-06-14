/** Figma "Final Design" → our events frame (125:60). */
const FIGMA_WIDTH = 1512;
const FIGMA_HEIGHT = 982;

const pctX = (px: number) => `${(px / FIGMA_WIDTH) * 100}%`;
const pctY = (px: number) => `${(px / FIGMA_HEIGHT) * 100}%`;
const pctW = (px: number) => `${(px / FIGMA_WIDTH) * 100}%`;
const figmaFont = (px: number, minPx: number, maxPx: number = px) =>
  `clamp(${minPx}px, ${(px / FIGMA_WIDTH) * 100}vw, ${maxPx}px)`;
const figmaPx = (px: number) => `${(px / FIGMA_WIDTH) * 100}vw`;

type EventItem = {
  city: string;
  date: string;
  /** Placeholder until real URLs are provided. */
  href: string;
};

type EventYear = {
  year: number;
  events: EventItem[];
};

/** Update `href` values when event links are ready. */
export const EVENT_YEARS: EventYear[] = [
  {
    year: 2026,
    events: [
      { city: "ottawa", date: "2026-09-12", href: "https://stupideas-ottawa-f26.devpost.com/" },
      { city: "singapore", date: "2026-05-02", href: "https://singapore-stupidhacks.devpost.com/" },
      { city: "waterloo", date: "2026-03-29", href: "https://sih-waterloo-w26.devpost.com/" },
      { city: "toronto", date: "2026-03-28", href: "https://sih-toronto-w26.devpost.com/" },
    ],
  },
  {
    year: 2025,
    events: [
      { city: "london", date: "2025-11-16", href: "https://stupid-hackathon-uwo.devpost.com/" },
      { city: "toronto", date: "2025-09-27", href: "https://toronto-stupid-ideas-hackathon.devpost.com/" },
      { city: "antananarivo", date: "2025-07-26", href: "https://stupid-hackathon-antananarivo.devpost.com/" },
      { city: "seattle", date: "2025-06-08", href: "https://seattle-stupid-ideas-hackathon.devpost.com/" },
    ],
  },
];

const bodyStyle = {
  fontSize: figmaFont(24, 15, 24),
  letterSpacing: figmaPx(-0.48),
  lineHeight: 1.35,
} as const;

const HOST_SIH_MAIL = "mailto:stupidideashackathon@gmail.com";

function HostSihButton() {
  return (
    <a
      href={HOST_SIH_MAIL}
      className="inline-flex shrink-0 items-center justify-center rounded-full border border-white bg-white font-arial-narrow lowercase text-black no-underline transition-opacity hover:opacity-70"
      style={{
        padding: `calc(${(4 / FIGMA_HEIGHT) * 100} * var(--app-height) / 100) ${figmaPx(16)}`,
        fontSize: figmaFont(24, 15, 24),
        letterSpacing: figmaPx(-0.48),
        lineHeight: 1,
      }}
    >
      host a sih
    </a>
  );
}

function EventList() {
  return (
    <>
      {EVENT_YEARS.map((group, groupIndex) => (
        <div
          key={group.year}
          className={groupIndex > 0 ? "mt-[0.35em]" : undefined}
        >
          <p
            className="m-0 font-bold underline decoration-solid underline-offset-[0.12em]"
            style={{ textUnderlinePosition: "from-font" }}
          >
            {group.year}
          </p>
          <p className="m-0 mt-[0.35em]" aria-hidden>
            &nbsp;
          </p>
          <ul className="m-0 list-none p-0">
            {group.events.map((event) => (
              <li key={`${group.year}-${event.city}-${event.date}`}>
                <a
                  href={event.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white no-underline transition-opacity hover:opacity-70"
                >
                  {`${event.city} ${event.date}`}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

export default function EventsSection() {
  return (
    <section
      id="our-events"
      className="h-app relative w-full shrink-0 bg-black text-white"
      aria-label="our events"
    >
      {/* Mobile — full-width column */}
      <div className="flex h-full w-full flex-col gap-10 px-5 py-[max(2.75rem,5.5vw)] min-[768px]:hidden">
        <div className="flex w-full flex-col gap-2 text-left">
          <h2
            className="font-arial-narrow m-0 w-full lowercase leading-none text-white"
            style={{
              fontSize: figmaFont(72, 40, 72),
              letterSpacing: figmaPx(-2.88),
            }}
          >
            our events
          </h2>
          <div className="font-arial-narrow w-full lowercase text-white" style={bodyStyle}>
            <p className="m-0">
              low-stakes, creativity-first hackathons where experimentation and
              unconventional ideas thrive
            </p>
            <p className="m-0 mt-[0.35em]" aria-hidden>
              &nbsp;
            </p>
            <HostSihButton />
          </div>
        </div>

        <nav
          className="w-full font-arial-narrow lowercase text-white"
          style={bodyStyle}
          aria-label="Past and upcoming events"
        >
          <EventList />
        </nav>
      </div>

      {/* Desktop — Figma layout (unchanged) */}
      <div className="relative mx-auto hidden h-full w-full max-w-[1512px] min-[768px]:block">
        <div
          className="absolute flex flex-col items-end text-right"
          style={{
            left: pctX(784),
            top: pctY(136),
            width: pctW(422),
            gap: figmaPx(8),
          }}
        >
          <h2
            className="font-arial-narrow m-0 w-full lowercase leading-none text-white"
            style={{
              fontSize: figmaFont(72, 36, 72),
              letterSpacing: figmaPx(-2.88),
            }}
          >
            our events
          </h2>
          <div
            className="font-arial-narrow w-full lowercase text-white"
            style={bodyStyle}
          >
            <p className="m-0">
              low-stakes, creativity-first hackathons where experimentation and
              unconventional ideas thrive
            </p>
            <p className="m-0 mt-[0.35em]" aria-hidden>
              &nbsp;
            </p>
            <HostSihButton />
          </div>
        </div>

        <nav
          className="absolute font-arial-narrow lowercase text-white"
          style={{
            left: pctX(334),
            top: pctY(290),
            width: pctW(520),
            ...bodyStyle,
          }}
          aria-label="Past and upcoming events"
        >
          <EventList />
        </nav>
      </div>
    </section>
  );
}
