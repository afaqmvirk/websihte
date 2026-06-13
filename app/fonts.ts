import { Archivo_Narrow } from "next/font/google";

/** Web fallback when "Arial Narrow" is not installed (most mobile/Linux devices). */
export const arialNarrowWeb = Archivo_Narrow({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-arial-narrow-web",
  adjustFontFallback: true,
  fallback: ["Arial", "Helvetica Neue", "sans-serif"],
});
