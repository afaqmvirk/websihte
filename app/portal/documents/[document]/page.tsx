import { notFound } from "next/navigation";
import { CONSENT_VERSION, ORGANIZER_NAME, CONSENT_CONTACT, PARTICIPANT_DOCUMENTS, type ParticipantDocument } from "@/lib/participant-documents";
import PortalShell from "../../portal-shell";
import styles from "../../portal.module.css";

export const metadata = { title: "Participation documents | Stupid Ideas Hackathon Ottawa", robots: { index: false, follow: false } };
export function generateStaticParams() { return Object.keys(PARTICIPANT_DOCUMENTS).map(document => ({ document })); }
export default async function DocumentPage({ params }: { params: Promise<{ document: string }> }) {
  const { document } = await params;
  if (!Object.hasOwn(PARTICIPANT_DOCUMENTS, document)) notFound();
  const content = PARTICIPANT_DOCUMENTS[document as ParticipantDocument];
  return <PortalShell><article className={styles.document}>
    <p>{ORGANIZER_NAME} / Ottawa</p><h1>{content.title}</h1>
    <p className={styles.documentVersion}>Version {CONSENT_VERSION} · English</p>
    <p className={styles.documentIntroduction}>{content.introduction}</p>
    {content.sections.map(section => <section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</section>)}
    <p>Questions or a copy of your accepted version: <a href={`mailto:${CONSENT_CONTACT}`}>{CONSENT_CONTACT}</a>.</p>
  </article></PortalShell>;
}
