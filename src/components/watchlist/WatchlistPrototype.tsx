"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type UIEvent } from "react";

import { BrandIcon, type BrandIconName } from "@/components/brand/BrandIcon";
import type { WatchlistSnapshot } from "@/lib/watchlist";
import type { DemoProfile } from "@/lib/demoProfiles";
import { PRODUCT_NAME } from "@/lib/brand";
import { CraneBadge as CurrentCraneBadge } from "@/components/v3/CraneBadge";
import {
  ALL_COLUMNS,
  DEFAULT_FILTERS,
  DEFAULT_SETTINGS,
  MIN_REFRESH_MINUTES,
  PRESET_COLUMNS,
  PROTOTYPE_OPERATIONS_NOW,
  PROTOTYPE_OPERATIONS_HORIZON_HOURS,
  getArrivalOperation,
  getDepartureOperation,
  getDeparturePlacement,
  getRelevantBerthAssignments,
  getNextActionableOperation,
  getOperationPlacement,
  getOperationallyActiveCalls,
  getOperationalWarnings,
  dataAgeMinutes,
  filterPortCalls,
  formatBerthCode,
  formatClock,
  formatDateTime,
  getWarnings,
  liveTime,
  mergeFilters,
  mergeSettings,
  moveColumn,
  moveColumnTo,
  normalizeBerthCode,
  normalizeBerthOptions,
  paginate,
  selectBerthFilter,
  sortPortCalls,
  cycleSort,
  sortKeyForColumn,
  naturalSortDirection,
  SORT_KEYS,
  togglePinnedId,
  visibleColumns,
  type ColumnKey,
  type DataState,
  type Locale,
  type OperationState,
  type PortCallNote,
  type PortCall,
  type PortOperation,
  type PortCallStatus,
  type SortDirection,
  type SortKey,
  type ViewPreset,
  type WatchlistFilters,
  type WatchlistSettings,
} from "@/lib/watchlist";
import { watchlistService } from "@/services/watchlistService";
import {
  mobileTaskKey,
  mobileTaskData,
  mobileTaskOverridesFromOutbox,
  parseMobileTaskAuditLog,
  parseMobileTaskOutbox,
  reconcileMobileTaskAuditLog,
  reconcileMobileTaskOutbox,
  scheduleMobileFeedback,
  settleMobileTaskAuditLog,
  settleMobileTaskOutbox,
  mobileTaskStorageKey,
  undoMobileTask,
  MOBILE_OUTBOX_SETTLE_DELAY_MS,
  MOBILE_TASK_AUDIT_STORAGE_KEY,
  MOBILE_TASK_OUTBOX_STORAGE_KEY,
  MOBILE_UNDO_WINDOW_MS,
  type MobileTaskAuditEntry,
  type MobileTaskOutbox,
  type MobileTaskOverride,
} from "@/lib/mobileTask";

import styles from "./WatchlistPrototype.module.css";
import { BrandedHoverInfo } from "./BrandedHoverInfo";
import { MobileTaskActions } from "./MobileTaskActions";
import {
  LifecycleEvent,
  OptionalEventSummary,
  PlacementLabel,
  lifecycleOperations,
  operationLabel,
  operationPrimaryTime,
  operationStateLabel,
  optionalSummaryOperations,
} from "./lifecycle";

const HarborMap = dynamic(() => import("./HarborMap").then((module) => module.HarborMap), {
  loading: () => <div className={styles.mapLoading} role="status">Loading map</div>,
});

const STORAGE_KEY = "aarhus-havn-watchlist-v2.settings";
const FILTER_STORAGE_KEY = "aarhus-havn-watchlist-v2.filters";
const NOTES_STORAGE_KEY = "aarhus-havn-watchlist-v2.notes";
const STATUSES: PortCallStatus[] = ["expected", "en-route", "arrived", "departed"];
type DetailTab = "call" | "vessel" | "timeline" | "route" | "notes";
type ChooserColumn = Exclude<ColumnKey, "status">;
type MobileUndoAction = {
  key: string;
  entryId: string;
  callId: string;
  operationId: string;
  operationLabel: string;
  state: OperationState;
  previous?: MobileTaskOverride;
  auditId: string;
};

const copy = {
  en: {
    app: PRODUCT_NAME,
    metricsLabel: "Watchlist metrics",
    calls: "Calls", fields: "fields",
    search: "Search call, vessel, berth, event, customer or agent", searchTerm: "Search", removeSearch: "Remove search", filters: "Filters", sort: "Sort",
    columns: "Columns", columnsHelper: "Show, hide and move columns. The order is saved to this profile.", dragColumn: "Drag to reorder", moveUp: "Move up", moveDown: "Move down", refresh: "Refresh", settings: "Settings", close: "Close",
    active: "Active calls", attention: "Needs action", next: "Next job", age: "Data age", filterBerth: "Filter calls by berth", arrival: "Arrival", departure: "Departure", shifting: "Shift", assistance: "Assistance", anchorage: "Anchorage", currentPlacement: "Current placement", nextOptional: "Next optional operation",
    all: "All calls", showing: "Showing", activeFilter: "active filter", activeFilters: "active filters", selected: "selected", noneSelected: "None selected", activeOnly: "Operationally active", currentAndUpcoming: "current and upcoming", clear: "Clear filters", clearAll: "Clear all", noResults: "No port calls match this view.",
    errorTitle: "Data could not be loaded", errorBody: "The data service returned an error. Existing data is not hidden.", retry: "Try again",
    stale: "Data is older than the operational trust threshold. Refresh before acting.",
    loading: "Loading port calls", rows: "Rows", page: "Page", of: "of", previous: "Previous", nextPage: "Next",
    normal: "Normal", compact: "Compact", list: "List", map: "Map", pin: "Pin", unpin: "Unpin",
    portCall: "Port call", vessel: "Vessel", timeline: "Timeline", route: "Route", notes: "Notes & documents",
    profile: "Role preset", theme: "Theme", language: "Language", dateFormat: "Date format",
    refreshInterval: "Refresh interval", auth: "User profile", accessLevel: "Access level", dataScope: "Data scope", signIn: "Switch user", demoLabel: "ACTIVE",
    addNote: "Add note", notePlaceholder: "Write an operational note", saveNote: "Add note", noNotes: "No notes on this call.", notesRestricted: "Restricted-call notes are read-only in this browser. Use the approved secure record workflow.",
    freshnessLabel: "Snapshot", modeLabel: "View mode", attentionShort: "needs attention", nextAction: "Next action", backToList: "Back to list", openDetails: "Open details", detailsShort: "Details",
    mobileTasks: "Mobile tasks", mobileTask: "Task", mobileChooseStatus: "Choose status", mobileSimulationNote: "Swipe right or open the action to set a status.", mobileHaptics: "Sound & haptics", mobileRegister: "Register", mobileEdit: "Edit registration", mobileEditShort: "Edit", mobileClose: "Close", mobileShowMore: "Show more tasks", mobileShowLess: "Show fewer tasks", mobileLiveEta: "Live ETA", mobileRegistered: "Registered", mobileNoTime: "No time", mobilePreparing: "Saving registration…", mobileReady: "No pending changes", mobileSaved: "Registration saved", mobileAutoFilled: "Auto-filled", mobileNext: "Next", mobileUndo: "Undo", mobileAudit: "Recent registrations", mobilePending: "Pending", mobileSent: "Updated", mobileError: "Update failed", mobileReset: "Reset changes", mobileLayoutLabel: "Mobile layout", mobileLayoutCards: "Task cards", mobileLayoutTable: "Compact table", mobileLayoutHint: "Swipe horizontally for more columns", mobilePersistenceWarning: "Changes could not be saved in this browser.", filterBerthSearch: "Search current and upcoming berths", noBerths: "No berths match this search", detailSections: "Port-call detail sections", customer: "Customer", agent: "Agent", callServices: "Call services", dataQuality: "Data quality", none: "None", flexPortAccess: "FlexPort access", integrationRequired: "Restricted", mockAvailable: "Available", noteExistInactive: "No notes available.",
  },
  da: {
    app: PRODUCT_NAME,
    metricsLabel: "Nøgletal",
    calls: "Anløb", fields: "felter",
    search: "Søg anløb, skib, kaj, opgave, kunde eller agent", searchTerm: "Søgestreng", removeSearch: "Fjern søgning", filters: "Filtre", sort: "Sortering",
    columns: "Kolonner", columnsHelper: "Vis, skjul og flyt kolonner. Rækkefølgen gemmes på denne profil.", dragColumn: "Træk for at ændre rækkefølge", moveUp: "Flyt op", moveDown: "Flyt ned", refresh: "Opdater", settings: "Indstillinger", close: "Luk",
    active: "Aktive anløb", attention: "Til handling", next: "Næste opgave", age: "Dataalder", filterBerth: "Filtrér anløb efter kaj", arrival: "Ankomst", departure: "Afgang", shifting: "Forhaling", assistance: "Assistance", anchorage: "Ankring", currentPlacement: "Aktuel placering", nextOptional: "Næste ekstra opgave",
    all: "Alle anløb", showing: "Viser", activeFilter: "aktivt filter", activeFilters: "aktive filtre", selected: "valgt", noneSelected: "Ingen valgt", activeOnly: "Aktive anløb", currentAndUpcoming: "aktuel og kommende", clear: "Ryd filtre", clearAll: "Ryd alle", noResults: "Ingen anløb matcher denne visning.",
    errorTitle: "Data kunne ikke indlæses", errorBody: "Datatjenesten returnerede en fejl. Eksisterende data skjules ikke.", retry: "Prøv igen",
    stale: "Data er ældre end den operationelle tillidsgrænse. Opdater før handling.",
    loading: "Indlæser anløb", rows: "Rækker", page: "Side", of: "af", previous: "Forrige", nextPage: "Næste",
    normal: "Normal", compact: "Kompakt", list: "Liste", map: "Kort", pin: "Fastgør", unpin: "Frigør",
    portCall: "Anløb", vessel: "Skib", timeline: "Tidslinje", route: "Rute", notes: "Noter og dokumenter",
    profile: "Rolleprofil", theme: "Tema", language: "Sprog", dateFormat: "Datoformat",
    refreshInterval: "Opdateringsinterval", auth: "Brugerprofil", accessLevel: "Adgangsniveau", dataScope: "Datagrundlag", signIn: "Skift bruger", demoLabel: "AKTIV",
    addNote: "Tilføj note", notePlaceholder: "Skriv en operationel note", saveNote: "Tilføj note", noNotes: "Ingen noter på dette anløb.", notesRestricted: "Noter på beskyttede anløb er skrivebeskyttede i denne browser. Brug den godkendte sikre postgang.",
    freshnessLabel: "Snapshot", modeLabel: "Visning", attentionShort: "kræver opmærksomhed", nextAction: "Næste handling", backToList: "Tilbage til liste", openDetails: "Åbn detaljer", detailsShort: "Detaljer",
    mobileTasks: "Mobile opgaver", mobileTask: "Opgave", mobileChooseStatus: "Vælg status", mobileSimulationNote: "Stryg mod højre eller åbn handlingen for at vælge status.", mobileHaptics: "Lyd og haptik", mobileRegister: "Registrér", mobileEdit: "Ret registrering", mobileEditShort: "Ret", mobileClose: "Luk", mobileShowMore: "Vis flere opgaver", mobileShowLess: "Vis færre opgaver", mobileLiveEta: "Live ETA", mobileRegistered: "Registreret", mobileNoTime: "Intet tidspunkt", mobilePreparing: "Gemmer registrering…", mobileReady: "Ingen afventende ændringer", mobileSaved: "Registrering gemt", mobileAutoFilled: "Tid udfyldt", mobileNext: "Næste", mobileUndo: "Fortryd", mobileAudit: "Seneste registreringer", mobilePending: "Afventer", mobileSent: "Opdateret", mobileError: "Opdatering mislykkedes", mobileReset: "Nulstil ændringer", mobileLayoutLabel: "Mobillayout", mobileLayoutCards: "Opgavekort", mobileLayoutTable: "Kompakt tabel", mobileLayoutHint: "Stryg vandret for flere kolonner", mobilePersistenceWarning: "Ændringer kunne ikke gemmes i denne browser.", filterBerthSearch: "Søg i aktuelle og kommende kajer", noBerths: "Ingen kajer matcher søgningen", detailSections: "Anløbsdetaljer", customer: "Kunde", agent: "Agent", callServices: "Anløbsservices", dataQuality: "Datakvalitet", none: "Ingen", flexPortAccess: "FlexPort-adgang", integrationRequired: "Begrænset", mockAvailable: "Tilgængeligt", noteExistInactive: "Ingen noter tilgængelige.",
  },
} as const;

const settingsChrome: Record<Locale, {
  density: string;
  dark: string;
  light: string;
  dateFull: string;
  english: string;
  danish: string;
  reset: string;
}> = {
  en: {
    density: "Density", dark: "Dark", light: "Light", dateFull: "Tuesday 30-06-2026", english: "English", danish: "Dansk", reset: "Reset saved preferences",
  },
  da: {
    density: "Tæthed", dark: "Mørk", light: "Lys", dateFull: "tirsdag 30-06-2026", english: "Engelsk", danish: "Dansk", reset: "Nulstil gemte præferencer",
  },
};

function accessProfileLabel(profile: DemoProfile, locale: Locale): string {
  return locale === "da"
    ? { public: "Offentlig adgang", internal: "Intern adgang", restricted: "Beskyttet adgang" }[profile.access]
    : { public: "Public access", internal: "Internal access", restricted: "Protected access" }[profile.access];
}

