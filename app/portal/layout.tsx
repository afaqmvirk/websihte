import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "my stupid ideas | ottawa 2026",
  description: "your Ottawa participant dashboard, schedule, and RSVP.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://my.stupideas.com" },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
