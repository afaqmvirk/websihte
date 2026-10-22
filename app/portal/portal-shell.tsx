import type { PortalMember } from "@/lib/portal";
import PortalReady from "./portal-ready";
import styles from "./portal.module.css";

export default function PortalShell({ member, children }: { member?: PortalMember | null; children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <PortalReady />
      <a href="#portal-main" className={styles.skipLink}>skip to dashboard</a>
      <header className={styles.header}>
        <a className={styles.brand} href="https://www.stupideas.com/ottawa" aria-label="stupid ideas hackathon Ottawa">
          stupid ideas hackathon
        </a>
        {member ? (
          <div className={styles.account}>
            <span className={styles.accountEmail}>{member.email}</span>
            <form action="/api/portal/sign-out" method="post"><button className={styles.textButton}>sign out</button></form>
          </div>
        ) : null}
      </header>
      <main id="portal-main" className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <nav aria-label="support links">
          <a href="mailto:applications@stupideas.com">contact</a>
          <a href="https://www.stupideas.com/privacy">privacy</a>
        </nav>
      </footer>
    </div>
  );
}
