import type { Metadata } from "next";
import OttawaPage from "./ottawa-page";

export const metadata: Metadata = {
  title: "ottawa | the stupid ideas hackathon",
  description:
    "sign up for the stupid ideas hackathon in ottawa on november 15, 2026.",
};

export default function Page() {
  return <OttawaPage />;
}
