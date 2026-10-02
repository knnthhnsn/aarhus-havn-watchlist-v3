"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { BrandIcon, type BrandIconName } from "@/components/brand/BrandIcon";
import { PRODUCT_NAME } from "@/lib/brand";
import { DEMO_PROFILES, type DemoProfileId } from "@/lib/demoProfiles";
import type { Locale, Theme } from "@/lib/watchlist";
import { chooseDemoProfile } from "./actions";
import styles from "./login.module.css";

const profileIcons: Record<DemoProfileId, BrandIconName> = { public: "operations", harbor: "harbour", secure: "security" };
const profileCopy = {
  da: {
    public: { title: "Offentlig liste", description: "Åbne anløb, planlagte tider og kajplaceringer." },
    harbor: { title: "Havnevagt", description: "Anløbslisten med havnevagtens arbejdskontekst." },
    secure: { title: "Sikret drift", description: "Samlet visning med de beskyttede anløb." },
  },
  en: {
    public: { title: "Public list", description: "Open port calls, scheduled times and berth assignments." },
    harbor: { title: "Harbour watch", description: "Port calls in the harbour watch workspace." },
    secure: { title: "Protected operations", description: "A combined view including protected port calls." },
  },
};

function OpenWorkspace({ locale }: { locale: Locale }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={styles.primary} disabled={pending} aria-busy={pending}>
    <span>{pending ? (locale === "da" ? "Åbner arbejdsrum…" : "Opening workspace…") : (locale === "da" ? "Åbn arbejdsrum" : "Open workspace")}</span>
    <BrandIcon name={pending ? "followUp" : "arrowRight"} />
  </button>;
}

export default function LoginFlow({ initialProfile = "public" }: { initialProfile?: DemoProfileId }) {
  const [profile, setProfile] = useState<DemoProfileId>(initialProfile);
  const [theme, setTheme] = useState<Theme>("dark");
  const [locale, setLocale] = useState<Locale>("da");
  const [ready, setReady] = useState(false);
  const da = locale === "da";

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const stored = initialProfile === "secure" ? null : JSON.parse(localStorage.getItem(`aarhus-havn-v3.${initialProfile}`) ?? "null");
        const currentTheme = document.documentElement.dataset.theme;
        if (currentTheme === "light" || currentTheme === "dark") setTheme(currentTheme);
        else if (stored?.theme === "light" || stored?.theme === "dark") setTheme(stored.theme);
        if (stored?.locale === "da" || stored?.locale === "en") setLocale(stored.locale);
      } catch { /* The form remains usable when browser storage is unavailable. */ }
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [initialProfile]);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.documentElement.lang = locale;
  }, [theme, locale, ready]);

  function rememberAppearance() {
    try {
      const key = `aarhus-havn-v3.${profile}`;
      if (profile === "secure") {
        localStorage.removeItem(key);
        return;
      }
      const existing = JSON.parse(localStorage.getItem(key) ?? "null");
      localStorage.setItem(key, JSON.stringify({ ...(existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {}), theme, locale }));
    } catch { /* Profile selection is handled by the server even without local storage. */ }
  }

  return <main className={styles.page} data-theme={theme}>
    <header className={styles.topbar}>
      <a className={styles.logo} href="/watchlist" aria-label={da ? "Aarhus Havn — gå til anløbslisten" : "Aarhus Havn — open port calls"}>
        <Image src="/brand/aarhus-havn-wordmark.svg" alt="Aarhus Havn" width={157} height={34} priority />
      </a>
      <div className={styles.preferences}>
        <button className={styles.language} type="button" onClick={() => setLocale(value => value === "da" ? "en" : "da")} aria-label={da ? "Switch to English" : "Skift til dansk"}>{da ? "EN" : "DA"}</button>
        <button className={styles.themeButton} type="button" onClick={() => setTheme(value => value === "dark" ? "light" : "dark")} aria-label={theme === "dark" ? (da ? "Skift til lyst tema" : "Switch to light mode") : (da ? "Skift til mørkt tema" : "Switch to dark mode")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            {theme === "dark" ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></> : <path d="M20.5 13.2A8.5 8.5 0 0 1 10.8 3.5a8.5 8.5 0 1 0 9.7 9.7Z" />}
          </svg>
        </button>
      </div>
    </header>

    <div className={styles.shell}>
      <section className={styles.introduction} aria-labelledby="welcome-title">
        <p className={styles.eyebrow}>{PRODUCT_NAME}</p>
        <h1 id="welcome-title">{da ? <>En havn.<br /><span>Ét overblik.</span></> : <>One port.<br /><span>A clear view.</span></>}</h1>
        <p className={styles.introCopy}>{da ? "Anløb, placeringer og næste opgave. Samlet i dit arbejdsrum." : "Port calls, berth assignments and the next operation. Together in your workspace."}</p>
        <ul className={styles.features} aria-label={da ? "I dit arbejdsrum" : "In your workspace"}>
          <li><BrandIcon name="operations" /><span>{da ? "Anløbslisten" : "Port calls"}</span></li>
          <li><BrandIcon name="map" /><span>{da ? "Havnekortet" : "Harbour map"}</span></li>
          <li><BrandIcon name="note" /><span>{da ? "Noter & opfølgning" : "Notes & follow-up"}</span></li>
        </ul>
        <div className={styles.portIdentity} aria-hidden="true"><BrandIcon name="portCall" /><div><span>AARHUS · DK</span><small>56°09′N · 10°13′E</small></div></div>
      </section>

      <section className={styles.workspacePanel} aria-labelledby="workspace-title">
        <div className={styles.panelHeading}><p className={styles.eyebrow}>{da ? "DIT ARBEJDSRUM" : "YOUR WORKSPACE"}</p><h2 id="workspace-title">{da ? "Klar til næste anløb?" : "Ready for the next call?"}</h2><p>{da ? "Vælg den visning, der passer til din opgave." : "Choose the view that fits your work."}</p></div>
        <form action={chooseDemoProfile} onSubmit={rememberAppearance} className={styles.form}>
          <fieldset className={styles.profiles}>
            <legend>{da ? "Vælg arbejdsrum" : "Choose workspace"}</legend>
            {DEMO_PROFILES.map(item => <label className={styles.profile} key={item.id} data-selected={profile === item.id}>
              <input type="radio" name="profile" value={item.id} checked={profile === item.id} onChange={() => setProfile(item.id)} aria-describedby={`profile-${item.id}-description`} />
              <span className={styles.profileIcon}><BrandIcon name={profileIcons[item.id]} /></span>
              <span className={styles.profileText}><strong>{profileCopy[locale][item.id].title}</strong><span id={`profile-${item.id}-description`}>{profileCopy[locale][item.id].description}</span></span>
              <span className={styles.radioMark} aria-hidden="true">{profile === item.id && <BrandIcon name="check" />}</span>
            </label>)}
          </fieldset>
          <OpenWorkspace locale={locale} />
          <p className={styles.formHint}>{da ? "Du kan skifte arbejdsrum fra din profil i anløbslisten." : "You can switch workspace from your profile in the port-call list."}</p>
        </form>
      </section>
    </div>

    <footer className={styles.footer}><span>Aarhus Havn</span><span>{da ? "Planlæg. Koordinér. Følg op." : "Plan. Coordinate. Follow up."}</span></footer>
  </main>;
}
