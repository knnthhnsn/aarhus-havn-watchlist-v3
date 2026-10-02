"use client";

import L, { type LayerGroup, type Map as LeafletMap, type Marker } from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";

import { BrandIcon } from "@/components/brand/BrandIcon";
import type { CallServiceOrder, DateFormat, Locale, Placement, PortCall, PortCallStatus, ShipTracking, WatchlistSnapshot } from "@/lib/watchlist";
import { PROTOTYPE_OPERATIONS_NOW, formatBerthCode, formatDateTime, formatClock, getActiveShiftingOperation, getArrivalOperation, getDepartureOperation, getDeparturePlacement, getEffectivePlacement, getNextActionableOperation, getOperationPlacement, getWarnings, liveTime, primaryTime } from "@/lib/watchlist";
import {
  AARHUS_HARBOR_CENTER,
  HARBOR_BERTHS,
  berthPosition,
  derivePortCallState,
  getBerthGeometry,
  isOperationalHarborState,
  type HarborPoint,
  type HarborSimulationState,
} from "@/lib/harbor";

import styles from "./WatchlistPrototype.module.css";
import { operationLabel, operationPrimaryTime } from "./lifecycle";

type MapLayer = "traffic" | "routes" | "berths";
type HarborMapProps = {
  calls: readonly PortCall[];
  selected?: PortCall;
  tracking?: WatchlistSnapshot["tracking"][number];
  tracks?: readonly ShipTracking[];
  locale?: Locale;
  dateFormat?: DateFormat;
  now?: string | number;
  serviceOrders?: readonly CallServiceOrder[];
  onOpenDetail?: (call: PortCall, tab?: "call" | "route") => void;
  onSelectCall?: (call: PortCall) => void;
  onClearSelection?: () => void;
  onSelectBerth?: (berth: string) => void;
  onBackToList?: () => void;
};
type MapPoint = HarborPoint;

const AARHUS_HARBOR: L.LatLngExpression = [AARHUS_HARBOR_CENTER.latitude, AARHUS_HARBOR_CENTER.longitude];
const DEFAULT_ZOOM = 13;
const SIMULATION_STEP_MS = 5 * 60_000;
const MAP_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const MAP_TILE_ATTRIBUTION = "&copy; OpenStreetMap contributors";

const copy = {
  en: {
    title: "Live harbor map", subtitle: "Aarhus basemap · quay geometry · updated Nov 2025", traffic: "Traffic", routes: "Routes", berths: "Quays", fit: "Fit visible", port: "Port", follow: "Follow selected", noSelection: "Select a vessel on the map", details: "Open call details", back: "Back to list", live: "Live", updated: "Updated", berth: "Berth", filterBerth: "Filter list by berth", next: "Next job", eta: "Live ETA", calls: "visible calls", selected: "Selected", noTiles: "Map tiles could not be loaded", retry: "Retry map", simulated: "Operations time", legend: "Markers show call status; vessel points follow their mapped quay.", expected: "Expected", enRoute: "En route", arrived: "Arrived", departed: "Departed", source: "Aarhus Havn geometry · map reference, November 2025",
  },
  da: {
    title: "Live havnekort", subtitle: "Aarhus-kort · kajgeometri · opdateret nov. 2025", traffic: "Trafik", routes: "Ruter", berths: "Kajer", fit: "Vis synlige", port: "Havn", follow: "Følg valgt", noSelection: "Vælg et skib på kortet", details: "Åbn anløbsdetaljer", back: "Tilbage til liste", live: "Live", updated: "Opdateret", berth: "Kaj", filterBerth: "Filtrér listen efter kaj", next: "Næste opgave", eta: "Live ETA", calls: "synlige anløb", selected: "Valgt", noTiles: "Kortfliser kunne ikke indlæses", retry: "Prøv kort igen", simulated: "Operationstid", legend: "Markører viser anløbsstatus; skibe følger deres kortlagte kaj.", expected: "Forventet", enRoute: "På vej", arrived: "Ankommet", departed: "Afgået", source: "Aarhus Havn-geometri · kortreference, november 2025",
  },
} as const;

