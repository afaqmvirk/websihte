# Privacy policy comparison basis

Reviewed September 22, 2026. The public policy in `app/privacy/page.tsx` is a
site-specific synthesis of the current policies below. It is not copied from a
generic policy generator.

## Policies reviewed

1. [UofTHacks Privacy Policy](https://uofthacks.com/privacypolicy), Toronto —
   last updated January 1, 2026. Used for the overall event-policy structure:
   information supplied in applications, automatically collected information,
   event administration purposes, service-provider and sponsor disclosure,
   retention, security, rights, children, changes, and contact.
2. [Hack the North Privacy and Data Policy](https://2025.hackthenorth.com/privacy),
   Waterloo. Used for its short summary, separation of application data from
   website data, express consent before résumé sharing with sponsors, deletion
   requests, and distinction between personal and aggregate information.
3. [Patry AI Internship Privacy Policy](https://www.patryinc.ai/privacy),
   Kingston — last updated June 8, 2026. Used for the applicant-specific list of
   fields, limited selection and administration purposes, named processors,
   need-to-know reviewer access, twelve-month applicant retention ceiling,
   safeguards, access/correction/withdrawal rights, and cross-border processing.
4. [Canada Hackathons Privacy Policy](https://canadahackathons.com/privacy) —
   last updated August 25, 2026. Used for its code-specific disclosure style:
   explicit statements about cookies and analytics, precise form-submission data
   flow, hosting logs, direct email, outside links, and updating the policy when
   a submission endpoint or provider changes.
5. [Devpost Privacy Policy](https://info.devpost.com/legal/privacy-policy) —
   effective August 10, 2026. Used for the distinction among visitor, profile,
   registration, and submission information, and for disclosing that a form
   operator may receive hackathon registration and submission information.

## Clause mapping and site-specific decisions

| Public policy section | Comparison basis | Site-specific result |
| --- | --- | --- |
| Scope and accountable organization | UofTHacks, Patry, Canada Hackathons | Covers this website, reusable event forms, and direct communications; SIH remains accountable. |
| Information collected | UofTHacks, Patry, Devpost | Lists only fields present in the current reusable application pattern, plus ordinary Vercel request data. |
| Purposes | All five | Limited to selection, event administration, communications, security, and legal/safety needs; application data is excluded from unrelated marketing. |
| Form processor | Patry, Canada Hackathons, Devpost | Submission is proxied through `/api/applications`; the selected processor must be named at the form and in the policy before live collection begins. |
| Mailing-list processor | Canada Hackathons, Resend | Ottawa email signups are proxied through `/api/mailing-list` and stored as contacts in a dedicated Resend segment. |
| Sponsor disclosure | Hack the North, UofTHacks | Separate express opt-in; limited to named event sponsors and defined contact/profile/résumé fields for recruiting or professional opportunities. |
| Cookies and analytics | Canada Hackathons, UofTHacks | The code audit found neither cookies nor analytics, so the policy says neither is used rather than inheriting another event's analytics clauses. |
| Retention | Patry, UofTHacks, Hack the North | Application data is deleted or de-identified within twelve months after the relevant event unless a stated exception applies; earlier deletion can be requested. |
| Security and location | Patry, UofTHacks | Encryption in transit, restricted organizer access, processor safeguards, and possible processing outside Ontario are disclosed without claiming unsupported certifications. |
| Rights and complaints | Patry, Canada Hackathons, UofTHacks | Access, correction, deletion, and withdrawal requests go to the named Privacy Lead; unresolved PIPEDA complaints can go to the OPC. |
| Children | UofTHacks, MLH-linked Ontario event practice | Forms are for participants aged 13 or older; event-specific guardian requirements still apply. |

## Deliberately excluded

The comparison policies contain clauses for Google/Apple login, mobile apps,
analytics, advertising, QR scans, cameras, push notifications, payments, AI
screening, and event photography. Those clauses are not included because the
audited site and stated submission plan do not currently use those features.
The policy must be reviewed before any of them are introduced.
