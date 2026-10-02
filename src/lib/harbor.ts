import type { PortCall } from "@/lib/watchlist";
import { HARBOR_ALIGNMENT } from "./harborAlignment";

export type HarborPoint = Readonly<{ latitude: number; longitude: number }>;
export type BerthWaterSide = "left" | "right";
export type NavigationNodeId = "outer-fairway" | "north-approach" | "container-approach" | "omni-approach" | "east-multi-approach" | "west-multi-approach" | "oil-approach" | "sydhavnen-approach";

/**
 * Geometry distilled from Aarhus Havn's colour map, issued November 2025.
 * The source is a visual planning map, not a GIS/bollard survey. The polyline
 * represents the operational quay segment, not an exact mooring point.
 */
export type BerthGeometry = Readonly<{
  code: string;
  terminal: string;
  basin: string;
  quay: readonly HarborPoint[];
  quayStart: HarborPoint;
  quayEnd: HarborPoint;
  heading: number;
  waterSide: BerthWaterSide;
  basinDepthM: number;
  localDepthM?: number;
  approachNode: NavigationNodeId;
  maxLoaMeters: number;
  maxBeamMeters: number;
  source: "Aarhus Havn map · November 2025";
  confidence: "medium" | "low";
  provenance: "official-map + PDF↔OSM planning alignment" | "official-map code; WGS84 coordinate low-confidence";
}>;

export type HarborSimulationState = "outside" | "holding" | "inbound" | "turning" | "alongside" | "shifting" | "outbound" | "hidden";
export const AARHUS_HARBOR_CENTER: HarborPoint = { latitude: 56.1555, longitude: 10.2295 };
const SOURCE = "Aarhus Havn map · November 2025" as const;

const NAVIGATION_NODES: Readonly<Record<NavigationNodeId, HarborPoint>> = {
  "outer-fairway": { latitude: 56.1644, longitude: 10.2920 },
  "north-approach": { latitude: 56.1630, longitude: 10.2650 },
  "container-approach": { latitude: 56.1550, longitude: 10.2420 },
  "omni-approach": { latitude: 56.1514, longitude: 10.2345 },
  "east-multi-approach": { latitude: 56.1460, longitude: 10.2275 },
  "west-multi-approach": { latitude: 56.1465, longitude: 10.2220 },
  "oil-approach": { latitude: 56.1580, longitude: 10.2270 },
  "sydhavnen-approach": { latitude: 56.1500, longitude: 10.2195 },
};
export const HARBOR_NAVIGATION_NODES = NAVIGATION_NODES;

/** Connectivity of the navigable water branches visible on the source map. */
export const HARBOR_NAVIGATION_GRAPH: Readonly<Record<NavigationNodeId, readonly NavigationNodeId[]>> = {
  "outer-fairway": ["north-approach"],
  "north-approach": ["container-approach"],
  "container-approach": ["north-approach", "omni-approach", "west-multi-approach", "east-multi-approach", "oil-approach"],
  "omni-approach": ["container-approach", "west-multi-approach", "east-multi-approach"],
  "east-multi-approach": ["container-approach", "omni-approach"],
  "west-multi-approach": ["container-approach", "omni-approach", "oil-approach", "sydhavnen-approach"],
  "oil-approach": ["container-approach", "west-multi-approach", "sydhavnen-approach"],
  "sydhavnen-approach": ["oil-approach", "west-multi-approach"],
};

type SeriesOptions = {
  terminal: string; basin: string; codes: readonly number[];
  basinDepthM: number; localDepthM?: number; approachNode: NavigationNodeId; maxLoaMeters: number; maxBeamMeters: number;
  confidence?: "medium" | "low";
};

function addPoint(left: HarborPoint, right: HarborPoint): HarborPoint {
  return { latitude: left.latitude + right.latitude, longitude: left.longitude + right.longitude };
}

function pointAtBearing(center: HarborPoint, heading: number, halfLengthMeters: number): { start: HarborPoint; end: HarborPoint } {
  const radians = heading * Math.PI / 180;
  const metersPerDegree = 111_320;
  const axis = {
    latitude: Math.cos(radians) * halfLengthMeters / metersPerDegree,
    longitude: Math.sin(radians) * halfLengthMeters / (metersPerDegree * Math.cos(center.latitude * Math.PI / 180)),
  };
  return { start: addPoint(center, { latitude: -axis.latitude, longitude: -axis.longitude }), end: addPoint(center, axis) };
}