function accessRecordLabel(profile: DemoProfile, locale: Locale): string {
  const callLabel = locale === "da" ? "anløb" : profile.recordCount === 1 ? "call" : "calls";
  return `${profile.recordCount} ${callLabel}`;
}

const presetLabels: Record<Locale, Record<ViewPreset, string>> = {
  en: { full: "Full", office: "Office", port: "Port", quick: "Quick" },
  da: { full: "Fuld", office: "Kontor", port: "Havn", quick: "Hurtig" },
};

const visiblePresets: readonly ViewPreset[] = ["full", "office", "port"];

const statusLabels: Record<Locale, Record<PortCallStatus, string>> = {
  en: { expected: "Expected", "en-route": "En route", arrived: "Arrived", departed: "Departed" },
  da: { expected: "Forventet", "en-route": "På vej", arrived: "Ankommet", departed: "Afgået" },
};

const columnLabels: Record<Locale, Record<ColumnKey, string>> = {
  en: {
    signal: "Signal", pin: "Pin", callNumber: "Call", imo: "IMO", callSign: "Ksign", crane: "C", vessel: "Vessel",
    status: "Status", eta: "Arrival", etd: "Departure", berth: "Berth", bollards: "P", side: "Side",
    nextJob: "Next", customer: "Customer", agent: "Agent", loa: "LOA", beam: "Beam", category: "Type",
    operations: "Ops", notes: "Notes",
  },
  da: {
    signal: "Signal", pin: "Pin", callNumber: "Anløb", imo: "IMO", callSign: "Ksign", crane: "Kran", vessel: "Skib",
    status: "Status", eta: "Ankomst", etd: "Afgang", berth: "Kaj", bollards: "P", side: "Side",
    nextJob: "Næste", customer: "Kunde", agent: "Agent", loa: "LOA", beam: "Bredde", category: "Type",
    operations: "Ops", notes: "Noter",
  },
};

type HeaderGroup = "identity" | "timing" | "placement" | "dimensions" | "workflow" | "stakeholders" | "operations";
const columnGroups: Record<ColumnKey, HeaderGroup> = {
  signal: "identity", pin: "identity", callNumber: "identity", imo: "identity", callSign: "identity", crane: "identity", vessel: "identity", status: "identity",
  eta: "timing", etd: "timing", berth: "placement", bollards: "placement", side: "placement",
  nextJob: "workflow", customer: "stakeholders", agent: "stakeholders", loa: "dimensions", beam: "dimensions", category: "identity", operations: "operations", notes: "operations",
};
const headerGroupLabels: Record<Locale, Record<HeaderGroup, string>> = {
  en: { identity: "Call identity", timing: "Arrival & departure", placement: "Berth & placement", dimensions: "Vessel dimensions", workflow: "Workflow", stakeholders: "Stakeholders", operations: "Optional operations" },
  da: { identity: "Anløb & skib", timing: "Ankomst & afgang", placement: "Kaj & placering", dimensions: "Skibsmål", workflow: "Drift", stakeholders: "Parter", operations: "Ekstra drift" },
};

type HeaderRun = { group: HeaderGroup; columns: ColumnKey[] };
function getHeaderRuns(columns: readonly ColumnKey[]): HeaderRun[] {
  return columns.reduce<HeaderRun[]>((runs, column) => {
    const group = columnGroups[column];
    const lastRun = runs[runs.length - 1];
    if (lastRun?.group === group) {
      lastRun.columns.push(column);
    } else {
      runs.push({ group, columns: [column] });
    }
    return runs;
  }, []);
}

const sortLabels: Record<Locale, Record<SortKey, string>> = {
  en: { signal: "Signals", pin: "Pinned", "call-number": "Call number", "job-order": "Next job", imo: "IMO", "call-sign": "Call sign", crane: "Crane", vessel: "Vessel", status: "Status", eta: "Arrival", etd: "Departure", berth: "Berth", bollards: "Bollards", side: "Side", operations: "Operations", customer: "Customer", agent: "Agent", loa: "LOA", beam: "Beam", category: "Type", notes: "Notes" },
  da: { signal: "Signaler", pin: "Fastgjort", "call-number": "Anløbsnummer", "job-order": "Næste opgave", imo: "IMO", "call-sign": "Kaldsignal", crane: "Kran", vessel: "Skib", status: "Status", eta: "Ankomst", etd: "Afgang", berth: "Kaj", bollards: "Pullerter", side: "Side", operations: "Ekstra drift", customer: "Kunde", agent: "Agent", loa: "LOA", beam: "Bredde", category: "Type", notes: "Noter" },
};

function sortDirectionWord(locale: Locale, direction: SortDirection): string {
  if (locale === "da") return direction === "asc" ? "stigende" : "faldende";
  return direction === "asc" ? "ascending" : "descending";
}

function sortHeaderActionLabel(locale: Locale, label: string, key: SortKey, currentDirection: SortDirection, activeKey: SortKey | null): string {
  const natural = naturalSortDirection(key);
  const direction = sortDirectionWord(locale, natural);
  if (key !== activeKey) return locale === "da" ? `Sortér ${label} ${direction}` : `Sort ${label} ${direction}`;
  const activeDirection = sortDirectionWord(locale, currentDirection);
  if (currentDirection === natural) {
    return locale === "da"
      ? `${label}, sorteret ${activeDirection}. Klik for ${sortDirectionWord(locale, natural === "asc" ? "desc" : "asc")}.`
      : `${label}, sorted ${activeDirection}. Click for ${sortDirectionWord(locale, natural === "asc" ? "desc" : "asc")}.`;
  }
  return locale === "da"
    ? `${label}, sorteret ${activeDirection}. Klik for at nulstille til standard: Næste opgave stigende.`
    : `${label}, sorted ${activeDirection}. Click to reset to default: Next job ascending.`;
}

function CompactOperationsIndicator({ call, operations, settings, onOpenDetail }: { call: PortCall; operations: readonly PortOperation[]; settings: WatchlistSettings; onOpenDetail: () => void }) {
  const first = operations[0];
  if (!first) return null;
  const count = operations.length;
  const operationName = operationLabel(first, settings.locale, call);
  const time = operationPrimaryTime(first);
  const state = operationStateLabel(first.state, settings.locale);
  const countLabel = settings.locale === "da" ? `${count} ekstra ${count === 1 ? "opgave" : "opgaver"} på ${call.vesselName}` : `${count} optional ${count === 1 ? "operation" : "operations"} on ${call.vesselName}`;
  const summary = [countLabel, operationName, state, time ? formatClock(time) : ""].filter(Boolean).join(" · ");
  return <button type="button" className={styles.exceptionIndicator} data-state={first.state} data-hover-info={summary} data-hover-label={settings.locale === "da" ? "Ekstra drift" : "Extra operations"} data-hover-tone={first.state === "expected" ? "warning" : "action"} onClick={onOpenDetail} aria-label={summary}><BrandIcon name="operations" /><strong>{count}</strong><small>OPS</small></button>;
}

function NotesCell({ call, notes, settings, onOpenDetail }: { call: PortCall; notes: readonly PortCallNote[]; settings: WatchlistSettings; onOpenDetail: () => void }) {
  const count = notes.length;
  if (!count) return null;
  const noteNoun = settings.locale === "da" ? (count === 1 ? "note" : "noter") : (count === 1 ? "note" : "notes");
  const countLabel = settings.locale === "da" ? `${count} ${count === 1 ? "note" : "noter"} på ${call.vesselName}` : `${count} ${count === 1 ? "note" : "notes"} on ${call.vesselName}`;
  const preview = notes[0]?.text.trim();
  const label = preview ? `${countLabel} · ${preview}` : countLabel;
  if (settings.density === "compact") return <button type="button" className={styles.noteIndicator} data-hover-info={label} data-hover-label={settings.locale === "da" ? "Noter" : "Notes"} data-hover-tone="action" onClick={onOpenDetail} aria-label={label}><BrandIcon name="note" /><strong>{count}</strong></button>;
  return <button type="button" className={styles.noteButton} data-hover-info={label} data-hover-label={settings.locale === "da" ? "Noter" : "Notes"} data-hover-tone="action" onClick={onOpenDetail} aria-label={label}>
    <span className={styles.noteButtonIcon} aria-hidden="true"><BrandIcon name="note" /></span>
    <span className={styles.noteButtonCount}><strong>{count}</strong><small>{noteNoun}</small></span>
    <span className={styles.noteButtonSource}>FlexPort</span>
  </button>;
}

