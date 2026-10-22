"use client";

import PortalShell from "./portal-shell";
import styles from "./portal.module.css";

export default function PortalError({ reset }: { reset: () => void }) {
  return <PortalShell><div className={styles.confirmWrap} role="alert"><h1>dashboard unavailable</h1><button className={styles.primaryButton} onClick={reset}>try again</button></div></PortalShell>;
}
