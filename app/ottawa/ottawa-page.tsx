"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type FocusEvent, type FormEvent } from "react";
import { APP_READY_GATES, markAppReady } from "@/components/shared/app-ready";
import { discordInviteUrl } from "@/site";
import { PrizeIcon, type PrizeIconName } from "./prize-icon";
import styles from "./page.module.css";

const AGENDA = [
  { time: "09:00", label: "doors + breakfast" },
  { time: "10:00", label: "opening nonsense" },
  { time: "10:30", label: "build time" },
  { time: "13:00", label: "food time" },
  { time: "17:30", label: "demoes" },
  { time: "19:00", label: "prizes + goodbye" },
];

type Prize = {
  title: string;
  icon: PrizeIconName;
  amount?: string;
  description?: string;
  sponsor?: { name: string; src: string; width: number; height: number };
};

const MAIN_TRACKS: Prize[] = [
  {
    title: "stupidest metric",
    icon: "metric",
    description: "track something useless",
    sponsor: { name: "Amplitude", src: "/sponsors/amplitude.svg", width: 3840, height: 800 },
  },
  {
    title: "stupidest button",
    icon: "button",
    description: "make something cool happen with a useless button",
  },
  {
    title: "stupidest API",
    icon: "api",
    description: "return stupid data",
  },
  {
    title: "stupidest AI",
    icon: "ai",
    description: "build a stupid AI agent",
    sponsor: { name: "Carleton Computer Science Society", src: "/sponsors/ccss.png", width: 1000, height: 204 },
  },
];

const GENERAL_PRIZES: Prize[] = [
  { title: "stupidest", icon: "trophy", amount: "$500" },
  { title: "stupider", icon: "medal", amount: "$250" },
  { title: "stupid", icon: "ribbon", amount: "$100" },
];

const GOOGLE_CALENDAR_URL =
  "https://calendar.google.com/calendar/render?action=TEMPLATE&text=The%20Stupid%20Ideas%20Hackathon%20Ottawa&dates=20261115T140000Z%2F20261116T000000Z&details=One%20day%20to%20follow%20your%20idea%20all%20the%20way%20through.&location=Bayview%20Yards%2C%207%20Bayview%20Station%20Rd%2C%20Ottawa%2C%20ON%20K1Y%202C5";

const OUTLOOK_CALENDAR_URL = "https://outlook.live.com/calendar/0/deeplink/compose?" + new URLSearchParams({
  path: "/calendar/action/compose",
  rru: "addevent",
  subject: "The Stupid Ideas Hackathon Ottawa",
  startdt: "2026-11-15T14:00:00Z",
  enddt: "2026-11-16T00:00:00Z",
  body: "One day to follow your idea all the way through.",
  location: "Bayview Yards, 7 Bayview Station Rd, Ottawa, ON K1Y 2C5",
});

type SubmissionState = "idle" | "submitting" | "success" | "error";
type ApplicationStep = 1 | 2;
type ApplicationControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type FieldValidation = { status: "valid" | "invalid"; message: string };

const APPLICATION_EXPANSION_DISMISSED_KEY = "ottawa-application-expansion-dismissed";
const APPLICATION_ANIMATION_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

function applicationFrame(bounds: DOMRect, padding: string): Keyframe {
  return {
    left: `${bounds.left}px`,
    top: `${bounds.top}px`,
    width: `${bounds.width}px`,
    height: `${bounds.height}px`,
    padding,
  };
}

const REQUIRED_FIELD_MESSAGES: Record<string, string> = {
  "full-name": "enter your full name.",
  email: "enter your email address.",
  affiliation: "enter your school, company, or side quest.",
  linkedin: "enter your LinkedIn URL.",
  "tshirt-size": "choose a t-shirt size.",
  "dietary-restrictions": "choose a dietary option.",
  "dietary-restrictions-other": "tell us your dietary restrictions.",
  "stupidest-thing": "tell us what happened.",
  "coolest-build": "tell us what you built.",
  attending: "confirm attendance and consent to continue.",
};

function isApplicationControl(target: EventTarget | null): target is ApplicationControl {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
}

