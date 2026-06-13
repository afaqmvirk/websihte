import Hero from "./components/hero";
import EventsSection from "./components/events-section";

export default function Home() {
  return (
    <main className="min-h-0">
      <Hero />
      <EventsSection />
    </main>
  );
}