const EXPECTED_YELLOW = "#f6d84a";
const BERTH_REFERENCE_SAND = "#dcdccc";
const ACTIVE_BERTH_GREEN = "#005758";
const statusColor: Record<PortCallStatus, string> = { expected: EXPECTED_YELLOW, "en-route": "#76bdeb", arrived: "#ff705e", departed: "#9eb5b5" };
const statusLabel = (status: PortCallStatus, locale: Locale) => { const labels = copy[locale]; return status === "expected" ? labels.expected : status === "en-route" ? labels.enRoute : status === "arrived" ? labels.arrived : labels.departed; };
function mapTooltipContent(label: string, title: string, details: readonly string[] = []): HTMLElement {
  const content = document.createElement("span");
  content.className = styles.mapHoverInfoContent;
  const eyebrow = document.createElement("small");
  eyebrow.textContent = label;
  const heading = document.createElement("strong");
  heading.textContent = title;
  content.append(eyebrow, heading);
  details.filter(Boolean).forEach((detail) => {
    const line = document.createElement("span");
    line.textContent = detail;
    content.append(line);
  });
  return content;
}
function clamp(value: number, min = 0, max = 1): number { return Math.max(min, Math.min(max, value)); }
function interpolateRoute(points: readonly MapPoint[], progress: number): MapPoint | undefined {
  if (points.length === 0) return undefined;
  if (points.length === 1) return points[0];
  const bounded = clamp(progress); const scaled = bounded * (points.length - 1); const index = Math.min(points.length - 2, Math.floor(scaled)); const fraction = scaled - index; const from = points[index]; const to = points[index + 1];
  return { latitude: from.latitude + (to.latitude - from.latitude) * fraction, longitude: from.longitude + (to.longitude - from.longitude) * fraction };
}
function routeHeading(points: readonly MapPoint[]): number {
  if (points.length < 2) return 0;
  const from = points[0]; const to = points[1];
  return Math.atan2(to.longitude - from.longitude, to.latitude - from.latitude) * 180 / Math.PI;
}
function fullTrackRoute(track: ShipTracking): MapPoint[] {
  return [...track.sailedRoute.slice(0, -1), track.currentPosition, ...track.estimatedRoute];
}
function departureTimestamp(call: PortCall): number {
  const value = call.departureTimes.find((time) => time.kind === "actual")?.value
    ?? call.departureTimes.find((time) => time.kind === "ordered")?.value
    ?? call.departureTimes.find((time) => time.kind === "expected")?.value;
  return value ? Date.parse(value) : Number.NaN;
}
function simulatedPosition(track: ShipTracking, call: PortCall, state: HarborSimulationState, simulationNow: number, berth = call.berth): MapPoint | undefined {
  const geometry = getBerthGeometry(berth);
  if (!geometry) return undefined;
  if (state === "alongside" || state === "shifting") return berthPosition(geometry);
  if (state === "turning") return interpolateRoute(fullTrackRoute(track), .94) ?? berthPosition(geometry);
  if (state === "holding" || state === "outside") return track.currentPosition;
  if (state === "inbound") {
    // Arrival actuals close the live ETA channel. Never animate from the
    // tracking feed's stale liveEta after an actual arrival; use the
    // call-level legacy timeline as the only fallback target.
    if (call.arrivalTimes.some((time) => time.kind === "actual")) return track.currentPosition;
    const arrivalTarget = liveTime(call.arrivalTimes) ?? primaryTime(call.arrivalTimes);
    const start = Date.parse(track.updatedAt); const end = Date.parse(arrivalTarget); const progress = Number.isFinite(start) && Number.isFinite(end) && end > start ? clamp((simulationNow - start) / (end - start)) : 0;
    return interpolateRoute([track.currentPosition, ...track.estimatedRoute], progress);
  }
  if (state === "outbound") {
    const start = departureTimestamp(call); const progress = Number.isFinite(start) ? clamp((simulationNow - start) / (60 * 60_000)) : 0.2;
    return interpolateRoute([track.currentPosition, ...track.estimatedRoute], progress);
  }
  return undefined;
}
function mapPlacementFor(call: PortCall, state: HarborSimulationState, simulationNow: number): Placement {
  if (state === "outbound") return getDeparturePlacement(call);
  if (state === "shifting") {
    const activeShift = getActiveShiftingOperation(call, simulationNow);
    const shiftPlacement = activeShift ? getOperationPlacement(activeShift) : undefined;
    if (shiftPlacement) return shiftPlacement;
  }
  const arrival = getArrivalOperation(call);
  return getEffectivePlacement(call, simulationNow)
    ?? (arrival ? getOperationPlacement(arrival) : undefined)
    ?? { berth: call.berth, bollardFrom: call.bollardFrom, bollardTo: call.bollardTo, side: call.side };
}
function formatMapPlacement(placement: Placement, locale: Locale): string {
  const side = placement.side === "port" ? (locale === "da" ? "BB" : "P") : (locale === "da" ? "SB" : "S");
  return `${formatBerthCode(placement.berth)} · ${placement.bollardFrom}-${placement.bollardTo} · ${side}`;
}
// Keep adjacent same-quay markers outside the 44px icon hit box. The offset is
// display-only; official placement and fit/pan coordinates remain unchanged.
const MARKER_BERTH_OFFSET_PX = 56;
function offsetMarkerAlongQuay(map: LeafletMap | null, point: MapPoint, heading: number, rank: number, count: number): MapPoint {
  if (!map || count < 2) return point;
  const centeredRank = rank - (count - 1) / 2;
  const radians = heading * Math.PI / 180;
  const layerPoint = map.latLngToLayerPoint([point.latitude, point.longitude]);
  const shiftedPoint = layerPoint.add(L.point(
    Math.sin(radians) * centeredRank * MARKER_BERTH_OFFSET_PX,
    Math.cos(radians) * centeredRank * MARKER_BERTH_OFFSET_PX,
  ));
  const shiftedLatLng = map.layerPointToLatLng(shiftedPoint);
  return { latitude: shiftedLatLng.lat, longitude: shiftedLatLng.lng };
}
function markerIcon(call: PortCall, selected: boolean, attention: boolean, heading: number): L.DivIcon {
  const status = call.status; const markerState = status.replace("-", "_");
  const shipGlyph = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15.5h16l-2.5 3H6.5z"/><path d="M7.5 15.5V7h7l2 3.5H7.5M10 7V4.5h3"/></svg>`;
  return L.divIcon({ className: `${styles.mapMarkerIcon} ${styles[`mapMarker_${markerState}`]} ${selected ? styles.mapMarkerSelected : ""} ${attention ? styles.mapMarkerAttention : ""}`, html: `<span style="--marker-color:${statusColor[status]};--ship-heading:${heading}deg;--label-heading:${-heading}deg">${shipGlyph}<b>${call.callNumber}</b></span>`, iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -22] });
}
function routePoints(points: readonly MapPoint[]): L.LatLngExpression[] { return points.map((point) => [point.latitude, point.longitude]); }
function visibleAt(call: PortCall, state: HarborSimulationState, simulationNow: number, selectedId: string | null, selected?: PortCall): boolean {
  // The harbor state machine keeps an outbound grace window so a departure
  // can animate away from the quay. A call already marked departed is history,
  // however, and must never re-enter live traffic just because it is selected.
  if (call.status === "departed") return false;
  if (call.id === selectedId || call.id === selected?.id) return true;
  return isOperationalHarborState(state);
}

