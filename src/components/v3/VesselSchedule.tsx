"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BrandIcon as Icon } from "@/components/brand/BrandIcon";
import { CurrentDateTime } from "./CurrentDateTime";
import { applyBookingWindow } from "@/lib/bookingWindow";
import { ColumnEditor } from "./ColumnEditor";
import { AARHUS_HAVN_MARK } from "@/lib/brand";
import type { DemoProfile } from "@/lib/demoProfiles";
import { DEFAULT_FILTERS, PROTOTYPE_OPERATIONS_NOW as SCENARIO_START, filterPortCalls, formatBerthCode, formatClock, getNextActionableOperation, getOperationalWarnings, getOperationallyActiveCalls, getRelevantBerthAssignments, cycleSort, naturalSortDirection, SORT_KEYS, normalizeBerthOptions, paginate, sortPortCalls, togglePinnedId, type Locale, type PortCall, type PortCallNote, type PortCallStatus, type PortOperation, type SortKey, type WatchlistFilters, type WatchlistSnapshot } from "@/lib/watchlist";
import { mobileTaskData, mobileTaskKey, type MobileTaskOverride, type MobileTaskOverrideMap } from "@/lib/mobileTask";
import { watchlistService } from "@/services/watchlistService";
import type { DetailTab } from "./CallDetail";
import { operationNames, statusNames } from "./display";
import { HoverInfo } from "./HoverInfo";
import { columnNames, presetColumns, restoredColumns, sortColumns, type Column, type Preset } from "./columns";
import { cycleServiceSort, restoredServiceSort, sortByActionService, type ActionServiceSort, type ServiceSortColumn } from "./actionServiceSort";
import type { ServiceCode } from "@/lib/watchlist";
import { ScheduleTable } from "./ScheduleTable";
import { MobileCallList } from "./MobileCallList";
import { StateLabel } from "./StateLabel";
import { sortScheduleCalls } from "./sortSchedule";
import { sanitizeLocalState } from "./localState";
import s from "./VesselSchedule.module.css";

const PortMap = dynamic(() => import("./PortMap").then(m => m.PortMap), { ssr: false, loading: () => <div className={s.empty} role="status">Havnekort / Harbour map…</div> });
const CallDetail = dynamic(() => import("./CallDetail").then(m => m.CallDetail), { ssr: false, loading: () => <div className={s.empty} role="status" aria-live="polite">Indlæser call-detaljer / Loading call details…</div> });
type Scope = "shift" | "all" | "pinned" | "attention";

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current, active = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    dialog?.showModal(); document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = previous; active?.focus(); };
  }, []);
  return <dialog ref={ref} className={s.panel} aria-labelledby="panel-title" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div className={s.panelInner}><header><h2 id="panel-title">{title}</h2><button className={s.iconButton} aria-label="Luk / Close" onClick={onClose}><Icon name="close" /></button></header>{children}</div></dialog>;
}

