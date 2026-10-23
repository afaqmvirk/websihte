import { getPortalMember } from "@/lib/portal-auth";
import { getMemberRsvp, getMemberRsvpWindow } from "@/lib/portal-storage";
import { OTTAWA_AGENDA, OTTAWA_CALENDAR_LINKS, OTTAWA_EVENT } from "@/lib/ottawa-event";
import { discordInviteUrl, instagramUrl } from "@/site";
import PortalShell from "./portal-shell";
import RsvpForm from "./rsvp-form";
import SignInForm from "./sign-in-form";
import styles from "./portal.module.css";

export const dynamic = "force-dynamic";

export default async function PortalPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const member = await getPortalMember();
  const params = await searchParams;
  if (!member) return (
    <PortalShell>
      <SignInForm invalidLink={params.error === "link"} />
    </PortalShell>
  );
  const [rsvp, window] = await Promise.all([getMemberRsvp(member), getMemberRsvpWindow(member)]);

  return (
    <PortalShell member={member}>
      <header className={styles.eventHeader}>
        <h1>ottawa</h1>
        <p><time dateTime={OTTAWA_EVENT.date}>{OTTAWA_EVENT.dateLabel}</time> · {OTTAWA_EVENT.hoursLabel}</p>
        <a href={OTTAWA_EVENT.mapsUrl} target="_blank" rel="noopener noreferrer">
          {OTTAWA_EVENT.venue} · {OTTAWA_EVENT.address}
        </a>
        <nav className={styles.communityLinks} aria-label="community links">
          <a className={styles.primaryButton} href={discordInviteUrl} target="_blank" rel="noopener noreferrer">Join Discord</a>
          <a className={styles.primaryButton} href={instagramUrl} target="_blank" rel="noopener noreferrer">Follow Instagram</a>
        </nav>
      </header>
      <div className={styles.dashboardGrid}>
        <section id="schedule" className={styles.scheduleCard} aria-labelledby="schedule-heading">
          <div className={styles.scheduleTitle}><h2 id="schedule-heading">schedule</h2></div>
          <nav className={styles.calendarLinks} aria-label="add event to calendar">
            {OTTAWA_CALENDAR_LINKS.map(link => (
              <a key={link.label} className={styles.primaryButton} href={link.href} target="_blank" rel="noopener noreferrer">+ {link.label}</a>
            ))}
          </nav>
          <ol className={styles.agenda}>
            {OTTAWA_AGENDA.map((item) => (
              <li key={item.time}><time dateTime={`${OTTAWA_EVENT.date}T${item.time}:00-05:00`}>{item.time}</time><span>{item.label}</span></li>
            ))}
          </ol>
          <section className={styles.venueMap} aria-labelledby="venue-heading">
            <h3 id="venue-heading">getting here</h3>
            <iframe src={OTTAWA_EVENT.mapEmbedUrl} title="Map to Bayview Yards in Ottawa" loading="lazy" referrerPolicy="no-referrer" />
            <a href={OTTAWA_EVENT.mapsUrl} target="_blank" rel="noopener noreferrer">get directions to {OTTAWA_EVENT.venue}</a>
          </section>
        </section>
        <RsvpForm initialRsvp={rsvp} deadline={window.deadline} initiallyClosed={window.closed} />
      </div>
    </PortalShell>
  );
}