function readFieldValidation(field: ApplicationControl): FieldValidation | undefined {
  if (!field.willValidate) return;
  const invalid = (message: string): FieldValidation => ({ status: "invalid", message });
  const missingMessage = REQUIRED_FIELD_MESSAGES[field.id] ?? "complete this field.";

  if (field instanceof HTMLInputElement && field.type === "checkbox") {
    if (!field.checked) return field.required ? invalid(missingMessage) : undefined;
  } else if (!field.value.trim()) {
    return field.required ? invalid(missingMessage) : undefined;
  }

  if (field instanceof HTMLInputElement && field.type === "file") {
    const file = field.files?.[0];
    if (file && !/\.(pdf|doc|docx)$/i.test(file.name)) return invalid("upload a PDF, DOC, or DOCX file.");
    if (file && file.size > 4 * 1024 * 1024) return invalid("choose a file that is 4 MB or smaller.");
  }

  if (field.validity.typeMismatch) {
    return invalid(field instanceof HTMLInputElement && field.type === "email"
      ? "enter a valid email address."
      : "enter a full URL, e.g. https://example.com.");
  }
  if (!field.validity.valid) return invalid("check this field and its character limit.");
  return { status: "valid", message: "" };
}

function FieldError({ id, validation }: { id: string; validation?: FieldValidation }) {
  if (validation?.status !== "invalid") return null;
  return <small id={`${id}-error`} className={styles.fieldError}>{validation.message}</small>;
}

