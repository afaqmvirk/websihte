export const OTTAWA_EVENT = {
  slug: "ottawa-2026",
  date: "2026-11-15",
  dateLabel: "november 15, 2026",
  venue: "Bayview Yards",
  address: "7 Bayview Station Rd, Ottawa, ON K1Y 2C5",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Bayview+Yards+7+Bayview+Station+Road+Ottawa",
  mapEmbedUrl: "https://maps.google.com/maps?q=Bayview+Yards+7+Bayview+Station+Road+Ottawa&output=embed",
  calendarUrl: "https://www.stupideas.com/ottawa-2026.ics",
} as const;

export const OTTAWA_AGENDA = [
  { time: "09:00", label: "doors + breakfast" },
  { time: "10:00", label: "opening nonsense" },
  { time: "10:30", label: "build time" },
  { time: "13:00", label: "food time" },
  { time: "17:30", label: "demoes" },
  { time: "19:00", label: "prizes + goodbye" },
] as const;
