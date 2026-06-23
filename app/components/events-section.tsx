import Image from "next/image";
import FramedPhotoArc from "./framed-photo-arc";
import OutlineCtaButton from "./outline-cta-button";
import { getArcConfig } from "./stamp-config";
import {
  SECTION_BG,
  SECTION_BODY_MAX_PX,
  SECTION_SHELL_CLASS,
  STAMP_PHOTOS,
  sectionFont,
  sectionPx,
} from "./section-layout";

type EventItem = {
  city: string;
  date: string;
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
      {
        city: "ottawa",
        date: "TBD",
        href: "",
      },
      { city: "san franscisco", date: "TBD", href: "" },
      {
        city: "singapore",
        date: "2026-05-02",
        href: "https://singapore-stupidhacks.devpost.com/",
      },
      {
        city: "waterloo",
        date: "2026-03-29",
        href: "https://sih-waterloo-w26.devpost.com/",
      },
      {
        city: "toronto",
        date: "2026-03-28",
        href: "https://sih-toronto-w26.devpost.com/",
      },
    ],
  },
  {
    year: 2025,
    events: [
      {
        city: "london",
        date: "2025-11-16",
        href: "https://stupid-hackathon-uwo.devpost.com/",
      },
      {
        city: "toronto",
        date: "2025-09-27",
        href: "https://toronto-stupid-ideas-hackathon.devpost.com/",
      },
      {
        city: "san franscisco",
        date: "2026-09-20",
        href: "https://stupideas-ottawa-f26.devpost.com/",
      },
      {
        city: "antananarivo",
        date: "2025-07-26",
        href: "https://stupid-hackathon-antananarivo.devpost.com/",
      },
      {
        city: "seattle",
        date: "2025-06-08",
        href: "https://seattle-stupid-ideas-hackathon.devpost.com/",
      },
    ],
  },
];

const HOST_SIH_MAIL =
  "mailto:stupidideashackathon@gmail.com?subject=i%20want%20to%20host%20a%20sih";
const SPONSOR_MAIL =
  "mailto:stupidideashackathon@gmail.com?subject=interested%20in%20your%20sponsor%20package!";

const ARC_CORNER = "top-right" as const;
const arcCfg = getArcConfig(ARC_CORNER);

const listStyle = {
  fontSize: sectionFont(20, 15, 20),
  letterSpacing: sectionPx(-0.4),
  lineHeight: 1.35,
} as const;

function EventColumns() {
  return (
    <div className="flex w-fit max-w-full flex-wrap justify-end gap-8 min-[768px]:gap-[32px]">
      {EVENT_YEARS.map((group) => (
        <div key={group.year} className="flex flex-col items-end gap-4">
          <p
            className="font-arial-narrow m-0 lowercase text-white"
            style={{
              fontSize: sectionFont(36, 24, 36),
              letterSpacing: sectionPx(-1.44),
            }}
          >
            {group.year}
          </p>
          <ul
            className="m-0 flex list-none flex-col items-end gap-2 p-0 font-arial lowercase text-white"
            style={listStyle}
          >
            {group.events.map((event) => (
              <li key={`${group.year}-${event.city}-${event.date}`}>
                {event.href ? (
                  <a
                    href={event.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pointer-events-auto text-white no-underline transition-opacity hover:opacity-70"
                  >
                    {`${event.city} ${event.date}`}
                  </a>
                ) : (
                  <span>{`${event.city} ${event.date}`}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function EventsSection() {
  return (
    <section
      id="our-events"
      className="relative w-full shrink-0 overflow-hidden text-white"
      style={{ backgroundColor: SECTION_BG }}
      aria-label="our events and sponsor us"
    >
      <div
        className={`${SECTION_SHELL_CLASS} relative flex w-full flex-col gap-12 pt-0 py-[max(2rem,6vw)] pb-[max(5rem,10vw)] min-[1024px]:flex-row min-[1024px]:items-start min-[1024px]:justify-end min-[1024px]:gap-6 min-[1024px]:pt-[100px] min-[1024px]:pb-[clamp(5rem,10vw,8rem)]`}
      >
        <div
          className="absolute z-[20] hidden min-[1024px]:block"
          style={{
            left: arcCfg.insetXPx,
            top: arcCfg.insetYPx,
          }}
        >
          <FramedPhotoArc photos={STAMP_PHOTOS} corner={ARC_CORNER} />
        </div>

        <div
          className="pointer-events-none relative z-10 flex w-fit max-w-full min-w-0 flex-col items-end gap-8 min-[1024px]:gap-8"
          style={{ maxWidth: SECTION_BODY_MAX_PX, marginLeft: "auto" }}
        >
          <div className="flex w-fit max-w-full flex-col items-end gap-4">
            <nav
              className="w-fit max-w-full"
              style={listStyle}
              aria-label="Past and upcoming events"
            >
              <EventColumns />
            </nav>

            <OutlineCtaButton className="pointer-events-auto" href={HOST_SIH_MAIL}>
              host a sih in your city
            </OutlineCtaButton>
          </div>

          <div
            id="sponsor-us"
            className="pointer-events-auto flex w-fit max-w-[451px] flex-col items-end gap-4"
          >
            <div className="relative aspect-[451/301] w-full overflow-hidden rounded-[4px] border-[16px] border-section-bg">
              <Image
                src="/sections/sponsor-photo.png"
                alt="participants cheering with drinks at a hackathon table"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 451px"
              />
            </div>

            <h2
              className="font-arial-narrow m-0 text-right lowercase leading-none text-white"
              style={{
                fontSize: sectionFont(64, 36, 64),
                letterSpacing: sectionPx(-2.56),
              }}
            >
              sponsor us
            </h2>

            <p
              className="m-0 text-right font-arial lowercase italic text-white"
              style={{
                fontSize: sectionFont(20, 15, 20),
                letterSpacing: sectionPx(-0.4),
                lineHeight: 1.35,
                maxWidth: "451px",
              }}
            >
              align with our mission and want to learn more about how to
              contribute? we partner with individuals and organizations who are
              driven by curiosity.
            </p>

            <OutlineCtaButton href={SPONSOR_MAIL}>
              get our sponsor deck
            </OutlineCtaButton>

            <p
              className="m-0 text-right font-arial lowercase italic text-white"
              style={{
                fontSize: sectionFont(14, 12, 14),
                letterSpacing: sectionPx(-0.28),
              }}
            >
              © the stupid ideas hackathon community 2026
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