function makeSeries(options: SeriesOptions): BerthGeometry[] {
  return options.codes.map((code) => {
    const aligned = HARBOR_ALIGNMENT[String(code)];
    if (!aligned) throw new Error(`Missing source-aligned geometry for quay ${code}`);
    const center = { latitude: aligned.latitude, longitude: aligned.longitude };
    const segment = pointAtBearing(center, aligned.heading, aligned.halfLengthMeters);
    return {
      code: String(code), terminal: options.terminal, basin: options.basin, quay: [segment.start, center, segment.end], quayStart: segment.start, quayEnd: segment.end,
      heading: aligned.heading, waterSide: aligned.waterSide, basinDepthM: options.basinDepthM, localDepthM: options.localDepthM,
      approachNode: options.approachNode, maxLoaMeters: options.maxLoaMeters, maxBeamMeters: options.maxBeamMeters, source: SOURCE,
      confidence: aligned.snapDistanceMeters > 35 ? "low" : options.confidence ?? "medium", provenance: "official-map + PDF↔OSM planning alignment",
    };
  });
}

const BERTH_SEGMENTS: readonly BerthGeometry[] = [
  ...makeSeries({ terminal: "Sydhavnen", basin: "Bassin 3", codes: [103, 105, 107, 109], basinDepthM: 10, localDepthM: 8.2, approachNode: "sydhavnen-approach", maxLoaMeters: 190, maxBeamMeters: 30 }),
  ...makeSeries({ terminal: "Kornpier", basin: "Bassin 3", codes: [113, 115, 117, 119, 121, 123], basinDepthM: 10, localDepthM: 8.1, approachNode: "sydhavnen-approach", maxLoaMeters: 190, maxBeamMeters: 30 }),
  ...makeSeries({ terminal: "Multiterminal Vest", basin: "Bassin 9", codes: [301, 303, 305, 307, 309, 311, 313], basinDepthM: 13.5, localDepthM: 12.5, approachNode: "west-multi-approach", maxLoaMeters: 240, maxBeamMeters: 38 }),
  ...makeSeries({ terminal: "Multiterminal Øst", basin: "Bassin 9", codes: [302, 304, 306, 308, 310, 312, 314, 316, 318, 320, 322, 324, 326], basinDepthM: 13.5, localDepthM: 12.5, approachNode: "east-multi-approach", maxLoaMeters: 240, maxBeamMeters: 38 }),
  ...makeSeries({ terminal: "Containerterminal", basin: "Bassin 11–12", codes: [404, 406, 408, 410, 412, 414, 416, 418, 420, 422, 424, 426, 428], basinDepthM: 14, localDepthM: 13.5, approachNode: "container-approach", maxLoaMeters: 300, maxBeamMeters: 46 }),
  ...makeSeries({ terminal: "Omniterminal", basin: "Bassin 10", codes: [501, 503, 505, 507, 509], basinDepthM: 13.5, localDepthM: 12.2, approachNode: "omni-approach", maxLoaMeters: 230, maxBeamMeters: 38 }),
  ...makeSeries({ terminal: "Olietterminal", basin: "Bassin 4/6", codes: [108, 110, 112, 114, 116, 118, 120, 122, 124, 126, 128], basinDepthM: 11, localDepthM: 8.5, approachNode: "oil-approach", maxLoaMeters: 210, maxBeamMeters: 34 }),
  ...makeSeries({ terminal: "Olietterminal", basin: "Bassin 4", codes: [201, 202, 203, 204, 206], basinDepthM: 10, localDepthM: 7.8, approachNode: "oil-approach", maxLoaMeters: 180, maxBeamMeters: 30, confidence: "low" }),
];

export const HARBOR_BERTHS: Readonly<Record<string, BerthGeometry>> = Object.freeze(
  Object.fromEntries(BERTH_SEGMENTS.map((berth) => [berth.code, berth])) as Record<string, BerthGeometry>,
);

/** Canonical map lookup key for legacy `Kaj 105`/`Berth 105`/`105` labels. */
export function normalizeHarborBerthCode(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^(?:(?:berth|kaj)\s*)?([0-9]+[a-z]?)$/i);
  if (!match) return trimmed.toLocaleLowerCase("en").replace(/\s+/g, " ");
  const code = match[1];
  const digits = code.match(/^\d+/)?.[0] ?? code;
  return `${Number(digits)}${code.slice(digits.length).toUpperCase()}`;
}

