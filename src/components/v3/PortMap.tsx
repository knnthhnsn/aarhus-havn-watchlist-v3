"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BrandIcon } from "@/components/brand/BrandIcon";
import { AARHUS_HARBOR_CENTER, HARBOR_BERTHS, berthPosition, getBerthGeometry, type HarborPoint } from "@/lib/harbor";
import { PROTOTYPE_OPERATIONS_NOW, formatBerthCode, formatClock, getNextActionableOperation, getOperationallyActiveCalls, liveTime, normalizeBerthCode, type Locale, type PortCall, type WatchlistSnapshot } from "@/lib/watchlist";
import { categoryName, getCallPlacementPresentation, plannedTime, shortDate, timeNames } from "./display";
import { liveEtaLabel } from "./liveEtaLabel";
import { compareQuayCodes, filterCallsByQuays, getQuayAssignmentTiming, getQuayCalls } from "./quayData";
import { StateLabel } from "./StateLabel";
import stateSurface from "./StateSurface.module.css";

import styles from "./PortMap.module.css";
import { quayHeading, routeHeading } from "./mapOrientation";
import { routeSegments, validMapPoint } from "./mapRoutes";
import { mapGroups } from "./mapGroups";
import { getNextMapQuay } from "./mapNextQuay";

export interface PortMapProps {
  calls: readonly PortCall[];
  snapshot: WatchlistSnapshot;
  selected?: PortCall;
  locale: Locale;
  now?: string | number;
  activeBerths?: readonly string[];
  onBerthsChange?: (berths: string[]) => void;
  onSelect: (call: PortCall) => void;
  onOpen: (call: PortCall) => void;
  onBerth: (berth: string) => void;
}

type MapLayer = "traffic" | "quays" | "routes";
type MapRecord = { call: PortCall; point: HarborPoint; berth: string; heading?: number };
const quays = Object.values(HARBOR_BERTHS).sort((left, right) => compareQuayCodes(left.code, right.code));

const quayText = {
  da: { pick: "Vælg kaj", all: "Alle kajer", clear: "Ryd kajfilter", current: "Ved kaj nu", upcoming: "Kommende", empty: "Ingen aktuelle eller kommende calls på denne kaj.", emptyHelp: "Vælg en anden kaj, eller ryd kajfilteret for at se trafikken igen.", search: "Søg kaj eller terminal", noResults: "Ingen kajer matcher søgningen.", overview: "Kajoversigt", selectHelp: "Vælg en kaj på kortet eller i listen.", selected: "Valgt kaj", filtered: "Kortet er filtreret", calls: "calls", accessible: "Aktuelle og kommende calls i det tilgængelige datasæt.", matches: "matcher øvrige filtre", noGeometry: "Kajgeometri er ikke tilgængelig", showList: "Vis kajen i listen", viewDetails: "Se calls", noPosition: "Ingen positioner matcher filtrene. Kajens calls kan stadig åbnes nedenfor.", focus: "Zoom til kaj", directory: "Find en anden kaj", shown: "på kortet", from: "af", depth: "Kortdybde", reference: "Planlægningsreference · ikke til navigation" },
  en: { pick: "Select quay", all: "All quays", clear: "Clear quay filter", current: "Alongside now", upcoming: "Upcoming", empty: "No current or upcoming calls at this quay.", emptyHelp: "Choose another quay, or clear the quay filter to see traffic again.", search: "Search quay or terminal", noResults: "No quays match your search.", overview: "Quay directory", selectHelp: "Choose a quay on the map or in the list.", selected: "Selected quay", filtered: "Map is filtered", calls: "calls", accessible: "Current and upcoming calls in the accessible dataset.", matches: "match other filters", noGeometry: "Quay geometry is unavailable", showList: "View quay in list", viewDetails: "View call", noPosition: "No positions match the filters. You can still open the quay's calls below.", focus: "Zoom to quay", directory: "Find another quay", shown: "on the map", from: "of", depth: "Chart depth", reference: "Planning reference · not for navigation" },
} as const;

