"use client";

import { useEffect, useMemo, useState } from "react";
import { BrandIcon } from "@/components/brand/BrandIcon";
import type { Locale } from "@/lib/watchlist";
import styles from "./VesselSchedule.module.css";

/** Wall clock only: never advances the fixed operational demo snapshot. */
export function CurrentDateTime({ locale }: { locale: Locale }) {
  const [now, setNow] = useState<Date | null>(null);
  const formats = useMemo(() => {
    const language = locale === "da" ? "da-DK" : "en-GB";
    return {
      date: new Intl.DateTimeFormat(language, { timeZone: "Europe/Copenhagen", weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      time: new Intl.DateTimeFormat(language, { timeZone: "Europe/Copenhagen", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
    };
  }, [locale]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      setNow(new Date());
      timer = setTimeout(update, 60_000 - Date.now() % 60_000);
    };
    const resume = () => { if (!document.hidden) update(); };
    update();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", update);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", resume); window.removeEventListener("focus", update); };
  }, []);
  const date = now ? formats.date.format(now) : "—";
  return <div className={styles.shiftDate} aria-label={locale === "da" ? "Aktuel dato og tid i Aarhus" : "Current date and time in Aarhus"}>
    <BrandIcon name="calendar" />
    <time dateTime={now?.toISOString()}>
      {date.charAt(0).toUpperCase() + date.slice(1)}
      <small>{locale === "da" ? "Kl." : "Time"} {now ? formats.time.format(now).replace(".", ":") : "—"} <span>·</span> {locale === "da" ? "Aarhus" : "Aarhus"}</small>
    </time>
  </div>;
}