function numericBerthCode(value: string): string { return normalizeHarborBerthCode(value); }
export function getBerthGeometry(berth: string): BerthGeometry | undefined { return HARBOR_BERTHS[numericBerthCode(berth)]; }
export function isMappedBerth(berth: string): boolean { return getBerthGeometry(berth) !== undefined; }

export function areAdjacentBerths(left: string, right: string): boolean {
  const leftGeometry = getBerthGeometry(left);
  const rightGeometry = getBerthGeometry(right);
  if (!leftGeometry || !rightGeometry || leftGeometry.terminal !== rightGeometry.terminal || leftGeometry.basin !== rightGeometry.basin) return false;
  const siblings = BERTH_SEGMENTS.filter((item) => item.terminal === leftGeometry.terminal && item.basin === leftGeometry.basin);
  const leftIndex = siblings.findIndex((item) => item.code === leftGeometry.code);
  const rightIndex = siblings.findIndex((item) => item.code === rightGeometry.code);
  return leftIndex >= 0 && rightIndex >= 0 && Math.abs(leftIndex - rightIndex) === 1;
}

export function berthPosition(berth: string | BerthGeometry, fraction = 0.5): HarborPoint | undefined {
  const geometry = typeof berth === "string" ? getBerthGeometry(berth) : berth;
  if (!geometry) return undefined;
  const bounded = Math.max(0, Math.min(1, fraction));
  return {
    latitude: geometry.quayStart.latitude + (geometry.quayEnd.latitude - geometry.quayStart.latitude) * bounded,
    longitude: geometry.quayStart.longitude + (geometry.quayEnd.longitude - geometry.quayStart.longitude) * bounded,
  };
}

/** Backwards-compatible centre lookup, containing only mapped segments. */
export const HARBOR_BERTH_ANCHORS: Readonly<Record<string, HarborPoint>> = Object.freeze(
  Object.fromEntries(BERTH_SEGMENTS.map((berth) => [berth.code, berthPosition(berth)!])) as Record<string, HarborPoint>,
);

/** Returns undefined for an unmapped legacy code; it never invents a centre. */
export function berthAnchor(berth: string): HarborPoint | undefined {
  const geometry = getBerthGeometry(berth);
  return geometry ? berthPosition(geometry) : undefined;
}

const APPROACH_ROUTES: Readonly<Record<NavigationNodeId, readonly HarborPoint[]>> = {
  "container-approach": [NAVIGATION_NODES["outer-fairway"], NAVIGATION_NODES["north-approach"], NAVIGATION_NODES["container-approach"]],
  "omni-approach": [NAVIGATION_NODES["outer-fairway"], NAVIGATION_NODES["north-approach"], NAVIGATION_NODES["container-approach"], NAVIGATION_NODES["omni-approach"]],
  "east-multi-approach": [NAVIGATION_NODES["outer-fairway"], NAVIGATION_NODES["north-approach"], NAVIGATION_NODES["container-approach"], NAVIGATION_NODES["east-multi-approach"]],
  "west-multi-approach": [NAVIGATION_NODES["outer-fairway"], NAVIGATION_NODES["north-approach"], NAVIGATION_NODES["container-approach"], NAVIGATION_NODES["west-multi-approach"]],
  "oil-approach": [NAVIGATION_NODES["outer-fairway"], NAVIGATION_NODES["north-approach"], NAVIGATION_NODES["container-approach"], NAVIGATION_NODES["oil-approach"]],
  "sydhavnen-approach": [NAVIGATION_NODES["outer-fairway"], NAVIGATION_NODES["north-approach"], NAVIGATION_NODES["container-approach"], NAVIGATION_NODES["oil-approach"], NAVIGATION_NODES["sydhavnen-approach"]],
  "outer-fairway": [NAVIGATION_NODES["outer-fairway"]],
  "north-approach": [NAVIGATION_NODES["outer-fairway"], NAVIGATION_NODES["north-approach"]],
};