const text = {
  da: {
    title: "Havnen lige nu", subtitle: "Trafik og kajpladser", traffic: "Trafik", quays: "Kajer", routes: "Ruter", fit: "Vis hele havnen", zoomIn: "Zoom ind", zoomOut: "Zoom ud", visible: "calls på kortet", vesselList: "Vælg et call", selected: "Valgt call", berth: "Kaj", arrival: "Ankomst", departure: "Afgang", next: "Næste opgave", details: "Se call-detaljer", filter: "Vis calls på kaj", empty: "Ingen aktive calls matcher dine filtre.", tiles: "Baggrundskortet kunne ikke indlæses.", retry: "Prøv igen", source: "Kortets datakilder", sourceText: "Baggrundskort: OpenStreetMap. Kajgeometri: Aarhus Havns officielle havnekort, november 2025. Kajlinjerne er til planlægning og viser ikke præcise fortøjningspositioner. Skibsmarkører bruger den tilgængelige position eller den aktuelle kajplacering. Ruterne er illustrative og må ikke bruges til navigation. Skibsretning beregnes fra ruten eller kajretning og SB/BB. Det er en planlægningsreference, ikke målt AIS-kurs.", sailed: "Sejlet rute", planned: "Planlagt rute", noRoute: "Ingen rute er tilgængelig for dette call.", expected: "Forventet", "en-route": "På vej", arrived: "I havn", departed: "Afgået", group: "calls på denne position", position: "Position", units: "m", attention: "Kortvisning", operation: { arrival: "Ankomst", shifting: "Forhaling", assistance: "Assistance", anchorage: "Ankring", departure: "Afgang" },
  },
  en: {
    title: "The harbour now", subtitle: "Traffic and berth assignments", traffic: "Traffic", quays: "Quays", routes: "Routes", fit: "Fit harbour", zoomIn: "Zoom in", zoomOut: "Zoom out", visible: "calls on the map", vesselList: "Select a call", selected: "Selected call", berth: "Berth", arrival: "Arrival", departure: "Departure", next: "Next operation", details: "View call details", filter: "View calls at berth", empty: "No active calls match your filters.", tiles: "The basemap could not be loaded.", retry: "Retry", source: "Map sources", sourceText: "Basemap: OpenStreetMap. Quay geometry: Port of Aarhus official harbour map, November 2025. Quay lines are planning references, not exact mooring positions. Vessel markers use the available position or the current berth assignment. Routes are illustrative and must not be used for navigation. Vessel orientation is derived from the route or quay alignment and mooring side, not measured AIS heading.", sailed: "Sailed route", planned: "Planned route", noRoute: "No route is available for this call.", expected: "Expected", "en-route": "En route", arrived: "Alongside", departed: "Departed", group: "calls at this position", position: "Position", units: "m", attention: "Map view", operation: { arrival: "Arrival", shifting: "Shifting", assistance: "Assistance", anchorage: "Anchorage", departure: "Departure" },
  },
} as const;

function pointFor(call: PortCall, snapshot: WatchlistSnapshot, now: string | number): MapRecord | undefined {
  const { placement, kind, isStud } = getCallPlacementPresentation(call, now);
  if (isStud) return undefined;
  if (kind === "historical") return undefined;
  const berth = placement.berth;
  const tracking = snapshot.tracking.find((track) => track.vesselId === call.vesselId);
  const point = kind === "current" ? berthPosition(berth) : tracking?.currentPosition;
  // An absent tracking point must never be replaced with a made-up ship location.
  if (!validMapPoint(point)) return undefined;
  const geometry = getBerthGeometry(berth);
  const heading = kind === "current" && geometry ? quayHeading(geometry.heading, geometry.waterSide, placement.side) : tracking ? routeHeading(point, tracking.sailedRoute, tracking.estimatedRoute) : undefined;
  return { call, point, berth, heading };
}

function position(point: HarborPoint): L.LatLngTuple { return [point.latitude, point.longitude]; }

function markerContent(records: readonly MapRecord[], activeId?: string, counted = records.length > 1): HTMLElement {
  const element = document.createElement("span");
  element.className = styles.markerFace;
  const highlighted = records.find((record) => record.call.id === activeId);
  element.dataset.status = (highlighted ?? records[0]).call.status;
  element.dataset.selected = String(Boolean(highlighted));
  element.textContent = counted ? String(records.length) : "";
  if (!counted) {
    const glyph = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    glyph.setAttribute("class", styles.markerVessel);
    glyph.setAttribute("viewBox", "0 0 32 40");
    glyph.setAttribute("aria-hidden", "true");
    // Rotate only the glyph; selection, hit target and group counts remain upright.
    const heading = records[0].heading;
    if (heading !== undefined) glyph.style.transform = `rotate(${heading}deg)`;
    glyph.style.transformOrigin = "50% 50%";
    const hull = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hull.setAttribute("d", "M16 2C11 7 9 12 9 19L9 37H23V19C23 12 21 7 16 2Z");
    hull.setAttribute("fill", "var(--ship-fill)");
    hull.setAttribute("stroke", "currentColor");
    hull.setAttribute("stroke-width", "2");
    const deck = document.createElementNS("http://www.w3.org/2000/svg", "path");
    deck.setAttribute("d", "M11 28H21V32H11Z");
    deck.setAttribute("fill", "currentColor");
    glyph.append(hull, deck);
    element.append(glyph);
  }
  return element;
}

