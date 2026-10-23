export const OTTAWA_EVENT = {
  slug: "ottawa-2026",
  date: "2026-11-15",
  dateLabel: "november 15, 2026",
  venue: "Bayview Yards",
  address: "7 Bayview Station Rd, Ottawa, ON K1Y 2C5",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Bayview+Yards+7+Bayview+Station+Road+Ottawa",
  mapEmbedUrl: "https://maps.google.com/maps?q=Bayview+Yards+7+Bayview+Station+Road+Ottawa&output=embed",
  calendarUrl: "https://www.stupideas.com/ottawa-2026.ics",
  title: "The Stupid Ideas Hackathon Ottawa",
  startsAt: "2026-11-15T09:30:00-05:00",
  endsAt: "2026-11-15T20:00:00-05:00",
  hoursLabel: "09:30–20:00 EST",
} as const;

export const OTTAWA_AGENDA = [
  { time: "09:30", label: "doors + breakfast" },
  { time: "10:00", label: "opening nonsense" },
  { time: "10:30", label: "build time" },
  { time: "13:00", label: "food time" },
  { time: "17:30", label: "demoes" },
  { time: "19:00", label: "closing ceremonies" },
  { time: "20:00", label: "event ends" },
] as const;

const calendarLocation = `${OTTAWA_EVENT.venue}, ${OTTAWA_EVENT.address}`;
const calendarDescription = "One day to follow your idea all the way through.";
const calendarStart = new Date(OTTAWA_EVENT.startsAt).toISOString();
const calendarEnd = new Date(OTTAWA_EVENT.endsAt).toISOString();
const calendarDates = [calendarStart, calendarEnd].map(date => date.replace(/[-:]/g, "").replace(".000", "")).join("/");

export const OTTAWA_CALENDAR_LINKS = [
  { label: "google calendar", href: `https://calendar.google.com/calendar/r/eventedit?${new URLSearchParams({
    action: "TEMPLATE", text: OTTAWA_EVENT.title, dates: calendarDates,
    stz: "America/Toronto", etz: "America/Toronto", details: calendarDescription, location: calendarLocation,
  })}` },
  { label: "outlook calendar", href: `https://outlook.live.com/calendar/0/deeplink/compose?${new URLSearchParams({
    path: "/calendar/action/compose", rru: "addevent", subject: OTTAWA_EVENT.title,
    startdt: calendarStart, enddt: calendarEnd, allday: "false", body: calendarDescription, location: calendarLocation,
  })}` },
  { label: "apple calendar", href: OTTAWA_EVENT.calendarUrl },
] as const;
