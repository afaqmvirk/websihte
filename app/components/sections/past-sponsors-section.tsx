import Image from "next/image";
import type { CSSProperties } from "react";
import { PAST_SPONSORS } from "@/lib/past-sponsors";
import styles from "./past-sponsors-section.module.css";

function SponsorList({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <ul className={styles.list} aria-hidden={duplicate || undefined}>
      {PAST_SPONSORS.map((sponsor) => {
        const className = [
          styles.sponsor,
          sponsor.preserveDetail ? styles.preserveDetail : "",
          sponsor.lightArtwork ? styles.lightArtwork : "",
          sponsor.monochromeOnly ? styles.monochromeOnly : "",
        ].filter(Boolean).join(" ");
        const content = (
          <span
            className={styles.artwork}
            style={{ "--sponsor-width": `${sponsor.displayWidth}px` } as CSSProperties}
          >
            <Image
              src={sponsor.monochromeSrc ?? sponsor.src}
              alt={duplicate ? "" : sponsor.name}
              width={sponsor.width}
              height={sponsor.height}
              sizes={`${sponsor.displayWidth}px`}
              className={`${styles.logo} ${styles.monochromeLogo}`}
            />
            <Image
              src={sponsor.src}
              alt=""
              aria-hidden="true"
              fill
              sizes={`${sponsor.displayWidth}px`}
              className={`${styles.logo} ${styles.colorLogo}`}
            />
          </span>
        );

        return (
          <li key={sponsor.name}>
            {sponsor.href ? (
              <a
                href={sponsor.href}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
                tabIndex={duplicate ? -1 : undefined}
              >
                {content}
              </a>
            ) : (
              <div className={className} tabIndex={duplicate ? -1 : 0}>
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function PastSponsorsSection() {
  return (
    <section
      id="past-sponsors"
      aria-labelledby="past-sponsors-title"
      className={styles.section}
    >
      <svg width="0" height="0" aria-hidden="true" className={styles.filters}>
        <defs>
          <filter id="past-sponsors-monochrome" colorInterpolationFilters="sRGB">
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncR type="linear" slope="-1" intercept="1" />
              <feFuncG type="linear" slope="-1" intercept="1" />
              <feFuncB type="linear" slope="-1" intercept="1" />
            </feComponentTransfer>
            {/* Keep transparent pixels clear when reversing dark wordmarks. */}
            <feComposite in2="SourceAlpha" operator="in" />
          </filter>
        </defs>
      </svg>
      <div className={`section-shell ${styles.heading}`}>
        <h2 id="past-sponsors-title">thank you to our past sponsors</h2>
      </div>
      <div id="past-sponsors-scroll" className={styles.viewport}>
        <div className={styles.track}>
          <SponsorList />
          <SponsorList duplicate />
        </div>
      </div>
      <footer className={`section-shell ${styles.copyright}`}>
        © the stupid ideas hackathon community 2026
      </footer>
    </section>
  );
}
