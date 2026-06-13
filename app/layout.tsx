import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ViewportHeightSync from "./components/viewport-height-sync";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      className={`${geistSans.variable} ${geistMono.variable} overflow-hidden antialiased`}
    >
      <body className="overflow-hidden">
        <ViewportHeightSync />
        {children}
      </body>
    </html>
  );
}
