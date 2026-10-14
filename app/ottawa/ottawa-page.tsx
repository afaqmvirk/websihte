"use client";

import Image from "next/image";
import Link from "next/link";
import { useLayoutEffect, useState, type FormEvent } from "react";
import { APP_READY_GATES, markAppReady } from "@/components/shared/app-ready";
import styles from "./page.module.css";

const AGENDA = [
  { time: "09:00", label: "doors + breakfast" },
  { time: "10:00", label: "opening nonsense" },
  { time: "10:30", label: "build time" },
  { time: "13:00", label: "food time" },
  { time: "17:30", label: "demoes" },
  { time: "19:00", label: "prizes + goodbye" },
];

const THEMED_PRIZES = [
  { title: "stupidest metric", description: "track something useless" },
  {
    title: "stupidest button",
    description: "make something cool happen with a useless button",
  },
  {
    title: "stupidest API",
    amount: "$67 cash",
    description: "return stupid data",
  },
  { title: "stupidest AI", description: "build a stupid AI agent" },
  { title: "the great bob award" },
];

const GENERAL_PRIZES = [
  { title: "stupidest", amount: "$500 cash" },
  { title: "stupider", amount: "$250 cash" },
  { title: "stupid", amount: "$100 cash" },
];

const GOOGLE_CALENDAR_URL =
  "https://calendar.google.com/calendar/render?action=TEMPLATE&text=The%20Stupid%20Ideas%20Hackathon%20Ottawa&dates=20261115T140000Z%2F20261116T000000Z&details=One%20day%20to%20follow%20your%20idea%20all%20the%20way%20through.&location=Bayview%20Yards%2C%207%20Bayview%20Station%20Rd%2C%20Ottawa%2C%20ON%20K1Y%202C5";

type SubmissionState = "idle" | "submitting" | "success" | "error";

