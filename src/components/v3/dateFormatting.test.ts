import { describe, expect, it } from "vitest";
import { formatClock, formatDateTime } from "@/lib/watchlist";
import { shortDate } from "./display";
describe("reused Copenhagen formatters", () => {
  it.each([ ["2026-01-15T23:30:00Z", "00:30", "16-01-2026", "fredag", "Friday"], ["2026-07-15T23:30:00Z", "01:30", "16-07-2026", "torsdag", "Thursday"] ])("keeps winter/summer and date rollover: %s", (at, clock, date, da, en) => {
    expect(formatClock(at)).toBe(clock);
    expect(formatDateTime(at, "da", "compact")).toBe(`${date} · ${clock}`);
    expect(formatDateTime(at, "en", "compact")).toBe(`${date} · ${clock}`);
    expect(formatDateTime(at, "da", "full")).toBe(`${da} ${date} · ${clock}`);
    expect(formatDateTime(at, "en", "full")).toBe(`${en} ${date} · ${clock}`);
    for (const locale of ["da", "en"] as const) expect(shortDate(at, locale)).toBe(new Intl.DateTimeFormat(locale === "da" ? "da-DK" : "en-GB", { timeZone: "Europe/Copenhagen", day: "numeric", month: "short" }).format(new Date(at)));
  });
  it.each(["", "invalid date"])("preserves invalid input: %s", (at) => {
    expect(formatClock(at)).toBe("—");
    for (const locale of ["da", "en"] as const) {
      expect(formatDateTime(at, locale, "compact")).toBe("—");
      expect(shortDate(at, locale)).toBe("—");
    }
  });
});