export function PortMap({ calls, snapshot, selected, locale, now = PROTOTYPE_OPERATIONS_NOW, activeBerths, onBerthsChange, onSelect, onOpen, onBerth }: PortMapProps) {
  const t = text[locale];
  const q = quayText[locale];
  const [layer, setLayer] = useState<MapLayer>("traffic");
  const [localBerths, setLocalBerths] = useState<string[]>([]);
  const [inspectorMode, setInspectorMode] = useState<"quay" | "vessel">(() => activeBerths?.length ? "quay" : "vessel");
  const [quayQuery, setQuayQuery] = useState("");
  const [tileError, setTileError] = useState(false);
  const [zoom, setZoom] = useState(13);
  const [dark, setDark] = useState(() => typeof document !== "undefined" && document.documentElement.dataset.theme === "dark");
  const [groupIds, setGroupIds] = useState<readonly string[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tilesRef = useRef<L.TileLayer | null>(null);
  const plottedRef = useRef<L.LayerGroup | null>(null);
  const initialFitRef = useRef(false);
  const quaySearchRef = useRef<HTMLInputElement>(null);
  const berthKeys = useMemo(() => [...new Set((activeBerths ?? localBerths).map(normalizeBerthCode))], [activeBerths, localBerths]);
  const activeQuayCode = berthKeys[0];
  const activeQuay = activeQuayCode ? getBerthGeometry(activeQuayCode) : undefined;
  const changeBerths = useCallback((berths: string[]) => { setLocalBerths(berths); onBerthsChange?.(berths); }, [onBerthsChange]);
  const focusQuay = useCallback((code: string) => {
    const geometry = getBerthGeometry(code);
    if (geometry) mapRef.current?.fitBounds(L.latLngBounds(geometry.quay.map(position)), { padding: [70, 70], maxZoom: 16, animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches });
  }, []);
  const selectQuay = useCallback((code: string) => {
    changeBerths([normalizeBerthCode(code)]);
    setInspectorMode(layer === "routes" ? "vessel" : "quay");
    setGroupIds(null);
    if (layer !== "routes") focusQuay(code);
  }, [changeBerths, focusQuay, layer]);
  const selectCall = useCallback((call: PortCall) => { setInspectorMode("vessel"); onSelect(call); }, [onSelect]);
  const clearQuays = useCallback(() => {
    changeBerths([]);
    setGroupIds(null);
    setInspectorMode("vessel");
    mapRef.current?.fitBounds(L.latLngBounds(quays.flatMap((quay) => quay.quay.map(position))), { padding: [32, 32], maxZoom: 14, animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches });
  }, [changeBerths]);
  const callbacks = useRef({ selectCall, selectQuay });

  useEffect(() => { callbacks.current = { selectCall, selectQuay }; }, [selectCall, selectQuay]);
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(document.documentElement.dataset.theme === "dark"));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  // Snapshot is the server-authorized boundary. Visible calls can contribute local
  // updates, but neither counts nor selection can reintroduce an absent call.
  const permittedCalls = useMemo(() => {
    const updates = new Map(calls.map((call) => [call.id, call]));
    return snapshot.calls.map((call) => updates.get(call.id) ?? call);
  }, [calls, snapshot.calls]);
  const scopedCalls = useMemo(() => {
    const permitted = new Set(snapshot.calls.map((call) => call.id));
    return filterCallsByQuays(calls.filter((call) => permitted.has(call.id)), berthKeys, now);
  }, [calls, snapshot.calls, berthKeys, now]);
  const quaySummaries = useMemo(() => quays.map((geometry) => {
    const entries = getQuayCalls(permittedCalls, geometry.code, now);
    return { geometry, entries, current: entries.filter((entry) => entry.assignment.kind === "current").length, upcoming: entries.filter((entry) => entry.assignment.kind === "upcoming").length };
  }), [permittedCalls, now]);
  const quayEntries = useMemo(() => activeQuayCode ? getQuayCalls(permittedCalls, activeQuayCode, now) : [], [permittedCalls, activeQuayCode, now]);
  const matchingQuayCalls = quayEntries.filter((entry) => scopedCalls.some((call) => call.id === entry.call.id)).length;
  const matchingQuays = quaySummaries.filter(({ geometry }) => `${geometry.code} ${geometry.terminal} ${geometry.basin}`.toLocaleLowerCase(locale).includes(quayQuery.trim().toLocaleLowerCase(locale)));
  const records = useMemo(() => {
    const activeCalls = berthKeys.length ? scopedCalls : getOperationallyActiveCalls(scopedCalls, now, undefined, snapshot.serviceOrders);
    const selectedInFilter = selected && selected.status !== "departed" && scopedCalls.find((call) => call.id === selected.id);
    const candidates = selectedInFilter && !activeCalls.some((call) => call.id === selectedInFilter.id) ? [...activeCalls, selectedInFilter] : activeCalls;
    return candidates.map((call) => pointFor(call, snapshot, now)).filter((record): record is MapRecord => Boolean(record));
  }, [scopedCalls, snapshot, selected, now, berthKeys.length]);
  const selectedInScope = selected ? scopedCalls.find((call) => call.id === selected.id) : undefined;
  const inspectedCall = selectedInScope ?? records[0]?.call;
  const active = records.find((record) => record.call.id === inspectedCall?.id);
  const inspectedPlacement = inspectedCall ? getCallPlacementPresentation(inspectedCall, now) : undefined;
  const activeBerth = inspectedPlacement?.placement.berth;
  const activeTrack = snapshot.tracking.find((track) => track.vesselId === inspectedCall?.vesselId);
  const sailedSegments = useMemo(() => routeSegments(activeTrack?.sailedRoute ?? []), [activeTrack]);
  const plannedSegments = useMemo(() => routeSegments(activeTrack ? [activeTrack.currentPosition, ...activeTrack.estimatedRoute] : []), [activeTrack]);
  const routePoints = useMemo(() => [...sailedSegments.flat(), ...plannedSegments.flat()], [sailedSegments, plannedSegments]);
  const fitRoute = useCallback(() => {
    if (routePoints.length) mapRef.current?.fitBounds(L.latLngBounds(routePoints.map(position)), { padding: [48, 48], maxZoom: 15, animate: false });
  }, [routePoints]);
  const next = inspectedCall ? getNextActionableOperation(inspectedCall, now, snapshot.serviceOrders) : undefined;
  const arrivalTime = inspectedCall ? plannedTime(inspectedCall.arrivalTimes) : undefined;
  const departureTime = inspectedCall ? plannedTime(inspectedCall.departureTimes) : undefined;
  const liveArrival = inspectedCall ? liveTime(inspectedCall.arrivalTimes) : undefined;
  const berthFilterable = inspectedPlacement?.filterable;
  const groupRecords = groupIds ? records.filter((record) => groupIds.includes(record.call.id)) : [];
  const visibleList = groupRecords.length > 0 ? groupRecords : records;
  const showQuayInspector = Boolean(layer !== "routes" && activeQuayCode && (inspectorMode === "quay" || !selectedInScope));
  const showQuayDirectory = layer === "quays" && !activeQuayCode;
  const nextQuay = !showQuayInspector && !showQuayDirectory ? getNextMapQuay(inspectedCall, now) : undefined;
  const nextBerth = nextQuay ? getBerthGeometry(nextQuay.berth)?.code : undefined;

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: [AARHUS_HARBOR_CENTER.latitude, AARHUS_HARBOR_CENTER.longitude], zoom: 13,
      minZoom: 10, maxZoom: 18, zoomControl: false, scrollWheelZoom: false,
      // Leaflet's CSS zoom completion timer can outlive a fast list/map switch.
      // Keep zoom synchronous; ordinary pan interaction remains available.
      zoomAnimation: false,
    });
    // Only quay-label visibility depends on zoom; do not recreate overlays at
    // every zoom level when their content is unchanged.
    map.on("zoomend", () => setZoom(map.getZoom() >= 15 ? 15 : 13));
    const tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    });
    tiles.on("tileerror", () => setTileError(true));
    tiles.addTo(map);
    map.attributionControl.setPrefix(false);
    const plotted = L.layerGroup().addTo(map);
    mapRef.current = map;
    tilesRef.current = tiles;
    plottedRef.current = plotted;
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(containerRef.current);
    return () => { observer.disconnect(); map.stop(); map.remove(); mapRef.current = null; tilesRef.current = null; plottedRef.current = null; initialFitRef.current = false; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const plotted = plottedRef.current;
    if (!map || !plotted) return;
    const focusedMarker = containerRef.current?.contains(document.activeElement) ? document.activeElement as HTMLElement : undefined;
    const focusedQuay = focusedMarker?.dataset.quayCode;
    const focusedCall = focusedMarker?.dataset.callId;
    plotted.clearLayers();
    const visibleBerths = new Set(records.map((record) => formatBerthCode(record.berth)));
    if (activeBerth) visibleBerths.add(formatBerthCode(activeBerth));
    if (nextBerth) visibleBerths.add(nextBerth);
    berthKeys.forEach((code) => visibleBerths.add(formatBerthCode(code)));
    quaySummaries.filter(({ geometry }) => layer === "quays" || visibleBerths.has(geometry.code)).forEach(({ geometry: berth, current, upcoming }) => {
      const selectedBerth = berthKeys.includes(berth.code);
      const vesselBerth = !berthKeys.length && formatBerthCode(activeBerth ?? "") === berth.code;
      const isNextBerth = nextBerth === berth.code;
      const highlighted = selectedBerth || vesselBerth || isNextBerth;
      const nextColor = getComputedStyle(containerRef.current!).getPropertyValue("--v-next-outline").trim();
      const color = isNextBerth ? nextColor : highlighted ? (dark ? "#c9dbf5" : "#005758") : (dark ? "#dcdccc" : "#0a3055");
      const weight = isNextBerth ? 8 : highlighted ? 7 : layer === "quays" ? 5 : 4;
      if (isNextBerth) L.polyline(berth.quay.map(position), { color: dark ? "#0a3055" : "#ffffff", weight: 12, opacity: 1, interactive: false, lineCap: "round" }).addTo(plotted);
      const line = L.polyline(berth.quay.map(position), {
        color, opacity: highlighted ? 1 : .8, weight, interactive: false,
      }).addTo(plotted);
      if (isNextBerth) line.getElement()?.setAttribute("data-next-quay", berth.code);
      // A larger transparent hit area follows the exact same surveyed/reference
      // segment. It improves touch selection without inventing quay geometry.
      const hit = L.polyline(berth.quay.map(position), { color, weight: 24, opacity: 0, lineCap: "round" }).addTo(plotted);
      const content = document.createElement("span");
      content.textContent = `${isNextBerth ? `${locale === "da" ? "Næste kaj" : "Next quay"} · ${inspectedCall?.vesselName} · ` : ""}${t.berth} ${berth.code} · ${berth.terminal} · ${current} ${q.current.toLocaleLowerCase(locale)} · ${upcoming} ${q.upcoming.toLocaleLowerCase(locale)}`;
      hit.bindTooltip(content, { className: styles.tooltip, direction: "top", sticky: true });
      hit.on("mouseover", () => line.setStyle({ weight: 9, opacity: 1 }));
      hit.on("mouseout", () => line.setStyle({ weight, opacity: highlighted ? 1 : .8 }));
      hit.on("click", () => callbacks.current.selectQuay(berth.code));
      if (isNextBerth || selectedBerth || layer === "quays" && (zoom >= 15 || current > 0)) {
        const center = berthPosition(berth);
        if (center) {
          const label = document.createElement("span");
          label.className = styles.quayLabel;
          label.dataset.selected = String(selectedBerth);
          label.dataset.nextQuay = String(isNextBerth);
          label.textContent = berth.code;
          const marker = L.marker(position(center), { icon: L.divIcon({ className: styles.quayMarker, html: label, iconSize: [44, 44], iconAnchor: [22, selectedBerth || isNextBerth ? 58 : 22] }), keyboard: true, title: `${q.pick} ${berth.code} · ${berth.terminal}`, zIndexOffset: selectedBerth || isNextBerth ? 1200 : 0 })
            .on("click", () => callbacks.current.selectQuay(berth.code)).addTo(plotted);
          marker.bindTooltip(content.cloneNode(true) as HTMLElement, { className: styles.tooltip, direction: "top", offset: [0, -18] });
          const element = marker.getElement();
          if (element) element.dataset.quayCode = berth.code;
          element?.setAttribute("role", "button");
          element?.setAttribute("aria-pressed", String(selectedBerth));
          element?.setAttribute("aria-label", content.textContent);
          element?.addEventListener("focus", () => { marker.openTooltip(); line.setStyle({ weight: 9, opacity: 1 }); });
          element?.addEventListener("blur", () => { marker.closeTooltip(); line.setStyle({ weight, opacity: highlighted ? 1 : .8 }); });
          element?.addEventListener("keydown", (event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); event.stopPropagation(); callbacks.current.selectQuay(berth.code); } });
          if (focusedQuay === berth.code) element?.focus({ preventScroll: true });
        }
      }
    });
    if (!initialFitRef.current) {
      const points = [...Object.values(HARBOR_BERTHS).flatMap((berth) => berth.quay.map(position)), ...records.map((record) => position(record.point))];
      map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 14, animate: false });
      initialFitRef.current = true;
    }
    if (layer === "routes") {
      sailedSegments.forEach((segment) => L.polyline(segment.map(position), { color: dark ? "#c9dbf5" : "#005758", weight: 4, opacity: .9, interactive: false }).addTo(plotted));
      plannedSegments.forEach((segment) => L.polyline(segment.map(position), { color: dark ? "#dcdccc" : "#0a3055", weight: 4, dashArray: "8 8", opacity: .9, interactive: false }).addTo(plotted));
    }
    if (layer !== "quays" || berthKeys.length) mapGroups(records).forEach(({ records: group, offsetX, counted }) => {
      const status = t[group[0].call.status];
      const title = group.length === 1 ? `${group[0].call.vesselName} · ${status}` : `${group.length} ${t.group} · ${status}`;
      const marker = L.marker(position(group[0].point), {
        icon: L.divIcon({ className: styles.marker, html: markerContent(group, inspectedCall?.id, counted), iconSize: [44, 44], iconAnchor: [22 - offsetX, 22] }),
        keyboard: true, title, alt: title, riseOnHover: true,
        zIndexOffset: group.some((record) => record.call.id === inspectedCall?.id) ? 1000 : 0,
      });
      const tooltip = document.createElement("div");
      tooltip.className = styles.tooltipContent;
      const heading = document.createElement("strong");
      heading.textContent = group.length === 1 ? group[0].call.vesselName : `${group.length} calls · ${status}`;
      const detail = document.createElement("span");
      detail.textContent = group.length === 1 ? `${status} · ${t.berth} ${formatBerthCode(group[0].berth)}` : (locale === "da" ? "Klik for at se denne gruppe" : "Select to view this group");
      tooltip.append(heading, detail);
      if (group.length > 1) {
        const list = document.createElement("ul");
        group.slice(0, 5).forEach(record => { const item = document.createElement("li"); item.textContent = record.call.vesselName; list.append(item); });
        tooltip.append(list);
        if (group.length > 5) { const more = document.createElement("span"); more.textContent = `+${group.length - 5} ${locale === "da" ? "flere" : "more"}`; tooltip.append(more); }
      }
      marker.bindTooltip(tooltip, { className: styles.tooltip, direction: "auto", offset: [offsetX, 0] });
      marker.on("tooltipopen", () => {
        const info = marker.getTooltip();
        if (!info) return;
        const width = info.getElement()?.offsetWidth ?? 280;
        const mapWidth = map.getSize().x;
        const x = map.latLngToContainerPoint(marker.getLatLng()).x + offsetX;
        if (mapWidth - x >= width + 32) {
          info.options.direction = "right";
          info.options.offset = L.point(offsetX + 26, 0);
        } else if (x >= width + 32) {
          info.options.direction = "left";
          info.options.offset = L.point(offsetX - 26, 0);
        } else {
          const centre = Math.max(width / 2 + 8, Math.min(mapWidth - width / 2 - 8, x));
          info.options.direction = "top";
          info.options.offset = L.point(offsetX + centre - x, -26);
        }
        info.update();
      });
      marker.on("click", () => {
        setGroupIds(counted ? group.map((record) => record.call.id) : null);
        callbacks.current.selectCall(group.find((record) => record.call.id === inspectedCall?.id)?.call ?? group[0].call);
      }).addTo(plotted);
      const element = marker.getElement();
      if (element) element.dataset.callId = group.find((record) => record.call.id === inspectedCall?.id)?.call.id ?? group[0].call.id;
      element?.setAttribute("role", "button");
      element?.setAttribute("aria-pressed", String(group.some((record) => record.call.id === inspectedCall?.id)));
      element?.addEventListener("focus", () => marker.openTooltip());
      element?.addEventListener("blur", () => marker.closeTooltip());
      element?.addEventListener("keydown", (event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); event.stopPropagation(); marker.fire("click"); } });
      if (focusedCall && group.some((record) => record.call.id === focusedCall)) element?.focus({ preventScroll: true });
    });
  }, [records, activeBerth, nextBerth, inspectedCall?.id, inspectedCall?.vesselName, layer, sailedSegments, plannedSegments, t, q, dark, berthKeys, quaySummaries, zoom, locale]);

  useEffect(() => { if (layer === "routes") fitRoute(); }, [layer, inspectedCall?.id, fitRoute]);

  useEffect(() => { if (activeQuayCode && layer !== "routes") focusQuay(activeQuayCode); }, [activeQuayCode, focusQuay, layer]);

  useEffect(() => {
    if (!selectedInScope || !mapRef.current || inspectorMode === "quay" || layer === "routes" && routePoints.length) return;
    const { placement, kind } = getCallPlacementPresentation(selectedInScope, now);
    const point = kind === "historical"
      ? berthPosition(placement.berth)
      : pointFor(selectedInScope, snapshot, now)?.point ?? berthPosition(placement.berth);
    if (point) mapRef.current.setView(position(point), 14, { animate: false });
  }, [selectedInScope, snapshot, now, inspectorMode, layer, routePoints.length]);

  const selectRecord = (record: MapRecord) => {
    selectCall(record.call);
    if (layer === "routes") return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    mapRef.current?.setView(position(record.point), Math.max(mapRef.current.getZoom(), 14), { animate: !reduceMotion });
  };
  const fitHarbour = () => {
    const quayPoints = Object.values(HARBOR_BERTHS).flatMap((berth) => berth.quay.map(position));
    const points = [...quayPoints, ...records.map((record) => position(record.point))];
    if (points.length) mapRef.current?.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 14, animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches });
  };

  return <section className={styles.shell} aria-label={t.attention}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>AARHUS HAVN</span><h1>{t.title}</h1><p>{t.subtitle} <span>·</span> {records.length} {t.visible}</p></div>
      <div className={styles.layers} role="group" aria-label={locale === "da" ? "Kortlag" : "Map layer"}>
        {(["traffic", "quays", "routes"] as const).map((key) => <button key={key} type="button" onClick={() => { setLayer(key); setInspectorMode(key === "quays" ? "quay" : "vessel"); }} aria-pressed={layer === key}><BrandIcon name={key === "traffic" ? "portCall" : key === "quays" ? "map" : "route"} /><span>{t[key]}</span></button>)}
      </div>
    </header>
    <div className={styles.quayToolbar}>
      <label className={styles.quayPicker}><BrandIcon name="harbour" /><span className={styles.srOnly}>{q.pick}</span><select value={activeQuayCode ?? ""} onChange={(event) => event.target.value ? selectQuay(event.target.value) : clearQuays()}>
        <option value="">{q.all}</option>
        {berthKeys.filter((code) => !getBerthGeometry(code)).map((code) => <option key={code} value={code}>{t.berth} {code}</option>)}
        {quaySummaries.map(({ geometry, entries }) => <option key={geometry.code} value={geometry.code}>{t.berth} {formatBerthCode(geometry.code)} · {geometry.terminal} · {entries.length} {q.calls}</option>)}
      </select></label>
      {berthKeys.length > 0 ? <div className={styles.activeQuayFilter}><span><BrandIcon name="filter" />{berthKeys.map((code) => `${t.berth} ${formatBerthCode(code)}`).join(" · ")}</span><button type="button" onClick={clearQuays} aria-label={q.clear}><BrandIcon name="close" /></button></div> : <button type="button" className={styles.directoryButton} onClick={() => { setLayer("quays"); setInspectorMode("quay"); window.setTimeout(() => quaySearchRef.current?.focus(), 0); }}>{q.overview}<BrandIcon name="arrowRight" /></button>}
      <span className={styles.mapCount} role="status">{records.length} {q.shown}</span>
    </div>
    {layer === "routes" && <div className={styles.routeLegend} role="status"><strong>{inspectedCall?.vesselName}</strong>{sailedSegments.length > 0 && <span><i />{t.sailed}</span>}{plannedSegments.length > 0 && <span data-planned="true"><i />{t.planned}</span>}{!routePoints.length ? <span>{t.noRoute}</span> : <><span>{!sailedSegments.length ? (locale === "da" ? "Kun planlagt rute er tilgængelig." : "Only a planned route is available.") : !plannedSegments.length ? (locale === "da" ? "Kun sejlet rute er tilgængelig." : "Only a sailed route is available.") : (locale === "da" ? "Fiktive rutedata · ikke AIS eller navigation" : "Fictitious route data · not AIS or navigation")}</span><button type="button" onClick={fitRoute}>{locale === "da" ? "Vis hele ruten" : "Fit route"}</button></>}</div>}
    <div className={styles.workspace}>
      <div className={styles.mapArea}>
        <div ref={containerRef} className={styles.map} aria-label={locale === "da" ? "Interaktivt kort over Aarhus Havn" : "Interactive map of the Port of Aarhus"} />
        <div className={styles.mapControls}>
          <button type="button" onClick={fitHarbour} aria-label={t.fit} title={t.fit}><BrandIcon name="expand" /></button>
          <div><button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label={t.zoomIn}>+</button><button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label={t.zoomOut}>−</button></div>
        </div>
        {tileError && <div className={styles.tileError} role="status"><span>{t.tiles}</span><button type="button" onClick={() => { setTileError(false); tilesRef.current?.redraw(); }}>{t.retry}</button></div>}
      </div>
      <aside className={styles.inspector} aria-label={t.selected}>
        {showQuayDirectory ? <section className={styles.quayDirectory}>
          <div className={styles.directoryHeading}><span className={styles.eyebrow}>{q.overview}</span><h2>{q.pick}</h2><p>{q.selectHelp}</p></div>
          <label className={styles.quaySearch}><BrandIcon name="search" /><span className={styles.srOnly}>{q.search}</span><input ref={quaySearchRef} type="search" placeholder={q.search} value={quayQuery} onChange={(event) => setQuayQuery(event.target.value)} /></label>
          <div className={styles.quayList} aria-label={q.overview}>
            {matchingQuays.map(({ geometry, current, upcoming }) => <button key={geometry.code} type="button" className={styles.quayRow} onClick={() => selectQuay(geometry.code)}><strong>{t.berth} {geometry.code}</strong><span>{geometry.terminal}<small>{current} {q.current.toLocaleLowerCase(locale)} · {upcoming} {q.upcoming.toLocaleLowerCase(locale)}</small></span><BrandIcon name="arrowRight" /></button>)}
            {!matchingQuays.length && <p className={styles.empty}>{q.noResults}</p>}
          </div>
        </section> : showQuayInspector ? <section className={styles.quaySelection} aria-label={`${q.selected} ${activeQuayCode}`}>
          <div className={styles.quaySelectionHeader}><div><span className={styles.eyebrow}>{q.selected}</span><h2>{t.berth} {formatBerthCode(activeQuayCode)}</h2></div>{activeQuay && <button type="button" className={styles.quayZoom} onClick={() => focusQuay(activeQuayCode)} aria-label={q.focus}><BrandIcon name="expand" /></button>}</div>
          <p className={styles.quayLocation}>{activeQuay ? <>{activeQuay.terminal}<span>{activeQuay.basin}</span></> : q.noGeometry}</p>
          {activeQuay?.confidence === "low" && <p className={styles.positionNotice}>{locale === "da" ? "Omtrentlig kajplacering · ikke geografisk verificeret." : "Approximate quay position · not geographically verified."}</p>}
          <dl className={styles.quayStats}><div><dt>{q.current}</dt><dd>{quayEntries.filter((entry) => entry.assignment.kind === "current").length}</dd></div><div><dt>{q.upcoming}</dt><dd>{quayEntries.filter((entry) => entry.assignment.kind === "upcoming").length}</dd></div></dl>
          <p className={styles.quayScope}>{q.accessible}{matchingQuayCalls !== quayEntries.length && <span>{matchingQuayCalls} {q.from} {quayEntries.length} {q.matches}.</span>}</p>
          {quayEntries.length ? <>
            {!records.length && <p className={styles.quayNoPosition}>{q.noPosition}</p>}
            <div className={styles.quayCalls}>
              {(["current", "upcoming"] as const).map((kind) => {
                const entries = quayEntries.filter((entry) => entry.assignment.kind === kind);
                return entries.length > 0 && <section key={kind}><h3>{q[kind]} <span>{entries.length}</span></h3>{entries.map((entry) => {
                  const { call, assignment } = entry;
                  const { primary, live } = getQuayAssignmentTiming(entry);
                  return <button key={call.id} type="button" className={styles.quayCall} onClick={() => onOpen(call)} aria-label={`${q.viewDetails}: ${call.vesselName}`}><span><strong>{call.vesselName}</strong><small>{kind === "current" ? `${assignment.bollardFrom}–${assignment.bollardTo} · ${assignment.side === "port" ? (locale === "da" ? "Bagbord" : "Port") : (locale === "da" ? "Styrbord" : "Starboard")}` : `${shortDate(primary?.value ?? "", locale)} · ${formatClock(primary?.value ?? "")}${primary?.kind ? ` · ${timeNames[locale][primary.kind]}` : ""}`}</small>{kind === "upcoming" && live && <small>{liveEtaLabel(live, primary?.value, locale)}</small>}</span><BrandIcon name="arrowUpRight" /></button>;
                })}</section>;
              })}
            </div>
            <button type="button" className={styles.quayListLink} onClick={() => onBerth(activeQuayCode)}>{q.showList}<BrandIcon name="arrowRight" /></button>
          </> : <div className={styles.emptyQuay}><BrandIcon name="harbour" /><strong>{q.empty}</strong><p>{q.emptyHelp}</p><button type="button" onClick={clearQuays}>{q.clear}</button></div>}
          <button type="button" className={styles.findQuay} onClick={() => { clearQuays(); setLayer("quays"); setQuayQuery(""); window.setTimeout(() => quaySearchRef.current?.focus(), 0); }}>{q.directory}<BrandIcon name="search" /></button>
        </section> : inspectedCall && activeBerth ? <>
          <div className={styles.selection}>
            {activeQuayCode && <button type="button" className={styles.backToQuay} onClick={() => setInspectorMode("quay")}><BrandIcon name="arrowLeft" />{t.berth} {formatBerthCode(activeQuayCode)}</button>}
            <div className={styles.selectionTop}><span className={styles.eyebrow}>{t.selected}</span><StateLabel state={inspectedCall.status}>{t[inspectedCall.status]}</StateLabel></div>
            <h3>{inspectedCall.vesselName}</h3><p>{inspectedCall.callNumber} <span>·</span> {categoryName(inspectedCall.category, locale)}</p>
            {getBerthGeometry(activeBerth)?.confidence === "low" && <p className={styles.positionNotice}>{locale === "da" ? "Kajplaceringen er omtrentlig. Markøren er ikke en målt skibsposition." : "The quay position is approximate. The marker is not a measured vessel position."}</p>}
            {!active && <p className={styles.positionNotice}>{inspectedPlacement?.kind === "historical" ? (locale === "da" ? "Callet er afsluttet. Kortet viser den sidste kajplacering." : "This call has ended. The map shows its final berth assignment.") : (locale === "da" ? "Ingen skibsposition er tilgængelig. Kortet viser den planlagte kaj." : "No vessel position is available. The map shows the planned berth.")}</p>}
            <dl className={styles.facts}>
              <div><dt>{t.berth}</dt><dd>{berthFilterable ? <button type="button" onClick={() => selectQuay(activeBerth)} aria-label={`${t.filter} ${formatBerthCode(activeBerth)}`}>{formatBerthCode(activeBerth)}<BrandIcon name="arrowUpRight" /></button> : formatBerthCode(activeBerth)}</dd></div>
              <div><dt>LOA</dt><dd>{inspectedCall.loaMeters} <small>{t.units}</small></dd></div>
              <div><dt>{t.arrival}</dt><dd>{formatClock(arrivalTime?.value ?? "")}<small className={styles.factDate}>{shortDate(arrivalTime?.value ?? "", locale)}</small>{arrivalTime && <small className={styles.factKind} data-kind={arrivalTime.kind}>{timeNames[locale][arrivalTime.kind]}</small>}{liveArrival && liveArrival !== arrivalTime?.value && <small className={styles.factLive}>{liveEtaLabel(liveArrival, arrivalTime?.value, locale)}</small>}</dd></div>
              <div><dt>{t.departure}</dt><dd>{formatClock(departureTime?.value ?? "")}<small className={styles.factDate}>{shortDate(departureTime?.value ?? "", locale)}</small>{departureTime && <small className={styles.factKind} data-kind={departureTime.kind}>{timeNames[locale][departureTime.kind]}</small>}</dd></div>
            </dl>
            {next && <div className={`${styles.next} ${stateSurface.surface}`} data-state={next.state} aria-label={`${t.next} · ${timeNames[locale][next.state]}`}><strong>{t.operation[next.type]} <time>{formatClock(next.at)}</time></strong><small>{shortDate(next.at, locale)}</small></div>}
            <button type="button" className={styles.openButton} onClick={() => onOpen(inspectedCall)}>{t.details}<BrandIcon name="arrowUpRight" /></button>
          </div>
          <div className={styles.vesselListHeader}><span>{t.vesselList}</span>{groupIds && <button type="button" onClick={() => setGroupIds(null)}>{locale === "da" ? "Vis alle" : "Show all"}</button>}</div>
          <div className={styles.vesselList}>
            {visibleList.map((record) => <button key={record.call.id} type="button" className={`${styles.vesselRow} ${stateSurface.surface}`} data-state={record.call.status} aria-pressed={inspectedCall.id === record.call.id} onClick={() => selectRecord(record)}><span className={styles.vesselCopy}><strong>{record.call.vesselName}</strong><small>{t[record.call.status]} · {t.berth} {formatBerthCode(record.berth)}</small></span>{inspectedCall.id === record.call.id ? <span className={styles.selectedVessel}><BrandIcon name="check" /><span>{locale === "da" ? "Valgt" : "Selected"}</span></span> : <BrandIcon name="arrowRight" />}</button>)}
          </div>
        </> : <p className={styles.empty}>{t.empty}</p>}
      </aside>
    </div>
    <footer className={styles.footer}>
      <div className={styles.legend} aria-label={locale === "da" ? "Statusfarver" : "Status colours"}>{(["expected", "en-route", "arrived"] as const).map((status) => <StateLabel key={status} state={status}>{t[status]}</StateLabel>)}</div>
      {nextBerth && <button type="button" className={styles.nextQuayKey} onClick={() => focusQuay(nextBerth)} aria-label={`${locale === "da" ? "Zoom til næste kaj" : "Zoom to next quay"} ${nextBerth} · ${inspectedCall?.vesselName}`}><i aria-hidden="true" />{locale === "da" ? "Næste kaj" : "Next quay"} · {nextBerth}<BrandIcon name="expand" /></button>}
      <details className={styles.sources}><summary>{t.source}</summary><p>{t.sourceText}</p><p>{locale === "da" ? "Kajnumre er aflæst fra PDF’en og tilpasset OSM-kystlinjen. Farver: gul = forventet, blå = på vej/bestilt, rød = i havn/faktisk. En skibsstatus ændrer ikke operationernes registreringer." : "Quay labels were digitized from the PDF and aligned to the OSM coastline. Yellow = expected, blue = en route/ordered, red = alongside/actual. Vessel status does not change operation records."}</p><a href="https://cdn.prod.website-files.com/664c5c4e2aed028ecda3e892/695d0e9a71687746f4bf72f7_Havnekort_nov_2025.pdf" target="_blank" rel="noopener noreferrer">{locale === "da" ? "Officielt havnekort · november 2025 (PDF)" : "Official harbour map · November 2025 (PDF)"}</a><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors <span aria-hidden="true">↗</span></a>{activeQuay && <p>{t.berth} {activeQuay.code} · {activeQuay.terminal} · {q.depth}: {activeQuay.localDepthM ?? activeQuay.basinDepthM} m<br />{q.reference}{activeQuay.confidence === "low" && <><br />{locale === "da" ? "Placeringen har lav koordinatsikkerhed." : "This position has low coordinate confidence."}</>}</p>}</details>
    </footer>
  </section>;
}
