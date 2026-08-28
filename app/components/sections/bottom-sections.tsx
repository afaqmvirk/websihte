"use client";

import Image from "next/image";
import { EnvelopeProvider } from "@/components/stamp/envelope-context";
import EventsSection from "@/components/sections/events-section";
import FramedPhotoArc from "@/components/stamp/framed-photo-arc";
import { SectionEnvelope } from "@/components/sections/section-envelope";
import WhoWeAreScrollOverlay from "@/components/sections/who-we-are-scroll-overlay";
import WhoWeAreSection from "@/components/sections/who-we-are-section";
import { markAppReady } from "@/components/shared/app-ready";
import { SECTION_BG, STAMP_PHOTOS } from "@/components/shared/section-layout";

function DarkSectionBackground() {
  const markTextureReady = () => markAppReady("dark-texture");

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <Image
        src="/sections/dark-chalkboard.jpg"
        alt=""
        fill
        preload
        sizes="100vw"
        className="object-cover object-center"
        style={{ filter: "brightness(0.36) contrast(1.12)" }}
        onLoad={markTextureReady}
        onError={markTextureReady}
      />
      <div className="absolute inset-0 bg-black/15" />
    </div>
  );
}

/** Who we are + events/sponsor with one shared sticky envelope. */
export default function BottomSections() {
  return (
    <EnvelopeProvider>
      <div
        id="dark-sections"
        className="relative -mt-px overflow-x-clip overflow-y-visible"
        style={{ backgroundColor: SECTION_BG }}
      >
        <DarkSectionBackground />
        <WhoWeAreScrollOverlay />
        <WhoWeAreSection />

        {/* Mobile — stamp row between sections; clips at viewport edges */}
        <div
          className="relative w-full max-w-full overflow-x-clip py-3 min-[1024px]:hidden"
        >
          <FramedPhotoArc photos={STAMP_PHOTOS} corner="bottom-left" />
        </div>

        <EventsSection />
      </div>
      <SectionEnvelope />
    </EnvelopeProvider>
  );
}
