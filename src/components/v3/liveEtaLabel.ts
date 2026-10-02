import { formatClock, type Locale } from "@/lib/watchlist";
import { shortDate } from "./display";

const harborDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit" });

/** Compare complete harbor-local dates, not UTC dates or just day/month. */
export function showLiveEtaDate(live: string, scheduled: string | undefined): boolean {
  if (!Number.isFinite(Date.parse(live))) return false;
  if (!scheduled || !Number.isFinite(Date.parse(scheduled))) return true;
  return harborDate.format(new Date(live)) !== harborDate.format(new Date(scheduled));
}

export function liveEtaLabel(live: string, scheduled: string | undefined, locale: Locale): string {
  const valid = Number.isFinite(Date.parse(live));
  if (!valid) return "Live ETA";
  return `Live ETA ${showLiveEtaDate(live, scheduled) ? `${shortDate(live, locale)} · ` : ""}${formatClock(live)}`;
}
