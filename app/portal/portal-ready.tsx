"use client";

import { useEffect } from "react";
import { APP_READY_GATES, markAppReady } from "@/components/shared/app-ready";

export default function PortalReady() {
  useEffect(() => { APP_READY_GATES.forEach(markAppReady); }, []);
  return null;
}