export type NavigationDirection = "inbound" | "outbound";
export function navigationRouteForBerth(berth: string, direction: NavigationDirection = "inbound"): HarborPoint[] {
  const geometry = getBerthGeometry(berth);
  if (!geometry) return [];
  const approach = APPROACH_ROUTES[geometry.approachNode] ?? [];
  const centre = berthPosition(geometry);
  if (!centre) return [];
  return direction === "inbound" ? [...approach, centre] : [centre, ...[...approach].reverse()];
}

export function holdingPointForBerth(berth: string): HarborPoint | undefined {
  const geometry = getBerthGeometry(berth);
  if (!geometry) return undefined;
  return NAVIGATION_NODES["outer-fairway"];
}

export function interpolateHarborPath(points: readonly HarborPoint[], progress: number): HarborPoint | undefined {
  if (points.length === 0) return undefined;
  if (points.length === 1) return points[0];
  const bounded = Math.max(0, Math.min(1, progress));
  const scaled = bounded * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(scaled));
  const fraction = scaled - index;
  const from = points[index];
  const to = points[index + 1];
  return { latitude: from.latitude + (to.latitude - from.latitude) * fraction, longitude: from.longitude + (to.longitude - from.longitude) * fraction };
}

export type BerthTimeline = Readonly<{ arrivalAt: string; departureAt: string; shiftAt?: string | readonly string[] }>;
/** One clock-driven state machine shared by mock generation, map markers and QA. */
export function deriveHarborState(timeline: BerthTimeline, simulationNow: number | string): HarborSimulationState {
  const now = typeof simulationNow === "number" ? simulationNow : Date.parse(simulationNow);
  const arrival = Date.parse(timeline.arrivalAt);
  const departure = Date.parse(timeline.departureAt);
  if (![now, arrival, departure].every(Number.isFinite)) return "outside";
  if (now < arrival - 12 * 60 * 60_000) return "outside";
  if (now < arrival - 90 * 60_000) return "holding";
  if (now < arrival - 20 * 60_000) return "inbound";
  if (now < arrival) return "turning";
  const shiftTimes = timeline.shiftAt ? (Array.isArray(timeline.shiftAt) ? timeline.shiftAt : [timeline.shiftAt]) : [];
  if (shiftTimes.some((value) => {
    const shift = Date.parse(value);
    return Number.isFinite(shift) && now >= shift - 20 * 60_000 && now < shift + 45 * 60_000;
  })) return "shifting";
  if (now < departure) return "alongside";
  return now < departure + 60 * 60_000 ? "outbound" : "hidden";
}

function arrivalTime(call: PortCall): string {
  return call.operations.find((operation) => operation.type === "arrival")?.at
    ?? call.arrivalTimes.find((time) => time.kind === "actual")?.value
    ?? call.arrivalTimes.find((time) => time.kind === "live")?.value
    ?? call.arrivalTimes.find((time) => time.kind === "ordered")?.value
    ?? call.arrivalTimes.find((time) => time.kind === "expected")?.value ?? "";
}
function departureTime(call: PortCall): string {
  return call.operations.find((operation) => operation.type === "departure")?.at
    ?? call.departureTimes.find((time) => time.kind === "actual")?.value
    ?? call.departureTimes.find((time) => time.kind === "live")?.value
    ?? call.departureTimes.find((time) => time.kind === "ordered")?.value
    ?? call.departureTimes.find((time) => time.kind === "expected")?.value ?? "";
}
export function derivePortCallState(call: PortCall, simulationNow: number | string): HarborSimulationState {
  const shiftAt = [...call.operations]
    .filter((operation) => operation.type === "shifting")
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .map((operation) => operation.at);
  return deriveHarborState({ arrivalAt: arrivalTime(call), departureAt: departureTime(call), shiftAt }, simulationNow);
}
export function isOperationalHarborState(state: HarborSimulationState): boolean {
  return state === "inbound" || state === "turning" || state === "alongside" || state === "shifting" || state === "outbound";
}

export type VesselDimensions = Readonly<{ loaMeters: number; beamMeters: number; draftMeters?: number }>;
export function berthSupportsVessel(berth: string, vessel: VesselDimensions): boolean {
  const geometry = getBerthGeometry(berth);
  if (!geometry) return false;
  return vessel.loaMeters <= geometry.maxLoaMeters && vessel.beamMeters <= geometry.maxBeamMeters
    && (vessel.draftMeters === undefined || vessel.draftMeters <= (geometry.localDepthM ?? geometry.basinDepthM) - 0.5);
}