export function HarborMap({ calls, selected, tracking, tracks = [], locale = "en", dateFormat = "full", now, serviceOrders = [], onOpenDetail, onSelectCall, onClearSelection, onSelectBerth, onBackToList }: HarborMapProps) {
  const t = copy[locale];
  const mapElementRef = useRef<HTMLDivElement>(null); const mapRef = useRef<LeafletMap | null>(null); const markerLayerRef = useRef<LayerGroup | null>(null); const routeLayerRef = useRef<LayerGroup | null>(null); const berthLayerRef = useRef<LayerGroup | null>(null);
  const [mapLayer, setMapLayer] = useState<MapLayer>(tracking ? "routes" : "berths"); const [selectedId, setSelectedId] = useState(selected?.id ?? null); const [followSelected, setFollowSelected] = useState(Boolean(selected)); const [tileError, setTileError] = useState(false); const [mapReady, setMapReady] = useState(false);
  const trackList = useMemo(() => tracks.length ? tracks : tracking ? [tracking] : [], [tracking, tracks]);
  const trackingByVesselId = useMemo(() => new Map(trackList.map((item) => [item.vesselId, item])), [trackList]);
  const simulationOrigin = useMemo(() => Date.parse(PROTOTYPE_OPERATIONS_NOW), []);
  const [simulationOffset, setSimulationOffset] = useState(0); const suppliedNow = typeof now === "number" ? now : now ? Date.parse(now) : Number.NaN; const hasSuppliedNow = Number.isFinite(suppliedNow); const simulationNow = hasSuppliedNow ? suppliedNow : simulationOrigin + simulationOffset;
  // Parent selection is authoritative when supplied; the local id keeps map
  // marker clicks responsive before the parent callback has rendered.
  const activeSelectedId = selected?.id ?? selectedId;
  const selectedCall = activeSelectedId ? calls.find((call) => call.id === activeSelectedId) ?? selected ?? null : null;
  const selectedTrack = selectedCall ? trackingByVesselId.get(selectedCall.vesselId) ?? (selectedCall.id === selected?.id ? tracking : undefined) : undefined;
  const stateByCall = useMemo(() => new Map(calls.map((call) => [call.id, derivePortCallState(call, simulationNow)])), [calls, simulationNow]);
  const visibleCalls = useMemo(() => calls.filter((call) => trackingByVesselId.has(call.vesselId) && getBerthGeometry(mapPlacementFor(call, stateByCall.get(call.id) ?? "outside", simulationNow).berth) && visibleAt(call, stateByCall.get(call.id) ?? "outside", simulationNow, activeSelectedId, selected)), [activeSelectedId, calls, selected, simulationNow, stateByCall, trackingByVesselId]);

  useEffect(() => {
    if (hasSuppliedNow) return undefined;
    const interval = window.setInterval(() => setSimulationOffset((value) => value + SIMULATION_STEP_MS), 8_000);
    return () => window.clearInterval(interval);
  }, [hasSuppliedNow]);
  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) return;
    const map = L.map(mapElementRef.current, { center: AARHUS_HARBOR, zoom: DEFAULT_ZOOM, zoomControl: false, preferCanvas: false, attributionControl: true });
    const tiles = L.tileLayer(MAP_TILE_URL, { maxZoom: 19, minZoom: 4, attribution: MAP_TILE_ATTRIBUTION, crossOrigin: true });
    tiles.on("tileerror", () => setTileError(true)); tiles.on("load", () => setTileError(false)); tiles.addTo(map); L.control.zoom({ position: "bottomright" }).addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map); routeLayerRef.current = L.layerGroup().addTo(map); berthLayerRef.current = L.layerGroup().addTo(map); mapRef.current = map; setMapReady(true);
    const resizeObserver = new ResizeObserver(() => map.invalidateSize({ animate: false })); resizeObserver.observe(mapElementRef.current);
    return () => { resizeObserver.disconnect(); map.remove(); mapRef.current = null; setMapReady(false); };
  }, []);

  useEffect(() => {
    const layer = markerLayerRef.current; if (!layer) return; layer.clearLayers(); const markers = new Map<string, Marker>();
    const candidates = visibleCalls.flatMap((call) => {
      const track = trackingByVesselId.get(call.vesselId) ?? (call.id === selected?.id ? tracking : undefined); if (!track) return [];
      const state = stateByCall.get(call.id) ?? "outside";
      const placement = mapPlacementFor(call, state, simulationNow);
      const position = simulatedPosition(track, call, state, simulationNow, placement.berth); if (!position) return [];
      const geometry = getBerthGeometry(placement.berth);
      const heading = state === "alongside" || state === "shifting" ? geometry?.heading ?? 0 : routeHeading(state === "turning" ? fullTrackRoute(track) : track.estimatedRoute.length > 1 ? track.estimatedRoute : track.sailedRoute);
      return [{ call, track, state, placement, position, geometry, heading }];
    });
    const byBerth = new Map<string, typeof candidates>();
    candidates.forEach((candidate) => {
      const group = byBerth.get(formatBerthCode(candidate.placement.berth)) ?? [];
      group.push(candidate);
      byBerth.set(formatBerthCode(candidate.placement.berth), group);
    });
    byBerth.forEach((group) => group.sort((left, right) => ((left.placement.bollardFrom + left.placement.bollardTo) / 2) - ((right.placement.bollardFrom + right.placement.bollardTo) / 2) || left.call.id.localeCompare(right.call.id)));
    candidates.forEach((candidate) => {
      const group = byBerth.get(formatBerthCode(candidate.placement.berth)) ?? [candidate];
      const rank = group.indexOf(candidate);
      const displayPosition = offsetMarkerAlongQuay(mapRef.current, candidate.position, candidate.geometry?.heading ?? candidate.heading, rank, group.length);
      const { call, placement, heading } = candidate;
      const attention = getWarnings(call, calls, simulationNow, serviceOrders).length > 0;
      const next = getNextActionableOperation(call, simulationNow, serviceOrders); const nextPlacement = next ? getOperationPlacement(next) : undefined;
      const nextLabel = next ? `${operationLabel(next, locale, call)} · ${formatMapPlacement(nextPlacement ?? placement, locale)}` : "";
      const placementLabel = formatMapPlacement(placement, locale);
      const marker = L.marker([displayPosition.latitude, displayPosition.longitude], { icon: markerIcon(call, call.id === activeSelectedId, attention, heading), keyboard: true });
      marker.bindTooltip(mapTooltipContent(locale === "da" ? `Anløb · ${call.callNumber}` : `Port call · ${call.callNumber}`, call.vesselName, [`${statusLabel(call.status, locale)} · ${placementLabel}`, nextLabel]), { direction: "top", offset: [0, -12], opacity: 1, className: styles.mapHoverInfo }); marker.on("click", () => { setSelectedId(call.id); onSelectCall?.(call); }); marker.on("keypress", (event) => { if (event.originalEvent.key === "Enter" || event.originalEvent.key === " ") { setSelectedId(call.id); onSelectCall?.(call); } }); marker.addTo(layer);
      const element = marker.getElement(); if (element) { element.setAttribute("role", "button"); element.setAttribute("aria-label", `${call.vesselName}, ${statusLabel(call.status, locale)}, ${placementLabel}${nextLabel ? `, ${nextLabel}` : ""}`); } markers.set(call.id, marker);
    });
    if (activeSelectedId && markers.has(activeSelectedId) && followSelected) markers.get(activeSelectedId)?.openTooltip();
  }, [activeSelectedId, calls, followSelected, locale, mapReady, onSelectCall, selected, serviceOrders, simulationNow, stateByCall, tracking, trackingByVesselId, visibleCalls]);

  useEffect(() => {
    const layer = routeLayerRef.current; if (!layer) return; layer.clearLayers(); if (mapLayer !== "routes" && !selectedTrack) return;
    const routeCalls = selectedCall ? [selectedCall] : visibleCalls;
    routeCalls.forEach((call) => { const track = trackingByVesselId.get(call.vesselId) ?? (call.id === selected?.id ? tracking : undefined); if (!track) return; const selectedRoute = call.id === activeSelectedId; if (track.sailedRoute.length > 1) L.polyline(routePoints(track.sailedRoute), { color: "#3e587b", weight: selectedRoute ? 5 : 2, opacity: 1, lineCap: "round" }).addTo(layer); if (track.estimatedRoute.length > 1) L.polyline(routePoints([track.currentPosition, ...track.estimatedRoute]), { color: "#c9dbf5", weight: selectedRoute ? 5 : 2, opacity: 1, dashArray: selectedRoute ? "12 8" : "7 9", lineCap: "round" }).addTo(layer); });
  }, [activeSelectedId, mapLayer, selected, selectedCall, selectedTrack, tracking, trackingByVesselId, visibleCalls]);

  useEffect(() => {
    const layer = berthLayerRef.current; if (!layer) return; layer.clearLayers(); if (mapLayer !== "berths") return;
    const seen = new Set<string>();
    Object.values(HARBOR_BERTHS).forEach((geometry) => { if (seen.has(geometry.code)) return; seen.add(geometry.code); const line = L.polyline(routePoints(geometry.quay), { color: BERTH_REFERENCE_SAND, weight: 4, opacity: 1, lineCap: "round" }); const quality = geometry.confidence === "low" ? "WGS84 planning reference" : "Planning reference"; const reference = locale === "da" ? (geometry.confidence === "low" ? "WGS84-planlægningsreference" : "Planlægningsreference") : quality; line.bindTooltip(mapTooltipContent(locale === "da" ? "Kajreference" : "Berth reference", `${locale === "da" ? "Kaj" : "Berth"} ${geometry.code}`, [`${geometry.terminal} · ${geometry.basin}`, `${geometry.localDepthM ?? geometry.basinDepthM} m · ${reference}`]), { direction: "top", className: styles.mapHoverInfo, opacity: 1 }); line.addTo(layer); if (visibleCalls.some((call) => mapPlacementFor(call, stateByCall.get(call.id) ?? "outside", simulationNow).berth.replace(/\D/g, "") === geometry.code)) { const centre = berthPosition(geometry); if (centre) L.circleMarker([centre.latitude, centre.longitude], { radius: 3, weight: 1, color: BERTH_REFERENCE_SAND, fillColor: ACTIVE_BERTH_GREEN, fillOpacity: 1 }).bindTooltip(mapTooltipContent(locale === "da" ? "Aktiv kaj" : "Active berth", formatBerthCode(geometry.code)), { direction: "top", className: styles.mapHoverInfo, opacity: 1 }).addTo(layer); } });
  }, [locale, mapLayer, simulationNow, stateByCall, visibleCalls]);

  const fitPointSets = useMemo(() => {
    const makePoints = (includeRoutes: boolean): L.LatLngExpression[] => visibleCalls.flatMap((call) => { const track = trackingByVesselId.get(call.vesselId); const state = stateByCall.get(call.id) ?? "outside"; const placement = mapPlacementFor(call, state, simulationNow); const position = track ? simulatedPosition(track, call, state, simulationNow, placement.berth) : undefined; if (!position) return []; return [[position.latitude, position.longitude] as L.LatLngExpression, ...(includeRoutes && track ? routePoints(track.estimatedRoute) : [])]; });
    const berthPoints = Object.values(HARBOR_BERTHS).flatMap((geometry) => routePoints(geometry.quay));
    return { traffic: makePoints(false), routes: makePoints(true), berths: berthPoints };
  }, [simulationNow, stateByCall, trackingByVesselId, visibleCalls]);
  useEffect(() => { const map = mapRef.current; if (!map || !selectedCall || !followSelected || !selectedTrack) return; const state = stateByCall.get(selectedCall.id) ?? "outside"; const position = simulatedPosition(selectedTrack, selectedCall, state, simulationNow, mapPlacementFor(selectedCall, state, simulationNow).berth); if (position) map.panTo([position.latitude, position.longitude], { animate: true, duration: .55 }); }, [followSelected, selectedCall, selectedTrack, simulationNow, stateByCall]);
  useEffect(() => { const map = mapRef.current; if (!map || selectedCall || !visibleCalls.length) return; const points = fitPointSets[mapLayer]; if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 13, animate: false }); }, [fitPointSets, mapLayer, selectedCall, visibleCalls.length]);

  const fitAll = () => { const map = mapRef.current; if (!map) return; setSelectedId(null); setFollowSelected(false); onClearSelection?.(); const points = fitPointSets[mapLayer]; if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 13, animate: true }); else map.setView(AARHUS_HARBOR, DEFAULT_ZOOM); };
  const focusPort = () => { setSelectedId(null); setFollowSelected(false); onClearSelection?.(); mapRef.current?.setView(AARHUS_HARBOR, 14, { animate: true }); };
  const simulationClock = new Date(simulationNow).toLocaleTimeString(locale === "da" ? "da-DK" : "en-GB", { timeZone: "Europe/Copenhagen", hour: "2-digit", minute: "2-digit" });
  const selectedMapStatus = selectedCall ? selectedCall.status.replace("-", "_") : "expected";
  const selectedState = selectedCall ? stateByCall.get(selectedCall.id) ?? "outside" : "outside";
  const selectedPlacement = selectedCall ? mapPlacementFor(selectedCall, selectedState, simulationNow) : undefined;
  const selectedArrival = selectedCall ? getArrivalOperation(selectedCall) : undefined;
  const selectedDeparture = selectedCall ? getDepartureOperation(selectedCall) : undefined;
  const selectedNext = selectedCall ? getNextActionableOperation(selectedCall, simulationNow, serviceOrders) : undefined;
  const selectedNextPlacement = selectedNext ? getOperationPlacement(selectedNext) : undefined;

  return (
    <section className={styles.mapShell} aria-label={t.title}>
      <header className={styles.mapHeader}>
        <button className={styles.mapBackButton} onClick={onBackToList} aria-label={t.back}><BrandIcon name="arrowLeft" /><span>{t.back}</span></button>
        <div><p className={styles.mapEyebrow}><BrandIcon name="map" />{t.title}</p><p className={styles.mapSubtitle}>{t.subtitle}</p></div>
        <div className={styles.mapHeaderMeta}><span>{visibleCalls.length} {t.calls}</span><span>{t.simulated} <b>{simulationClock}</b></span></div>
      </header>
      <div className={styles.mapToolbar} role="toolbar" aria-label={t.title}>
        <div className={styles.mapLayerSwitch} role="group" aria-label="Map layers">
          <button aria-pressed={mapLayer === "traffic"} onClick={() => setMapLayer("traffic")}><BrandIcon name="portCall" />{t.traffic}</button>
          <button aria-pressed={mapLayer === "routes"} onClick={() => setMapLayer("routes")}><BrandIcon name="route" />{t.routes}</button>
          <button aria-pressed={mapLayer === "berths"} onClick={() => setMapLayer("berths")}><BrandIcon name="harbour" />{t.berths}</button>
        </div>
        <div className={styles.mapActions}>
          <button onClick={focusPort}><BrandIcon name="harbour" />{t.port}</button>
          <button onClick={fitAll}><BrandIcon name="expand" />{t.fit}</button>
          <button aria-pressed={followSelected} disabled={!selectedCall} data-hover-info={!selectedCall ? t.noSelection : t.follow} data-hover-label={t.follow} data-hover-tone="action" className={followSelected ? styles.mapFollowActive : ""} onClick={() => setFollowSelected((value) => !value)}><BrandIcon name="followUp" />{t.follow}</button>
        </div>
      </div>
      <div className={styles.mapWorkspace}>
        <div ref={mapElementRef} className={styles.mapLeaflet} role="application" aria-label={t.title} />
        {tileError && <div className={styles.mapTileError} role="alert"><span>{t.noTiles}</span><button onClick={() => { setTileError(false); mapRef.current?.invalidateSize(); }}><BrandIcon name="followUp" />{t.retry}</button></div>}
        <aside className={`${styles.mapCallCard} ${selectedCall ? styles.mapCallCardVisible : ""}`} aria-live="polite">
          {selectedCall && selectedTrack ? <>
            <div className={styles.mapCallCardTop}>
              <span className={`${styles.mapStatusDot} ${styles[`mapStatus_${selectedMapStatus}`]}`} aria-hidden="true" />
              <div><small>{t.selected} · {selectedCall.callNumber}</small><h3>{selectedCall.vesselName}</h3><span className={styles.visuallyHidden}>{statusLabel(selectedCall.status, locale)}</span></div>
              <button className={styles.mapCloseButton} data-hover-info="" data-hover-label={locale === "da" ? "Kortvalg" : "Map selection"} data-hover-tone="action" onClick={() => { setSelectedId(null); setFollowSelected(false); onClearSelection?.(); }} aria-label={locale === "da" ? "Luk valgt anløb" : "Close selected call"}><BrandIcon name="close" /></button>
            </div>
            <div className={styles.mapCallMetrics}><span><small>{locale === "da" ? "Ankomst" : "Arrival"}</small><b>{formatDateTime(operationPrimaryTime(selectedArrival, selectedCall.arrivalTimes), locale, dateFormat)}</b></span><span><small>{locale === "da" ? "Afgang" : "Departure"}</small><b>{formatDateTime(operationPrimaryTime(selectedDeparture, selectedCall.departureTimes), locale, dateFormat)}</b></span><span><small>{t.berth}</small>{selectedPlacement?.berth && onSelectBerth ? <button className={styles.mapBerthButton} onClick={() => onSelectBerth(selectedPlacement.berth!)} aria-label={`${t.filterBerth}: ${formatBerthCode(selectedPlacement.berth)}`}><b>{formatMapPlacement(selectedPlacement, locale)}</b></button> : <b>{selectedPlacement ? formatMapPlacement(selectedPlacement, locale) : "—"}</b>}</span><span><small>{t.next}</small><b>{selectedNext ? `${formatClock(operationPrimaryTime(selectedNext))} · ${operationLabel(selectedNext, locale, selectedCall)}${selectedNextPlacement ? ` · ${formatMapPlacement(selectedNextPlacement, locale)}` : ""}` : "—"}</b></span></div>
            <div className={styles.mapCallActions}><button onClick={() => onOpenDetail?.(selectedCall, "route")}><BrandIcon name="route" />{t.routes}</button><button onClick={() => onOpenDetail?.(selectedCall, "call")}>{t.details}<BrandIcon name="arrowRight" /></button></div>
          </> : <div className={styles.mapEmptyCard}><BrandIcon name="map" /><p>{t.noSelection}</p><small>{t.legend}</small></div>}
        </aside>
      </div>
      <footer className={styles.mapFooter}><span><i className={styles.mapLegendLineSailed} />{t.routes}</span><span><i className={styles.mapLegendMarker} />{t.traffic}</span><span>{t.legend}</span><span>{t.source}</span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a></footer>
    </section>
  );
}
