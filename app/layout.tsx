import type { Metadata, Viewport } from "next";
import { arialNarrowWeb, pressStart2P } from "./fonts";
import LoadingScreen from "./components/loading-screen";
import ViewportHeightSync from "./components/viewport-height-sync";
import "./globals.css";

export const metadata: Metadata = {
  title: "the stupid ideas hackathon community",
  description:
    "a decentralized community reclaiming the joy of building, one stupid idea at a time.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${arialNarrowWeb.variable} ${pressStart2P.variable} antialiased`}
    >
      <body>
        <LoadingScreen />
        <ViewportHeightSync />
        <div id="app-content">{children}</div>
      </body>
    </html>
  );
}
