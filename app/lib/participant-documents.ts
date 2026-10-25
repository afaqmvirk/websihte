export const CONSENT_VERSION = "ottawa-2026-2026-10-24";
export const ORGANIZER_NAME = "Stupid Ideas Hackathon Community";
export const CONSENT_CONTACT = "applications@stupideas.com";
export const PARENT_FORM_DOWNLOAD = "/forms/sih-ottawa-2026-parent-guardian-consent.pdf";
export const CONSENT_EVENT = "Stupid Ideas Hackathon Ottawa on November 15, 2026 at Bayview Yards, 7 Bayview Station Rd, Ottawa, Ontario";
export const PARENT_DECLARATIONS = [
  "I am at least 18 and am the participant's parent or legal guardian with authority to give this consent. I have read the attached Code of Conduct and Event Policy and Liability Release Waiver, including the risks, negligence release, and limits on waiving a minor's rights. I consent to the participant attending and participating in this event and agree to the parent/guardian provisions in section 6 of the waiver in my own capacity and, only to the extent permitted by law, on the participant's behalf.",
  "I will arrange appropriate travel and pickup, discuss the event rules and risks with the participant, and authorize the emergency assistance described in the waiver within the limits of applicable law. Nothing in this form waives a right of a minor that I cannot lawfully waive.",
  "By signing below, I confirm that this information is accurate and I give this consent voluntarily. If I sign electronically, I intend my electronic signature to be my signature for this form. The signed form and its review record will be retained privately. Contact applications@stupideas.com for a copy or an alternative signing arrangement.",
];

type Document = { title: string; introduction: string; sections: { title: string; paragraphs: string[] }[] };