export default function OttawaPage() {
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [submissionMessage, setSubmissionMessage] = useState("");

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      APP_READY_GATES.forEach(markAppReady);
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    setSubmissionState("submitting");
    setSubmissionMessage("");

    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        body: new FormData(form),
      });
      const result = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          result?.message ??
            "We could not submit your application. Please try again.",
        );
      }

      form.reset();
      setSubmissionState("success");
      setSubmissionMessage(result?.message ?? "Application received.");
    } catch (error) {
      setSubmissionState("error");
      setSubmissionMessage(
        error instanceof Error
          ? error.message
          : "We could not submit your application. Please try again.",
      );
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.texture} aria-hidden>
        <Image
          src="/Texturelabs_Paper_312XL 1.png"
          alt=""
          fill
          sizes="100vw"
          className={styles.textureImage}
          priority
        />
      </div>

      <header className={styles.hero}>
        <Image
          src="/ottawa-skyline.png"
          alt="the Ottawa skyline and Parliament Hill viewed across the Ottawa River"
          fill
          sizes="100vw"
          className={styles.heroImage}
          priority
        />
        <div className={styles.heroShade} aria-hidden />
        <Link href="/" className={styles.backLink} aria-label="back to home">
          ← stupid ideas
        </Link>

        <div className={styles.heroCopy}>
          <div className={styles.heroLockup}>
            <p className={styles.city}>ottawa.</p>
            <p className={styles.heroDate}>
              <time dateTime="2026-11-15">november 15, 2026</time>
            </p>
            <p className={styles.heroVenue}>
              <a
                href="https://www.google.com/maps/search/?api=1&query=Bayview+Yards%2C+Ottawa%2C+ON"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.heroVenueLink}
                aria-label="Bayview Yards — 7 Bayview Station Road, Ottawa, Ontario K1Y 2C5 — open in Google Maps"
              >
                <span className={styles.heroVenueName}>Bayview Yards ↗</span>
                <span className={styles.heroVenueAddress} aria-hidden>
                  7 Bayview Station Rd, Ottawa, ON K1Y 2C5 ↗
                </span>
              </a>
            </p>
            <div className={styles.calendarActions}>
              <a
                href={GOOGLE_CALENDAR_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                + google calendar
              </a>
              <a href="/ottawa-2026.ics" download>
                + apple calendar
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className={styles.bodyLayout}>
        <div className={styles.leftColumn}>
          <section className={styles.intro} aria-labelledby="ottawa-title">
            <h1 id="ottawa-title" className={styles.title}>
              make something beautiful
            </h1>
            <p className={styles.description}>
              one day to follow your idea all the way through.
            </p>
            <a className={styles.mobileApply} href="#apply">
              ( Apply )
            </a>
          </section>

          <section className={styles.program} aria-label="agenda and prizes">
            <article className={`${styles.paperCard} ${styles.agendaCard}`}>
              <p className={styles.sectionNumber} aria-hidden>①</p>
              <h2>agenda</h2>
              <p className={styles.agendaDate}>
                <time dateTime="2026-11-15">November 15, 2026</time>
              </p>
              <ol className={styles.agendaList}>
                {AGENDA.map((item) => (
                  <li key={`${item.time}-${item.label}`}>
                    <time>{item.time}</time>
                    <span>{item.label}</span>
                  </li>
                ))}
              </ol>
            </article>

            <article className={`${styles.paperCard} ${styles.prizesCard}`}>
              <p className={styles.sectionNumber} aria-hidden>②</p>
              <h2>prizes</h2>
              <div className={styles.prizeGroups}>
                <section aria-label="themed awards">
                  <ol className={styles.themedPrizeList}>
                    {THEMED_PRIZES.map((prize, index) => (
                      <li key={prize.title}>
                        <span className={styles.prizeNumber}>0{index + 1}</span>
                        <div>
                          <h3>{prize.title}</h3>
                          {prize.amount ? <p className={styles.prizeAmount}>{prize.amount}</p> : null}
                          {prize.description ? (
                            <p className={styles.prizeDescription}>{prize.description}</p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>

                <section className={styles.generalTrack} aria-label="general track">
                  <ol className={styles.generalPrizeList}>
                    {GENERAL_PRIZES.map((prize, index) => (
                      <li key={prize.title}>
                        <span className={styles.generalPrizeNumber}>0{index + 1}</span>
                        <h3>{prize.title}</h3>
                        <p>{prize.amount}</p>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>
            </article>
          </section>

          <section className={styles.sponsors} aria-labelledby="sponsors-title">
            <div className={styles.sponsorsHeading}>
              <p className={styles.sectionNumber} aria-hidden>③</p>
              <h2 id="sponsors-title">powered by those who get it.</h2>
            </div>

            <div className={styles.sponsorGrid}>
              <div className={`${styles.sponsorRow} ${styles.sponsorTierOne}`}>
                <a href="https://amplitude.com/" target="_blank" rel="noopener noreferrer" className={styles.sponsorCard} aria-label="Amplitude Analytics">
                  <Image src="/sponsors/amplitude.svg" alt="Amplitude" width={3840} height={800} className={styles.amplitudeLogo} />
                </a>
                <a href="https://www.shopify.com/" target="_blank" rel="noopener noreferrer" className={styles.sponsorCard} aria-label="Shopify">
                  <Image src="/sponsors/shopify.svg" alt="Shopify" width={304} height={87} className={styles.shopifyLogo} />
                </a>
              </div>

              <div className={`${styles.sponsorRow} ${styles.sponsorTierTwo}`}>
                <a href="https://mthm.tech/" target="_blank" rel="noopener noreferrer" className={styles.sponsorCard} aria-label="MathemaTech">
                  <Image src="/sponsors/mathematech-logo.png" alt="MathemaTech" width={2000} height={372} className={styles.mthmLogo} />
                </a>
              </div>

              <div className={`${styles.sponsorRow} ${styles.sponsorTierThree}`}>
                <a href="https://cuthere.app/" target="_blank" rel="noopener noreferrer" className={styles.sponsorCard} aria-label="CU There">
                  <Image src="/sponsors/cu-there.png" alt="CU There" width={1010} height={496} className={styles.cuThereLogo} />
                </a>
                <a href="https://ccss.carleton.ca/" target="_blank" rel="noopener noreferrer" className={styles.sponsorCard} aria-label="Carleton Computer Science Society">
                  <Image src="/sponsors/ccss.png" alt="Carleton Computer Science Society" width={1000} height={204} className={styles.ccssLogo} />
                </a>
              </div>
            </div>
          </section>
        </div>

        <section id="apply" className={styles.application}>
          <div className={styles.applicationIntro}>
            <p className={styles.sectionNumber} aria-hidden>④</p>
            <h2>apply to build.</h2>
            <p>tell us who you are and what gloriously unnecessary thing you want to make. rough ideas are very welcome.</p>
          </div>

          <form className={styles.applicationForm} onSubmit={handleSubmit}>
            <input type="hidden" name="event" value="ottawa-2026" />
            <div className={styles.formGrid}>
              <label className={styles.field} htmlFor="full-name"><span>full name *</span><input id="full-name" name="fullName" type="text" autoComplete="name" required /></label>
              <label className={styles.field} htmlFor="email"><span>email *</span><input id="email" name="email" type="email" autoComplete="email" required /></label>
              <label className={styles.field} htmlFor="affiliation"><span>school / company / side quest *</span><input id="affiliation" name="affiliation" type="text" required /></label>
              <label className={styles.field} htmlFor="resume"><span>resume <span className={styles.optional}>(optional)</span></span><input id="resume" name="resume" type="file" accept=".pdf,.doc,.docx" className={styles.fileInput} /></label>
              <label className={styles.field} htmlFor="linkedin"><span>linkedin *</span><input id="linkedin" name="linkedin" type="url" inputMode="url" placeholder="https://linkedin.com/in/" required /></label>
              <label className={styles.field} htmlFor="other-link"><span>another link <span className={styles.optional}>(optional)</span></span><input id="other-link" name="otherLink" type="url" inputMode="url" placeholder="(portfolio, github, instagram, anything)" /></label>
              <label className={`${styles.field} ${styles.fullField}`} htmlFor="stupidest-thing"><span>what’s the stupidest thing you’ve ever done that completely worked out well? * (400 characters max)</span><textarea id="stupidest-thing" name="stupidestThing" rows={3} maxLength={400} required /></label>
              <label className={`${styles.field} ${styles.fullField}`} htmlFor="coolest-build"><span>coolest thing you’ve ever built (link or short description) * (100 characters max)</span><input id="coolest-build" name="coolestBuild" type="text" maxLength={100} required /></label>
            </div>

            <div className={styles.confirmationGroup}>
              <div className={styles.confirmation}>
                <input id="attending" name="attending" type="checkbox" required />
                <label htmlFor="attending">i can attend this event and consent to the collection and use of my application information as described in the{" "}<Link href="/privacy" target="_blank" rel="noopener noreferrer">privacy policy</Link>. *</label>
              </div>
              <div className={styles.confirmation}>
                <input id="sponsor-opt-in" name="sponsorOptIn" type="checkbox" />
                <label htmlFor="sponsor-opt-in">yes, share my contact and profile details and attached résumé with this event&apos;s sponsors so they can contact me about recruiting or professional opportunities.<span className={styles.optional}> (optional)</span></label>
              </div>
            </div>

            <div className={styles.submitRow}>
              <button type="submit" disabled={submissionState === "submitting"}>{submissionState === "submitting" ? "sending application…" : "send application ↗"}</button>
              <p className={`${styles.submissionStatus} ${submissionState === "error" ? styles.submissionError : ""}`} role="status" aria-live="polite">{submissionMessage}</p>
            </div>
          </form>
        </section>
      </div>

      <footer className={styles.footer}>
        <span>a stupid ideas hackathon community event</span>
        <Link href="/privacy">privacy policy</Link>
      </footer>
    </main>
  );
}
