import type { Metadata, Viewport } from "next";
import { arialNarrowWeb, caveat, pressStart2P } from "./fonts";
import LoadingScreen from "@/components/shared/loading-screen";
import ViewportHeightSync from "@/components/shared/viewport-height-sync";
import "./globals.css";
import { shareImage, siteDescription, siteTitle, siteUrl } from "./site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: siteTitle,
    title: siteTitle,
    description: siteDescription,
    images: [shareImage],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [shareImage],
  },
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
      className={`${arialNarrowWeb.variable} ${pressStart2P.variable} ${caveat.variable} antialiased`}
    >
      <body>
        <LoadingScreen />
        <ViewportHeightSync />
        {children}
      </body>
    </html>
  );
}