export const PARTICIPANT_DOCUMENTS = {
  "code-of-conduct": {
    title: "Code of Conduct and Event Policy",
    introduction: `This policy applies to everyone taking part in ${CONSENT_EVENT}, including hackers, organizers, volunteers, mentors, judges, sponsors, and guests. The event is organized by ${ORGANIZER_NAME}.`,
    sections: [
      { title: "Respect and inclusion", paragraphs: [
        "Treat people with respect. Harassment, discrimination, bullying, intimidation, threats, unwanted sexual attention, unwanted physical contact, and abusive or degrading language or imagery are prohibited. Respect people's names, pronouns, boundaries, and requests to stop an interaction.",
        "This applies in the venue, during event activities, in event chats and online spaces, and in communications connected to the event. A joke, project, presentation, or supposedly stupid idea is not an excuse to harm or target someone.",
      ] },
      { title: "Safety and the venue", paragraphs: [
        "Follow reasonable instructions from organizers, venue staff, and emergency personnel. Respect the venue, accessibility routes, equipment, and other people's property. Do not interfere with fire alarms, safety equipment, security systems, or building operations. Return borrowed items when requested.",
        "Use electronics, batteries, tools, prototypes, and demonstrations safely. Ask an organizer before bringing or operating anything hazardous. Do not bring weapons, illegal substances, or anything that creates a safety risk. Do not attend while impaired in a way that puts you or others at risk.",
        "Respect other people's privacy, confidential information, work, accounts, and devices. Do not record or photograph someone who asks you not to. Do not access systems or data without permission.",
      ] },
      { title: "Participants under 18", paragraphs: [
        "If you will be under 18 on November 15, 2026, your parent or legal guardian must complete the event's parent/guardian consent form before check-in. You and your guardian are responsible for arranging safe travel and pickup.",
        "Abuse, exploitation, grooming, coercion, and inappropriate relationships involving a minor are prohibited. Never request, create, or exchange sexual or intimate images involving a minor. Adults should avoid unnecessary private meetings or communications with minors; use appropriate event channels or observable settings where reasonably possible.",
        "Report safeguarding concerns to an organizer promptly. Everyone must follow reasonable safeguarding instructions.",
      ] },
      { title: "Accessibility and support", paragraphs: [
        `Contact ${CONSENT_CONTACT} as early as reasonably possible to discuss accessibility needs, accommodations, dietary concerns, or support. You may also speak to an organizer at the event.`,
      ] },
      { title: "Reporting a concern", paragraphs: [
        `Tell an organizer in person or email ${CONSENT_CONTACT}. You can report something that happened to you or that you witnessed. In an emergency or immediate danger, contact emergency services at 911 and notify an organizer when safe to do so.`,
        "Organizers will handle reports with care and share information only as reasonably needed to respond, protect people, or meet legal obligations. Do not retaliate against someone for raising a concern in good faith.",
      ] },
      { title: "Response and enforcement", paragraphs: [
        "Organizers may ask someone to stop conduct, give a warning, restrict access, remove someone from an activity or the event, or disqualify a submission when reasonably necessary for safety or the integrity of the event. Serious matters may be referred to venue security, emergency services, law enforcement, or another appropriate authority where appropriate or legally required.",
        "Participation means agreeing to follow this policy and reasonable event rules. Required consent forms do not excuse conduct that violates this policy.",
      ] },
    ],
  },
  "liability-waiver": {
    title: "Liability Release Waiver",
    introduction: "THIS DOCUMENT AFFECTS YOUR LEGAL RIGHTS. READ IT CAREFULLY. For adult participants, the release below includes claims for negligence, to the extent permitted by law. It does not release rights or liability that cannot lawfully be waived.",
    sections: [
      { title: "1. Event and parties", paragraphs: [
        `This waiver applies to my attendance and participation in ${CONSENT_EVENT} (the Event), organized by ${ORGANIZER_NAME} (the Community). It covers official programming, building and demonstrations, workshops, meals, competitions, and ceremonies organized or authorized as part of this one-day event. Doors open at 9:30 AM EST and the event ends at 8 PM EST.`,
        "The Released Parties are the Community; the owners and operators of Bayview Yards acting in connection with the Event; and their organizers, volunteers, officers, employees, agents, mentors, judges, facilitators, and authorized sponsor representatives acting in an Event role. No other event organizer, university, or hackathon association is made a party by this waiver.",
      ] },
      { title: "2. Assumption of risk", paragraphs: [
        "I understand that participation involves risks that may result in injury, illness, disability, death, or loss or damage to property or data. These include use of premises, furniture, computers, electrical equipment, batteries, hardware, tools, prototypes, demonstrations and workshops; prolonged computer use, fatigue, stress and dehydration; foodborne illness, allergies and allergen cross-contact; the acts or omissions of other people; and emergencies or other known or unknown event risks.",
        "I will consider my abilities, take reasonable precautions, follow safety instructions, and ask for help when needed. I understand that risks may arise from my conduct, other people's conduct, the premises or equipment, or the negligence of a Released Party. I voluntarily accept the risks associated with participation to the fullest extent permitted by law.",
      ] },
      { title: "3. Adult release of claims", paragraphs: [
        "IF I AM 18 OR OLDER: In consideration of being permitted to participate, I release the Released Parties from claims, demands, actions, damages, losses, expenses and liabilities arising from my attendance or participation, to the fullest extent permitted by law. This includes claims relating to injury, illness, disability or death; loss, theft or damage to property or data; the use or condition of premises or equipment; and negligence or breach of a duty of care by a Released Party, including duties under Ontario's Occupiers' Liability Act to the extent they can lawfully be released.",
        "I understand that this may limit my right to sue even where a Released Party's negligence contributed to my injury or loss. This waiver does not release fraud, wilful misconduct, gross negligence, or any liability or right that applicable law does not allow to be released or waived.",
      ] },
      { title: "4. Responsibilities and property", paragraphs: [
        "I will follow the Code of Conduct and Event Policy and reasonable safety and emergency instructions. I am responsible for securing my belongings, devices and data and for making appropriate backups. I am responsible for property damage to the extent caused by my negligent, reckless or intentional conduct.",
        "In my own capacity, I agree to indemnify the Released Parties against third-party claims and reasonable costs to the extent caused by my negligent, reckless or intentional conduct or material breach of safety rules. This does not apply to the extent a loss was caused by a Released Party's own negligence or other conduct for which that party is legally responsible.",
      ] },
      { title: "5. Emergency assistance", paragraphs: [
        "If event personnel reasonably believe I need help because of illness, injury or an emergency, I authorize them to summon or facilitate first aid, venue assistance, paramedics, 911 or other appropriate emergency assistance and disclose information reasonably necessary for that purpose. This does not authorize treatment or substitute consent beyond what applicable law permits. I remain responsible for personal expenses for which I am legally liable.",
      ] },
      { title: "6. Participants under 18", paragraphs: [
        "MINOR'S ACKNOWLEDGMENT: If I will be under 18 on November 15, 2026, I confirm that I have read this waiver or had it explained in a way I understand. I understand the described risks, want to participate voluntarily, and agree to follow the Code of Conduct, event policies, and safety instructions. My acknowledgment does not replace the required parent or legal guardian consent.",
        "PARENT OR LEGAL GUARDIAN CONSENT: I confirm that I am at least 18 and am this participant's parent or legal guardian with authority to consent. I have read this waiver, understand the risks, and consent to the participant attending and participating in the Event. I will arrange appropriate travel and pickup and authorize the emergency assistance described above for the participant, within the limits of applicable law.",
        "In my own capacity, I release the Released Parties from claims I may have arising from the participant's attendance, to the fullest extent permitted by law. To the extent permitted by law, I agree to the assumption-of-risk and release provisions on the participant's behalf. Nothing in this document releases or waives any right of a minor that a parent or guardian cannot lawfully release or waive.",
      ] },
      { title: "7. Law, severability, and changes", paragraphs: [
        "Ontario law and applicable Canadian law govern this waiver. Proceedings concerning it shall be brought in Ontario, subject to mandatory legal rules. If a provision is unenforceable, it will be limited or severed to the minimum extent necessary and the remaining provisions will continue to apply. A material amendment requires fresh affirmative acceptance of the amended version.",
      ] },
      { title: "8. Acknowledgment and electronic signature", paragraphs: [
        "I confirm that I have read and understand this waiver, including the assumption of risk and release of claims for negligence, and that I agree voluntarily. An adult signs in their own capacity. A minor provides the acknowledgment in section 6 and must also have a parent or legal guardian complete the separate parent form.",
        `By affirmatively accepting the relevant checkboxes and typing my full legal name, I consent to using an electronic signature for this document. The signed version and acceptance time will be retained. I can request a copy or discuss an alternative signing arrangement by emailing ${CONSENT_CONTACT}.`,
      ] },
    ],
  },
  "media-release": {
    title: "Optional Media Release Authorization",
    introduction: `This authorization concerns photos, video, audio, name, likeness, and voice recorded in connection with ${CONSENT_EVENT}. It is optional. Declining does not affect eligibility or participation.`,
    sections: [
      { title: "Permission and purpose", paragraphs: [
        `If I opt in, I grant ${ORGANIZER_NAME} a non-exclusive, royalty-free, worldwide licence to use, reproduce, publish, display, distribute, crop, resize, caption, subtitle and reasonably edit this media to document and promote the event and the Community's hackathon activities, including websites, social media, event communications, news coverage, and historical or educational archives.`,
        "The Community may allow its photographers and other service providers to handle media as reasonably necessary for these purposes, and event sponsors to use authorized media to describe their involvement in this event. This does not authorize unrelated advertising or imply my personal endorsement of a sponsor, product, or service without separate express consent.",
      ] },
      { title: "Limits and ownership", paragraphs: [
        "Media must not materially distort my statements or depiction or falsely attribute statements to me. This permission does not transfer ownership of or give a licence to my projects, source code, inventions, submissions, résumé, or confidential information, except material incidentally visible or audible in authorized media.",
        "I will not receive compensation for authorized uses. No media use is promised. To the extent permitted by law, I release claims arising solely from uses within this authorization; the release does not cover uses outside it, fraud, wilful misconduct, or liability that cannot lawfully be released.",
      ] },
      { title: "Under-18 participants", paragraphs: [
        "For a participant under 18 on the event date, media permission takes effect only when both the participant opts in and their parent or legal guardian separately authorizes it on the parent form. Declining media permission never prevents completion of the required participation forms.",
      ] },
      { title: "Withdrawal and changes", paragraphs: [
        `I may withdraw permission for future uses by emailing ${CONSENT_CONTACT}. The Community will take reasonable steps to stop new uses under its control and notify sponsors to whom it supplied the media. Withdrawal does not undo lawful prior uses or require recalling distributed print, published, or archival material beyond reasonable control.`,
        "This permission remains in effect until withdrawn, subject to applicable law. A material expansion of its purposes or permitted recipients requires additional notice and fresh consent where required by law.",
      ] },
    ],
  },
} satisfies Record<string, Document>;

export type ParticipantDocument = keyof typeof PARTICIPANT_DOCUMENTS;
export const documentHref = (name: ParticipantDocument) => `/portal/documents/${name}`;

export type ConsentAnswer = { isAdult: boolean; signature: string; codeAccepted: true; waiverAccepted: true; mediaConsent: boolean };
export function parseConsent(value: unknown): ConsentAnswer | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.isAdult !== "boolean" || v.codeAccepted !== true || v.waiverAccepted !== true || typeof v.mediaConsent !== "boolean"
    || typeof v.signature !== "string" || v.signature.trim().length < 2 || v.signature.trim().length > 160) return null;
  return { isAdult: v.isAdult, signature: v.signature.trim(), codeAccepted: true, waiverAccepted: true, mediaConsent: v.mediaConsent };
}
