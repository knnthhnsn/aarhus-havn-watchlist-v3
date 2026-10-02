"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { BrandIcon } from "@/components/brand/BrandIcon";
import {
  classifyWarnings, formatBerthCode, formatClock, formatDateTime,
  PROTOTYPE_OPERATIONS_NOW,
  getArrivalOperation, getDepartureOperation, getNextActionableOperation,
  getOperationPlacement, getRelevantBerthAssignments, sameOperationIdentity,
  type CallServiceOrder, type Locale, type PortCall,
  type PortOperation, type TimeKind, type Vessel, type WarningSignal,
} from "@/lib/watchlist";
import {
  lifecycleOperations, operationLabel, operationPrimaryTime, operationState,
  operationStateLabel, operationTimes,
} from "@/components/watchlist/lifecycleData";
import { categoryName, getCallPlacementPresentation, statusNames } from "./display";
import { CraneBadge } from "./CraneBadge";
import { OperationServices } from "./OperationServices";
import { PinButton } from "./PinControl";
import { OperationRegistration } from "./OperationRegistration";
import type { MobileTaskOverride } from "@/lib/mobileTask";
import stateSurface from "./StateSurface.module.css";
import styles from "./CallDetail.module.css";

export type DetailTab = "call" | "timeline" | "vessel" | "crane" | "notes";

export interface CallDetailProps {
  call: PortCall;
  allCalls: readonly PortCall[];
  vessel?: Vessel;
  serviceOrders: readonly CallServiceOrder[];
  locale: Locale;
  now?: string | number;
  initialTab?: DetailTab;
  onClose: () => void;
  onPin: () => void;
  pinned: boolean;
  onAddNote: (text: string) => void;
  onRegister: (operation: PortOperation, value?: MobileTaskOverride) => void;
  onShowMap: () => void;
}

const defaultTabKeys: readonly DetailTab[] = ["call", "timeline", "vessel", "crane", "notes"];

function timeLabel(kind: TimeKind, locale: Locale) {
  if (kind === "live") return "Live ETA";
  return operationStateLabel(kind, locale);
}

function dateLabel(value: string, locale: Locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "da" ? "da-DK" : "en-GB", {
    timeZone: "Europe/Copenhagen", day: "numeric", month: "short", year: "numeric",
  }).format(date);
}

function translateDetail(text: string, locale: Locale): string {
  if (locale === "en") return text;
  const exact: Record<string, string> = {
    "Vessel identity or operational data is incomplete and must be verified.": "Skibsidentitet eller driftsdata er ufuldstændige og skal kontrolleres.",
    "Same-terminal shift; source geometry is mapped to both quay segments.": "Forhaling inden for samme terminal. Placeringen omfatter begge kajafsnit.",
    "Second shift remains within the same terminal and basin.": "Anden forhaling sker inden for samme terminal og bassin.",
    "Administrative holding state; no anchorage marker is shown on the map.": "Administrativ klarstatus. Der vises ingen ankringsposition på kortet.",
    "Administrative readiness state; no anchorage marker is drawn on the map.": "Administrativ klarstatus. Der vises ingen ankringsposition på kortet.",
    "Translated from configurable duty code.": "Assistance er knyttet til den bestilte tjeneste.",
    "Ordered departure occurs before the final assistance operation.": "Bestilt afgang ligger før den sidste assistanceopgave.",
    "Confirm final mooring arrangement with the duty team.": "Bekræft den endelige fortøjningsplan med vagtholdet.",
    "Agent advised that vessel particulars may be updated.": "Agenten har oplyst, at skibsoplysningerne kan blive opdateret.",
    "Port coordinator": "Havnekoordinator", "Operations": "Drift", "Duty officer": "Vagthavende",
    "Arrival": "Ankomst", "Departure": "Afgang", "Anchorage": "Ankring", "Assistance": "Assistance",
  };
  return exact[text] ?? text
    .replace(/Live ETA is (\d+) minutes later than expected\./, "Live ETA er $1 minutter senere end forventet.")
    .replace(/Live ETA is later than the planned departure at ([\d:]+)\./, "Live ETA ligger efter den planlagte afgang kl. $1.")
    .replace(/(.+) is unfinished and overdue since ([\d:]+)\./, (_, task: string, at: string) => `${exact[task] ?? task} er ikke registreret som udført og er overskredet siden kl. ${at}.`)
    .replace(/ bollards /g, " pullerter ").replace(/ overlap /g, " overlapper ").replace(/ at /g, " ved ");
}