export function VesselSchedule({ initialSnapshot, profile }: { initialSnapshot: WatchlistSnapshot; profile: DemoProfile }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [locale, setLocale] = useState<Locale>("da");
  const [preset, setPreset] = useState<Preset>("office");
  const [compact, setCompact] = useState(false);
  const [mobileLayout, setMobileLayout] = useState<"cards" | "table">("cards");
  const [activeHeaderSort, setActiveHeaderSort] = useState<SortKey | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [NOW, setOperationNow] = useState<string>(SCENARIO_START);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => setOperationNow(new Date(Date.parse(SCENARIO_START) + Date.now() - started).toISOString()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const [scope, setScope] = useState<Scope>("shift");
  const [view, setView] = useState<"list" | "map">("list");
  const [filters, setFilters] = useState<WatchlistFilters>(DEFAULT_FILTERS);
  const [serviceSort, setServiceSort] = useState<ActionServiceSort | null>(null);
  const [sort, setSort] = useState<SortKey>("job-order");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [pins, setPins] = useState<readonly string[]>([]);
  const [notes, setNotes] = useState<Record<string, PortCallNote[]>>({});
  const [overrides, setOverrides] = useState<MobileTaskOverrideMap>({});
  const [customColumns, setCustomColumns] = useState<Column[] | null>(null);
  const [detail, setDetail] = useState<{ id: string; tab: DetailTab } | null>(null);
  const [mapSelected, setMapSelected] = useState<string>();
  const [panel, setPanel] = useState<"filters" | "columns" | "settings" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [online, setOnline] = useState(true);
  const [age, setAge] = useState(0);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const loadLock = useRef(false);
  const storeKey = `aarhus-havn-v3.${profile.id}`;
  const canPersist = profile.access !== "restricted" && !snapshot.calls.some(call => call.visibility === "restricted");
  const safeLocal = useMemo(() => sanitizeLocalState({ pins, notes, overrides }, snapshot.calls), [pins, notes, overrides, snapshot.calls]);
  const da = locale === "da";
  const t = (dk: string, en: string) => da ? dk : en;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const mayRead = profile.access !== "restricted" && !initialSnapshot.calls.some(call => call.visibility === "restricted");
        const value = mayRead ? JSON.parse(localStorage.getItem(storeKey) ?? "null") : null;
        const saved = sanitizeLocalState(value, initialSnapshot.calls);
        setPins(saved.pins); setNotes(saved.notes); setOverrides(saved.overrides);
        if (value) {
          if (value.theme === "light" || value.theme === "dark") setTheme(value.theme);
          if (value.locale === "da" || value.locale === "en") setLocale(value.locale);
          if (["full", "office", "port"].includes(value.preset)) setPreset(value.preset);
          setCustomColumns(restoredColumns(value.columns, value.columnsVersion));
          if (value.mobileLayout === "cards" || value.mobileLayout === "table") setMobileLayout(value.mobileLayout);
          if (value.preset === "full") setServiceSort(restoredServiceSort(value.serviceSort));
          if (SORT_KEYS.includes(value.sort) && value.sort !== "customer") { setSort(value.sort); setActiveHeaderSort(value.sort); }
          if (value.direction === "asc" || value.direction === "desc") setDirection(value.direction);
          if ([10, 20, 50].includes(value.pageSize)) setPageSize(value.pageSize);
          setCompact(value.compact === true); setCollapsed(value.collapsed === true);
        }
      } catch { /* Fall back to readable defaults if stored preferences are unavailable. */ }
      setOnline(navigator.onLine); setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [storeKey, profile.access, initialSnapshot.calls]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = locale;
    document.documentElement.style.colorScheme = theme;
    if (ready) { try { if (canPersist) localStorage.setItem(storeKey, JSON.stringify({ theme, locale, preset, compact, mobileLayout, collapsed, ...safeLocal, columns: customColumns, columnsVersion: 2, sort, serviceSort, direction, pageSize })); else localStorage.removeItem(storeKey); } catch { /* In-memory interaction remains available in private browsing. */ } }
  }, [theme, locale, preset, compact, mobileLayout, collapsed, safeLocal, customColumns, sort, serviceSort, direction, pageSize, ready, storeKey, canPersist]);
  const refresh = useCallback(async (notify = true) => {
    if (loadLock.current) return;
    loadLock.current = true; setLoading(true); setError(false);
    try {
      const next = await watchlistService.refresh();
      // Revoke stale local identifiers together with the authoritative snapshot.
      setPins(value => sanitizeLocalState({ pins: value }, next.calls).pins);
      setNotes(value => sanitizeLocalState({ notes: value }, next.calls).notes);
      setOverrides(value => sanitizeLocalState({ overrides: value }, next.calls).overrides);
      setSnapshot(next);
      setAge(Math.max(0, Math.floor((Date.now() - Date.parse(next.fetchedAt)) / 60_000)));
      if (notify) setToast({ text: locale === "da" ? "Call-listen er opdateret" : "Port calls updated" });
    }
    catch { setError(true); }
    finally { setLoading(false); loadLock.current = false; }
  }, [locale]);
  useEffect(() => {
    const interval = setInterval(() => void refresh(false), 600_000);
    const tick = setInterval(() => setAge(Math.max(0, Math.floor((Date.now() - Date.parse(snapshot.fetchedAt)) / 60_000))), 30_000);
    const connect = () => { setOnline(true); void refresh(false); }, disconnect = () => setOnline(false);
    window.addEventListener("online", connect); window.addEventListener("offline", disconnect);
    return () => { clearInterval(interval); clearInterval(tick); window.removeEventListener("online", connect); window.removeEventListener("offline", disconnect); };
  }, [refresh, snapshot.fetchedAt]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), toast.undo ? 9000 : 3500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "/" && !detail && !panel && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [detail, panel]);

  const effective = useMemo(() => {
    const registered = mobileTaskData(snapshot.calls, snapshot.serviceOrders, safeLocal.overrides);
    const data = applyBookingWindow({ ...snapshot, ...registered }, NOW);
    return { ...snapshot, ...data, calls: data.calls.map(call => ({ ...call, status: call.operations.some(op => op.type === "departure" && op.state === "actual") ? "departed" as const : call.operations.some(op => op.type === "arrival" && op.state === "actual") ? "arrived" as const : call.status, notes: [...call.notes, ...(safeLocal.notes[call.id] ?? [])] })) };
  }, [snapshot, safeLocal, NOW]);
  const activeCalls = useMemo(() => getOperationallyActiveCalls(effective.calls, NOW, 8, effective.serviceOrders), [effective, NOW]);
  const attention = useMemo(() => effective.calls.filter(call => getOperationalWarnings(call, effective.calls, NOW, effective.serviceOrders).length), [effective, NOW]);
  const nextCall = useMemo(() => sortPortCalls(activeCalls, "job-order", "asc", [], NOW, effective.serviceOrders)[0], [activeCalls, effective.serviceOrders, NOW]);
  const nextOp = nextCall && getNextActionableOperation(nextCall, NOW, effective.serviceOrders);
  const filtered = useMemo(() => {
    const input = scope === "pinned" ? effective.calls.filter(c => pins.includes(c.id)) : effective.calls;
    const list = filterPortCalls(input, { ...filters, operationalOnly: scope === "shift", attentionOnly: scope === "attention" }, effective.calls, NOW, effective.serviceOrders);
    const ordered = sortScheduleCalls(list, sort, direction, pins, NOW, effective.serviceOrders);
    return preset === "full" && serviceSort ? sortByActionService(ordered, serviceSort, effective.serviceOrders, pins) : ordered;
  }, [effective, filters, scope, pins, sort, serviceSort, preset, direction, NOW]);
  const paged = paginate(filtered, page, pageSize);
  const mapCalls = useMemo(() => filterPortCalls(scope === "pinned" ? effective.calls.filter(call => pins.includes(call.id)) : effective.calls, { ...filters, berths: [], operationalOnly: scope === "shift", attentionOnly: scope === "attention" }, effective.calls, NOW, effective.serviceOrders), [effective, filters, scope, pins, NOW]);
  const selected = effective.calls.find(c => c.id === detail?.id);
  const columns = (customColumns ?? presetColumns[preset]).filter(column => column !== "customer");
  const berths = useMemo(() => normalizeBerthOptions(effective.calls.flatMap(c => getRelevantBerthAssignments(c, NOW).map(p => p.berth))), [effective.calls, NOW]);
  const filterCount = filters.statuses.length + filters.berths.length + (filters.studOnly ? 1 : 0) + (filters.serviceCodes?.length ?? 0);
  const reset = () => { setFilters(DEFAULT_FILTERS); setScope("all"); setPage(1); };
  const selectScope = (value: Scope) => { setScope(value); setPage(1); };
  const showMetric = (value: Scope) => { setFilters(DEFAULT_FILTERS); selectScope(value); setView("list"); };
  const open = (call: PortCall, tab: DetailTab = "call") => setDetail({ id: call.id, tab });
  const pin = (call: PortCall) => { setPins(ids => togglePinnedId(ids, call.id)); setToast({ text: pins.includes(call.id) ? t(`${call.vesselName} fjernet fra fastgjorte`, `${call.vesselName} unpinned`) : t(`${call.vesselName} fastgjort`, `${call.vesselName} pinned`) }); };
  const byBerth = (berth: string) => { setFilters(f => ({ ...f, berths: [berth] })); setScope("all"); setView("list"); setPage(1); };
  const byStud = () => { setFilters(value => ({ ...value, studOnly: true })); setPage(1); };
  const sortService = (column: ServiceSortColumn, code: ServiceCode) => { setServiceSort(current => cycleServiceSort(current, column, code)); setPage(1); };
  const sortBy = (key: SortKey) => { setServiceSort(null); const next = cycleSort(sort, direction, key, activeHeaderSort); setDirection(next.sortDirection); setSort(next.sortKey); setActiveHeaderSort(next.activeSortKey); setPage(1); };
  const showOnMap = (call: PortCall) => { setMapSelected(call.id); setFilters(DEFAULT_FILTERS); setScope("all"); setView("map"); setDetail(null); };
  const registerCall = (call: PortCall, operation: PortOperation, registration: MobileTaskOverride = { state: "actual" }) => {
    if (call.visibility === "restricted") return;
    const key = mobileTaskKey(call.id, operation.id), previous = overrides[key];
    setOverrides(value => ({ ...value, [key]: { ...registration, ...(registration.state === "actual" ? { registeredAt: operation.state === "actual" ? operation.mobileRegisteredAt ?? operation.at : NOW } : {}) } }));
    setDetail(null);
    setToast({ text: t(`${operationNames.da[operation.type]} registreret`, `${operationNames.en[operation.type]} recorded`), undo: () => { setOverrides(value => { const next = { ...value }; if (previous) next[key] = previous; else delete next[key]; return next; }); setToast({ text: t("Registreringen er fortrudt", "Registration undone") }); } });
  };
  const addNote = (text: string) => {
    if (!selected || selected.visibility === "restricted" || !text.trim()) return;
    const note = { id: crypto.randomUUID(), text: text.trim(), authorRole: profile.name[locale], createdAt: new Date().toISOString() };
    setNotes(value => ({ ...value, [selected.id]: [...(value[selected.id] ?? []), note] }));
    setToast({ text: t("Note gemt", "Note saved") });
  };

  const themeButton = <button className={s.themeButton} onClick={() => setTheme(v => v === "dark" ? "light" : "dark")} aria-label={theme === "dark" ? t("Skift til lyst tema", "Switch to light mode") : t("Skift til mørkt tema", "Switch to dark mode")} data-help={theme === "dark" ? t("Lyst tema", "Light mode") : t("Mørkt tema", "Dark mode")}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">{theme === "dark" ? <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></> : <path d="M20.5 13.2A8.5 8.5 0 0 1 10.8 3.5a8.5 8.5 0 1 0 9.7 9.7Z"/>}</svg></button>;

  return <div className={s.app} data-theme={theme} data-collapsed={collapsed} data-view={view} data-density={compact ? "compact" : "normal"} data-mobile-layout={mobileLayout}>
    <HoverInfo />
    <a className={s.skip} href="#calls">{t("Gå til call-listen", "Skip to port calls")}</a>
    <aside className={s.rail} inert={collapsed} aria-hidden={collapsed} id="primary-navigation" aria-label={t("Primær navigation", "Primary navigation")}>
      <a className={s.logoTile} href="/watchlist" aria-label="Aarhus Havn"><Image src={AARHUS_HAVN_MARK} alt="Aarhus Havn" width={32} height={32} unoptimized /></a>
      <nav aria-label={t("Hovednavigation", "Main navigation")}>
        <button data-active={view === "list" && scope !== "pinned"} aria-current={view === "list" && scope !== "pinned" ? "page" : undefined} onClick={() => { setView("list"); if (scope === "pinned") selectScope("shift"); }}><Icon name="operations" /><span>{t("Liste", "List")}</span></button>
        <button data-active={view === "map"} aria-current={view === "map" ? "page" : undefined} onClick={() => setView("map")}><Icon name="map" /><span>{t("Kort", "Map")}</span></button>
        <button data-active={view === "list" && scope === "pinned"} aria-current={view === "list" && scope === "pinned" ? "page" : undefined} onClick={() => { selectScope("pinned"); setView("list"); }}><Icon name="pin" /><span>{t("Fastgjorte", "Pinned")}</span></button>
      </nav>
      <div className={s.railBottom}>{themeButton}<button className={s.avatar} onClick={() => setPanel("settings")} aria-label={t("Indstillinger", "Settings")}>{profile.initials}</button></div>
    </aside>
    <button className={s.collapse} aria-expanded={!collapsed} aria-controls="primary-navigation" aria-label={collapsed ? t("Vis sidebar", "Show sidebar") : t("Skjul sidebar", "Hide sidebar")} data-help={collapsed ? t("Vis menu", "Show menu") : t("Skjul menu", "Hide menu")} onClick={() => setCollapsed(v => !v)}><Icon name={collapsed ? "arrowRight" : "arrowLeft"} /></button>
    <main className={s.main}>
      <header className={s.topbar}><div className={s.breadcrumb}><Image src="/brand/aarhus-havn-wordmark.svg" alt="Aarhus Havn" width={1513} height={145}/><span>/</span><span>{t("Havnedrift", "Port operations")}</span></div><div className={s.topActions}><button className={s.sync} aria-label={t("Opdater calls", "Refresh port calls")} aria-busy={loading} disabled={loading} onClick={() => void refresh()} data-problem={!online || error || age >= 10}><Icon name="followUp" className={loading ? s.spinning : undefined}/>{loading ? t("Opdaterer…", "Updating…") : !online ? "Offline" : error ? t("Opdatering fejlede", "Update failed") : age < 1 ? t("Netop opdateret", "Just updated") : t(`Opdateret for ${age} min. siden`, `Updated ${age} min. ago`)}</button><div className={s.mobileTheme}>{themeButton}</div><button className={s.iconButton} aria-label={t("Indstillinger", "Settings")} data-help={t("Indstillinger", "Settings")} onClick={() => setPanel("settings")}><Icon name="settings"/></button></div></header>
      <section className={s.heading}><div><p className={s.eyebrow}>{t("CALLS & HAVNETRAFIK", "PORT CALLS & TRAFFIC")}</p><h1>Vessel Schedule<span className={s.headingDot}>.</span></h1></div><CurrentDateTime locale={locale} /></section>
      <section className={s.metrics} aria-label={t("Vagtens overblik", "Shift summary")}>
        <button onClick={() => showMetric("shift")} className={s.metric}><span><Icon name="portCall"/>{t("Aktive calls", "Active calls")}</span><strong>{activeCalls.length.toString().padStart(2, "0")}<small>{t("denne vagt", "this shift")}</small></strong><Icon name="arrowUpRight"/></button>
        <button onClick={() => showMetric("attention")} className={`${s.metric} ${s.attentionMetric}`}><span><Icon name="attention"/>OPS.</span><strong>{attention.length.toString().padStart(2, "0")}<small>{t("calls med advarsler", "calls with warnings")}</small></strong><Icon name="arrowUpRight"/></button>
        <button onClick={() => nextCall && open(nextCall, "timeline")} className={`${s.metric} ${s.nextMetric}`} disabled={!nextOp}><span><Icon name="operations"/>{t("Næste opgave", "Next task")}</span><strong>{nextOp ? formatClock(nextOp.at) : "—"}<small>{nextOp ? operationNames[locale][nextOp.type] : t("Ingen opgaver", "No tasks")}</small></strong><span className={s.nextVessel}>{nextCall?.vesselName}</span><Icon name="arrowUpRight"/></button>
      </section>
      {(!online || error || age >= 10) && <div role="status" className={s.error}><Icon name="attention"/><span>{!online ? t("Du er offline. De senest hentede calls vises.", "You are offline. Showing the latest saved snapshot.") : error ? t("Listen kunne ikke opdateres. Dine nuværende calls er stadig synlige.", "The list could not refresh. Your current calls are still visible.") : t("Oplysningerne er over 10 minutter gamle.", "Information is more than 10 minutes old.")}</span><button onClick={() => void refresh()}>{t("Prøv igen", "Retry")}</button></div>}
      <section className={s.workspace} aria-label={t("Call-listen", "Port call workspace")}>
        <div className={s.viewbar}><div className={s.scopes} aria-label={t("Vis calls", "Show calls")}>{(["shift", "all", "pinned", "attention"] as Scope[]).map(value => <button key={value} aria-pressed={scope === value} onClick={() => selectScope(value)}>{value === "shift" ? t("Denne vagt", "This shift") : value === "all" ? t("Alle calls", "All calls") : value === "pinned" ? t("Fastgjorte", "Pinned") : t("Advarsler", "Warnings")}<span>{value === "shift" ? activeCalls.length : value === "all" ? effective.calls.length : value === "pinned" ? pins.filter(id => effective.calls.some(c => c.id === id)).length : attention.length}</span></button>)}</div><div className={s.segmented} aria-label={t("Visning", "View")}>{(["list", "map"] as const).map(mode => <button key={mode} aria-pressed={view === mode} onClick={() => setView(mode)}><Icon name={mode === "list" ? "operations" : "map"}/>{mode === "list" ? t("Liste", "List") : t("Kort", "Map")}</button>)}</div></div>
        <div className={s.toolbar}><div className={s.search}><Icon name="search"/><input ref={searchRef} type="search" value={filters.query} placeholder={t("Søg skib, call, kaj, agent, STUD…", "Search vessel, call, quay, agent, STUD…")} aria-label={t("Søg calls", "Search port calls")} onChange={e => { setFilters(f => ({ ...f, query: e.target.value })); setPage(1); }}/><kbd>/</kbd></div><button className={s.toolButton} data-active={filterCount > 0} onClick={() => setPanel("filters")}><Icon name="filter"/>{t("Filtre", "Filters")}{filterCount > 0 && <b>{filterCount}</b>}</button><div className={s.presets} aria-label={t("Arbejdsprofil", "Workspace preset")}>{(["full", "office", "port"] as Preset[]).map(p => <button key={p} aria-pressed={preset === p} onClick={() => { setPreset(p); setCustomColumns(null); setServiceSort(null); setPage(1); }}>{p === "full" ? t("Fuld", "Full") : p === "office" ? t("Kontor", "Office") : t("Havn", "Harbour")}</button>)}</div><label className={s.sort}><span className={s.srOnly}>{t("Sortering", "Sort by")}</span><select value={serviceSort ? "action-service" : sort} onChange={e => { setServiceSort(null); const key = e.target.value as SortKey; setSort(key); setActiveHeaderSort(key); setDirection(naturalSortDirection(key)); setPage(1); }}>{serviceSort && <option value="action-service">{columnNames[locale][serviceSort.column]} · {serviceSort.code}</option>}{(Object.keys(sortColumns) as Column[]).filter(col => col !== "customer").map(col => <option key={col} value={sortColumns[col]}>{columnNames[locale][col]}</option>)}</select></label><button className={`${s.iconButton} ${s.sortDirection}`} aria-label={t("Vend sortering", "Reverse sort")} data-help={t("Vend sortering", "Reverse sort")} onClick={() => { if (serviceSort) setServiceSort({ ...serviceSort, direction: serviceSort.direction === "asc" ? "desc" : "asc" }); else setDirection(d => d === "asc" ? "desc" : "asc"); setPage(1); }}><Icon name={(serviceSort?.direction ?? direction) === "asc" ? "arrowUp" : "arrowDown"}/></button><button className={`${s.toolButton} ${s.densityButton}`} aria-label={compact ? t("Normal visning", "Normal density") : t("Kompakt visning", "Compact density")} aria-pressed={compact} data-help={t("Tæthed", "Density")} onClick={() => setCompact(v => !v)}><Icon name="density"/><span>{compact ? t("Kompakt", "Compact") : t("Normal", "Normal")}</span></button><button className={`${s.iconButton} ${s.desktopTool}`} aria-label={t("Tilpas kolonner", "Customize columns")} data-help={t("Kolonner", "Columns")} onClick={() => setPanel("columns")}><Icon name="columns"/></button><button className={s.refresh} aria-label={t("Opdater calls", "Refresh port calls")} disabled={loading} data-help={t("Opdater", "Refresh")} onClick={() => void refresh()}><Icon className={loading ? s.spinning : ""} name="followUp"/></button></div>
        {(filterCount > 0 || filters.query) && <div className={s.filterChips}>{filters.query && <button onClick={() => setFilters(f => ({ ...f, query: "" }))}>“{filters.query}” <Icon name="close"/></button>}{filters.statuses.map(value => <button key={value} onClick={() => setFilters(f => ({ ...f, statuses: f.statuses.filter(v => v !== value) }))}>{statusNames[locale][value]}<Icon name="close"/></button>)}{filters.berths.map(value => <button key={value} onClick={() => setFilters(f => ({ ...f, berths: f.berths.filter(v => v !== value) }))}>{t("Kaj", "Quay")} {formatBerthCode(value)}<Icon name="close"/></button>)}{filters.studOnly && <button onClick={() => { setFilters(f => ({ ...f, studOnly: false })); setPage(1); }}>STUD<Icon name="close"/></button>}{filters.serviceCodes?.map(code => <button key={code} aria-label={t(`Fjern servicefilter ${code}`, `Remove service filter ${code}`)} onClick={() => { setFilters(f => ({ ...f, serviceCodes: f.serviceCodes?.filter(value => value !== code) })); setPage(1); }}>{code}<Icon name="close"/></button>)}<button onClick={() => { setFilters(DEFAULT_FILTERS); setPage(1); }}>{t("Ryd filtre", "Clear filters")}</button></div>}
        <div id="calls" className={s.results} tabIndex={-1}>
          {view === "list" && <div className={s.mobileListControls}><span><b>{filtered.length}</b> {t("calls", "calls")}</span><div className={s.segmented} aria-label={t("Mobilvisning", "Mobile layout")}><button aria-pressed={mobileLayout === "cards"} onClick={() => setMobileLayout("cards")}>Swipe</button><button aria-pressed={mobileLayout === "table"} onClick={() => setMobileLayout("table")}>{t("Liste", "Table")}</button></div><button className={s.iconButton} aria-label={t("Tilpas kolonner", "Customize columns")} onClick={() => setPanel("columns")}><Icon name="columns"/></button><button className={`${s.toolButton} ${s.densityButton}`} aria-label={compact ? t("Normal visning", "Normal density") : t("Kompakt visning", "Compact density")} aria-pressed={compact} onClick={() => setCompact(value => !value)}><Icon name="density"/><span>{compact ? t("Kompakt", "Compact") : t("Normal", "Normal")}</span></button></div>}
          <div className={s.resultMeta}><span><b>{filtered.length}</b> {t("calls", "port calls")} <i>·</i> {scope === "shift" ? t("i den aktuelle vagt", "in the current shift") : scope === "attention" ? t("med aktive driftsadvarsler", "with active operational warnings") : scope === "pinned" ? t("i din liste", "in your list") : t("i planlægningen", "in the schedule")}</span><span className={s.timeLegend}><StateLabel state="expected">{t("Forventet", "Expected")}</StateLabel><StateLabel state="ordered">{t("Bestilt", "Ordered")}</StateLabel><StateLabel state="actual">{t("Faktisk", "Actual")}</StateLabel></span></div>
          {view === "map" ? <PortMap now={NOW} calls={mapCalls} snapshot={effective} selected={effective.calls.find(c => c.id === mapSelected)} locale={locale} activeBerths={filters.berths} onBerthsChange={berths => { setFilters(f => ({ ...f, berths })); setScope("all"); setPage(1); }} onSelect={c => setMapSelected(c.id)} onOpen={c => open(c)} onBerth={byBerth}/> : !filtered.length ? <div className={s.empty}><Icon name={scope === "pinned" ? "pin" : "search"}/><h2>{scope === "pinned" && !filterCount && !filters.query ? t("Dine vigtigste calls. Samlet her.", "Your important calls. Together here.") : t("Ingen calls matcher", "No matching port calls")}</h2><p>{scope === "pinned" ? t("Fastgør et skib i listen, så du hurtigt kan finde det igen.", "Pin a vessel in the list to find it quickly next time.") : t("Prøv et andet søgeord, eller udvid dine filtre.", "Try another search or broaden your filters.")}</p><button className={s.primaryButton} onClick={reset}>{t("Vis alle calls", "Show all calls")}<Icon name="arrowRight"/></button></div> : <>
            <div className={s.tableView}><ScheduleTable serviceSort={preset === "full" ? serviceSort : null} onServiceSort={sortService} preset={preset} calls={paged.items} allCalls={effective.calls} serviceOrders={effective.serviceOrders} locale={locale} now={NOW} columns={columns} compact={compact} pins={pins} sort={sort} direction={direction} onSort={sortBy} onPin={pin} onOpen={open} onBerth={byBerth} onStud={byStud}/></div>
            <div className={s.mobileCards}><MobileCallList calls={paged.items} allCalls={effective.calls} serviceOrders={effective.serviceOrders} locale={locale} preset={preset} compact={compact} now={NOW} pins={pins} onPin={pin} onOpen={open} onBerth={byBerth} onStud={byStud} onRegister={registerCall} onShowMap={showOnMap}/></div>
            <footer className={s.pagination}><span>{t("Viser", "Showing")} {(paged.page - 1) * pageSize + 1}–{Math.min(paged.page * pageSize, filtered.length)} {t("af", "of")} {filtered.length}</span><label><span>{t("Pr. side", "Per page")}</span><select aria-label={t("Pr. side", "Per page")} value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>{[10, 20, 50].map(n => <option key={n}>{n}</option>)}</select></label><div><button className={s.iconButton} disabled={paged.page <= 1} aria-label={t("Forrige side", "Previous page")} onClick={() => setPage(paged.page - 1)}><Icon name="arrowLeft"/></button><span>{paged.page} / {paged.pages}</span><button className={s.iconButton} disabled={paged.page >= paged.pages} aria-label={t("Næste side", "Next page")} onClick={() => setPage(paged.page + 1)}><Icon name="arrowRight"/></button></div></footer>
          </>}
        </div>
      </section>
      <footer className={s.pageFooter}><span>AARHUS HAVN <span>·</span> PORT OF AARHUS</span><span>{t("Alle tider er lokal tid · Aarhus", "All times are local · Aarhus")}</span></footer>
    </main>
    <nav className={s.mobileNav} aria-label={t("Mobil navigation", "Mobile navigation")}><button aria-current={view === "list" && scope !== "pinned" ? "page" : undefined} onClick={() => { setView("list"); if (scope === "pinned") selectScope("shift"); }}><Icon name="operations"/>{t("Liste", "List")}</button><button aria-current={view === "map" ? "page" : undefined} onClick={() => setView("map")}><Icon name="map"/>{t("Kort", "Map")}</button><button aria-current={view === "list" && scope === "pinned" ? "page" : undefined} onClick={() => { setView("list"); selectScope("pinned"); }}><Icon name="pin"/>{t("Fastgjorte", "Pinned")}{pins.length > 0 && <b>{pins.length}</b>}</button><button onClick={() => setPanel("settings")}><span className={s.miniAvatar}>{profile.initials}</span>{t("Profil", "Profile")}</button></nav>
    {panel === "filters" && <Panel title={t("Filtrér calls", "Filter port calls")} onClose={() => setPanel(null)}><fieldset className={s.fieldset}><legend>Status</legend><div className={s.checkGrid}>{(["expected", "en-route", "arrived", "departed"] as PortCallStatus[]).map(value => <label key={value}><input type="checkbox" checked={filters.statuses.includes(value)} onChange={e => { setFilters(f => ({ ...f, statuses: e.target.checked ? [...f.statuses, value] : f.statuses.filter(v => v !== value) })); setPage(1); }}/>{statusNames[locale][value]}</label>)}</div></fieldset><fieldset className={s.fieldset}><legend>{t("Arbejdssted", "Work location")}</legend><label><input type="checkbox" checked={!!filters.studOnly} onChange={event => { setFilters(value => ({ ...value, studOnly: event.target.checked })); setPage(1); }} /> STUD · {t("kørsel ud til skibet", "travel to vessel")}</label></fieldset><fieldset className={s.fieldset}><legend>Service</legend><p className={s.muted}>{t("Vis calls med mindst én af de valgte services.", "Show calls with at least one selected service.")}</p>{(["H", "L", "B"] as const).map(code => <label key={code}><input type="checkbox" checked={filters.serviceCodes?.includes(code) ?? false} onChange={event => { setFilters(f => ({ ...f, serviceCodes: event.target.checked ? [...(f.serviceCodes ?? []), code] : (f.serviceCodes ?? []).filter(value => value !== code) })); setPage(1); }} />{code} · {code === "H" ? t("Trosseføring", "Linesmen") : code === "L" ? t("Lods", "Pilot") : t("Bugserbåd", "Tug")}</label>)}</fieldset><fieldset className={s.fieldset}><legend>{t("Kaj", "Quay")}</legend><div className={s.berthGrid}>{berths.map(berth => <label key={berth}><input type="checkbox" checked={filters.berths.includes(berth)} onChange={e => { setFilters(f => ({ ...f, berths: e.target.checked ? [...f.berths, berth] : f.berths.filter(v => v !== berth) })); setPage(1); }}/><span>{formatBerthCode(berth)}</span></label>)}</div></fieldset><footer className={s.panelFooter}><button className={s.toolButton} onClick={() => { setFilters(DEFAULT_FILTERS); setPage(1); }}>{t("Nulstil", "Reset")}</button><button className={s.primaryButton} onClick={() => setPanel(null)}>{t(`Vis ${filtered.length} calls`, `Show ${filtered.length} calls`)}<Icon name="arrowRight"/></button></footer></Panel>}
{panel === "columns" && <Panel title={t("Tilpas kolonner", "Customize columns")} onClose={() => setPanel(null)}><p className={s.muted}>{t("Vælg oplysningerne til dit arbejde. Skibet er altid synligt.", "Choose the information you need. Vessel identity stays visible.")}</p><ColumnEditor columns={columns} locale={locale} onChange={setCustomColumns} /><footer className={s.panelFooter}><button className={s.toolButton} onClick={() => setCustomColumns(null)}>{t("Standard", "Default")}</button><button className={s.primaryButton} onClick={() => setPanel(null)}>{t("Færdig", "Done")}<Icon name="check"/></button></footer></Panel>}
    {panel === "settings" && <Panel title={t("Dit arbejdsrum", "Your workspace")} onClose={() => setPanel(null)}><div className={s.profileCard}><span className={s.avatar}>{profile.initials}</span><span><strong>{profile.name[locale]}</strong><small>{profile.shortName[locale]}</small></span></div><div className={s.setting}><span>{t("Udseende", "Appearance")}</span><div className={s.segmented}><button aria-pressed={theme === "light"} onClick={() => setTheme("light")}>{t("Lys", "Light")}</button><button aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>{t("Mørk", "Dark")}</button></div></div><div className={s.setting}><span>{t("Sprog", "Language")}</span><div className={s.segmented}><button aria-pressed={locale === "da"} onClick={() => setLocale("da")}>Dansk</button><button aria-pressed={locale === "en"} onClick={() => setLocale("en")}>English</button></div></div><div className={s.setting}><span>{t("Listeafstand", "List density")}</span><div className={s.segmented}><button aria-pressed={!compact} onClick={() => setCompact(false)}>{t("Normal", "Normal")}</button><button aria-pressed={compact} onClick={() => setCompact(true)}>{t("Kompakt", "Compact")}</button></div></div><div className={s.setting}><span>{t("Automatisk opdatering", "Automatic refresh")}</span><span>{t("Hvert 10. minut", "Every 10 minutes")}</span></div><footer className={s.panelFooter}><a className={s.toolButton} href="/login">{t("Skift adgang", "Change access")}<Icon name="arrowUpRight"/></a><button className={s.primaryButton} onClick={() => setPanel(null)}>{t("Færdig", "Done")}<Icon name="check"/></button></footer></Panel>}
    {selected && detail && <CallDetail
      now={NOW} key={selected.id} call={selected} allCalls={effective.calls} vessel={snapshot.vessels.find(v => v.id === selected.vesselId)} serviceOrders={effective.serviceOrders} locale={locale} initialTab={detail.tab} pinned={pins.includes(selected.id)} onClose={() => setDetail(null)} onPin={() => pin(selected)} onAddNote={addNote} onRegister={(operation, value) => registerCall(selected, operation, value)} onShowMap={() => showOnMap(selected)}
    />}
    {toast && <div className={s.toast} role="status"><Icon name="check"/><span>{toast.text}</span>{toast.undo && <button onClick={toast.undo}>{t("Fortryd", "Undo")}</button>}<button aria-label={t("Luk besked", "Dismiss")} onClick={() => setToast(null)}><Icon name="close"/></button></div>}
  </div>;
}
