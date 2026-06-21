import { Archivo_Narrow, Press_Start_2P } from "next/font/google";

/** Web fallback when "Arial Narrow" is not installed (most mobile/Linux devices). */
export const arialNarrowWeb = Archivo_Narrow({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-arial-narrow-web",
  adjustFontFallback: true,
  fallback: ["Arial", "Helvetica Neue", "sans-serif"],
});

export const pressStart2P = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-press-start-2p",
});
