"use client";

import { EnvelopeProvider } from "@/components/stamp/envelope-context";
import EventsSection from "@/components/sections/events-section";
import FramedPhotoArc from "@/components/stamp/framed-photo-arc";
import { SectionEnvelope } from "@/components/sections/section-envelope";
import WhoWeAreScrollOverlay from "@/components/sections/who-we-are-scroll-overlay";
import WhoWeAreSection from "@/components/sections/who-we-are-section";
import { SECTION_BG, STAMP_PHOTOS } from "@/components/shared/section-layout";

/** Who we are + events/sponsor with one shared sticky envelope. */
export default function BottomSections() {
  return (
    <EnvelopeProvider>
      <div id="dark-sections" className="relative -mt-px overflow-x-clip overflow-y-visible">
        <WhoWeAreScrollOverlay />
        <WhoWeAreSection />

        {/* Mobile — stamp row between sections; clips at viewport edges */}
        <div
          className="relative w-full max-w-full overflow-x-clip py-3 min-[1024px]:hidden"
          style={{ backgroundColor: SECTION_BG }}
        >
          <FramedPhotoArc photos={STAMP_PHOTOS} corner="bottom-left" />
        </div>

        <EventsSection />
      </div>
      <SectionEnvelope />
    </EnvelopeProvider>
  );
}