export default function OttawaPage() {
  const [applicationStep, setApplicationStep] = useState<ApplicationStep>(1);
  const [isApplicationExpanded, setIsApplicationExpanded] = useState(false);
  const [dietaryRestriction, setDietaryRestriction] = useState("");
  const [agendaInView, setAgendaInView] = useState(false);
  const [fieldValidation, setFieldValidation] = useState<Record<string, FieldValidation | undefined>>({});
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [submissionMessage, setSubmissionMessage] = useState("");
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const confirmationHeadingRef = useRef<HTMLHeadingElement>(null);
  const applicationRef = useRef<HTMLElement>(null);
  const applicationSlotRef = useRef<HTMLDivElement>(null);
  const applicationReturnFocusRef = useRef<HTMLElement | null>(null);
  const compactApplicationFrameRef = useRef<Keyframe | null>(null);
  const compactFormPaddingRef = useRef("");
  const applicationAnimationsRef = useRef<Animation[]>([]);
  const isApplicationCollapsingRef = useRef(false);
  const hasDismissedExpansionRef = useRef(false);
  const formBodyRef = useRef<HTMLDivElement>(null);
  const agendaTimelineRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (submissionState === "success") confirmationHeadingRef.current?.focus({ preventScroll: true });
  }, [submissionState]);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      APP_READY_GATES.forEach(markAppReady);
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const timeline = agendaTimelineRef.current;
    if (!timeline || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setAgendaInView(true);
      observer.disconnect();
    }, { threshold: 0.15 });

    observer.observe(timeline);
    return () => observer.disconnect();
  }, []);

  const collapseApplication = useCallback(() => {
    const application = applicationRef.current;
    if (!application || isApplicationCollapsingRef.current) return;
    hasDismissedExpansionRef.current = true;
    try {
      sessionStorage.setItem(APPLICATION_EXPANSION_DISMISSED_KEY, "true");
    } catch {
      // Keep the preference for this visit if browser storage is unavailable.
    }

    function finishCollapse() {
      isApplicationCollapsingRef.current = false;
      setIsApplicationExpanded(false);
      requestAnimationFrame(() => {
        const previousControl = applicationReturnFocusRef.current;
        const expandButton = applicationRef.current?.querySelector<HTMLButtonElement>("[data-expand-application]");
        const target = previousControl?.getClientRects().length
          ? previousControl
          : expandButton?.getClientRects().length ? expandButton : stepHeadingRef.current ?? confirmationHeadingRef.current;
        target?.focus({ preventScroll: true });
      });
    }

    const compactBounds = applicationSlotRef.current?.getBoundingClientRect();
    if (!compactBounds || !window.matchMedia("(min-width: 1081px)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finishCollapse();
      return;
    }

    const expandedFrame = applicationFrame(application.getBoundingClientRect(), getComputedStyle(application).padding);
    const form = application.querySelector("form");
    const formPadding = form ? getComputedStyle(form).padding : "";
    const backButton = application.querySelector<HTMLButtonElement>('[data-collapse-application]');
    const backButtonTransform = backButton ? getComputedStyle(backButton).transform : "none";
    applicationAnimationsRef.current.forEach((animation) => animation.cancel());

    isApplicationCollapsingRef.current = true;
    const options = { duration: 360, easing: APPLICATION_ANIMATION_EASING, fill: "forwards" as const };
    const animation = application.animate([expandedFrame, applicationFrame(compactBounds, "0px")], options);
    applicationAnimationsRef.current = [animation];
    if (form) {
      applicationAnimationsRef.current.push(form.animate([{ padding: formPadding }, { padding: compactFormPaddingRef.current }], options));
    }
    if (backButton) {
      applicationAnimationsRef.current.push(backButton.animate([{ transform: backButtonTransform }, { transform: "translateX(-100%)" }], options));
    }
    void animation.finished.then(finishCollapse, () => {});
  }, []);

  useLayoutEffect(() => {
    if (!isApplicationExpanded) return;
    const application = applicationRef.current;
    const compactFrame = compactApplicationFrameRef.current;
    if (!application || !compactFrame || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const options = { duration: 440, easing: APPLICATION_ANIMATION_EASING };
    const expandedFrame = applicationFrame(application.getBoundingClientRect(), getComputedStyle(application).padding);
    applicationAnimationsRef.current = [application.animate([compactFrame, expandedFrame], options)];
    const form = application.querySelector("form");
    if (form) {
      applicationAnimationsRef.current.push(form.animate([{ padding: compactFormPaddingRef.current }, { padding: getComputedStyle(form).padding }], options));
    }
    const backButton = application.querySelector<HTMLButtonElement>('[data-collapse-application]');
    if (backButton) {
      applicationAnimationsRef.current.push(backButton.animate([{ transform: "translateX(-100%)" }, { transform: "translateX(0)" }], options));
    }
    return () => {
      applicationAnimationsRef.current.forEach((animation) => animation.cancel());
      applicationAnimationsRef.current = [];
    };
  }, [isApplicationExpanded]);

  useEffect(() => {
    if (!isApplicationExpanded) return;
    const application = applicationRef.current;
    if (!application) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    if (!application.contains(document.activeElement) || document.activeElement?.hasAttribute("data-expand-application")) {
      stepHeadingRef.current?.focus({ preventScroll: true });
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        collapseApplication();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(application!.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
      )).filter((control) => control.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    }

    const desktop = window.matchMedia("(min-width: 1081px)");
    function handleViewportChange() {
      if (!desktop.matches) collapseApplication();
    }

    document.addEventListener("keydown", handleKeyDown);
    desktop.addEventListener("change", handleViewportChange);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      desktop.removeEventListener("change", handleViewportChange);
    };
  }, [isApplicationExpanded, collapseApplication]);

  function expandApplication() {
    if (isApplicationExpanded || !window.matchMedia("(min-width: 1081px)").matches) return;
    const application = applicationRef.current;
    if (!application) return;
    compactApplicationFrameRef.current = applicationFrame(application.getBoundingClientRect(), "0px");
    const form = application.querySelector("form");
    compactFormPaddingRef.current = form ? getComputedStyle(form).padding : "0px";
    const activeElement = document.activeElement;
    applicationReturnFocusRef.current = activeElement instanceof HTMLElement && applicationRef.current?.contains(activeElement)
      ? activeElement
      : stepHeadingRef.current;
    setIsApplicationExpanded(true);
  }

  function autoExpandApplication() {
    if (hasDismissedExpansionRef.current) return;
    try {
      if (sessionStorage.getItem(APPLICATION_EXPANSION_DISMISSED_KEY) === "true") return;
    } catch {
      // Automatic expansion still works without browser storage.
    }
    expandApplication();
  }

  function goToStep(step: ApplicationStep) {
    setApplicationStep(step);
    setSubmissionMessage("");
    requestAnimationFrame(() => {
      formBodyRef.current?.scrollTo({ top: 0 });
      stepHeadingRef.current?.focus({ preventScroll: true });
    });
  }

  function validationProps(id: string) {
    const validation = fieldValidation[id];
    return {
      "data-validation": validation?.status,
      "aria-invalid": validation?.status === "invalid" ? true : undefined,
      "aria-describedby": validation?.status === "invalid" ? `${id}-error` : undefined,
    };
  }

  function handleFieldBlur(event: FocusEvent<Element>) {
    const field = event.target;
    if (!isApplicationControl(field) || !field.id) return;
    const validation = readFieldValidation(field);
    setFieldValidation((current) => ({ ...current, [field.id]: validation }));
  }

  function handleFieldChange(event: ChangeEvent<Element>) {
    const field = event.target;
    if (!isApplicationControl(field) || !field.id) return;
    const validateImmediately = field instanceof HTMLSelectElement || (field instanceof HTMLInputElement && ["checkbox", "file"].includes(field.type));
    if (!fieldValidation[field.id] && !validateImmediately) return;
    const validation = readFieldValidation(field);
    setFieldValidation((current) => ({ ...current, [field.id]: validation }));
  }

  function validateStep(form: HTMLFormElement, step: ApplicationStep) {
    const fields = form.querySelectorAll<ApplicationControl>(
      `[data-application-step="${step}"] input, [data-application-step="${step}"] select, [data-application-step="${step}"] textarea`,
    );
    const nextValidation: Record<string, FieldValidation | undefined> = {};
    let invalidField: ApplicationControl | undefined;
    for (const field of fields) {
      const validation = readFieldValidation(field);
      nextValidation[field.id] = validation;
      if (!invalidField && validation?.status === "invalid") invalidField = field;
    }
    setFieldValidation((current) => ({ ...current, ...nextValidation }));
    if (!invalidField) return true;

    setApplicationStep(step);
    const firstInvalidField = invalidField;
    requestAnimationFrame(() => firstInvalidField.focus());
    return false;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionState === "submitting") return;

    const form = event.currentTarget;
    if (!validateStep(form, 1)) return;
    if (applicationStep === 1) {
      goToStep(2);
      return;
    }
    if (!validateStep(form, 2)) return;

    setSubmissionState("submitting");
    setSubmissionMessage("");

    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        body: new FormData(form),
      });
      const result = (await response.json().catch(() => null)) as
        | { message?: string; confirmationEmailSent?: boolean }
        | null;

      if (!response.ok) {
        throw new Error(
          result?.message ??
            "We could not submit your application. Please try again.",
        );
      }

      form.reset();
      setDietaryRestriction("");
      setFieldValidation({});
      setSubmissionState("success");
      setSubmissionMessage(result?.confirmationEmailSent === false
        ? "your application is saved, but we couldn’t send your email copy. contact applications@stupideas.com if you need it."
        : "");
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

      <header className={styles.hero} inert={isApplicationExpanded}>
        <Image
          src="/ottawa-illustration.png"
          alt="SpongeBob and Patrick in Carleton gear in front of Ottawa’s Parliament Hill"
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
              <a
                href={OUTLOOK_CALENDAR_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                + outlook calendar
              </a>
              <a href="/ottawa-2026.ics" download>
                + apple calendar
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className={styles.bodyLayout}>
        <div className={styles.leftColumn} inert={isApplicationExpanded}>
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
              <div className={styles.agendaTimelineViewport} role="region" aria-label="event timeline, scroll horizontally" tabIndex={0}>
                <ol ref={agendaTimelineRef} className={styles.agendaList} aria-label="event timeline" data-animated={agendaInView}>
                  {AGENDA.map((item, index) => (
                    <li key={`${item.time}-${item.label}`} style={{ animationDelay: `${index * 120}ms` }}>
                      <time dateTime={`2026-11-15T${item.time}`}>{item.time}</time>
                      <span className={styles.timelineDot} aria-hidden />
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </article>

            <article className={`${styles.paperCard} ${styles.prizesCard}`}>
              <p className={styles.sectionNumber} aria-hidden>②</p>
              <h2>prizes</h2>
              <div className={styles.prizeGroups}>
                <section aria-labelledby="main-tracks-title">
                  <h3 id="main-tracks-title" className={styles.mainTracksHeading}>main tracks <span>(pick one)</span></h3>
                  <ol className={styles.themedPrizeList}>
                    {MAIN_TRACKS.map((prize) => (
                      <li key={prize.title} className={prize.sponsor ? styles.sponsoredPrize : undefined}>
                        <PrizeIcon name={prize.icon} className={styles.prizeIcon} />
                        <div>
                          <h4>{prize.title}</h4>
                          {prize.amount ? <p className={styles.prizeAmount}>{prize.amount}</p> : null}
                          {prize.description ? (
                            <p className={styles.prizeDescription}>{prize.description}</p>
                          ) : null}
                        </div>
                        {prize.sponsor ? (
                          <Image
                            src={prize.sponsor.src}
                            alt={prize.sponsor.name}
                            width={prize.sponsor.width}
                            height={prize.sponsor.height}
                            sizes="(max-width: 720px) 28vw, 120px"
                            className={styles.prizeSponsorLogo}
                          />
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </section>

                <section className={styles.generalTrack} aria-label="general track">
                  <ol className={styles.generalPrizeList}>
                    {GENERAL_PRIZES.map((prize) => (
                      <li key={prize.title}>
                        <PrizeIcon name={prize.icon} className={styles.generalPrizeIcon} />
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
              </div>

              <div className={`${styles.sponsorRow} ${styles.sponsorTierTwo}`}>
                <a href="https://www.shopify.com/" target="_blank" rel="noopener noreferrer" className={styles.sponsorCard} aria-label="Shopify">
                  <Image src="/sponsors/shopify.svg" alt="Shopify" width={304} height={87} className={styles.shopifyLogo} />
                </a>
                <a href="https://mthm.tech/" target="_blank" rel="noopener noreferrer" className={styles.sponsorCard} aria-label="MathemaTech">
                  <Image src="/sponsors/mathematech-logo.png" alt="MathemaTech" width={2000} height={372} className={styles.mthmLogo} />
                </a>
              </div>

              <div className={`${styles.sponsorRow} ${styles.sponsorTierThree}`}>
                <a href="https://anakin.io/" target="_blank" rel="noopener noreferrer" className={styles.sponsorCard} aria-label="Anakin">
                  <Image src="/sponsors/anakin.png" alt="Anakin" width={954} height={312} className={styles.anakinLogo} />
                </a>
                <a href="https://ccss.carleton.ca/" target="_blank" rel="noopener noreferrer" className={styles.sponsorCard} aria-label="Carleton Computer Science Society">
                  <Image src="/sponsors/ccss.png" alt="Carleton Computer Science Society" width={1000} height={204} className={styles.ccssLogo} />
                </a>
                <a href="https://www.investottawa.ca/" target="_blank" rel="noopener noreferrer" className={styles.sponsorCard} aria-label="Invest Ottawa">
                  <Image src="/sponsors/invest-ottawa.svg" alt="Invest Ottawa" width={982} height={351} className={styles.investOttawaLogo} />
                </a>
                <a href="https://cuthere.app/" target="_blank" rel="noopener noreferrer" className={styles.sponsorCard} aria-label="CU There">
                  <Image src="/sponsors/cu-there.png" alt="CU There" width={1010} height={496} className={styles.cuThereLogo} />
                </a>
              </div>
            </div>
          </section>
        </div>

        <div ref={applicationSlotRef} className={styles.applicationSlot}>
        <section
          id="apply"
          ref={applicationRef}
          className={`${styles.application} ${isApplicationExpanded ? styles.applicationExpanded : ""}`}
          role={isApplicationExpanded ? "dialog" : undefined}
          aria-modal={isApplicationExpanded ? true : undefined}
          aria-labelledby="application-title"
        >
          <button type="button" className={styles.collapseApplication} onClick={collapseApplication} aria-label="back to page, collapse application form" data-collapse-application>
            <span aria-hidden>←</span>
            <span>back to page</span>
          </button>
          {submissionState === "success" ? (
            <div className={`${styles.applicationForm} ${styles.applicationSuccess}`} role="status" aria-live="polite">
              <span className={styles.successMark} aria-hidden>✓</span>
              <h2 id="application-title" ref={confirmationHeadingRef} tabIndex={-1}>application received.</h2>
              <p>thanks for applying. we’ll be in touch with an update.</p>
              <p>join our discord to meet the community and get event updates.</p>
              <a className={styles.discordCta} href={discordInviteUrl} target="_blank" rel="noopener noreferrer">
                join our discord <span aria-hidden>↗</span>
              </a>
              {submissionMessage && <p className={styles.receiptNotice}>{submissionMessage}</p>}
            </div>
          ) : (
          <>
          <div className={styles.applicationIntro}>
            <p className={styles.sectionNumber} aria-hidden>④</p>
            <h2 id="application-title">apply to build.</h2>
            <p>
              tell us who you are and what gloriously unnecessary thing you want to make. rough ideas are very welcome.
              <span className={styles.applicationDeadline}>
                applications close <time dateTime="2026-11-02">02 november at midnight</time> EDT.
              </span>
              <span className={styles.applicationContact}>
                questions? email <a href="mailto:stupidideashackathon@gmail.com">stupidideashackathon@gmail.com</a>
              </span>
            </p>
          </div>

          <form id="application-form" className={styles.applicationForm} onClickCapture={autoExpandApplication} onSubmit={handleSubmit} onBlurCapture={handleFieldBlur} onChange={handleFieldChange} noValidate>
            <input type="hidden" name="event" value="ottawa-2026" />
            <div hidden aria-hidden="true">
              <label htmlFor="application-website">leave this empty</label>
              <input id="application-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            <div className={styles.stepHeader}>
              <div className={styles.stepTitleRow}>
                <button type="button" className={styles.expandApplication} onClick={expandApplication} aria-label="expand application form" aria-expanded={isApplicationExpanded} aria-controls="apply" data-expand-application>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                    <path d="M6 2H2v4M10 2h4v4M2 10v4h4M14 10v4h-4" />
                  </svg>
                </button>
                <h3 ref={stepHeadingRef} tabIndex={-1}>
                  {applicationStep === 1 ? "about you." : "your ideas."}
                </h3>
                <span className={styles.stepCount}>step {applicationStep} of 2</span>
              </div>
              <div className={styles.stepProgress} aria-hidden>
                <span className={styles.completedStep} />
                <span className={applicationStep === 2 ? styles.completedStep : undefined} />
              </div>
            </div>

            <div ref={formBodyRef} className={styles.formBody}>
              <fieldset className={`${styles.stepPanel} ${styles.formGrid} ${styles.profileGrid}`} data-application-step="1" hidden={applicationStep !== 1} aria-label="about you">
                <label className={styles.field} htmlFor="full-name"><span>full name *</span><input id="full-name" name="fullName" type="text" autoComplete="name" required {...validationProps("full-name")} /><FieldError id="full-name" validation={fieldValidation["full-name"]} /></label>
                <label className={styles.field} htmlFor="email"><span>email *</span><input id="email" name="email" type="email" autoComplete="email" required {...validationProps("email")} /><FieldError id="email" validation={fieldValidation.email} /></label>
                <label className={`${styles.field} ${styles.fullField}`} htmlFor="affiliation"><span>school / company / side quest *</span><input id="affiliation" name="affiliation" type="text" required {...validationProps("affiliation")} /><FieldError id="affiliation" validation={fieldValidation.affiliation} /></label>
                <div className={`${styles.compactFieldsRow} ${styles.fullField}`}>
                  <label className={styles.field} htmlFor="tshirt-size">
                    <span>t-shirt size *</span>
                    <select id="tshirt-size" name="tshirtSize" defaultValue="" required {...validationProps("tshirt-size")} aria-describedby={fieldValidation["tshirt-size"]?.status === "invalid" ? "tshirt-size-error" : "merch-hint"}>
                      <option value="" disabled>size</option>
                      {["XS", "S", "M", "L", "XL", "2XL", "3XL"].map((size) => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                    <FieldError id="tshirt-size" validation={fieldValidation["tshirt-size"]} />
                    {fieldValidation["tshirt-size"]?.status !== "invalid" && (
                      <small id="merch-hint" className={styles.merchHint}>we might have merch!</small>
                    )}
                  </label>
                  <label className={styles.field} htmlFor="dietary-restrictions">
                    <span>dietary restrictions *</span>
                    <select id="dietary-restrictions" name="dietaryRestrictions" value={dietaryRestriction} onChange={(event) => setDietaryRestriction(event.target.value)} required {...validationProps("dietary-restrictions")}>
                      <option value="" disabled>select</option>
                      {["none", "halal", "vegan", "vegetarian", "other"].map((restriction) => (
                        <option key={restriction} value={restriction}>{restriction}</option>
                      ))}
                    </select>
                    <FieldError id="dietary-restrictions" validation={fieldValidation["dietary-restrictions"]} />
                  </label>
                  <label className={styles.field} htmlFor="resume"><span>resume <span className={styles.optional}>(optional)</span></span><input id="resume" name="resume" type="file" accept=".pdf,.doc,.docx" className={styles.fileInput} {...validationProps("resume")} /><FieldError id="resume" validation={fieldValidation.resume} /></label>
                </div>
                <label className={`${styles.field} ${styles.fullField}`} htmlFor="dietary-restrictions-other" hidden={dietaryRestriction !== "other"}>
                  <span>please specify your dietary restrictions *</span>
                  <input id="dietary-restrictions-other" name="dietaryRestrictionsOther" type="text" maxLength={500} required={dietaryRestriction === "other"} disabled={dietaryRestriction !== "other"} {...validationProps("dietary-restrictions-other")} />
                  <FieldError id="dietary-restrictions-other" validation={fieldValidation["dietary-restrictions-other"]} />
                </label>
                <label className={`${styles.field} ${styles.fullField} ${styles.profileLinkField}`} htmlFor="linkedin"><span>linkedin *</span><input id="linkedin" name="linkedin" type="url" inputMode="url" placeholder="https://linkedin.com/in/" required {...validationProps("linkedin")} /><FieldError id="linkedin" validation={fieldValidation.linkedin} /></label>
                <label className={`${styles.field} ${styles.fullField} ${styles.profileLinkField}`} htmlFor="other-link"><span>another link <span className={styles.optional}>(optional)</span></span><input id="other-link" name="otherLink" type="url" inputMode="url" placeholder="(portfolio, github, instagram, anything)" {...validationProps("other-link")} /><FieldError id="other-link" validation={fieldValidation["other-link"]} /></label>
              </fieldset>

              <fieldset className={styles.stepPanel} data-application-step="2" hidden={applicationStep !== 2} aria-label="your ideas and consent">
                <div className={styles.formGrid}>
                  <label className={`${styles.field} ${styles.fullField}`} htmlFor="stupidest-thing"><span>what’s the stupidest thing you’ve ever done that completely worked out well? * (400 characters max)</span><textarea id="stupidest-thing" name="stupidestThing" rows={3} maxLength={400} required {...validationProps("stupidest-thing")} /><FieldError id="stupidest-thing" validation={fieldValidation["stupidest-thing"]} /></label>
                  <label className={`${styles.field} ${styles.fullField}`} htmlFor="coolest-build"><span>coolest thing you’ve ever built (link or short description) * (100 characters max)</span><input id="coolest-build" name="coolestBuild" type="text" maxLength={100} required {...validationProps("coolest-build")} /><FieldError id="coolest-build" validation={fieldValidation["coolest-build"]} /></label>
                </div>

                <div className={styles.confirmationGroup}>
                  <div className={styles.confirmation}>
                    <input id="attending" name="attending" type="checkbox" required {...validationProps("attending")} />
                    <div className={styles.confirmationCopy}>
                      <label htmlFor="attending">i can attend this event and consent to the collection and use of my application information as described in the{" "}<Link href="/privacy" target="_blank" rel="noopener noreferrer">privacy policy</Link>. *</label>
                      <FieldError id="attending" validation={fieldValidation.attending} />
                    </div>
                  </div>
                  <div className={styles.confirmation}>
                    <input id="sponsor-opt-in" name="sponsorOptIn" type="checkbox" {...validationProps("sponsor-opt-in")} />
                    <label htmlFor="sponsor-opt-in">yes, share my contact and profile details and attached résumé with this event&apos;s sponsors so they can contact me about recruiting or professional opportunities.<span className={styles.optional}> (optional)</span></label>
                  </div>
                </div>
              </fieldset>
            </div>

            <div className={styles.formFooter}>
              <div className={styles.submitRow}>
                {applicationStep === 2 && (
                  <button type="button" className={styles.backButton} disabled={submissionState === "submitting"} onClick={() => goToStep(1)}>← back</button>
                )}
                <button type="submit" disabled={submissionState === "submitting"}>
                  {applicationStep === 1 ? "next: your ideas →" : submissionState === "submitting" ? "sending application…" : "send application ↗"}
                </button>
              </div>
              <p className={`${styles.submissionStatus} ${submissionState === "error" ? styles.submissionError : ""}`} role="status" aria-live="polite">{submissionMessage}</p>
            </div>
          </form>
          </>
          )}
        </section>
        </div>
      </div>

      <footer className={styles.footer} inert={isApplicationExpanded}>
        <span>a stupid ideas hackathon community event</span>
        <Link href="/privacy">privacy policy</Link>
      </footer>
    </main>
  );
}
