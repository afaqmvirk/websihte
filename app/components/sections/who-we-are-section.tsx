import Image from "next/image";
import FramedPhotoArc from "@/components/stamp/framed-photo-arc";
import { getArcConfig } from "@/components/stamp/stamp-config";
import { SECTION_BG, SECTION_SHELL_CLASS, STAMP_PHOTOS, sectionFont, sectionPx } from "@/components/shared/section-layout";
import WhoWeAreScrollOverlay from "@/components/sections/who-we-are-scroll-overlay";

const bodyStyle = {
  fontSize: sectionFont(20, 15, 20),
  letterSpacing: sectionPx(-0.4),
  lineHeight: 1.05,
} as const;

const ARC_CORNER = "bottom-left" as const;
const arcCfg = getArcConfig(ARC_CORNER);

export default function WhoWeAreSection() {
  return (
    <section
      id="who-we-are"
      className="relative w-full shrink-0 overflow-hidden text-white"
      style={{ backgroundColor: SECTION_BG }}
      aria-label="who we are"
    >
      <WhoWeAreScrollOverlay />
      <div
        className={`${SECTION_SHELL_CLASS} relative flex w-full flex-col gap-10 py-[max(2rem,6vw)] pb-0 min-[1024px]:flex-row min-[1024px]:items-start min-[1024px]:justify-between min-[1024px]:gap-8 min-[1024px]:py-[100px]`}
      >
          <div className="pointer-events-none relative z-10 flex w-full min-w-0 flex-col gap-4 min-[1024px]:max-w-[57%] min-[1024px]:gap-4">
            <h2
              className="font-arial-narrow m-0 lowercase leading-none text-white"
              style={{
                fontSize: sectionFont(64, 36, 64),
                letterSpacing: sectionPx(-2.56),
              }}
            >
              who we are
            </h2>

            <div className="font-arial flex flex-col gap-4">
            <div className="text-justify lowercase" style={bodyStyle}>
              <p className="m-0 italic">
                when was the last time you built something just for fun?
              </p>

              <p className="m-0">
                we love hackathons, but somewhere along the line, building became
                synonymous with optimizing, everything had to be scalable,
                pitch-ready, or profitable.
              </p>
            </div>

            <p
              className="m-0 text-justify font-bold lowercase"
              style={{
                ...bodyStyle,
                fontSize: sectionFont(24, 17, 24),
                letterSpacing: sectionPx(-0.48),
              }}
            >
              we created a collective to bring the playground back to tech.
            </p>

            <p className="m-0 text-justify lowercase" style={bodyStyle}>
              the stupid ideas hackathon is a low-stakes event designed to reclaim
              the joy of creation. we strip away the pressure of optimization to
              make room for pure curiosity. try a tool you&apos;ve never touched,
              build something extremely impractical, and fail spectacularly.
            </p>

            <div className="relative mt-2 aspect-[4096/2731] w-full max-w-full overflow-hidden rounded-[4px] border-[16px] border-section-bg min-[1024px]:border-[12px]">
              <Image
                src="/sections/who-we-are-photo.png"
                alt="hackathon participants working together at a long table"
                fill
                className="object-cover"
                sizes="(max-width: 1023px) 100vw, 50vw"
              />
            </div>
            </div>
          </div>

        <div
          className="absolute z-[20] hidden min-[1024px]:block min-[1024px]:overflow-visible"
          style={{
            right: arcCfg.insetXPx,
            bottom: arcCfg.insetYPx,
          }}
        >
          <FramedPhotoArc photos={STAMP_PHOTOS} corner={ARC_CORNER} />
        </div>
      </div>
    </section>
  );
}