function WarningList({ warnings, locale }: { warnings: readonly WarningSignal[]; locale: Locale }) {
  const labels = locale === "da"
    ? { conflict: "Konflikt", overlap: "Kajoverlap", delay: "Forsinkelse", uncertain: "Kontrollér data", overdue: "Overskredet" }
    : { conflict: "Conflict", overlap: "Berth overlap", delay: "Delay", uncertain: "Verify data", overdue: "Overdue" };
  return <ul className={styles.warnings}>{warnings.map((warning, index) => <li key={`${warning.type}-${index}`}>
    <BrandIcon name="attention" /><div><strong>{labels[warning.type]}</strong><p>{translateDetail(warning.message, locale)}</p></div>
  </li>)}</ul>;
}

function noteText(value: string, locale: Locale) {
  if (locale === "en") return value;
  // Translate known source notes only. Operational text entered by a user
  // must never be rewritten by the warning-message translation rules.
  const labels: Record<string, string> = {
    "Confirm final mooring arrangement with the duty team.": "Bekræft den endelige fortøjningsplan med vagtholdet.",
    "Agent advised that vessel particulars may be updated.": "Agenten har oplyst, at skibsoplysningerne kan blive opdateret.",
    "Port coordinator": "Havnekoordinator", "Operations": "Drift", "Duty officer": "Vagthavende",
  };
  return labels[value] ?? value;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt>{label}</dt><dd>{children || "—"}</dd></div>;
}

export function TimeCard({ call, type, operation: suppliedOperation, locale, isNext = false, children }: { call: PortCall; type: PortOperation["type"]; operation?: PortOperation; locale: Locale; isNext?: boolean; children?: ReactNode }) {
  const operation = suppliedOperation ?? (type === "arrival" ? getArrivalOperation(call) : type === "departure" ? getDepartureOperation(call) : undefined);
  const fallback = type === "arrival" ? call.arrivalTimes : type === "departure" ? call.departureTimes : [];
  const times = operationTimes(operation, fallback).filter(time => type === "arrival" || time.kind !== "live");
  const primary = operation?.source === "mobile-override" ? (operation.mobileRegisteredAt ?? operation.at)
    : operation?.state === "actual" && !times.some(time => time.kind === "actual") ? operation.at
    : operationPrimaryTime(operation, fallback);
  const state = operation?.state === "actual" ? "actual" : operationState(operation, fallback);
  const label = operation ? operationLabel(operation, locale, call) : (type === "arrival" ? (locale === "da" ? "Ankomst" : "Arrival") : (locale === "da" ? "Afgang" : "Departure"));
  const reported = call.vesselReportedTimes?.arrival;
  const secondary = [
    ...(type === "arrival" ? [{ kind: "vessel" as const, value: reported }] : []),
    ...(type === "arrival" && state !== "actual" ? times.filter(time => time.kind === "live") : []),
  ];
  return <article className={`${styles.timeCard} ${stateSurface.surface}`} data-operation-id={operation?.id} data-state={state} data-next={isNext || undefined} aria-label={`${label}: ${operationStateLabel(state, locale)}`}>
    <header className={styles.cardHeading}><h4>{label}</h4>
      <span className={styles.primaryStatus} data-primary-status={state}>{operationStateLabel(state, locale)}</span></header>
    <time className={styles.bigTime} dateTime={primary}>{formatClock(primary)}</time>
    <span className={styles.date}>{dateLabel(primary, locale)}</span>
    {secondary.length > 0 && <dl className={styles.timeList}>{secondary.map((time) => <div key={`${time.kind}-${time.value}`} className={stateSurface.surface} data-state={time.kind} data-time-kind={time.kind}>
      <dt>{time.kind === "vessel" ? (locale === "da" ? "Skib" : "Vessel") : timeLabel(time.kind, locale)}</dt>
      <dd>{time.value ? <time dateTime={time.value}>{formatDateTime(time.value, locale, "compact")}</time> : (locale === "da" ? "Ikke oplyst" : "Not provided")}</dd>
    </div>)}</dl>}
    {children}
  </article>;
}

