"use client";

import { EnvelopeProvider } from "./envelope-context";
import EventsSection from "./events-section";
import FramedPhotoArc from "./framed-photo-arc";
import { SectionEnvelope } from "./section-envelope";
import WhoWeAreSection from "./who-we-are-section";
import { STAMP_PHOTOS } from "./section-layout";

/** Who we are + events/sponsor with one shared sticky envelope. */
export default function BottomSections() {
  return (
    <EnvelopeProvider>
      <div id="dark-sections" className="relative overflow-x-clip overflow-y-visible">
        <WhoWeAreSection />

        {/* Mobile — stamp row between sections; clips at viewport edges */}
        <div
          className="relative w-full max-w-full overflow-x-clip py-3 min-[1024px]:hidden"
          style={{ backgroundColor: "#0e0e0e" }}
        >
          <FramedPhotoArc photos={STAMP_PHOTOS} corner="bottom-left" />
        </div>

        <EventsSection />
      </div>
      <SectionEnvelope />
    </EnvelopeProvider>
  );
}