function Overlay({ title, onClose, children, wide = false, closeLabel = "Close" }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; closeLabel?: string }) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeHandlerRef = useRef(onClose);
  useEffect(() => {
    closeHandlerRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previousActiveElement = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeHandlerRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    window.requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousActiveElement?.isConnected) window.requestAnimationFrame(() => previousActiveElement.focus());
    };
  }, []);
  return (
    <div className={styles.overlay} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className={`${styles.dialog} ${wide ? styles.dialogWide : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className={styles.dialogHeader}><h2>{title}</h2><button ref={closeRef} className={styles.iconButton} data-hover-info="" data-hover-tone="action" onClick={onClose} aria-label={closeLabel}><BrandIcon name="close" /></button></header>
        <div className={styles.dialogBody}>{children}</div>
      </section>
    </div>
  );
}

function StatusBadge({ status, locale, compact = false }: { status: PortCallStatus; locale: Locale; compact?: boolean }) {
  const statusIcons: Record<PortCallStatus, BrandIconName> = { expected: "calendar", "en-route": "arrowUpRight", arrived: "portCall", departed: "check" };
  const label = statusLabels[locale][status];
  return <span className={`${styles.status} ${styles[`status_${status}`]} ${compact ? styles.statusCompact : ""}`} role={compact ? "img" : undefined} aria-label={compact ? label : undefined} data-hover-info={label} data-hover-label={locale === "da" ? "Status" : "Status"}><span aria-hidden="true" className={styles.statusIcon}><BrandIcon name={statusIcons[status]} /></span><span className={compact ? styles.visuallyHidden : undefined}>{label}</span></span>;
}

function VisibilityBadge({ call, locale }: { call: PortCall; locale: Locale }) {
  if (call.visibility !== "restricted") return null;
  const label = locale === "da" ? "BESKYTTET" : "RESTRICTED";
  return <span className={styles.visibilityBadge} data-hover-info={locale === "da" ? "Kun synlig for brugere med den nødvendige adgang." : "Visible only to users with the required access."} data-hover-label={locale === "da" ? "Begrænset adgang" : "Restricted access"} data-hover-tone="restricted"><BrandIcon name="access" />{label}</span>;
}

function warningTypeLabel(locale: Locale, type: string): string {
  if (locale === "da") return ({ delay: "Forsinkelse", overlap: "Overlap", conflict: "Konflikt", uncertain: "Usikker data", overdue: "Forfalden" } as Record<string, string>)[type] ?? type;
  return ({ delay: "Delay", overlap: "Overlap", conflict: "Conflict", uncertain: "Uncertain data", overdue: "Overdue" } as Record<string, string>)[type] ?? type;
}

function warningMessage(locale: Locale, type: string, message: string): string {
  if (locale !== "da") return message;
  const delay = message.match(/^Live ETA is (\d+) minutes later than expected\.$/i);
  if (delay) return `Live ETA er ${delay[1]} minutter senere end forventet.`;
  const departure = message.match(/^Live ETA is later than the planned departure at (.+)\.$/i);
  if (departure) return `Live ETA er senere end den planlagte afgang kl. ${departure[1]}.`;
  const overlap = message.match(/^(.+?) bollards (\d+)-(\d+) overlap (.+?) at (.+?) bollards (\d+)-(\d+)\.$/i);
  if (overlap) return `Kaj ${overlap[1]}, pullerter ${overlap[2]}-${overlap[3]} overlapper ${overlap[4]} ved kaj ${overlap[5]}, pullerter ${overlap[6]}-${overlap[7]}.`;
  const overdue = message.match(/^(.+?) is unfinished and overdue since (.+)\.$/i);
  if (overdue) {
    const operation = overdue[1].toLowerCase() === "holding readiness" ? "Ankringsklarering" : overdue[1];
    return `${operation} er ikke afsluttet. Fristen var kl. ${overdue[2]}.`;
  }
  if (/^Ordered departure occurs before the final assistance operation\.$/i.test(message)) return "Bestilt afgang ligger før den sidste assistanceopgave.";
  if (/^Vessel identity or operational data is incomplete and must be verified\.$/i.test(message)) return "Skibsidentitet eller operationelle data er ufuldstændige og skal verificeres.";
  return message;
}

function dataQualityLabel(locale: Locale, value: PortCall["dataQuality"]): string {
  if (locale === "da") return value === "verified" ? "Verificeret" : "Usikker";
  return value === "verified" ? "Verified" : "Uncertain";
}

function operationDetailText(locale: Locale, details: string): string {
  if (locale !== "da") return details;
  return ({
    "Same-terminal shift; source geometry is mapped to both quay segments.": "Forhalingen sker inden for samme terminal; kajgeometrien er knyttet til begge kajafsnit.",
    "Second shift remains within the same terminal and basin.": "Anden forhaling foregår fortsat inden for samme terminal og bassin.",
    "Translated from configurable duty code.": "Oprettet fra den konfigurerede tjenestekode.",
    "Administrative readiness state; no anchorage marker is drawn on the map.": "Administrativ klarstatus; der vises ingen ankringsmarkør på kortet.",
  } as Record<string, string>)[details] ?? details;
}

function CraneBadge({ status, locale = "en" }: { status: PortCall["craneStatus"]; locale?: Locale }) {
  return <CurrentCraneBadge status={status} locale={locale} />;
}

function DetailPanel({ call, snapshot, settings, initialTab, onClose, notes, onAddNote, onSelectBerth, now }: { call: PortCall; snapshot: WatchlistSnapshot; settings: WatchlistSettings; initialTab: DetailTab; onClose: () => void; notes: readonly PortCallNote[]; onAddNote: (text: string) => void; onSelectBerth: (berth: string) => void; now: string | number }) {
  const [tab, setTab] = useState<DetailTab>(initialTab);
  const [draftNote, setDraftNote] = useState("");
  const vessel = snapshot.vessels.find((item) => item.id === call.vesselId)!;
  const tracking = snapshot.tracking.find((item) => item.vesselId === call.vesselId);
  const orders = snapshot.serviceOrders.filter((order) => call.serviceOrderIds.includes(order.id));
  const warnings = getWarnings(call, snapshot.calls, now, orders);
  const next = getNextActionableOperation(call, now, orders);
  const arrival = getArrivalOperation(call);
  const departure = getDepartureOperation(call);
  const liveArrival = liveTime(call.arrivalTimes);
  const placement = displayPlacement(call, now);
  const berthInteraction = berthFilterInteraction(call, now, onSelectBerth);
  const timelineOperations = lifecycleOperations(call, orders);
  const t = copy[settings.locale];
  return (
    <Overlay title={`${call.callNumber} · ${call.vesselName}`} onClose={onClose} closeLabel={settings.locale === "da" ? "Luk" : "Close"} wide>
      {call.visibility === "restricted" && <div className={styles.detailVisibility} role="status"><VisibilityBadge call={call} locale={settings.locale} /> <span>{settings.locale === "da" ? "Kun for godkendte brugere" : "Approved users only"}</span></div>}
      <nav className={styles.detailTabs} aria-label={t.detailSections} role="tablist">
        {([['call', t.portCall], ['vessel', t.vessel], ['timeline', t.timeline], ['route', t.route], ['notes', t.notes]] as const).map(([key, label]) => (
          <button key={key} id={`detail-tab-${key}`} role="tab" aria-selected={tab === key} aria-controls={`detail-panel-${key}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </nav>
      {warnings.length > 0 && <div className={styles.warningList} role="status" aria-label={settings.locale === "da" ? "Operationelle advarsler" : "Operational warnings"}>{warnings.map((warning) => <article className={styles.warningNotice} data-warning-type={warning.type} key={`${warning.type}-${warning.message}`}><span className={styles.warningNoticeIcon}><BrandIcon name="attention" /></span><span className={styles.warningNoticeCopy}><strong><i aria-hidden="true" />{warningTypeLabel(settings.locale, warning.type)}</strong><span>{warningMessage(settings.locale, warning.type, warning.message)}</span></span></article>)}</div>}
      {tab === "call" && <div id="detail-panel-call" role="tabpanel" aria-labelledby="detail-tab-call">
        <div className={styles.detailLifecycle} aria-label={settings.locale === "da" ? "Ankomst og afgang" : "Arrival and departure"}>
          <LifecycleEvent call={call} operation={arrival} label={settings.locale === "da" ? "Ankomst" : "Arrival"} settings={settings} onSelectBerth={berthInteraction.onSelectBerth} isBerthFilterable={berthInteraction.isBerthFilterable} onOpenDetail={() => setTab("timeline")} />
          <LifecycleEvent call={call} operation={departure} label={settings.locale === "da" ? "Afgang" : "Departure"} settings={settings} onSelectBerth={berthInteraction.onSelectBerth} isBerthFilterable={berthInteraction.isBerthFilterable} onOpenDetail={() => setTab("timeline")} />
        </div>
        <dl className={`${styles.detailGrid} ${styles.callDetailGrid}`}>
        <Info className={styles.infoWide} label={settings.locale === "da" ? "Aktuel kaj / pullerter" : "Current berth / bollards"}><PlacementLabel call={{ ...call, berth: placement.berth, bollardFrom: placement.bollardFrom, bollardTo: placement.bollardTo, side: placement.side }} locale={settings.locale} onSelectBerth={berthInteraction.onSelectBerth} filterable={berthInteraction.isBerthFilterable?.(placement.berth)} /></Info>
        <Info label={settings.locale === "da" ? "Side" : "Side"}>{placement.side === "port" ? (settings.locale === "da" ? "Bagbord" : "Port") : (settings.locale === "da" ? "Styrbord" : "Starboard")}</Info>
        <Info label={columnLabels[settings.locale].crane}><CraneBadge status={call.craneStatus} locale={settings.locale} /></Info>
        <Info className={styles.infoWide} label={settings.locale === "da" ? "Næste opgave" : "Next job"}>{next ? `${formatDateTime(next.at, settings.locale, settings.dateFormat)} · ${operationLabel(next, settings.locale, call)}${getOperationPlacement(next)?.berth ? ` · ${formatBerthCode(getOperationPlacement(next)!.berth)}` : ""}` : "—"}</Info>
        <Info label={t.customer}>{call.customer}</Info><Info label={t.agent}>{call.agent}</Info>
        <Info className={styles.infoWide} label={t.callServices}>{orders.length ? orders.map((order) => `${order.displayText} (${order.dutyCode})`).join(", ") : t.none}</Info>
        <Info className={styles.infoWide} label={t.dataQuality}>{dataQualityLabel(settings.locale, call.dataQuality)}</Info>
        </dl>
      </div>}
      {tab === "vessel" && <div id="detail-panel-vessel" role="tabpanel" aria-labelledby="detail-tab-vessel"><dl className={`${styles.detailGrid} ${styles.vesselDetailGrid}`}>
        <Info label={t.vessel}>{vessel?.name ?? call.vesselName}</Info><Info label="IMO">{vessel?.imo ?? call.imo}</Info><Info label={settings.locale === "da" ? "Kaldsignal" : "Call sign"}>{vessel?.callSign ?? call.callSign}</Info>
        <Info label={settings.locale === "da" ? "Kategori" : "Category"}>{vessel?.category ?? call.category}</Info><Info label={settings.locale === "da" ? "Flag" : "Flag"}>{vessel?.flag ?? "—"}</Info>
        <Info label="LOA">{vessel?.loaMeters ?? call.loaMeters} m</Info><Info label="BEAM">{vessel?.beamMeters ?? call.beamMeters} m</Info>
        <Info label={t.customer}>{vessel?.customer ?? call.customer}</Info><Info label={t.agent}>{vessel?.agent ?? call.agent}</Info>
        <Info label={settings.locale === "da" ? "Sidste havn" : "Last port"}>{vessel?.lastPort ?? "—"}</Info><Info label={settings.locale === "da" ? "Næste havn" : "Next port"}>{vessel?.nextPort ?? "—"}</Info>
      </dl></div>}
      {tab === "timeline" && <div id="detail-panel-timeline" role="tabpanel" aria-labelledby="detail-tab-timeline">
        <section className={styles.timelineJourney} aria-label={settings.locale === "da" ? `Anløbets forløb for ${call.vesselName}` : `Vessel journey for ${call.vesselName}`}>
          <header className={styles.timelineJourneyHeader}>
            <div className={styles.timelineJourneyTitle}>
              <span>{settings.locale === "da" ? "Anløbets forløb" : "Vessel journey"}</span>
              <h3>{call.vesselName}</h3>
            </div>
            <div className={styles.timelineJourneyCount} aria-label={`${timelineOperations.length} ${settings.locale === "da" ? "milepæle" : "milestones"}`}>
              <strong>{String(timelineOperations.length).padStart(2, "0")}</strong>
              <span>{settings.locale === "da" ? "milepæle" : "milestones"}</span>
            </div>
          </header>
          <div className={styles.timelineRouteViewport}>
            <div
              className={styles.timelineRouteStage}
              style={{
                "--timeline-columns": Math.max(timelineOperations.length, 1),
                "--timeline-min-width": `${Math.max(820, timelineOperations.length * 220)}px`,
              } as CSSProperties}
            >
              <ol className={styles.timeline}>
                {timelineOperations.map((operation, index) => (
                  <li key={operation.id} data-state={operation.state}>
                    <span className={styles.timelineStepNumber} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                    <div className={styles.timelineMilestone}>
                      <LifecycleEvent call={call} operation={operation} label={operationLabel(operation, settings.locale, call)} settings={settings} onSelectBerth={berthInteraction.onSelectBerth} isBerthFilterable={berthInteraction.isBerthFilterable} onOpenDetail={() => setTab("call")} />
                      {operation.details && <span className={styles.timelineDetails}>{operationDetailText(settings.locale, operation.details)}</span>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      </div>}
      {tab === "route" && <div id="detail-panel-route" role="tabpanel" aria-labelledby="detail-tab-route">{tracking ? <><HarborMap calls={[call]} selected={call} tracking={tracking} tracks={[tracking]} serviceOrders={orders} locale={settings.locale} dateFormat={settings.dateFormat} now={now} /><dl className={styles.routeFacts}>{liveArrival && <div><dt>Live ETA</dt><dd>{formatDateTime(liveArrival, settings.locale, settings.dateFormat)}</dd></div>}<div><dt>Destination</dt><dd>{tracking.destinationBerth}</dd></div><div><dt>{settings.locale === "da" ? "Opdateret" : "Updated"}</dt><dd>{formatDateTime(tracking.updatedAt, settings.locale, settings.dateFormat)}</dd></div></dl></> : <p className={styles.emptyDetail}>{settings.locale === "da" ? "Ingen rute er tilgængelig for dette anløb." : "No route is available for this call."}</p>}</div>}
      {tab === "notes" && <div id="detail-panel-notes" role="tabpanel" aria-labelledby="detail-tab-notes" className={styles.notesPanel}>
        <h3>{t.notes}</h3>{notes.length ? notes.map((note) => <article key={note.id}><p>{note.text}</p><small>{note.authorRole} · {formatDateTime(note.createdAt, settings.locale, "compact")}</small></article>) : <p>{t.noNotes}</p>}
        {call.visibility === "restricted" ? <p className={styles.notesReadOnly} role="status">{t.notesRestricted}</p> : <form className={styles.noteComposer} onSubmit={(event) => { event.preventDefault(); const text = draftNote.trim(); if (!text) return; onAddNote(text); setDraftNote(""); }}>
          <label htmlFor={`note-${call.id}`}>{t.addNote}</label>
          <textarea id={`note-${call.id}`} value={draftNote} onChange={(event) => setDraftNote(event.target.value)} placeholder={t.notePlaceholder} rows={3} />
          <button type="submit" disabled={!draftNote.trim()}>{t.saveNote}</button>
        </form>}
        <h3>{t.flexPortAccess}</h3>{call.documents.length ? call.documents.map((document) => <div key={document.id} className={styles.documentRow}><span>{document.name}</span><b>{document.state === "restricted" ? t.integrationRequired : t.mockAvailable}</b></div>) : <p>{t.noteExistInactive}</p>}
      </div>}
    </Overlay>
  );
}

function Info({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) { return <div className={`${styles.info} ${className ?? ""}`}><dt>{label}</dt><dd>{children}</dd></div>; }

function displayPlacement(call: PortCall, now: string | number) {
  return getRelevantBerthAssignments(call, now)[0] ?? getDeparturePlacement(call);
}

function berthFilterInteraction(
  call: PortCall,
  now: string | number,
  onSelectBerth: (berth: string) => void,
) {
  const assignments = getRelevantBerthAssignments(call, now);
  const relevantCodes = new Set(assignments.map((assignment) => normalizeBerthCode(assignment.berth)));
  if (!relevantCodes.size) return { onSelectBerth: undefined, isBerthFilterable: undefined };
  return {
    onSelectBerth,
    isBerthFilterable: (berth: string, operation?: PortOperation) => {
      const code = normalizeBerthCode(berth);
      if (!relevantCodes.has(code)) return false;
      if (!operation) return true;
      return assignments.some((assignment) => {
        if (normalizeBerthCode(assignment.berth) !== code) return false;
        if (assignment.operationId === operation.id) return true;
        if (!assignment.operationId && assignment.source === "initial" && operation.type === "arrival") return true;
        return assignment.source === "departure" && operation.type === "departure";
      });
    },
  };
}

export function WatchlistPrototype({ demoProfile }: { demoProfile: DemoProfile }) {
  const [snapshot, setSnapshot] = useState<WatchlistSnapshot | null>(null);
  const [settings, setSettings] = useState<WatchlistSettings>(DEFAULT_SETTINGS);
  const [filters, setFilters] = useState<WatchlistFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"list" | "map">("list");
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [dataState, setDataState] = useState<DataState>("loading");
  const [activeHeaderSortKey, setActiveHeaderSortKey] = useState<SortKey | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [statusFiltersOpen, setStatusFiltersOpen] = useState(true);
  const [berthFiltersOpen, setBerthFiltersOpen] = useState(false);
  const [berthQuery, setBerthQuery] = useState("");
  const [dragColumn, setDragColumn] = useState<ChooserColumn | null>(null);
  const [dropColumn, setDropColumn] = useState<ChooserColumn | null>(null);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [selectedMapCallId, setSelectedMapCallId] = useState<string | null>(null);
  const pendingMapFocusRef = useRef<string | null>(null);
  const [detailInitialTab, setDetailInitialTab] = useState<DetailTab>("call");
  const [noteOverrides, setNoteOverrides] = useState<Record<string, PortCallNote[]>>({});
  const [clock, setClock] = useState(() => Date.now());
  const [operationClock, setOperationClock] = useState(() => Date.parse(PROTOTYPE_OPERATIONS_NOW));
  const [mobileOutbox, setMobileOutbox] = useState<MobileTaskOutbox>({});
  const [mobileAuditLog, setMobileAuditLog] = useState<MobileTaskAuditEntry[]>([]);
  const [mobileUndoAction, setMobileUndoAction] = useState<MobileUndoAction | null>(null);
  const [mobilePersistenceError, setMobilePersistenceError] = useState(false);
  const [mobileFeedback, setMobileFeedback] = useState("");
  const [mobileFeedbackEnabled, setMobileFeedbackEnabled] = useState(true);
  const mobileFeedbackCancelRef = useRef<(() => void) | null>(null);
  const mobileOutboxTimersRef = useRef<Map<string, number>>(new Map());
  const mobileUndoTimerRef = useRef<number | null>(null);
  const mobileTableRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [chromeHidden, setChromeHidden] = useState(false);
  const chromeFocusRef = useRef(false);
  const chromeOverlayOpenRef = useRef(false);

  const setChromeHiddenState = useCallback((hidden: boolean) => {
    setChromeHidden((current) => current === hidden ? current : hidden);
  }, []);

  const t = copy[settings.locale];
  const chrome = settingsChrome[settings.locale];
  const nextTheme = settings.theme === "dark" ? "light" : "dark";
  const themeActionLabel = settings.locale === "da" ? `Skift til ${nextTheme === "light" ? "lyst" : "mørkt"} tema` : `Switch to ${nextTheme} theme`;
  const railToggleLabel = settings.locale === "da" ? (railCollapsed ? "Udvid sidebar" : "Minimér sidebar") : (railCollapsed ? "Expand sidebar" : "Collapse sidebar");
  const activeDemoName = demoProfile.name[settings.locale];
  const chromeOverlayOpen = settingsOpen || filtersOpen || columnsOpen || selectedCallId !== null;
  const restrictedSnapshot = snapshot?.calls.some((call) => call.visibility === "restricted") ?? false;
  const profileStorageKeys = useMemo(() => ({
    settings: mobileTaskStorageKey(STORAGE_KEY, demoProfile.id),
    filters: mobileTaskStorageKey(FILTER_STORAGE_KEY, demoProfile.id),
    notes: mobileTaskStorageKey(NOTES_STORAGE_KEY, demoProfile.id),
    mobileOutbox: mobileTaskStorageKey(MOBILE_TASK_OUTBOX_STORAGE_KEY, demoProfile.id),
    mobileAudit: mobileTaskStorageKey(MOBILE_TASK_AUDIT_STORAGE_KEY, demoProfile.id),
  }), [demoProfile.id]);
  const canPersistProfileState = demoProfile.access !== "restricted" && !restrictedSnapshot;
  const previousRestrictedSnapshotRef = useRef(false);
  const mobileTaskOverrides = useMemo(() => mobileTaskOverridesFromOutbox(mobileOutbox), [mobileOutbox]);
  const acceptSnapshot = useCallback((value: WatchlistSnapshot) => {
    const nextRestricted = value.calls.some((call) => call.visibility === "restricted");
    const publicCallIds = new Set(value.calls.filter((call) => call.visibility !== "restricted").map((call) => call.id));
    const restrictedProfile = demoProfile.access === "restricted" || nextRestricted;
    if (previousRestrictedSnapshotRef.current && !nextRestricted) {
      setFilters(DEFAULT_FILTERS);
      setPage(1);
      setSettings((current) => ({ ...current, pinnedIds: current.pinnedIds.filter((callId) => publicCallIds.has(callId)) }));
      setSelectedCallId((current) => current && publicCallIds.has(current) ? current : null);
      setSelectedMapCallId((current) => current && publicCallIds.has(current) ? current : null);
    }
    setNoteOverrides((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([callId]) => publicCallIds.has(callId)));
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
    if (restrictedProfile) {
      mobileOutboxTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      mobileOutboxTimersRef.current.clear();
      if (mobileUndoTimerRef.current !== null) window.clearTimeout(mobileUndoTimerRef.current);
      mobileUndoTimerRef.current = null;
      setMobileOutbox({});
      setMobileAuditLog([]);
      setMobileUndoAction(null);
      try {
        [
          profileStorageKeys.mobileOutbox,
          profileStorageKeys.mobileAudit,
          MOBILE_TASK_OUTBOX_STORAGE_KEY,
          MOBILE_TASK_AUDIT_STORAGE_KEY,
        ].forEach((key) => window.localStorage.removeItem(key));
      } catch {
        window.setTimeout(() => setMobilePersistenceError(true), 0);
      }
    } else {
      setMobileOutbox((current) => reconcileMobileTaskOutbox(current, publicCallIds));
      setMobileAuditLog((current) => reconcileMobileTaskAuditLog(current, publicCallIds));
      setMobileUndoAction((current) => current && publicCallIds.has(current.callId) ? current : null);
    }
    previousRestrictedSnapshotRef.current = nextRestricted;
    setSnapshot(value);
    setDataState("ready");
  }, [demoProfile.access, profileStorageKeys.mobileAudit, profileStorageKeys.mobileOutbox]);

  useEffect(() => {
    const restrictedProfile = demoProfile.access === "restricted";
    const stored = restrictedProfile ? null : window.localStorage.getItem(profileStorageKeys.settings);
    const storedFilters = restrictedProfile ? null : window.localStorage.getItem(profileStorageKeys.filters);
    const storedNotes = restrictedProfile ? null : window.localStorage.getItem(profileStorageKeys.notes);
    const storedMobileOutbox = restrictedProfile ? null : window.localStorage.getItem(profileStorageKeys.mobileOutbox);
    const storedMobileAudit = restrictedProfile ? null : window.localStorage.getItem(profileStorageKeys.mobileAudit);
    if (restrictedProfile) {
      try {
        [
          profileStorageKeys.settings,
          profileStorageKeys.filters,
          profileStorageKeys.notes,
          profileStorageKeys.mobileOutbox,
          profileStorageKeys.mobileAudit,
          MOBILE_TASK_OUTBOX_STORAGE_KEY,
          MOBILE_TASK_AUDIT_STORAGE_KEY,
        ].forEach((key) => window.localStorage.removeItem(key));
      } catch {
        window.setTimeout(() => setMobilePersistenceError(true), 0);
      }
    }
    window.setTimeout(() => {
      if (stored) {
        try {
          const storedSettings = mergeSettings(JSON.parse(stored));
          const merged = storedSettings.preset === "quick"
            ? { ...storedSettings, preset: "office" as const, columns: [...PRESET_COLUMNS.office], hiddenColumns: [] }
            : storedSettings;
          setSettings(merged);
          setActiveHeaderSortKey(merged.sortKey === DEFAULT_SETTINGS.sortKey && merged.sortDirection === DEFAULT_SETTINGS.sortDirection ? null : merged.sortKey);
        } catch { setSettings(DEFAULT_SETTINGS); setActiveHeaderSortKey(null); }
      }
      if (storedFilters) { try { setFilters(mergeFilters(JSON.parse(storedFilters))); } catch { setFilters(DEFAULT_FILTERS); } }
      if (storedNotes) { try { setNoteOverrides(JSON.parse(storedNotes)); } catch { setNoteOverrides({}); } }
      if (storedMobileOutbox) {
        try {
          const parsed = parseMobileTaskOutbox(JSON.parse(storedMobileOutbox));
          setMobileOutbox(settleMobileTaskOutbox(parsed, new Date().toISOString()));
        } catch { setMobileOutbox({}); }
      }
      if (storedMobileAudit) {
        try {
          const parsed = parseMobileTaskAuditLog(JSON.parse(storedMobileAudit));
          setMobileAuditLog(settleMobileTaskAuditLog(parsed, new Date().toISOString()));
        } catch { setMobileAuditLog([]); }
      }
      setHydrated(true);
    }, 0);
    watchlistService.getSnapshot()
      .then(acceptSnapshot)
      .catch(() => setDataState("error"));
  }, [acceptSnapshot, demoProfile.access, profileStorageKeys.filters, profileStorageKeys.mobileAudit, profileStorageKeys.mobileOutbox, profileStorageKeys.notes, profileStorageKeys.settings]);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.lang = settings.locale;
    if (previousRestrictedSnapshotRef.current && !restrictedSnapshot) return;
    try {
      if (!canPersistProfileState) {
        window.localStorage.removeItem(profileStorageKeys.settings);
        return;
      }
      window.localStorage.setItem(profileStorageKeys.settings, JSON.stringify(settings));
    } catch {
      window.setTimeout(() => setMobilePersistenceError(true), 0);
    }
  }, [canPersistProfileState, settings, hydrated, profileStorageKeys.settings, restrictedSnapshot]);

  useEffect(() => {
    if (!hydrated) return;
    if (previousRestrictedSnapshotRef.current && !restrictedSnapshot) return;
    try {
      if (!canPersistProfileState) {
        window.localStorage.removeItem(profileStorageKeys.filters);
        return;
      }
      window.localStorage.setItem(profileStorageKeys.filters, JSON.stringify(filters));
    } catch {
      window.setTimeout(() => setMobilePersistenceError(true), 0);
    }
  }, [canPersistProfileState, filters, hydrated, profileStorageKeys.filters, restrictedSnapshot]);

  useEffect(() => {
    if (!hydrated) return;
    if (previousRestrictedSnapshotRef.current && !restrictedSnapshot) return;
    try {
      if (!canPersistProfileState) {
        window.localStorage.removeItem(profileStorageKeys.notes);
        return;
      }
      window.localStorage.setItem(profileStorageKeys.notes, JSON.stringify(noteOverrides));
    } catch {
      window.setTimeout(() => setMobilePersistenceError(true), 0);
    }
  }, [canPersistProfileState, noteOverrides, hydrated, profileStorageKeys.notes, restrictedSnapshot]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (!canPersistProfileState) {
        window.localStorage.removeItem(profileStorageKeys.mobileOutbox);
        window.localStorage.removeItem(profileStorageKeys.mobileAudit);
        return;
      }
      window.localStorage.setItem(profileStorageKeys.mobileOutbox, JSON.stringify(mobileOutbox));
      window.localStorage.setItem(profileStorageKeys.mobileAudit, JSON.stringify(mobileAuditLog));
    } catch {
      window.setTimeout(() => setMobilePersistenceError(true), 0);
    }
  }, [canPersistProfileState, hydrated, mobileAuditLog, mobileOutbox, profileStorageKeys.mobileAudit, profileStorageKeys.mobileOutbox]);

  useEffect(() => {
    if (!hydrated || !snapshot) return;
    const callIds = new Set(snapshot.calls.filter((call) => call.visibility !== "restricted").map((call) => call.id));
    if (demoProfile.access === "restricted" || restrictedSnapshot) return;
    const timer = window.setTimeout(() => {
      setMobileOutbox((current) => reconcileMobileTaskOutbox(current, callIds));
      setMobileAuditLog((current) => reconcileMobileTaskAuditLog(current, callIds));
      setMobileUndoAction((current) => current && callIds.has(current.callId) ? current : null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [demoProfile.access, hydrated, restrictedSnapshot, snapshot]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setOperationClock((value) => value + 60_000), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => {
    mobileFeedbackCancelRef.current?.();
    mobileFeedbackCancelRef.current = null;
    mobileOutboxTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    mobileOutboxTimersRef.current.clear();
    if (mobileUndoTimerRef.current !== null) window.clearTimeout(mobileUndoTimerRef.current);
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT" || target?.isContentEditable;
      if (event.key === "/" && !isTyping) { event.preventDefault(); searchRef.current?.focus(); }
      if (event.key === "Escape") { setSettingsOpen(false); setFiltersOpen(false); setColumnsOpen(false); setSelectedCallId(null); }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    chromeOverlayOpenRef.current = chromeOverlayOpen;
  }, [chromeOverlayOpen]);

  useEffect(() => {
    const isStickyChromeTarget = (target: EventTarget | null): target is Element => target instanceof Element && target.closest("[data-sticky-chrome]") !== null;
    const handleFocusIn = (event: FocusEvent) => {
      if (!isStickyChromeTarget(event.target)) return;
      chromeFocusRef.current = true;
      setChromeHiddenState(false);
    };
    const handleFocusOut = (event: FocusEvent) => {
      if (isStickyChromeTarget(event.relatedTarget)) return;
      chromeFocusRef.current = false;
    };

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
    };
  }, [setChromeHiddenState]);

  useEffect(() => {
    const revealThreshold = 120;
    const meaningfulDelta = 6;
    let frame: number | null = null;
    let previousScrollY = Math.max(0, window.scrollY);

    const processScroll = () => {
      frame = null;
      const currentScrollY = Math.max(0, window.scrollY);
      const delta = currentScrollY - previousScrollY;
      previousScrollY = currentScrollY;

      if (currentScrollY <= revealThreshold || delta <= -meaningfulDelta || chromeFocusRef.current || chromeOverlayOpenRef.current) {
        setChromeHiddenState(false);
      } else if (delta >= meaningfulDelta && currentScrollY > revealThreshold) {
        setChromeHiddenState(true);
      }
    };
    const scheduleScrollUpdate = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(processScroll);
    };

    window.addEventListener("scroll", scheduleScrollUpdate, { passive: true });
    return () => {
      window.removeEventListener("scroll", scheduleScrollUpdate);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [setChromeHiddenState]);

  useEffect(() => {
    if (view !== "map") return;
    if (window.matchMedia("(max-width: 760px)").matches) return;
    const timer = window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>('[class*="mapShell"]');
      if (target) window.scrollTo({ top: Math.max(0, target.offsetTop - 8), behavior: "smooth" });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [view]);

  useEffect(() => {
    if (!snapshot) return;
    const timer = window.setInterval(() => {
      watchlistService.refresh().then(acceptSnapshot).catch(() => setDataState("stale"));
    }, Math.max(MIN_REFRESH_MINUTES, settings.refreshMinutes) * 60_000);
    return () => window.clearInterval(timer);
  }, [acceptSnapshot, snapshot, settings.refreshMinutes]);

  const snapshotCalls = useMemo(() => snapshot?.calls ?? [], [snapshot]);
  const snapshotServiceOrders = useMemo(() => snapshot?.serviceOrders ?? [], [snapshot]);
  const mobileData = useMemo(
    () => mobileTaskData(snapshotCalls, snapshotServiceOrders, mobileTaskOverrides),
    [mobileTaskOverrides, snapshotCalls, snapshotServiceOrders],
  );
  const calls = mobileData.calls;
  const serviceOrders = mobileData.serviceOrders;
  const selectedCall = useMemo(
    () => selectedCallId ? calls.find((call) => call.id === selectedCallId) ?? null : null,
    [calls, selectedCallId],
  );
  const effectiveSnapshot = useMemo<WatchlistSnapshot | null>(
    () => snapshot ? { ...snapshot, calls, serviceOrders } : null,
    [calls, serviceOrders, snapshot],
  );
  const operationNow = Number.isFinite(operationClock) ? new Date(operationClock).toISOString() : PROTOTYPE_OPERATIONS_NOW;
  const registerMobileTask = (call: PortCall, operation: PortOperation, state: OperationState) => {
    setMobilePersistenceError(false);
    const registrationAt = state === "actual" ? operationNow : undefined;
    const key = mobileTaskKey(call.id, operation.id);
    const previous = mobileTaskOverrides[key];
    const createdAt = new Date().toISOString();
    const id = `mobile-${Date.now()}-${operation.id}`;
    const entry: MobileTaskOutbox[typeof key] = {
      id,
      key,
      callId: call.id,
      operationId: operation.id,
      state,
      ...(registrationAt ? { registeredAt: registrationAt } : {}),
      ...(previous ? { previous } : {}),
      status: "pending",
      createdAt,
      updatedAt: createdAt,
    };
    setMobileOutbox((current) => ({ ...current, [key]: entry }));
    const taskLabel = operationLabel(operation, settings.locale, call);
    const stateLabel = operationStateLabel(state, settings.locale);
    const timestampNote = registrationAt ? ` · ${t.mobileAutoFilled} ${formatClock(registrationAt)}` : "";
    const auditId = `${id}-audit`;
    const auditEntry: MobileTaskAuditEntry = {
      id: auditId,
      key,
      callId: call.id,
      operationId: operation.id,
      label: taskLabel,
      action: "register",
      state,
      ...(previous ? { previousState: previous.state } : {}),
      status: "pending",
      createdAt,
    };
    setMobileAuditLog((current) => [auditEntry, ...current].slice(0, 40));
    setMobileUndoAction({ key, entryId: id, callId: call.id, operationId: operation.id, operationLabel: taskLabel, state, previous, auditId });
    if (mobileUndoTimerRef.current !== null) window.clearTimeout(mobileUndoTimerRef.current);
    mobileUndoTimerRef.current = window.setTimeout(() => { setMobileUndoAction(null); mobileUndoTimerRef.current = null; }, MOBILE_UNDO_WINDOW_MS);
    const previousTimer = mobileOutboxTimersRef.current.get(key);
    if (previousTimer !== undefined) window.clearTimeout(previousTimer);
    const settleTimer = window.setTimeout(() => {
      setMobileOutbox((current) => {
        const currentEntry = current[key];
        if (!currentEntry || currentEntry.id !== id) return current;
        return { ...current, [key]: { ...currentEntry, status: "sent", updatedAt: new Date().toISOString(), error: undefined } };
      });
      mobileOutboxTimersRef.current.delete(key);
      setMobileAuditLog((current) => current.map((item) => item.id === auditId ? { ...item, status: "sent" } : item));
    }, MOBILE_OUTBOX_SETTLE_DELAY_MS);
    mobileOutboxTimersRef.current.set(key, settleTimer);
    const readyMessage = `${t.mobileSaved} · ${taskLabel} · ${stateLabel}${timestampNote}`;
    mobileFeedbackCancelRef.current?.();
    mobileFeedbackCancelRef.current = scheduleMobileFeedback(
      `${t.mobilePreparing} · ${taskLabel} · ${stateLabel}`,
      readyMessage,
      setMobileFeedback,
      { setTimeout: (callback, delay) => window.setTimeout(callback, delay), clearTimeout: (timer) => window.clearTimeout(timer) },
    );
  };
  const undoMobileRegistration = () => {
    const action = mobileUndoAction;
    if (!action) return;
    const result = undoMobileTask(mobileOutbox, action, new Date().toISOString());
    if (!result) {
      setMobileUndoAction(null);
      return;
    }
    const timer = mobileOutboxTimersRef.current.get(action.key);
    if (timer !== undefined) window.clearTimeout(timer);
    mobileOutboxTimersRef.current.delete(action.key);
    setMobileOutbox(result.outbox);
    setMobileAuditLog((current) => [result.audit, ...current].slice(0, 40));
    setMobileUndoAction(null);
    if (mobileUndoTimerRef.current !== null) window.clearTimeout(mobileUndoTimerRef.current);
    mobileUndoTimerRef.current = null;
    mobileFeedbackCancelRef.current?.();
    mobileFeedbackCancelRef.current = null;
    setMobileFeedback(`${t.mobileUndo} · ${action.operationLabel}`);
  };
  const resetMobileDemo = () => {
    mobileOutboxTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    mobileOutboxTimersRef.current.clear();
    if (mobileUndoTimerRef.current !== null) window.clearTimeout(mobileUndoTimerRef.current);
    mobileUndoTimerRef.current = null;
    mobileFeedbackCancelRef.current?.();
    mobileFeedbackCancelRef.current = null;
    setMobileOutbox({});
    setMobileAuditLog([]);
    setMobileUndoAction(null);
    setMobileFeedback("");
    setMobilePersistenceError(false);
  };
  const berths = useMemo(() => normalizeBerthOptions(calls.flatMap((call) => getRelevantBerthAssignments(call, operationNow).map((assignment) => assignment.berth))), [calls, operationNow]);
  const visibleBerths = useMemo(() => {
    const query = berthQuery.trim().toLocaleLowerCase("da-DK");
    return query ? berths.filter((berth) => formatBerthCode(berth).toLocaleLowerCase("da-DK").includes(query)) : berths;
  }, [berthQuery, berths]);
  const filtered = useMemo(() => filterPortCalls(calls, filters, calls, operationNow, serviceOrders), [calls, filters, operationNow, serviceOrders]);
  const sorted = useMemo(() => sortPortCalls(filtered, settings.sortKey, settings.sortDirection, settings.pinnedIds, operationNow, serviceOrders), [filtered, operationNow, serviceOrders, settings.sortKey, settings.sortDirection, settings.pinnedIds]);
  const effective = useMemo(() => dataState === "empty" ? [] : sorted, [dataState, sorted]);
  const paged = useMemo(() => paginate(effective, page, settings.pageSize), [effective, page, settings.pageSize]);
  useEffect(() => {
    const callId = pendingMapFocusRef.current;
    if (view !== "list" || !callId) return;
    const target = Array.from(document.querySelectorAll<HTMLElement>("[data-call-id]"))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const computed = window.getComputedStyle(element);
        return computed.display !== "none" && computed.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      })
      .find((element) => element.dataset.callId === callId);
    if (!target) return;
    pendingMapFocusRef.current = null;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    const focusTarget = target.querySelector<HTMLElement>("button, a, [tabindex]:not([tabindex='-1'])") ?? target;
    if (!focusTarget.matches("button, a, input, select, textarea, [tabindex]")) focusTarget.tabIndex = -1;
    focusTarget.focus({ preventScroll: true });
  }, [paged.items, view]);
  const configuredColumns = visibleColumns(settings);
  const nextJobVisible = configuredColumns.includes("nextJob");
  const resolvedNotesForCall = (call: PortCall): readonly PortCallNote[] => call.visibility === "restricted" ? call.notes : noteOverrides[call.id] ?? call.notes;
  const resultHasOptionalOperations = effective.some((call) => optionalSummaryOperations(call, operationNow, serviceOrders, nextJobVisible).length > 0);
  const resultHasNotes = effective.some((call) => resolvedNotesForCall(call).length > 0);
  // Status remains available as a filter/detail signal, but the legacy colour
  // treatment makes a standalone table Status column redundant. Keep it out
  // even when an older saved profile or custom column list still contains it.
  // Sparse exception columns stay stable across pagination: they disappear only
  // when the complete filtered result has no value, not merely on one page.
  const columns = configuredColumns.filter((column) => column !== "status"
    && (column !== "operations" || resultHasOptionalOperations)
    && (column !== "notes" || resultHasNotes));
  const warningCount = calls.filter((call) => getOperationalWarnings(call, calls, operationNow, serviceOrders).length > 0).length;
  const nextOperation = calls.flatMap((call) => {
    const operation = getNextActionableOperation(call, operationNow, serviceOrders);
    return operation ? [operation] : [];
  }).sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0] ?? null;
  const activeCallCount = getOperationallyActiveCalls(calls, operationNow, PROTOTYPE_OPERATIONS_HORIZON_HOURS, serviceOrders).length;
  const age = snapshot ? dataAgeMinutes(snapshot.fetchedAt, clock) : 0;
  const isStale = dataState === "stale" || (snapshot !== null && age >= Math.max(MIN_REFRESH_MINUTES, settings.refreshMinutes));
  const canShowData = dataState !== "loading" && (dataState !== "error" || snapshot !== null);
  const activeFilterCount = Number(filters.query.trim().length > 0) + Number(filters.statuses.length > 0) + Number(filters.berths.length > 0) + Number(filters.attentionOnly) + Number(filters.operationalOnly);
  const rangeStart = effective.length ? (paged.page - 1) * settings.pageSize + 1 : 0;
  const rangeEnd = effective.length ? Math.min(paged.page * settings.pageSize, paged.total) : 0;
  const mobileOutboxEntries = useMemo(() => Object.values(mobileOutbox).sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)), [mobileOutbox]);
  const mobilePendingCount = mobileOutboxEntries.filter((entry) => entry.status === "pending").length;
  const mobileSentCount = mobileOutboxEntries.filter((entry) => entry.status === "sent").length;
  const mobileErrorCount = mobileOutboxEntries.filter((entry) => entry.status === "error").length;
  const mobileAuditStatusLabel = (status: MobileTaskAuditEntry["status"]) => status === "pending" ? t.mobilePending : status === "sent" ? t.mobileSent : status === "error" ? t.mobileError : t.mobileUndo;

  const updateSettings = (patch: Partial<WatchlistSettings>) => setSettings((current) => ({ ...current, ...patch }));
  const chooseSortKey = (sortKey: SortKey) => {
    const sortDirection = naturalSortDirection(sortKey);
    updateSettings({ sortKey, sortDirection });
    setActiveHeaderSortKey(sortKey === DEFAULT_SETTINGS.sortKey && sortDirection === DEFAULT_SETTINGS.sortDirection ? null : sortKey);
    setPage(1);
  };
  const toggleSortDirection = () => {
    const sortDirection = settings.sortDirection === "asc" ? "desc" : "asc";
    updateSettings({ sortDirection });
    setActiveHeaderSortKey(settings.sortKey === DEFAULT_SETTINGS.sortKey && sortDirection === DEFAULT_SETTINGS.sortDirection ? null : activeHeaderSortKey ?? settings.sortKey);
    setPage(1);
  };
  const cycleColumnSort = (column: ColumnKey) => {
    const selection = cycleSort(settings.sortKey, settings.sortDirection, sortKeyForColumn(column), activeHeaderSortKey);
    updateSettings({ sortKey: selection.sortKey, sortDirection: selection.sortDirection });
    setActiveHeaderSortKey(selection.activeSortKey);
    setPage(1);
  };
  const changeFilters = (updater: (current: WatchlistFilters) => WatchlistFilters) => { setFilters(updater); setPage(1); };
  const updateFilters = (patch: Partial<WatchlistFilters>) => changeFilters((current) => ({ ...current, ...patch }));
  const chooserColumns = useMemo(() => settings.columns.filter((column): column is ChooserColumn => column !== "status"), [settings.columns]);
  const moveChooserColumn = (column: ChooserColumn, direction: -1 | 1) => updateSettings({ columns: moveColumn(chooserColumns, column, direction) });
  const reorderChooserColumn = (source: ChooserColumn, target: ChooserColumn) => {
    updateSettings({ columns: moveColumnTo(chooserColumns, source, target) });
  };
  const startColumnDrag = (event: React.DragEvent<HTMLButtonElement>, column: ChooserColumn) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", column);
    setDragColumn(column);
    setDropColumn(null);
  };
  const finishColumnDrag = () => { setDragColumn(null); setDropColumn(null); };
  const dropChooserColumn = (event: React.DragEvent<HTMLDivElement>, target: ChooserColumn) => {
    event.preventDefault();
    const source = event.dataTransfer.getData("text/plain") as ChooserColumn;
    reorderChooserColumn(source || dragColumn || target, target);
    finishColumnDrag();
  };
  const selectBerth = (berth: string) => changeFilters((current) => selectBerthFilter(current, berth));
  const selectBerthAndReturn = (berth: string) => { selectBerth(berth); setView("list"); };
  const returnToList = () => {
    if (selectedMapCallId) {
      const selectedIndex = effective.findIndex((call) => call.id === selectedMapCallId);
      if (selectedIndex >= 0) {
        setPage(Math.floor(selectedIndex / settings.pageSize) + 1);
        pendingMapFocusRef.current = selectedMapCallId;
      }
    }
    setView("list");
  };
  const clearFilters = () => { setFilters(DEFAULT_FILTERS); setBerthQuery(""); setPage(1); };
  const activateMetric = (metric: "active" | "attention" | "next" | "age") => {
    if (metric === "active") updateFilters({ operationalOnly: true, statuses: [], attentionOnly: false });
    if (metric === "attention") updateFilters({ attentionOnly: true });
    if (metric === "next") { updateSettings({ sortKey: "job-order", sortDirection: "asc" }); setActiveHeaderSortKey(null); setPage(1); }
    if (metric === "age") void manualRefresh();
  };
  const choosePreset = (preset: ViewPreset) => { updateSettings({ preset, columns: [...PRESET_COLUMNS[preset]], hiddenColumns: [] }); setPage(1); };
  const manualRefresh = async () => {
    setRefreshing(true); setDataState("loading");
    try { acceptSnapshot(await watchlistService.refresh()); } catch { setDataState("error"); } finally { setRefreshing(false); }
  };
  const openDetail = (call: PortCall, tab: DetailTab = "call") => { setDetailInitialTab(tab); setSelectedCallId(call.id); };
  const addNote = (callId: string, text: string) => {
    if (calls.find((call) => call.id === callId)?.visibility === "restricted") return;
    const base = noteOverrides[callId] ?? calls.find((call) => call.id === callId)?.notes ?? [];
    const note: PortCallNote = { id: `note-${callId}-${Date.now()}`, text, authorRole: "Current operator", createdAt: new Date().toISOString() };
    setNoteOverrides((current) => ({ ...current, [callId]: [...(current[callId] ?? base), note] }));
  };

  const mobileTaskLabels = {
    taskList: t.mobileTasks,
    task: t.mobileTask,
    next: t.mobileNext,
    chooseStatus: t.mobileChooseStatus,
    register: t.mobileRegister,
    edit: t.mobileEdit,
    editShort: t.mobileEditShort,
    close: t.mobileClose,
    showMore: t.mobileShowMore,
    showLess: t.mobileShowLess,
    liveEta: t.mobileLiveEta,
    registered: t.mobileRegistered,
    noTime: t.mobileNoTime,
    states: {
      actual: operationStateLabel("actual", settings.locale),
      expected: operationStateLabel("expected", settings.locale),
      ordered: operationStateLabel("ordered", settings.locale),
    },
  };

  const syncMobileTableSeam = useCallback((scroller: HTMLDivElement) => {
    const callNumberCell = scroller.querySelector<HTMLElement>('tbody tr td[data-column="callNumber"]');
    const vesselCell = scroller.querySelector<HTMLElement>('tbody tr td[data-column="vessel"]');
    if (!callNumberCell || !vesselCell) {
      scroller.style.setProperty("--mobile-vessel-seam", "0px");
      return;
    }

    const scrollerLeft = scroller.getBoundingClientRect().left;
    const callNumberRight = callNumberCell.getBoundingClientRect().right;
    const vesselLeft = vesselCell.getBoundingClientRect().left;
    const visibleCallNumber = callNumberRight - scrollerLeft;
    const vesselGap = Math.max(0, vesselLeft - scrollerLeft);
    // Keep a readable call number while it is still in view. Once only a
    // narrow suffix remains, extend the sticky vessel background over the seam
    // so truncated digits cannot appear as an orphaned gutter.
    const seam = visibleCallNumber > 0 && visibleCallNumber <= 16 ? vesselGap : 0;
    scroller.style.setProperty("--mobile-vessel-seam", `${seam}px`);
  }, []);

  const handleMobileTableScroll = (event: UIEvent<HTMLDivElement>) => {
    syncMobileTableSeam(event.currentTarget);
  };

  useEffect(() => {
    const scroller = mobileTableRef.current;
    if (scroller) syncMobileTableSeam(scroller);
  }, [columns, page, settings.density, settings.mobileLayout, settings.preset, syncMobileTableSeam]);

  const renderCell = (call: PortCall, column: ColumnKey) => {
    const warnings = getOperationalWarnings(call, calls, operationNow, serviceOrders); const next = getNextActionableOperation(call, operationNow, serviceOrders); const pinned = settings.pinnedIds.includes(call.id);
    const warningSummary = warnings.map((warning) => warningMessage(settings.locale, warning.type, warning.message)).join("\n");
    const arrival = getArrivalOperation(call); const departure = getDepartureOperation(call);
    const legacyArrival = operationPrimaryTime(arrival, call.arrivalTimes); const liveArrival = arrival?.state === "actual" ? undefined : liveTime(call.arrivalTimes);
    const placement = displayPlacement(call, operationNow);
    const berthInteraction = berthFilterInteraction(call, operationNow, selectBerth);
    const vesselCategorySupplement = !columns.includes("category") ? call.category : null;
    const vesselIdentitySupplement = [
      settings.density === "normal" && !columns.includes("callSign") ? call.callSign : null,
      settings.density === "normal" && !columns.includes("imo") ? `IMO ${call.imo}` : null,
    ].filter((part): part is string => Boolean(part)).join(" · ");
    const vesselVisibilityBadge = columns.includes("callNumber") ? null : <VisibilityBadge call={call} locale={settings.locale} />;
    switch (column) {
      case "signal": return warnings.length ? <button className={styles.signal} aria-label={warningSummary.replaceAll("\n", " ")} data-hover-info={warningSummary} data-hover-label={settings.locale === "da" ? "Kræver handling" : "Needs action"} data-hover-tone="alert" onClick={() => openDetail(call)}><BrandIcon name="attention" /><span>{warnings.length}</span></button> : <span className={styles.noSignal} aria-label="No warnings">·</span>;
      case "pin": return <button className={`${styles.pinButton} ${pinned ? styles.pinButtonPinned : ""}`} aria-pressed={pinned} aria-label={pinned ? t.unpin : t.pin} data-hover-info="" data-hover-label={settings.locale === "da" ? "Handling" : "Action"} data-hover-tone="action" onClick={() => updateSettings({ pinnedIds: togglePinnedId(settings.pinnedIds, call.id) })}><BrandIcon name="pin" /></button>;
      case "callNumber": return <button className={styles.textButton} onClick={() => openDetail(call, "call")}>{call.callNumber} <VisibilityBadge call={call} locale={settings.locale} /><span className={styles.visuallyHidden}> · {statusLabels[settings.locale][call.status]}</span></button>;
      case "imo": return <button className={styles.textButton} onClick={() => openDetail(call, "vessel")}>{call.imo}</button>;
      case "callSign": return <button className={styles.textButton} onClick={() => openDetail(call, "vessel")}>{call.callSign}</button>;
      case "crane": return <CraneBadge status={call.craneStatus} locale={settings.locale} />;
      case "vessel": return <div className={styles.vesselCell}><button className={styles.vesselButton} onClick={() => openDetail(call, "vessel")}><strong data-hover-info={call.vesselName} data-hover-label={settings.locale === "da" ? "Skib" : "Vessel"} data-hover-tone="action">{call.vesselName} {vesselVisibilityBadge}</strong>{vesselCategorySupplement && <small className={styles.vesselCategory} data-hover-info={vesselCategorySupplement} data-hover-label={settings.locale === "da" ? "Kategori" : "Category"}>{vesselCategorySupplement}</small>}{vesselIdentitySupplement && <small className={styles.vesselIdentifiers} data-hover-info={vesselIdentitySupplement} data-hover-label={settings.locale === "da" ? "Skibsidentitet" : "Vessel identity"}>{vesselIdentitySupplement}</small>}</button><span className={styles.mobileInlineTask}><MobileTaskActions call={call} settings={settings} now={operationNow} serviceOrders={serviceOrders} overrides={mobileTaskOverrides} labels={mobileTaskLabels} feedbackEnabled={mobileFeedbackEnabled} compactTable onRegister={(operation, state) => registerMobileTask(call, operation, state)} onSelectBerth={berthInteraction.onSelectBerth} isBerthFilterable={berthInteraction.isBerthFilterable} /></span></div>;
      case "status": return <StatusBadge status={call.status} locale={settings.locale} compact={settings.density === "compact"} />;
      case "eta": return <div className={styles.tableLifecycleCell}><LifecycleEvent call={call} operation={arrival} label={settings.locale === "da" ? "Ankomst" : "Arrival"} settings={settings} onSelectBerth={berthInteraction.onSelectBerth} isBerthFilterable={berthInteraction.isBerthFilterable} onOpenDetail={() => openDetail(call, liveArrival ? "route" : "call")} />{liveArrival && liveArrival !== legacyArrival && <button className={styles.liveSupplement} onClick={() => openDetail(call, "route")} aria-label={`${settings.locale === "da" ? "Live ETA" : "Live ETA"}: ${formatDateTime(liveArrival, settings.locale, settings.dateFormat)}`}>Live ETA · {formatClock(liveArrival)}</button>}</div>;
      case "etd": return <LifecycleEvent call={call} operation={departure} label={settings.locale === "da" ? "Afgang" : "Departure"} settings={settings} onSelectBerth={berthInteraction.onSelectBerth} isBerthFilterable={berthInteraction.isBerthFilterable} onOpenDetail={() => openDetail(call, "call")} />;
      case "berth": return <PlacementLabel call={{ ...call, berth: placement.berth ?? call.berth, bollardFrom: placement.bollardFrom ?? call.bollardFrom, bollardTo: placement.bollardTo ?? call.bollardTo, side: placement.side ?? call.side }} locale={settings.locale} onSelectBerth={berthInteraction.onSelectBerth} filterable={berthInteraction.isBerthFilterable?.(placement.berth ?? call.berth)} showBollards={!columns.includes("bollards")} showSide={!columns.includes("side")} />;
      case "bollards": return <span className={styles.bollards}>{placement.bollardFrom}-{placement.bollardTo}</span>;
      case "side": return placement.side === "port" ? (settings.locale === "da" ? "Bagbord" : "Port") : (settings.locale === "da" ? "Styrbord" : "Starboard");
      case "nextJob": return next ? <span className={styles.nextJob}><strong>{formatDateTime(next.at, settings.locale, settings.dateFormat)}</strong><small>{operationLabel(next, settings.locale, call)}</small></span> : <span className={styles.muted}>—</span>;
      case "customer": return call.customer; case "agent": return call.agent; case "loa": return `${call.loaMeters} m`; case "beam": return `${call.beamMeters} m`; case "category": return call.category;
      case "operations": {
        const optionalOperations = optionalSummaryOperations(call, operationNow, serviceOrders, nextJobVisible);
        return settings.density === "compact"
          ? <CompactOperationsIndicator call={call} operations={optionalOperations} settings={settings} onOpenDetail={() => openDetail(call, "timeline")} />
          : <OptionalEventSummary call={call} settings={settings} now={operationNow} serviceOrders={serviceOrders} excludeNextOperation={nextJobVisible} compactSummary={settings.mobileLayout === "table"} onSelectBerth={berthInteraction.onSelectBerth} isBerthFilterable={berthInteraction.isBerthFilterable} onOpenDetail={() => openDetail(call, "timeline")} />;
      }
      case "notes": return <NotesCell call={call} notes={resolvedNotesForCall(call)} settings={settings} onOpenDetail={() => openDetail(call, "notes")} />;
    }
  };

  return (
    <main className={styles.app} data-theme={settings.theme} data-density={settings.density} data-preset={settings.preset} data-view={view} data-mobile-layout={settings.mobileLayout} data-chrome={chromeHidden && !chromeOverlayOpen ? "hidden" : "visible"} data-rail={railCollapsed ? "collapsed" : "expanded"}>
      <BrandedHoverInfo />
      <a className={styles.skipLink} href="#watchlist-data">Skip to watchlist</a>
      <aside id="desktop-primary-rail" className={styles.desktopRail} aria-label={settings.locale === "da" ? "Primær navigation" : "Primary navigation"} aria-hidden={railCollapsed} inert={railCollapsed}>
        <button className={styles.railBrand} data-hover-info={settings.locale === "da" ? "Gå til toppen" : "Go to top"} data-hover-label="Aarhus Havn" data-hover-tone="action" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Aarhus Havn · top"><Image src="/brand/aarhus-havn-stacked.svg" alt="" width={86} height={32} priority /></button>
        <nav className={styles.railNav} aria-label={settings.locale === "da" ? "Arbejdsområder" : "Work areas"}>
          <button aria-current={view === "list" ? "page" : undefined} onClick={() => { returnToList(); window.setTimeout(() => document.getElementById("watchlist-data")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }}><span className={styles.icon}><BrandIcon name="portCall" /></span><span>{t.list}</span></button>
          <button aria-current={view === "map" ? "page" : undefined} onClick={() => { setView("map"); window.setTimeout(() => document.getElementById("watchlist-data")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }}><span className={styles.icon}><BrandIcon name="map" /></span><span>{t.map}</span></button>
        </nav>
        <div className={styles.railUtilities}>
          <button className={styles.railTheme} data-hover-info={themeActionLabel} data-hover-label={t.theme} data-hover-tone="action" onClick={() => updateSettings({ theme: nextTheme })} aria-label={themeActionLabel}>
            <span className={`${styles.railThemeIcon} ${styles.railThemeSun}`} data-active={settings.theme === "light"} aria-hidden="true" />
            <span className={`${styles.railThemeIcon} ${styles.railThemeMoon}`} data-active={settings.theme === "dark"} aria-hidden="true" />
          </button>
          <button className={styles.railAvatar} data-hover-info={`${t.settings}: ${activeDemoName}`} data-hover-label={settings.locale === "da" ? "Brugerprofil" : "User profile"} data-hover-tone="action" onClick={() => setSettingsOpen(true)} aria-label={`${t.settings}: ${activeDemoName}`}>{demoProfile.initials}</button>
        </div>
      </aside>
      <button className={styles.railToggle} data-hover-info="" data-hover-label={railToggleLabel} data-hover-tone="action" onClick={() => setRailCollapsed((current) => !current)} aria-controls="desktop-primary-rail" aria-expanded={!railCollapsed} aria-label={railToggleLabel}><BrandIcon name={railCollapsed ? "arrowRight" : "arrowLeft"} /></button>
      <header className={styles.topbar} data-sticky-chrome="topbar">
        <div className={styles.brand}><span className={styles.brandMark}><Image src="/brand/aarhus-havn-wordmark.svg" alt="Aarhus Havn" width={1513} height={145} priority /></span></div>
        <div className={styles.topActions}><button className={styles.avatar} data-hover-info={`${t.settings}: ${activeDemoName}`} data-hover-label={settings.locale === "da" ? "Brugerprofil" : "User profile"} data-hover-tone="action" onClick={() => setSettingsOpen(true)} aria-label={`${t.settings}: ${activeDemoName}`}>{demoProfile.initials}</button></div>
      </header>

      <section className={styles.workspace}>
        <section className={styles.operationHeader} aria-labelledby="watchlist-title">
          <div className={styles.operationTitle}>
            <small>Aarhus Havn</small>
            <h1 id="watchlist-title">{t.app}</h1>
          </div>
          <div className={styles.metrics} aria-label={t.metricsLabel}>
            <article role="button" tabIndex={0} aria-label={`${t.active}: ${activeCallCount}`} onClick={() => activateMetric("active")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activateMetric("active"); } }}><span className={styles.icon}><BrandIcon name="portCall" /></span><span>{t.active}</span><strong>{activeCallCount}</strong></article>
            <article role="button" tabIndex={0} aria-label={`${t.attention}: ${warningCount}`} onClick={() => activateMetric("attention")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activateMetric("attention"); } }}><span className={styles.icon}><BrandIcon name="attention" /></span><span>{t.attention}</span><strong>{warningCount}</strong></article>
            <article role="button" tabIndex={0} aria-label={t.next} onClick={() => activateMetric("next")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activateMetric("next"); } }}><span className={styles.icon}><BrandIcon name="calendar" /></span><span>{t.next}</span><strong>{nextOperation ? formatClock(nextOperation.at) : "—"}</strong></article>
            <article role="button" tabIndex={0} aria-label={t.age} className={isStale ? styles.metricStale : ""} onClick={() => activateMetric("age")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activateMetric("age"); } }}><span className={styles.icon}><BrandIcon name="followUp" /></span><span>{t.age}</span><strong>{isStale ? `${Math.max(age, 26)} min` : `${age} min`}</strong></article>
          </div>
        </section>

        <nav className={styles.presetBar} aria-label={t.profile}>{visiblePresets.map((preset) => <button key={preset} aria-pressed={settings.preset === preset} onClick={() => choosePreset(preset)}><span>{presetLabels[settings.locale][preset]}</span><small>{PRESET_COLUMNS[preset].length} {t.fields}</small></button>)}</nav>

        <section className={styles.controlPanel} data-sticky-chrome="controlPanel" aria-label="Watchlist controls">
          <div className={styles.searchWrap}><span className={styles.icon}><BrandIcon name="search" /></span><input ref={searchRef} type="search" value={filters.query} onChange={(event) => updateFilters({ query: event.target.value })} placeholder={`${t.search}  /`} aria-label={t.search} aria-keyshortcuts="/" />{filters.query && <button data-hover-info="" data-hover-label={settings.locale === "da" ? "Søgning" : "Search"} data-hover-tone="action" onClick={() => updateFilters({ query: "" })} aria-label={settings.locale === "da" ? "Ryd søgning" : "Clear search"}><BrandIcon name="close" /></button>}</div>
          <button className={styles.controlButton} onClick={() => setFiltersOpen(true)}><span className={styles.icon}><BrandIcon name="filter" /></span>{t.filters}<b>{activeFilterCount || ""}</b></button>
          <label className={styles.sortControl}><span className={styles.sortLabel}>{t.sort}</span><select value={settings.sortKey} onChange={(event) => chooseSortKey(event.target.value as SortKey)}>{SORT_KEYS.map((key) => <option key={key} value={key}>{sortLabels[settings.locale][key]}</option>)}</select></label>
          <button className={styles.iconButton} data-hover-info="" data-hover-label={settings.locale === "da" ? "Sorteringsretning" : "Sort direction"} data-hover-tone="action" onClick={toggleSortDirection} aria-label={settings.locale === "da" ? `Vend sortering til ${sortDirectionWord(settings.locale, settings.sortDirection === "asc" ? "desc" : "asc")}` : `Flip sort to ${sortDirectionWord(settings.locale, settings.sortDirection === "asc" ? "desc" : "asc")}`}><BrandIcon name={settings.sortDirection === "asc" ? "arrowUp" : "arrowDown"} /></button>
          <button className={styles.controlButton} onClick={() => setColumnsOpen(true)}><span className={styles.icon}><BrandIcon name="columns" /></span>{t.columns}</button>
          <button className={styles.controlButton} aria-pressed={settings.density === "compact"} aria-label={settings.locale === "da" ? (settings.density === "normal" ? "Skift til kompakt visning" : "Skift til normal visning") : (settings.density === "normal" ? "Switch to compact density" : "Switch to normal density")} onClick={() => updateSettings({ density: settings.density === "normal" ? "compact" : "normal" })}><span className={styles.icon}><BrandIcon name="density" /></span>{settings.density === "normal" ? t.normal : t.compact}</button>
          <div className={styles.viewSwitch} role="group" aria-label={settings.locale === "da" ? "Visning" : "View"}><button aria-pressed={view === "list"} onClick={returnToList}>{t.list}</button><button aria-pressed={view === "map"} onClick={() => setView("map")}>{t.map}</button></div>
          <button className={styles.refreshButton} onClick={manualRefresh} disabled={refreshing}><span className={styles.icon}><BrandIcon name="followUp" /></span>{refreshing ? t.loading : t.refresh}</button>
        </section>

        {activeFilterCount > 0 && <div className={styles.chips} aria-label={t.activeFilters}>{filters.query.trim() && <button className={styles.queryChip} onClick={() => updateFilters({ query: "" })} aria-label={`${t.removeSearch}: ${filters.query.trim()}`}><BrandIcon name="search" /> {filters.query.trim()} <BrandIcon name="close" /></button>}{filters.operationalOnly && <button onClick={() => updateFilters({ operationalOnly: false })}>{t.activeOnly} <BrandIcon name="close" /></button>}{filters.statuses.map((status) => <button key={status} onClick={() => changeFilters((current) => ({ ...current, statuses: current.statuses.filter((item) => item !== status), operationalOnly: false }))}>{statusLabels[settings.locale][status]} <BrandIcon name="close" /></button>)}{filters.berths.map((berth) => <button key={berth} onClick={() => changeFilters((current) => ({ ...current, berths: current.berths.filter((item) => item !== berth) }))}>{formatBerthCode(berth)} <BrandIcon name="close" /></button>)}{filters.attentionOnly && <button onClick={() => updateFilters({ attentionOnly: false })}>{t.attention} <BrandIcon name="close" /></button>}<button className={styles.clearChip} onClick={clearFilters}>{t.clearAll}</button></div>}
        {isStale && <div className={styles.staleBanner} role="status"><BrandIcon name="attention" />{t.stale}<button onClick={manualRefresh}>{t.refresh}</button></div>}

        <section id="watchlist-data" className={styles.dataRegion}>
          {dataState === "loading" && <div className={styles.loadingState} role="status"><span className={styles.spinner} /><strong>{t.loading}</strong><div className={styles.skeletonRows}>{Array.from({ length: 7 }, (_, index) => <i key={index} />)}</div></div>}
          {dataState === "error" && <div className={styles.errorBanner} role="alert"><BrandIcon name="attention" /><span><b>{t.errorTitle}</b> {t.errorBody}</span><button onClick={manualRefresh}>{t.retry}</button></div>}
          {canShowData && view === "map" && <HarborMap calls={effective} selected={selectedMapCallId ? calls.find((call) => call.id === selectedMapCallId) : undefined} tracks={snapshot?.tracking ?? []} serviceOrders={serviceOrders} locale={settings.locale} dateFormat={settings.dateFormat} now={operationNow} onOpenDetail={openDetail} onSelectCall={(call) => setSelectedMapCallId(call.id)} onClearSelection={() => setSelectedMapCallId(null)} onSelectBerth={selectBerthAndReturn} onBackToList={returnToList} />}
          {canShowData && view === "list" && effective.length === 0 && <div className={styles.emptyState}><span className={styles.emptyStateIcon}><BrandIcon name="search" /></span><h2>{t.noResults}</h2><p>{filters.query.trim() ? `${t.searchTerm}: “${filters.query.trim()}” · 0 ${t.calls.toLowerCase()}` : `0 ${t.calls.toLowerCase()}`}</p><button onClick={() => { clearFilters(); setDataState("ready"); }}>{t.clear}</button></div>}
          {canShowData && view === "list" && effective.length > 0 && <>
             <div className={styles.listSummary} aria-live="polite"><span>{t.showing} <strong>{rangeStart}–{rangeEnd}</strong> / {paged.total} {t.calls.toLowerCase()}</span><span>{activeFilterCount ? `${activeFilterCount} ${activeFilterCount === 1 ? t.activeFilter : t.activeFilters}` : t.all}</span></div>
             <div className={styles.mobileLayoutControl} role="group" aria-label={t.mobileLayoutLabel}>
               <span className={styles.mobileLayoutLabel}>{t.mobileLayoutLabel}</span>
               <div className={styles.mobileLayoutOptions}>
                 <button type="button" aria-pressed={settings.mobileLayout === "cards"} onClick={() => updateSettings({ mobileLayout: "cards" })}>{t.mobileLayoutCards}</button>
                 <button type="button" aria-pressed={settings.mobileLayout === "table"} onClick={() => updateSettings({ mobileLayout: "table" })}>{t.mobileLayoutTable}</button>
               </div>
               {settings.mobileLayout === "table" && <small className={styles.mobileLayoutHint}>{t.mobileLayoutHint}</small>}
             </div>
              <div ref={mobileTableRef} className={styles.tableScroller} onScroll={handleMobileTableScroll} tabIndex={0} aria-label="Scrollable port-call table"><table><thead><tr className={styles.tableGroupRow} aria-hidden="true">{getHeaderRuns(columns).map((run, index) => <th key={`${run.group}-${index}`} data-group={run.group} data-group-start="true" colSpan={run.columns.length}><span className={styles.tableGroupLabel}>{headerGroupLabels[settings.locale][run.group]}</span></th>)}</tr><tr>{columns.map((column) => { const sortKey = sortKeyForColumn(column); const active = sortKey === activeHeaderSortKey; const label = columnLabels[settings.locale][column]; const actionLabel = sortHeaderActionLabel(settings.locale, label, sortKey, settings.sortDirection, activeHeaderSortKey); return <th key={column} data-column={column} data-sort-active={active ? "true" : undefined} scope="col" aria-sort={active ? settings.sortDirection === "asc" ? "ascending" : "descending" : "none"}><button type="button" className={`${styles.sortableHeader} ${active ? styles.sortableHeaderActive : ""}`} data-hover-info={actionLabel} data-hover-label={settings.locale === "da" ? "Kolonnesortering" : "Column sorting"} data-hover-tone="action" onClick={() => cycleColumnSort(column)} aria-label={actionLabel}><span>{label}</span>{active && <span className={styles.sortDirectionMark} aria-hidden="true"><BrandIcon name={settings.sortDirection === "asc" ? "arrowUp" : "arrowDown"} /></span>}</button></th>})}</tr></thead><tbody>{paged.items.map((call) => <tr key={call.id} data-call-id={call.id} data-selected={selectedMapCallId === call.id} data-warning={getOperationalWarnings(call, calls, operationNow, serviceOrders).length > 0}>{columns.map((column) => <td key={column} data-column={column}>{renderCell(call, column)}</td>)}</tr>)}</tbody></table></div>
              {!settingsOpen && mobilePersistenceError && <p className={styles.visuallyHidden} role="alert">{t.mobilePersistenceWarning}</p>}
              {!settingsOpen && mobileFeedback && <p className={styles.visuallyHidden} role="status" aria-live="polite" aria-atomic="true">{mobileFeedback}</p>}
             <div className={styles.mobileCards}>{paged.items.map((call) => {
               const warnings = getOperationalWarnings(call, calls, operationNow, serviceOrders);
               const pinned = settings.pinnedIds.includes(call.id);
               const berthInteraction = berthFilterInteraction(call, operationNow, selectBerth);
               return <article key={call.id} data-call-id={call.id} className={`${styles.mobileCard} ${selectedMapCallId === call.id ? styles.mobileCardSelected : ""}`} data-warning={warnings.length > 0}>
                 <header><button className={styles.vesselButton} onClick={() => openDetail(call, "vessel")}><strong>{call.vesselName} <VisibilityBadge call={call} locale={settings.locale} /></strong><small>{call.callNumber} · {call.category}</small><span className={styles.visuallyHidden}>{statusLabels[settings.locale][call.status]}</span></button><div className={styles.mobileCardActions}><button type="button" className={styles.mobileDetailsButton} aria-label={`${t.openDetails}: ${call.vesselName}`} data-hover-info={`${t.openDetails}: ${call.vesselName}`} data-hover-label={settings.locale === "da" ? "Anløbsdetaljer" : "Call details"} data-hover-tone="action" onClick={() => openDetail(call)}><span>{t.detailsShort}</span><BrandIcon name="arrowUpRight" /></button><button type="button" className={`${styles.pinButton} ${pinned ? styles.pinButtonPinned : ""}`} aria-pressed={pinned} aria-label={pinned ? t.unpin : t.pin} data-hover-info="" data-hover-label={settings.locale === "da" ? "Handling" : "Action"} data-hover-tone="action" onClick={() => updateSettings({ pinnedIds: togglePinnedId(settings.pinnedIds, call.id) })}><span>{pinned ? t.unpin : t.pin}</span><BrandIcon name="pin" /></button></div></header>
                 {warnings.length > 0 && <button className={styles.mobileWarning} onClick={() => openDetail(call)} aria-label={`${warnings.length} ${t.attentionShort}`}><b><BrandIcon name="attention" /></b><strong>{warnings.length}</strong><span>{t.attentionShort}</span></button>}
                 <MobileTaskActions
                   call={call}
                   settings={settings}
                   now={operationNow}
                   serviceOrders={serviceOrders}
                   overrides={mobileTaskOverrides}
                    labels={mobileTaskLabels}
                   feedbackEnabled={mobileFeedbackEnabled}
                   onRegister={(operation, state) => registerMobileTask(call, operation, state)}
                   onSelectBerth={berthInteraction.onSelectBerth}
                   isBerthFilterable={berthInteraction.isBerthFilterable}
                 />
               </article>;
             })}</div>
             <nav className={styles.pagination} aria-label="Watchlist pagination"><label>{t.rows}<select value={settings.pageSize} onChange={(event) => { updateSettings({ pageSize: Number(event.target.value) }); setPage(1); }}><option>10</option><option>25</option><option>50</option></select></label><span>{paged.total} {settings.locale === "da" ? "anløb" : "calls"} · {t.page} <b>{paged.page}</b> {t.of} <b>{paged.pages}</b></span><div><button disabled={paged.page <= 1} data-hover-info="" data-hover-label={settings.locale === "da" ? "Navigation" : "Navigation"} data-hover-tone="action" onClick={() => setPage((current) => current - 1)} aria-label={t.previous}><BrandIcon name="arrowLeft" /></button><button disabled={paged.page >= paged.pages} data-hover-info="" data-hover-label={settings.locale === "da" ? "Navigation" : "Navigation"} data-hover-tone="action" onClick={() => setPage((current) => current + 1)} aria-label={t.nextPage}><BrandIcon name="arrowRight" /></button></div></nav>
          </>}
        </section>
      </section>

      {settingsOpen && <Overlay title={t.settings} onClose={() => setSettingsOpen(false)} closeLabel={t.close}><div className={styles.settingsGrid}>
        <label>{t.profile}<select value={settings.preset} onChange={(event) => choosePreset(event.target.value as ViewPreset)}>{visiblePresets.map((preset) => <option key={preset} value={preset}>{presetLabels[settings.locale][preset]}</option>)}</select></label>
        <label>{t.theme}<select value={settings.theme} onChange={(event) => updateSettings({ theme: event.target.value as "light" | "dark" })}><option value="dark">{chrome.dark}</option><option value="light">{chrome.light}</option></select></label>
        <label>{t.language}<select value={settings.locale} onChange={(event) => updateSettings({ locale: event.target.value as Locale })}><option value="en">{chrome.english}</option><option value="da">{chrome.danish}</option></select></label>
        <label>{t.dateFormat}<select value={settings.dateFormat} onChange={(event) => updateSettings({ dateFormat: event.target.value as "full" | "compact" })}><option value="full">{chrome.dateFull}</option><option value="compact">30-06-2026</option></select></label>
        <label>{chrome.density}<select value={settings.density} onChange={(event) => updateSettings({ density: event.target.value as "normal" | "compact" })}><option value="normal">{t.normal}</option><option value="compact">{t.compact}</option></select></label>
        <label>{t.refreshInterval}<select value={settings.refreshMinutes} onChange={(event) => updateSettings({ refreshMinutes: Math.max(MIN_REFRESH_MINUTES, Number(event.target.value)) })}><option value="10">10 min</option><option value="15">15 min</option><option value="30">30 min</option></select></label>
      </div><section className={styles.mobileTaskNotice} aria-label={t.mobileTasks}>
        <div className={styles.mobileTaskNoticeCopy}><strong>{t.mobileTasks}</strong><span>{t.mobileSimulationNote}</span></div>
        <div className={styles.mobileTaskNoticeActions}>
          <span className={styles.mobileOutboxSummary} aria-live="polite">
            {mobileOutboxEntries.length === 0 ? t.mobileReady : [
              mobilePendingCount ? `${mobilePendingCount} · ${t.mobilePending}` : "",
              mobileSentCount ? `${mobileSentCount} · ${t.mobileSent}` : "",
              mobileErrorCount ? `${mobileErrorCount} · ${t.mobileError}` : "",
            ].filter(Boolean).join(" · ")}
          </span>
          {mobileUndoAction && <button type="button" className={styles.mobileUndoButton} onClick={undoMobileRegistration}>{t.mobileUndo}</button>}
          {mobileOutboxEntries.length > 0 && <button type="button" className={styles.mobileResetButton} onClick={resetMobileDemo}>{t.mobileReset}</button>}
        </div>
        <label className={styles.mobileEnhancementToggle}><input type="checkbox" checked={mobileFeedbackEnabled} onChange={(event) => setMobileFeedbackEnabled(event.target.checked)} /><span>{t.mobileHaptics}</span></label>
        {mobilePersistenceError && <p className={styles.mobilePersistenceError} role="alert">{t.mobilePersistenceWarning}</p>}
        {mobileFeedback && <p className={styles.mobileFeedback} role="status" aria-live="polite" aria-atomic="true">{mobileFeedback}</p>}
        {mobileAuditLog.length > 0 && <details className={styles.mobileAudit}>
          <summary>{t.mobileAudit} · {mobileAuditLog.length}</summary>
          <ol>
            {mobileAuditLog.slice(0, 8).map((entry) => <li key={entry.id}><span>{entry.label}</span><small>{entry.action === "undo" ? t.mobileUndo : mobileAuditStatusLabel(entry.status)} · {formatClock(entry.createdAt)}</small></li>)}
          </ol>
        </details>}
      </section><section className={styles.demoAccessModule} data-access={demoProfile.access} aria-label={`${t.auth}: ${activeDemoName}`}>
        <div className={styles.demoAccessHeader}>
          <span className={styles.demoProfileBadge} aria-hidden="true">{demoProfile.initials}</span>
          <span className={styles.demoProfileName}><small>{t.auth}</small><strong>{demoProfile.name[settings.locale]}</strong></span>
          <span className={styles.demoStatePill}><i aria-hidden="true" />{t.demoLabel}</span>
        </div>
        <div className={styles.demoAccessFacts}>
          <div className={styles.demoAccessFact}><span>{t.accessLevel}</span><strong>{accessProfileLabel(demoProfile, settings.locale)}</strong></div>
          <div className={styles.demoAccessFact}><span>{t.dataScope}</span><strong>{accessRecordLabel(demoProfile, settings.locale)}</strong></div>
        </div>
        <Link className={styles.demoAccessAction} href="/login"><span>{t.signIn}</span><span aria-hidden="true"><BrandIcon name="arrowRight" /></span></Link>
      </section><button className={styles.secondaryButton} onClick={() => { setSettings(DEFAULT_SETTINGS); setActiveHeaderSortKey(null); clearFilters(); setDataState("ready"); }}>{chrome.reset}</button></Overlay>}

      {filtersOpen && <Overlay title={t.filters} onClose={() => setFiltersOpen(false)} closeLabel={t.close}>
        <details className={styles.filterGroup} open={statusFiltersOpen} onToggle={(event) => setStatusFiltersOpen(event.currentTarget.open)}>
          <summary>
            <span className={styles.filterSummaryLabel}><strong>Status</strong><small>{filters.statuses.length ? `${filters.statuses.length} ${t.selected}` : t.noneSelected}</small></span>
            <span className={styles.filterCount} aria-label={`${filters.statuses.length} ${t.selected}`}>{filters.statuses.length}</span>
          </summary>
          <div className={styles.filterOptions}>
            {STATUSES.map((status) => <label key={status}><input type="checkbox" checked={filters.statuses.includes(status)} onChange={() => changeFilters((current) => ({ ...current, statuses: current.statuses.includes(status) ? current.statuses.filter((item) => item !== status) : [...current.statuses, status], operationalOnly: false }))} />{statusLabels[settings.locale][status]}</label>)}
          </div>
        </details>
        <details className={styles.filterGroup} open={berthFiltersOpen} onToggle={(event) => setBerthFiltersOpen(event.currentTarget.open)}>
          <summary>
            <span className={styles.filterSummaryLabel}><strong>{columnLabels[settings.locale].berth}</strong><small>{t.currentAndUpcoming}</small></span>
            <span className={styles.filterCount} aria-label={`${filters.berths.length} ${t.selected}`}>{filters.berths.length}</span>
          </summary>
          <div className={`${styles.filterOptions} ${styles.filterOptionsBerths}`}>
            <label className={styles.filterSearch}><span className={styles.visuallyHidden}>{t.filterBerthSearch}</span><input type="search" value={berthQuery} onChange={(event) => setBerthQuery(event.target.value)} placeholder={t.filterBerthSearch} aria-label={t.filterBerthSearch} /></label>
            {visibleBerths.length > 0 ? visibleBerths.map((berth) => <label key={berth}><input type="checkbox" checked={filters.berths.includes(berth)} onChange={() => changeFilters((current) => ({ ...current, berths: current.berths.includes(berth) ? current.berths.filter((item) => item !== berth) : [...current.berths, berth] }))} />{formatBerthCode(berth)}</label>) : <p className={styles.filterEmpty} role="status">{t.noBerths}</p>}
          </div>
        </details>
        <label className={styles.attentionCheck}><input type="checkbox" checked={filters.operationalOnly} onChange={(event) => updateFilters({ operationalOnly: event.target.checked })} />{t.activeOnly}</label>
        <label className={styles.attentionCheck}><input type="checkbox" checked={filters.attentionOnly} onChange={(event) => updateFilters({ attentionOnly: event.target.checked })} />{t.attention}</label>
        <button className={styles.secondaryButton} onClick={clearFilters}>{t.clear}</button>
      </Overlay>}

      {columnsOpen && <Overlay title={t.columns} onClose={() => { finishColumnDrag(); setColumnsOpen(false); }} closeLabel={t.close}>
        <p className={styles.helperText}>{t.columnsHelper}</p>
        <div className={styles.columnList} role="list" aria-label={t.columns}>
          {chooserColumns.map((column, index) => <div
            key={column}
            role="listitem"
            data-dragging={dragColumn === column ? "true" : undefined}
            data-drop-target={dropColumn === column ? "true" : undefined}
            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; if (dragColumn && dragColumn !== column) setDropColumn(column); }}
            onDragEnter={(event) => { event.preventDefault(); if (dragColumn && dragColumn !== column) setDropColumn(column); }}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropColumn(null); }}
            onDrop={(event) => dropChooserColumn(event, column)}
          >
            <button
              type="button"
              className={styles.dragHandle}
              draggable
              onDragStart={(event) => startColumnDrag(event, column)}
              onDragEnd={finishColumnDrag}
              aria-grabbed={dragColumn === column}
              aria-label={`${t.dragColumn}: ${columnLabels[settings.locale][column]}`}
              data-hover-info={`${t.dragColumn}: ${columnLabels[settings.locale][column]}`}
              data-hover-label={settings.locale === "da" ? "Kolonnerækkefølge" : "Column order"}
              data-hover-tone="action"
            ><BrandIcon name="grip" /></button>
            <label><input type="checkbox" checked={!settings.hiddenColumns.includes(column)} onChange={() => updateSettings({ hiddenColumns: settings.hiddenColumns.includes(column) ? settings.hiddenColumns.filter((item) => item !== column) : [...settings.hiddenColumns, column] })} />{columnLabels[settings.locale][column]}</label>
            <span className={styles.columnMoveButtons}><button type="button" disabled={index === 0} data-hover-info="" data-hover-label={settings.locale === "da" ? "Kolonnerækkefølge" : "Column order"} data-hover-tone="action" onClick={() => moveChooserColumn(column, -1)} aria-label={`${t.moveUp}: ${columnLabels[settings.locale][column]}`}><BrandIcon name="arrowUp" /></button><button type="button" disabled={index === chooserColumns.length - 1} data-hover-info="" data-hover-label={settings.locale === "da" ? "Kolonnerækkefølge" : "Column order"} data-hover-tone="action" onClick={() => moveChooserColumn(column, 1)} aria-label={`${t.moveDown}: ${columnLabels[settings.locale][column]}`}><BrandIcon name="arrowDown" /></button></span>
          </div>)}
        </div>
        <details><summary>{settings.locale === "da" ? "Tilføj felter uden for denne profil" : "Add fields not in this preset"}</summary><div className={styles.addColumns}>{ALL_COLUMNS.filter((column) => column !== "status" && !chooserColumns.includes(column)).map((column) => <button key={column} onClick={() => updateSettings({ columns: [...chooserColumns, column] })}>+ {columnLabels[settings.locale][column]}</button>)}</div></details>
      </Overlay>}
      {selectedCall && effectiveSnapshot && <DetailPanel call={selectedCall} snapshot={effectiveSnapshot} settings={settings} initialTab={detailInitialTab} notes={resolvedNotesForCall(selectedCall)} onAddNote={(text) => addNote(selectedCall.id, text)} onSelectBerth={selectBerth} now={operationNow} onClose={() => setSelectedCallId(null)} />}
    </main>
  );
}