export function CallDetail({ call, allCalls, vessel, serviceOrders, locale, now = PROTOTYPE_OPERATIONS_NOW, initialTab = "call", onClose, onPin, pinned, onAddNote, onRegister, onShowMap }: CallDetailProps) {
  const id = useId();
  const tabKeys = defaultTabKeys.filter(key => key !== "crane" || call.craneStatus !== "none");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const registerRef = useRef<HTMLButtonElement>(null);
  const footerRegisterRef = useRef<HTMLButtonElement>(null);
  const tabRefs = useRef<Partial<Record<DetailTab, HTMLButtonElement>>>({});
  const [tab, setTab] = useState<DetailTab>(initialTab);
  const [note, setNote] = useState("");
  const [noteAdded, setNoteAdded] = useState(false);
  const [confirmation, setConfirmation] = useState<PortOperation | null>(null);
  const da = locale === "da";
  const readOnly = call.visibility === "restricted";
  const tabLabels: Record<DetailTab, string> = { crane: da ? "Kran" : "Crane", call: da ? "Oversigt" : "Overview", timeline: da ? "Tidslinje" : "Timeline", vessel: da ? "Skib" : "Vessel", notes: da ? "Noter" : "Notes" };
  const operations = lifecycleOperations(call, serviceOrders).sort((a, b) => {
    const displayedTime = (operation: PortOperation) => operation.source === "mobile-override" ? (operation.mobileRegisteredAt ?? operation.at) : operationPrimaryTime(operation, operation.type === "arrival" ? call.arrivalTimes : operation.type === "departure" ? call.departureTimes : []);
    return Date.parse(displayedTime(a)) - Date.parse(displayedTime(b)) || a.id.localeCompare(b.id);
  });
  const next = getNextActionableOperation(call, now, serviceOrders);
  const warnings = classifyWarnings(call, allCalls, now, serviceOrders);
  const assignments = getRelevantBerthAssignments(call, now);
  const placementPresentation = getCallPlacementPresentation(call, now);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const y = window.scrollY;
    const body = document.body;
    const previous = { overflow: body.style.overflow, position: body.style.position, top: body.style.top, width: body.style.width };
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.width = "100%";
    if (!dialog.open) dialog.showModal();
    headingRef.current?.focus({ preventScroll: true });
    return () => {
      if (dialog.open) dialog.close();
      Object.assign(body.style, previous);
      window.scrollTo({ top: y, behavior: "instant" });
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);


  function selectTab(value: DetailTab, focus = false) {
    setTab(value);
    setConfirmation(null);
    if (panelRef.current) panelRef.current.scrollTop = 0;
    if (focus) tabRefs.current[value]?.focus();
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, current: DetailTab) {
    const index = tabKeys.indexOf(current);
    let target: DetailTab | undefined;
    if (event.key === "ArrowRight") target = tabKeys[(index + 1) % tabKeys.length];
    if (event.key === "ArrowLeft") target = tabKeys[(index + tabKeys.length - 1) % tabKeys.length];
    if (event.key === "Home") target = tabKeys[0];
    if (event.key === "End") target = tabKeys[tabKeys.length - 1];
    if (target) { event.preventDefault(); selectTab(target, true); }
  }

  function registration(operation: PortOperation, value: MobileTaskOverride) {
    if (readOnly || !confirmation || !operations.some(item => sameOperationIdentity(item, operation))) { setConfirmation(null); return; }
    onRegister(operation, value);
    setConfirmation(null);
    restoreRegistrationFocus();
  }

  function restoreRegistrationFocus() {
    requestAnimationFrame(() => (registerRef.current?.isConnected ? registerRef.current : footerRegisterRef.current)?.focus({ preventScroll: true }));
  }

  function cancelRegistration() {
    setConfirmation(null);
    restoreRegistrationFocus();
  }

  const craneDetails = call.craneStatus !== "none" && <section className={`${styles.section} ${styles.serviceSection}`}><h3>{da ? "Operationer og service" : "Operations and services"}</h3>
            <div className={styles.craneCard} aria-labelledby={`${id}-crane`}>
              <span id={`${id}-crane`}>{da ? "Kran" : "Crane"}</span>
              <span aria-hidden="true">·</span>
              <CraneBadge status={call.craneStatus} locale={locale} label />
            </div>
            <dl className={styles.facts}>{(["requested", "approved", "accepted", "start", "end"] as const).map(key => <Fact key={key} label={(da ? { requested: "Registreret", approved: "Godkendt", accepted: "Accepteret", start: "Kranstart", end: "Kranslut" } : { requested: "Registered", approved: "Approved", accepted: "Accepted", start: "Crane start", end: "Crane end" })[key]}>{call.craneTimes?.[key] ? formatDateTime(call.craneTimes[key]!, locale, "compact") : (da ? "Ikke oplyst" : "Not provided")}</Fact>)}</dl>
          </section>;

  const footer = <><div className={styles.footerTask}><span>{next ? (da ? "Næste opgave" : "Next operation") : (da ? "Callets opgaver" : "Call operations")}</span>
    <strong>{next ? `${operationLabel(next, locale, call)}${tab === "timeline" ? ` · ${formatClock(next.at)}` : ""}` : (da ? "Ingen åbne opgaver" : "No open operations")}</strong></div>
    {operations.length > 0 && !readOnly ? <button ref={footerRegisterRef} className={styles.primary} type="button" onClick={(event) => { registerRef.current = event.currentTarget; setConfirmation(next ?? operations[0]); }}><BrandIcon name="check" />{da ? "Registrér" : "Register"}</button>
      : <button className={styles.secondary} type="button" onClick={onClose}>{da ? "Luk calls" : "Close call"}</button>}</>;

  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-identity`}
    onCancel={(event) => { event.preventDefault(); if (confirmation) cancelRegistration(); else onClose(); }}
    onClick={(event) => { if (event.target !== event.currentTarget) return; const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose(); }}>
    <div className={styles.frame}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <p className={styles.eyebrow} id={`${id}-identity`}>{call.callNumber} <span>·</span> {categoryName(call.category, locale)}</p>
          <h2 ref={headingRef} tabIndex={-1} id={`${id}-title`}>{call.vesselName}</h2>
          <span className={styles.callStatus} data-status={call.status}>{statusNames[locale][call.status]}</span>
        </div>
        <div className={styles.headerActions}><PinButton pinned={pinned} locale={locale} vesselName={call.vesselName} onClick={onPin} />
          <button type="button" className={styles.iconButton} aria-label={da ? "Luk calls" : "Close call"} onClick={onClose}><BrandIcon name="close" /></button></div>
      </header>
      <div className={styles.tabs} role="tablist" aria-label={da ? "Callsdetaljer" : "Call details"}>
        {tabKeys.map((key) => <button type="button" key={key} ref={(element) => { tabRefs.current[key] = element ?? undefined; }} role="tab" id={`${id}-tab-${key}`} aria-controls={`${id}-panel-${key}`} aria-selected={tab === key} tabIndex={tab === key ? 0 : -1} onClick={() => selectTab(key)} onKeyDown={(event) => onTabKey(event, key)}>
          {tabLabels[key]}{key === "notes" && call.notes.length > 0 && <span className={styles.tabCount}>{call.notes.length}</span>}
        </button>)}
      </div>
      {tabKeys.filter((key) => key !== tab).map((key) => <div key={key} hidden role="tabpanel" id={`${id}-panel-${key}`} aria-labelledby={`${id}-tab-${key}`} />)}
      <div ref={panelRef} className={styles.content} role="tabpanel" id={`${id}-panel-${tab}`} aria-labelledby={`${id}-tab-${tab}`} tabIndex={0}>
        {confirmation && !readOnly && <OperationRegistration call={call} operations={operations} initialOperation={confirmation} locale={locale} onSave={registration} onCancel={cancelRegistration} />}
        <div hidden={!!confirmation}>
        {tab === "crane" && craneDetails}
        {tab === "call" && <div className={styles.stack}>
          {warnings.operational.length > 0 && <section aria-label={da ? "Kræver opmærksomhed" : "Needs attention"}><WarningList warnings={warnings.operational} locale={locale} /></section>}
          <button type="button" className={styles.timelineLink} onClick={() => selectTab("timeline", true)}><span>{da ? "Se tider og handlinger" : "View times and operations"}</span><BrandIcon name="arrowRight" /></button>
          <section className={styles.section}>
            <div className={styles.sectionHeading}><h3>{placementPresentation.isStud ? (da ? "Arbejdssted" : "Work location") : (da ? "Kaj & placering" : "Berth & placement")}</h3><button type="button" className={styles.textButton} onClick={onShowMap}><BrandIcon name="map" />{da ? "Vis på kort" : "View on map"}</button></div>
            {placementPresentation.isStud ? <p className={styles.emptyText}><strong>STUD</strong> · {da ? "Assistance uden kajplacering." : "Assistance without a berth placement."}</p> : assignments.length ? <div className={styles.placements}>{assignments.map((assignment, index) => <article key={`${assignment.berth}-${index}`} className={styles.placement}>
              <div><span className={styles.eyebrow}>{assignment.kind === "current" ? (da ? "Nuværende" : "Current") : (index === 0 ? (da ? "Planlagt ankomst" : "Planned arrival") : (da ? "Kommende placering" : "Upcoming placement"))}</span>
                <strong className={styles.berth}>{da ? "Kaj" : "Berth"} {formatBerthCode(assignment.berth)}</strong></div>
              <dl><Fact label={da ? "Pullerter" : "Bollards"}>{assignment.bollardFrom}–{assignment.bollardTo}</Fact><Fact label={da ? "Side" : "Side"}>{assignment.side === "port" ? (da ? "Bagbord" : "Port") : (da ? "Styrbord" : "Starboard")}</Fact></dl>
            </article>)}</div> : <p className={styles.emptyText}>{da ? "Skibet er afgået. Tidligere placeringer vises i tidslinjen." : "The vessel has departed. Previous placements are shown in the timeline."}</p>}
          </section>
          <section className={styles.section}><h3>{da ? "Samarbejdspartnere" : "Partners"}</h3><dl className={styles.facts}>
            <Fact label={da ? "Agent" : "Agent"}>{call.agent}</Fact>
            <Fact label={da ? "Datakvalitet" : "Data quality"}>{call.dataQuality === "verified" ? (da ? "Kontrolleret" : "Verified") : (da ? "Afventer kontrol" : "Needs verification")}</Fact>
          </dl></section>
          {warnings.historical.length > 0 && <details className={styles.history}><summary>{da ? "Tidligere opmærksomhedspunkter" : "Previous attention items"} <span>{warnings.historical.length}</span></summary><WarningList warnings={warnings.historical} locale={locale} /></details>}
        </div>}
        {tab === "timeline" && <section className={styles.stack}>
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>{da ? "Callets forløb" : "Call journey"}</p><h3>{placementPresentation.isStud ? (da ? "Handlinger" : "Actions") : (da ? "Fra ankomst til afgang" : "From arrival to departure")}</h3></div><span className={styles.counter}>{String(operations.length).padStart(2, "0")} <small>{da ? "opgaver" : "operations"}</small></span></div>
          <ol className={styles.timeline}>{operations.map((operation, index) => {
            const placement = getOperationPlacement(operation);
            const isNext = sameOperationIdentity(operation, next);
            return <li key={operation.id} className={styles.event} data-next={isNext}>
              <div className={styles.eventIndex} aria-hidden="true">{String(index + 1).padStart(2, "0")}</div>
              <TimeCard call={call} type={operation.type} operation={operation} locale={locale} isNext={isNext}>
                {isNext && <span className={styles.srOnly}>{da ? "Næste opgave" : "Next operation"}</span>}
                <div className={styles.operationDetails}>
                {operation.workLocation !== "stud" && placement && <p className={styles.eventPlacement}>{da ? "Kaj" : "Berth"} <strong>{formatBerthCode(placement.berth)}</strong><span>·</span>{da ? "Pullerter" : "Bollards"} {placement.bollardFrom}–{placement.bollardTo}<span>·</span>{placement.side === "port" ? (da ? "Bagbord" : "Port") : (da ? "Styrbord" : "Starboard")}</p>}
                <OperationServices operation={operation} locale={locale} />
                {operation.details && <p className={styles.eventDescription}>{translateDetail(operation.details, locale)}</p>}
                </div>
                {!readOnly && <button type="button" className={styles.eventRegister} aria-label={`${operation.state === "actual" ? (da ? "Ret registrering:" : "Edit registration:") : (da ? "Registrér" : "Register")} ${operationLabel(operation, locale, call)}`} onClick={(event) => { registerRef.current = event.currentTarget; setConfirmation(operation); }}><BrandIcon name="check" />{operation.state === "actual" ? (da ? "Ret registrering" : "Edit registration") : (da ? "Registrér" : "Register")}</button>}
              </TimeCard>
            </li>;
          })}</ol>
          {!operations.length && <p className={styles.emptyText}>{da ? "Der er endnu ingen planlagte opgaver på dette call." : "No operations have been scheduled for this call yet."}</p>}
        </section>}
        {tab === "vessel" && <div className={styles.stack}>
          <section className={styles.vesselIdentity}><span className={styles.vesselIcon}><BrandIcon name="portCall" /></span><div><p className={styles.eyebrow}>{vessel?.flag || (da ? "Flag ikke oplyst" : "Flag not provided")}</p><h3>{vessel?.name ?? call.vesselName}</h3><p>{categoryName(vessel?.category ?? call.category, locale)}</p></div></section>
          <section className={styles.section}><h3>{da ? "Skibsoplysninger" : "Vessel particulars"}</h3><dl className={styles.facts}>
            <Fact label="Call">{call.callNumber}</Fact>
            <Fact label="IMO">{vessel?.imo ?? call.imo}</Fact><Fact label={da ? "Kaldesignal" : "Call sign"}>{vessel?.callSign ?? call.callSign}</Fact>
            <Fact label={da ? "Længde overalt" : "Length overall"}>{vessel?.loaMeters ?? call.loaMeters} m</Fact><Fact label={da ? "Bredde" : "Beam"}>{vessel?.beamMeters ?? call.beamMeters} m</Fact>
            <Fact label={da ? "Skibstype" : "Vessel type"}>{categoryName(vessel?.category ?? call.category, locale)}</Fact><Fact label={da ? "Flagstat" : "Flag state"}>{vessel?.flag || (da ? "Ikke oplyst" : "Not provided")}</Fact>
          </dl></section>
          <section className={styles.section}><div className={styles.sectionHeading}><h3>{da ? "Rejse" : "Voyage"}</h3><button className={styles.textButton} type="button" onClick={onShowMap}><BrandIcon name="route" />{da ? "Åbn kort" : "Open map"}</button></div>
            <ol className={styles.route}><li><span>{da ? "Seneste havn" : "Previous port"}</span><strong>{vessel?.lastPort || (da ? "Ikke oplyst" : "Not provided")}</strong></li><li data-current="true"><span>{da ? "Dette calls" : "This call"}</span><strong>Aarhus</strong><small>{call.callNumber}</small></li><li><span>{da ? "Næste havn" : "Next port"}</span><strong>{vessel?.nextPort || (da ? "Ikke oplyst" : "Not provided")}</strong></li></ol>
          </section>
          <section className={styles.section}><h3>{da ? "Kontakt på callet" : "Call contacts"}</h3><dl className={styles.facts}><Fact label="Agent">{vessel?.agent ?? call.agent}</Fact></dl></section>
        </div>}
        {tab === "notes" && <div className={styles.stack}>
          <section className={styles.section}><div className={styles.sectionHeading}><h3>{da ? "Noter til callet" : "Call notes"}</h3><span className={styles.noteCount}>{call.notes.length}</span></div>
            {readOnly ? <p className={styles.emptyText}>{da ? "Noter på beskyttede calls er skrivebeskyttede i denne visning." : "Notes on protected calls are read-only in this view."}</p> : <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); const text = note.trim(); if (!text) return; onAddNote(text); setNote(""); setNoteAdded(true); }}>
              <label htmlFor={`${id}-note`}>{da ? "Tilføj en operationel note" : "Add an operational note"}</label>
              <textarea id={`${id}-note`} value={note} maxLength={2000} rows={3} placeholder={da ? "Hvad skal næste kollega vide?" : "What does the next colleague need to know?"} onChange={(event) => { setNote(event.target.value); setNoteAdded(false); }} aria-describedby={`${id}-note-limit`} />
              <div className={styles.composerActions}><span id={`${id}-note-limit`}>{note.length.toLocaleString(locale)} / {(2000).toLocaleString(locale)}</span><button type="submit" className={styles.primary} disabled={!note.trim()}><BrandIcon name="note" />{da ? "Gem note" : "Save note"}</button></div>
              <p className={styles.noteStatus} role="status">{noteAdded ? (da ? "Noten er gemt." : "Note saved.") : ""}</p>
            </form>}
            {call.notes.length ? <ol className={styles.notes}>{[...call.notes].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map((item) => <li key={item.id}><header><strong>{noteText(item.authorRole, locale)}</strong><time dateTime={item.createdAt}>{formatDateTime(item.createdAt, locale, "compact")}</time></header><p>{noteText(item.text, locale)}</p></li>)}</ol> : <p className={styles.emptyText}>{da ? "Ingen noter endnu. Saml de vigtige detaljer til næste kollega her." : "No notes yet. Keep the important details for the next colleague here."}</p>}
          </section>
          <section className={styles.section}><div className={styles.sectionHeading}><h3>{da ? "Dokumenter" : "Documents"}</h3><span className={styles.eyebrow}>FlexPort</span></div>
            {call.documents.length ? <ul className={styles.documents}>{call.documents.map((document) => <li key={document.id}><BrandIcon name={document.state === "restricted" ? "security" : "note"} /><div><strong>{document.name}</strong><p>{document.state === "restricted" ? (da ? "Adgang gives af den dokumentansvarlige i FlexPort." : "Access is managed by the document owner in FlexPort.") : (da ? "Dokumentet ligger i FlexPort. Åbning kræver en tilsluttet dokumentadgang." : "Stored in FlexPort. Opening requires a connected document access.")}</p></div></li>)}</ul> : <p className={styles.emptyText}>{da ? "Der er ingen dokumenter tilknyttet dette call." : "No documents are attached to this call."}</p>}
          </section>
        </div>}
      </div>
      </div>
      {!confirmation && <footer className={styles.footer}>{footer}</footer>}
    </div>
  </dialog>;
}
