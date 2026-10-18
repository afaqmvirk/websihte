import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "privacy policy | the stupid ideas hackathon community",
  description:
    "how the stupid ideas hackathon community collects, uses, shares, and protects personal information.",
};

const PRIVACY_EMAIL = "stupidideashackathon@gmail.com";
const PRIVACY_MAILTO =
  "mailto:stupidideashackathon@gmail.com?subject=privacy%20request";

export default function PrivacyPolicyPage() {
  return (
    <main className={styles.page}>
      <div className={styles.paperTexture} aria-hidden />

      <header className={styles.header}>
        <Link href="/" className={styles.backLink}>
          ← stupid ideas
        </Link>
        <p className={styles.eyebrow}>the not-so-stupid fine print</p>
        <h1>privacy policy.</h1>
        <p className={styles.intro}>
          This policy explains how the Stupid Ideas Hackathon Community
          (&ldquo;SIH,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) handles
          personal information through this website, our event applications,
          mailing lists, Discord bot interactions, and direct emails.
        </p>
        <p className={styles.date}>
          effective and last updated:{" "}
          <time dateTime="2026-10-15">October 15, 2026</time>
        </p>
      </header>

      <div className={styles.content}>
        <aside className={styles.summary} aria-labelledby="quick-read">
          <p className={styles.noteNumber} aria-hidden>
            ①
          </p>
          <h2 id="quick-read">the quick read</h2>
          <ul>
            <li>We do not use cookies, advertising pixels, or website analytics.</li>
            <li>
              When you submit an event form, its fields and uploaded files are
              transmitted to the application processor identified on that form.
              Ottawa applications are stored with Supabase and emailed to you and SIH organizers through Resend.
              A copy is also sent to a private SIH organizer channel on Discord.
            </li>
            <li>
              When you join an event mailing list, we use your email only for
              updates about that event, and you can unsubscribe at any time.
            </li>
            <li>
              We share résumé and contact/profile information with event sponsors
              only when you separately opt in.
            </li>
            <li>You can ask to access, correct, or delete your information.</li>
          </ul>
        </aside>

        <article className={styles.policy}>
          <section>
            <h2>1. who this policy covers</h2>
            <p>
              SIH is responsible for the personal information described here.
              This policy applies to this website, event forms and mailing lists
              operated by SIH, and messages sent directly to us. It does not
              apply to a sponsor, event platform, or other outside website after
              you choose to visit it. The SIH Privacy Lead is the person
              accountable for questions and requests under this policy.
            </p>
          </section>

          <section>
            <h2>2. information we collect</h2>

            <h3>when you visit the website</h3>
            <p>
              We host this website with Vercel. Like most hosting providers,
              Vercel automatically processes limited request and diagnostic
              information needed to deliver and protect the site. This can
              include your IP address, approximate city or country derived from
              it, browser and device information, requested page, date and time,
              referring page, and security or performance records. We may have
              access to some of these operational logs.
            </p>

            <h3>when you submit an event form</h3>
            <p>Depending on the event and form, we may ask for:</p>
            <ul>
              <li>your name and email address;</li>
              <li>school, company, or other affiliation;</li>
              <li>LinkedIn and an optional additional profile or portfolio link;</li>
              <li>your answers to application questions;</li>
              <li>T-shirt size and dietary restrictions;</li>
              <li>event preferences and confirmation that you can attend; and</li>
              <li>
                uploaded files such as an optional résumé, along with your
                consent and sponsor-sharing choices.
              </li>
            </ul>
            <p>
              When you press a form&apos;s submit button, the information and files
              you provided are transmitted through our server to the form,
              application-management, or storage provider selected for that event.
              Before a live form accepts submissions, its notice will identify
              that provider and link to the provider&apos;s privacy information. We
              will also update this policy when a new provider or materially
              different processing arrangement is introduced.
            </p>
            <p>
              For Ottawa applications, we store your answers, consent choices,
              submission time, and email delivery status in a private Supabase
              database, with any uploaded résumé in private Supabase file storage.
              We use Resend to email a copy of your
              answers and any uploaded résumé to the address you provide, with
              a private copy to the SIH organizer inbox. These application emails
              are for event administration and do not subscribe you to a mailing list.
              We also send the application details and any uploaded résumé to a
              private organizer channel on Discord to notify the team of new applications.
            </p>

            <h3>when you mention our Discord bots</h3>
            <p>
              If you mention sih-inator (overlord bob) or overlord rick, we send your question and
              up to 25 recent messages from the same Discord channel or thread,
              plus up to 10 earlier messages from you across server channels the
              bot can access, to OpenAI to generate a reply. This can include
              other participants&apos; messages and both bots&apos; replies.
              The bots can tag each other for a short conversation in that channel,
              and can tag you or people mentioned in the current exchange.
              If you ask for an image, we also send a short image description to
              OpenAI and post the generated image back to Discord. Images are not
              saved in our website database.
              We use temporary speaker labels to distinguish participants. We do
              not include other participants&apos; messages from other channels,
              private application notifications, or attachments in this context.
              We keep message, server, and user IDs, timestamps, reply IDs, and
              delivery status, bot identity, conversation depth, and image usage
              in our private database for duplicate handling and
              usage limits. Metadata older than two days is removed on the next
              request. We also keep a server-level monthly request count until
              the next month. Conversation context is fetched when needed; we do
              not store message, question, or answer text in that database.
            </p>

            <h3>when you email us</h3>
            <p>
              Our host-an-event, sponsor, and community links also open your email
              app. If you send a message, we receive your email address, the
              message, and any other information or files you choose to include.
            </p>

            <h3>when you join a mailing list</h3>
            <p>
              We collect the email address you submit and the event list you
              selected. The form sends this information through our server to
              Resend, our mailing-list provider, which stores the address as a
              contact in the relevant event segment.
            </p>

            <p>
              We do not ask for payment-card details, government identification,
              or precise location through this website.
              Please do not include unnecessary sensitive information in an
              application or email.
            </p>
          </section>

          <section>
            <h2>3. how we use information</h2>
            <p>We use personal information to:</p>
            <ul>
              <li>review applications and select participants;</li>
              <li>
                communicate about application status, event logistics, safety,
                accessibility requests that you choose to raise, and event updates;
              </li>
              <li>plan and administer the event, including catering and any event merch;</li>
              <li>
                send opening announcements and related updates for an event
                mailing list you chose to join;
              </li>
              <li>respond to hosting, sponsorship, and community inquiries;</li>
              <li>operate, troubleshoot, secure, and prevent misuse of the site; and</li>
              <li>meet legal obligations and protect people, rights, and property.</li>
            </ul>
            <p>
              We limit collection, use, and disclosure to purposes a reasonable
              person would consider appropriate in the circumstances. We do not
              use application information for unrelated marketing.
            </p>
          </section>

          <section>
            <h2>4. consent and sponsor sharing</h2>
            <p>
              Joining an event mailing list is optional. You may withdraw your
              consent and stop future messages at any time by using the
              unsubscribe option in an email or contacting us.
            </p>
            <p>
              Information marked required on an event form is needed to review the
              submission or administer participation. You do not have to provide
              fields marked optional, such as an additional link or résumé.
            </p>
            <p>
              Sponsor sharing is a separate, optional opt-in and does not affect
              how we assess your application. If you opt in, we may give the
              sponsors identified for that event your name, email, affiliation,
              LinkedIn or other profile link, and the résumé you uploaded so they
              can review your profile and contact you about recruiting or
              professional opportunities. We do not share your written application
              answers with sponsors for this purpose.
            </p>
            <p>
              You may withdraw this consent by emailing us before we disclose the
              information. Withdrawal cannot reverse a disclosure already made,
              but we will stop new disclosures and can pass your request to a
              sponsor that already received the information.
            </p>
          </section>

          <section>
            <h2>5. who receives information</h2>
            <p>We may disclose personal information to:</p>
            <ul>
              <li>
                SIH organizers who need it to review applications or run the event;
              </li>
              <li>
                service providers that support website hosting, form delivery,
                application management, mailing-list delivery, file storage,
                communications, and security, including Vercel as our website
                host, Supabase for application and file storage, and Resend for
                application emails and mailing-list delivery, and Discord for private
                organizer application notifications, and OpenAI for Discord bot replies;
              </li>
              <li>
                sponsors identified for the relevant event, only for the optional
                sharing described above and only if you opt in; and
              </li>
              <li>
                authorities or other parties when reasonably necessary to comply
                with law, respond to legal process, protect safety, or investigate
                misuse.
              </li>
            </ul>
            <p>
              We do not sell or rent personal information, and we do not share it
              for targeted advertising.
            </p>
          </section>

          <section>
            <h2>6. cookies, analytics, and outside links</h2>
            <p>
              This website currently sets no cookies and contains no advertising
              trackers, pixels, session-replay tools, or website analytics. It
              serves its fonts and images from the site itself.
            </p>
            <p>
              The website links to Google Maps, Devpost event pages, sponsors,
              and other outside websites. We do not send your application to those
              sites. If you choose a link, the destination may receive ordinary
              request information and may use cookies under its own privacy policy.
              This policy does not govern those third parties.
            </p>
            <p>
              If we add a new tracking or cookie-based service, we will update
              this notice and ask for consent where required before using it.
            </p>
          </section>

          <section>
            <h2>7. storage and processing locations</h2>
            <p>
              SIH is based in Ontario, but our hosting, form, application-management,
              storage, and communications providers may process information in
              Canada, the United States, or other countries. Information handled
              outside Ontario may be subject to the laws and lawful access rules
              of those places. Our Ottawa application database and résumé storage
              are hosted in Supabase&apos;s Canada Central region. Email delivery,
              hosting, Discord notifications, and provider support may involve processing elsewhere. See our
              providers&apos; notices for more detail: {" "}
              <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
                Vercel Privacy Notice
              </a>,{" "}
              <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">
                Supabase Privacy Policy
              </a>,{" "}
              <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
                Resend Privacy Policy
              </a>, and{" "}
              <a href="https://discord.com/privacy" target="_blank" rel="noopener noreferrer">
                Discord Privacy Policy
              </a>, and{" "}
              <a href="https://openai.com/policies/privacy-policy/" target="_blank" rel="noopener noreferrer">
                OpenAI Privacy Policy
              </a>.
            </p>
          </section>

          <section>
            <h2>8. how long we keep it</h2>
            <p>
              We keep event submissions and uploaded files only as long as needed
              to review them, run the relevant event, complete necessary follow-up,
              and address legal or safety issues. Unless you are selected for an
              ongoing role, ask us to keep your materials on file, or an ongoing
              legal or safety matter requires them, we delete or de-identify
              application material within 12 months after the relevant event. You
              may request earlier deletion.
            </p>
            <p>
              We keep direct correspondence only while it remains useful for the
              inquiry or relationship. We keep mailing-list information until you
              unsubscribe or the relevant updates are complete, then delete or
              de-identify it according to our provider settings. Hosting records
              are retained under our Vercel settings and Vercel&apos;s applicable
              service terms. Other providers retain information under our
              configuration and their applicable service terms. Sponsors that
              received information with your consent control their own copies
              under their privacy practices and retention requirements.
            </p>
          </section>

          <section>
            <h2>9. how we protect it</h2>
            <p>
              We use safeguards appropriate to the information, including
              encrypted website connections, access controls on organizer accounts,
              and limiting application access to organizers who need it. No email
              or online system is completely secure, so please send only what the
              application asks for.
            </p>
          </section>

          <section>
            <h2>10. your choices and requests</h2>
            <p>
              You may ask what personal information we hold about you, how we
              used or disclosed it, and request access, correction, or deletion.
              You may also withdraw consent for future optional uses. Email our
              Privacy Lead at {" "}
              <a href={PRIVACY_MAILTO}>{PRIVACY_EMAIL}</a>. We may need to verify
              your identity before completing a request, and legal exceptions may
              apply. We aim to respond within 30 days.
            </p>
          </section>

          <section>
            <h2>11. children and younger participants</h2>
            <p>
              Our event forms are intended for participants aged 13 or older.
              Individual events may require permission from a parent or legal
              guardian for participants who have not reached the age of majority;
              those requirements will be stated with the event. If we learn that
              we collected information from a child under 13 without appropriate
              authorization, we will delete it.
            </p>
          </section>

          <section>
            <h2>12. changes to this policy</h2>
            <p>
              We may update this policy when our practices or legal requirements
              change. We will post the new version here and change the date above.
              We will ask for new consent before materially changing how we use or
              disclose information already collected when consent is required.
            </p>
          </section>

          <section>
            <h2>13. contact and complaints</h2>
            <p>
              The SIH Privacy Lead is accountable for this policy. Send questions,
              requests, or complaints to {" "}
              <a href={PRIVACY_MAILTO}>{PRIVACY_EMAIL}</a>. We will investigate and
              explain the outcome. If PIPEDA applies and your concern is not
              resolved, you may contact the {" "}
              <a
                href="https://www.priv.gc.ca/en/report-a-concern/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Office of the Privacy Commissioner of Canada
              </a>.
            </p>
          </section>
        </article>
      </div>

      <footer className={styles.footer}>
        <Link href="/">home</Link>
        <span>© the stupid ideas hackathon community 2026</span>
      </footer>
    </main>
  );
}
