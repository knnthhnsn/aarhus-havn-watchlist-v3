import type {
  CallServiceOrder,
  OperationalTime,
  Placement,
  PortCall,
  PortCallStatus,
  PortOperation,
  ServiceCode,
  ShipTracking,
  Vessel,
  WatchlistSnapshot,
} from "@/lib/watchlist";
import { getActiveShiftingOperation, getDepartureOperation, getDeparturePlacement, getEffectivePlacement, getOperationPlacement, primaryTime, PROTOTYPE_OPERATIONS_NOW } from "@/lib/watchlist";
import { withinBookingWindow } from "@/lib/bookingWindow";
import {
  HARBOR_BERTHS,
  areAdjacentBerths,
  berthPosition,
  derivePortCallState,
  getBerthGeometry,
  holdingPointForBerth,
  interpolateHarborPath,
  navigationRouteForBerth,
  type HarborPoint,
} from "@/lib/harbor";

const FIRST_NAMES = ["Baltic", "Aurora", "Northstar", "Juniper", "Copper", "Mistral", "Silver", "Harbour", "Saffron", "Atlantic", "Nordic", "Arctic", "Skagen", "Kattegat", "Meridian", "Danish"];
const LAST_NAMES = ["Kestrel", "Sound", "Current", "Echo", "Tern", "Lantern", "Finch", "Pioneer"];
const AGENTS = ["Nordic Port Agency", "Baltic Harbor Services", "Aarhus Marine", "Quayline Agency", "Sound Shipping"];
const CUSTOMERS = ["North Sea Logistics", "Meridian Grain", "Scandia Steel", "Blue Stack Cargo", "Kestrel Container Services"];
const MINUTE = 60_000;
const STUD_CALL_INDEXES = new Set([9, 12]);
export const MOCK_SNAPSHOT_FETCHED_AT = PROTOTYPE_OPERATIONS_NOW;
const BASE = Date.parse(MOCK_SNAPSHOT_FETCHED_AT);

/** Only codes represented by explicit official-map geometry are used here. */
const BERTH_POOLS = [
  ["Berth 103", "Berth 105", "Berth 107", "Berth 109"],
  ["Berth 301", "Berth 303", "Berth 305", "Berth 307", "Berth 309", "Berth 311", "Berth 313"],
  ["Berth 302", "Berth 304", "Berth 306", "Berth 308", "Berth 310", "Berth 312", "Berth 314", "Berth 316", "Berth 318", "Berth 320", "Berth 322", "Berth 324", "Berth 326"],
  ["Berth 404", "Berth 406", "Berth 408", "Berth 410", "Berth 412", "Berth 414", "Berth 416", "Berth 418", "Berth 420", "Berth 422", "Berth 424", "Berth 426", "Berth 428"],
  ["Berth 501", "Berth 503", "Berth 505", "Berth 507", "Berth 509"],
  ["Berth 113", "Berth 115", "Berth 117", "Berth 119", "Berth 121", "Berth 123"],
  ["Berth 108", "Berth 110", "Berth 112", "Berth 114", "Berth 116", "Berth 118", "Berth 120", "Berth 122", "Berth 124", "Berth 126", "Berth 128"],
  ["Berth 201", "Berth 202", "Berth 203", "Berth 204", "Berth 206"],
] as const;

const allMappedBerths = Object.values(HARBOR_BERTHS);
const iso = (timestamp: number): string => new Date(timestamp).toISOString();

function scheduleFor(index: number): { arrival: number; departure: number } {
  if (index < 3) {
    const departure = BASE - (15 + index * 25) * MINUTE;
    return { arrival: departure - (5 + index) * 60 * MINUTE, departure };
  }
  if (index < 8) {
    const arrival = BASE - (45 - (index - 3) * 8) * MINUTE;
    return { arrival, departure: BASE + (4 + (index % 3)) * 60 * MINUTE };
  }
  if (index < 20) {
    const arrival = BASE + (20 + (index - 8) * 18) * MINUTE;
    return { arrival, departure: arrival + (6 + (index % 4)) * 60 * MINUTE };
  }
  const arrival = BASE + (6 * 60 + (index - 20) * 74) * MINUTE;
  return { arrival, departure: arrival + (6 + (index % 8)) * 60 * MINUTE };
}

function statusFor(arrival: number, departure: number): PortCallStatus {
  if (departure <= BASE) return "departed";
  if (arrival <= BASE) return "arrived";
  if (arrival <= BASE + 12 * 60 * MINUTE) return "en-route";
  return "expected";
}

function berthFor(index: number): string {
  if (index % 13 === 0) return "Berth 203";
  const pool = BERTH_POOLS[index % BERTH_POOLS.length];
  return pool[Math.floor(index / BERTH_POOLS.length) % pool.length];
}

function sameTerminalBerth(berth: string, index: number): string | undefined {
  const geometry = getBerthGeometry(berth);
  // Low-confidence WGS84 series are deliberately not used to invent a berth
  // shift: their catalogue order is not a verified physical adjacency.
  if (!geometry || geometry.confidence !== "medium") return undefined;
  const candidates = allMappedBerths.filter((item) => item.terminal === geometry.terminal && item.basin === geometry.basin);
  const currentIndex = candidates.findIndex((item) => item.code === geometry.code);
  if (currentIndex < 0 || candidates.length < 2) return undefined;
  const direction = index % 2 === 0 ? 1 : -1;
  const preferredIndex = currentIndex + direction;
  const fallbackIndex = direction > 0 ? currentIndex - 1 : currentIndex + 1;
  const next = candidates[preferredIndex] ?? candidates[fallbackIndex];
  return next && next.confidence === "medium" && areAdjacentBerths(berth, next.code) ? next.code : undefined;
}

function arrivalTimes(index: number, scheduled: number, status: PortCallStatus): OperationalTime[] {
  const delayMinutes = index % 13 === 0 ? 175 : (index % 5) * 4;
  const times: OperationalTime[] = [{ kind: "expected", value: iso(scheduled) }];
  if (withinBookingWindow(iso(scheduled), BASE)) times.push({ kind: "ordered", value: iso(scheduled) });
  if (status !== "expected" || index % 9 === 0) times.push({ kind: "live", value: iso(scheduled + delayMinutes * MINUTE) });
  if (status === "arrived" || status === "departed") times.push({ kind: "actual", value: iso(scheduled + Math.min(delayMinutes, 10) * MINUTE) });
  return times;
}

function departureTimes(index: number, scheduled: number, status: PortCallStatus): OperationalTime[] {
  const times: OperationalTime[] = [{ kind: "expected", value: iso(scheduled) }];
  if (withinBookingWindow(iso(scheduled), BASE)) times.push({ kind: "ordered", value: iso(scheduled) });
  if (status === "departed") times.push({ kind: "actual", value: iso(scheduled + (index % 8) * MINUTE) });
  return times;
}

function operativeOperationTime(times: readonly OperationalTime[]): { at: string; state: "expected" | "ordered" | "actual" } {
  // Select the same prioritized entry used by primaryTime. Matching by value
  // alone is unsafe when live and actual timestamps coincide: the earlier
  // array entry would incorrectly turn a completed event back into ordered.
  const selected = times.find((time) => time.kind === "actual")
    ?? times.find((time) => time.kind === "ordered")
    ?? times.find((time) => time.kind === "expected")
    ?? times.find((time) => time.kind === "live");
  if (!selected) return { at: "", state: "expected" };
  return { at: selected.value, state: selected.kind === "actual" ? "actual" : selected.kind === "ordered" ? "ordered" : "expected" };
}

function withPlacement<T extends Omit<PortOperation, "placement" | "berth" | "bollardFrom" | "bollardTo" | "side">>(operation: T, placement: Placement): PortOperation {
  return { ...operation, placement, berth: placement.berth, bollardFrom: placement.bollardFrom, bollardTo: placement.bollardTo, side: placement.side };
}

function shiftPlacement(berth: string, index: number, offset: number, current: Placement): Placement {
  const bollardFrom = 8 + ((index + offset) % 8) * 4;
  return { berth, bollardFrom, bollardTo: bollardFrom + 7 + (index % 3), side: current.side === "port" ? "starboard" : "port" };
}

function makeVessel(index: number, berth: string): Vessel {
  const geometry = getBerthGeometry(berth)!;
  const name = `${FIRST_NAMES[index % FIRST_NAMES.length]} ${LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length]}`;
  const category = geometry.terminal === "Containerterminal" ? "Container ship" : geometry.terminal === "Olietterminal" ? "Chemical tanker" : index % 3 === 0 ? "Bulk carrier" : "General cargo";
  const loa = Math.min(geometry.maxLoaMeters - 5, 112 + (index * 7.3) % 100);
  const beam = Math.min(geometry.maxBeamMeters - 2, 17 + (index * 1.7) % 16);
  return {
    id: `vessel-${index + 1}`, imo: String(9300000 + index * 37), callSign: `O${String.fromCharCode(65 + (index % 26))}${String.fromCharCode(65 + ((index * 7) % 26))}${index % 10}`,
    name, category, loaMeters: Number(loa.toFixed(1)), beamMeters: Number(beam.toFixed(1)), customer: CUSTOMERS[index % CUSTOMERS.length], agent: AGENTS[index % AGENTS.length],
    flag: ["DK", "NL", "DE", "NO", "SE", "GB"][index % 6], lastPort: ["NLRTM", "DEHAM", "SEGOT", "NOOSL"][index % 4], nextPort: index % 9 === 0 ? "ZZUKN" : ["DKAAR", "PLGDN", "GBFXT"][index % 3],
  };
}

function makeOperations(index: number, callId: string, arrival: number, departure: number, initial: Placement): PortOperation[] {
  const servicesFor = (offset: number): { serviceCodes: ServiceCode[]; tugQuantity?: number } => {
    const serviceCodes: ServiceCode[] = [];
    if ((index + offset) % 4 === 0) serviceCodes.push("H");
    if ((index + offset) % 5 === 0) serviceCodes.push("L");
    if ((index + offset) % 6 === 0) serviceCodes.push("B");
    return { serviceCodes, tugQuantity: serviceCodes.includes("B") ? 1 + ((index + offset) % 2) : undefined };
  };
  const status = statusFor(arrival, departure);
  const arrivalTime = arrivalTimes(index, arrival, status);
  const departureTime = departureTimes(index, departure, status);
  const arrivalOperationTime = operativeOperationTime(arrivalTime);
  const departureOperationTime = operativeOperationTime(departureTime);
  const arrivalServices = servicesFor(0);
  const operations: PortOperation[] = [withPlacement({ id: `${callId}-arrival`, type: "arrival", label: "Arrival", at: arrivalOperationTime.at, state: arrivalOperationTime.state, ...arrivalServices }, initial)];
  // Keep a medium-confidence, already-arrived call in the snapshot inside a
  // live shift window.  Index 3 is the deterministic fixture for that case;
  // index 0/5/10/... continue to exercise the broader shift distribution.
  const shiftBerth = index % 5 === 0 || index === 3 ? sameTerminalBerth(initial.berth, index + 2) : undefined;
  let finalPlacement = initial;
  if (shiftBerth) {
    const shiftMinutes = index === 3 || index % 10 === 5 ? 10 : 150;
    const shiftAt = arrival + shiftMinutes * MINUTE;
    const shiftState: PortOperation["state"] = shiftAt <= BASE ? "actual" : withinBookingWindow(iso(shiftAt), BASE) ? "ordered" : "expected";
    const firstPlacement = shiftPlacement(shiftBerth, index, 1, initial);
    finalPlacement = firstPlacement;
    const firstServices = servicesFor(1);
    operations.push(withPlacement({ id: `${callId}-shift-1`, type: "shifting", label: "Shift to secondary berth", at: iso(shiftAt), state: shiftState, details: "Same-terminal shift; source geometry is mapped to both quay segments.", ...firstServices }, firstPlacement));
    const returnBerth = index % 10 === 0 ? sameTerminalBerth(shiftBerth, index + 3) : undefined;
    if (returnBerth) {
      const returnAt = arrival + 260 * MINUTE;
      const returnState: PortOperation["state"] = returnAt <= BASE ? "actual" : withinBookingWindow(iso(returnAt), BASE) ? "ordered" : "expected";
      const returnPlacement = shiftPlacement(returnBerth, index, 3, firstPlacement);
      finalPlacement = returnPlacement;
      const returnServices = servicesFor(3);
      operations.push(withPlacement({ id: `${callId}-shift-2`, type: "shifting", label: "Return shift", at: iso(returnAt), state: returnState, details: "Second shift remains within the same terminal and basin.", ...returnServices }, returnPlacement));
    }
  }
  if (index % 3 === 0) {
    const assistAt = arrival - 45 * MINUTE; const assistServices = servicesFor(4);
    operations.push(withPlacement({ id: `${callId}-assist`, type: "assistance", label: index % 2 ? "Pilot and linesmen" : "Two tugboats and linesmen", at: iso(assistAt), state: assistAt <= BASE ? "actual" : withinBookingWindow(iso(assistAt), BASE) ? "ordered" : "expected", details: "Translated from configurable duty code.", ...assistServices }, initial));
  }
  if (index % 7 === 0) {
    const holdingAt = arrival - 120 * MINUTE; const holdingServices = servicesFor(5);
    operations.push(withPlacement({ id: `${callId}-holding`, type: "anchorage", label: "Holding readiness", at: iso(holdingAt), state: holdingAt <= BASE ? "actual" : "expected", details: "Administrative readiness state; no anchorage marker is drawn on the map.", ...holdingServices }, initial));
  }
  const departureServices = servicesFor(2);
  operations.push(withPlacement({ id: `${callId}-departure`, type: "departure", label: "Departure", at: departureOperationTime.at, state: departureOperationTime.state, ...departureServices }, finalPlacement));
  return operations.sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
}

function makeStudOperations(
  index: number,
  callId: string,
  arrival: number,
  arrivalCallTimes: readonly OperationalTime[],
  departureCallTimes: readonly OperationalTime[],
): PortOperation[] {
  const arrivalOperationTime = operativeOperationTime(arrivalCallTimes);
  const departureOperationTime = operativeOperationTime(departureCallTimes);
  const assistanceAt = arrival + (index === 9 ? 30 : 45) * MINUTE;
  const operations: PortOperation[] = [
    {
      id: `${callId}-arrival`, type: "arrival", workLocation: "stud", label: "Arrival",
      at: arrivalOperationTime.at, state: arrivalOperationTime.state, serviceCodes: [],
    },
    {
      id: `${callId}-stud-assist`, type: "assistance", workLocation: "stud",
      label: index === 9 ? "STUD vessel assistance" : "STUD pilot transfer assistance",
      details: "Work is performed at the vessel; no quay, bollards or mooring side apply.",
      at: iso(assistanceAt),
      state: assistanceAt <= BASE ? "actual" : withinBookingWindow(iso(assistanceAt), BASE) ? "ordered" : "expected",
      serviceCodes: index === 9 ? ["H", "B"] : ["L"],
      ...(index === 9 ? { tugQuantity: 1 } : {}),
    },
    {
      id: `${callId}-departure`, type: "departure", workLocation: "stud", label: "Departure",
      at: departureOperationTime.at, state: departureOperationTime.state, serviceCodes: [],
    },
  ];
  return operations.sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
}

const vessels: Vessel[] = [];
const serviceOrders: CallServiceOrder[] = [];
const calls: PortCall[] = Array.from({ length: 76 }, (_, index) => {
  const intentionalOverlap = index % 17 === 1;
  const berth = berthFor(intentionalOverlap ? index - 1 : index);
  const vessel = makeVessel(index, berth);
  vessels.push(vessel);
  const id = `call-${String(index + 1).padStart(3, "0")}`;
  const schedule = scheduleFor(index);
  const status = statusFor(schedule.arrival, schedule.departure);
  const bollardFrom = intentionalOverlap ? 10 + ((index - 1) % 9) * 3 : 10 + (index % 9) * 3;
  const side: "port" | "starboard" = index % 2 ? "starboard" : "port";
  const initialPlacement: Placement = { berth, bollardFrom, bollardTo: bollardFrom + 7 + (index % 3), side };
  const studCall = STUD_CALL_INDEXES.has(index);
  const callArrivalTimes = arrivalTimes(index, schedule.arrival, status);
  const callDepartureTimes = departureTimes(index, schedule.departure, status);
  const operations = studCall
    ? makeStudOperations(index, id, schedule.arrival, callArrivalTimes, callDepartureTimes)
    : makeOperations(index, id, schedule.arrival, schedule.departure, initialPlacement);
  const assistance = operations.find((operation) => operation.type === "assistance");
  const orderId = assistance ? `order-${id}` : undefined;
  if (assistance && orderId) serviceOrders.push({ id: orderId, portCallId: id, dutyCode: index % 2 ? "PIL-LIN" : "TUG2-LIN", displayText: assistance.label, scheduledAt: assistance.at, quantity: assistance.tugQuantity ?? (index % 2 ? 1 : 2), status: assistance.state, serviceCode: assistance.serviceCodes[0], operationId: assistance.id });
  const geometry = getBerthGeometry(berth)!;
  const craneStatus: PortCall["craneStatus"] = studCall ? "none" : index % 13 === 0 ? "accepted" : index % 11 === 0 ? "approved" : index % 7 === 0 || index % 5 === 0 ? "requested" : "none";
  // Fictional crane booking history and work window, kept consistent with R/V status.
  const craneTimes: PortCall["craneTimes"] = craneStatus === "none" ? undefined : {
    requested: iso(schedule.arrival - (180 + index % 4 * 15) * MINUTE),
    ...(craneStatus === "approved" || craneStatus === "accepted" ? { approved: iso(schedule.arrival - 120 * MINUTE) } : {}),
    ...(craneStatus === "accepted" ? { accepted: iso(schedule.arrival - 90 * MINUTE) } : {}),
    start: iso(schedule.arrival + 30 * MINUTE),
    end: iso(Math.min(schedule.arrival + (150 + index % 3 * 30) * MINUTE, schedule.departure - 30 * MINUTE)),
  };
  return {
    id, callNumber: String(11300 + index).padStart(6, "0"), vesselId: vessel.id, vesselName: vessel.name, imo: vessel.imo, callSign: vessel.callSign, status,
    ...(studCall ? { workLocation: "stud" as const } : {}),
    craneStatus, craneTimes, berth, bollardFrom, bollardTo: initialPlacement.bollardTo, side, customer: vessel.customer, agent: vessel.agent, category: vessel.category,
    loaMeters: vessel.loaMeters, beamMeters: vessel.beamMeters, arrivalTimes: callArrivalTimes, departureTimes: callDepartureTimes, operations,
    // Independent fictional vessel reports, not inferred from live tracking or customer-service time.
    vesselReportedTimes: { arrival: iso(schedule.arrival + (5 + index % 4 * 5) * MINUTE) },
    notes: index % 4 === 0 ? [{ id: `note-${id}-1`, text: "Confirm final mooring arrangement with the duty team.", authorRole: "Port coordinator", createdAt: iso(schedule.arrival - 5 * 60 * MINUTE) }, ...(index % 8 === 0 ? [{ id: `note-${id}-2`, text: "Agent advised that vessel particulars may be updated.", authorRole: "Operations", createdAt: iso(schedule.arrival - 3 * 60 * MINUTE) }] : [])] : [],
    documents: index % 4 === 0 ? [{ id: `doc-${id}-1`, name: "FlexPort call note", type: "note", state: "mock-available" }, { id: `doc-${id}-2`, name: "D365 attachment access", type: "file", state: "restricted" }] : [],
    serviceOrderIds: orderId ? [orderId] : [], dataQuality: index % 19 === 0 ? "uncertain" : "verified", explicitConflict: index % 23 === 0 ? "Ordered departure occurs before the final assistance operation." : undefined, visibility: "public",
    // Keep the geometry lookup exercised at data construction time; unmapped calls are never emitted.
    ...(geometry ? {} : { dataQuality: "uncertain" as const }),
  };
});

function routePoint(point: HarborPoint, recordedAt: number): { latitude: number; longitude: number; recordedAt: string } {
  return { latitude: point.latitude, longitude: point.longitude, recordedAt: iso(recordedAt) };
}
function routeSlice(points: readonly HarborPoint[], progress: number): { current: HarborPoint; sailed: HarborPoint[]; estimated: HarborPoint[] } {
  const bounded = Math.max(0, Math.min(1, progress));
  const current = interpolateHarborPath(points, bounded) ?? points[0];
  const segment = Math.min(Math.max(points.length - 2, 0), Math.floor(bounded * Math.max(points.length - 1, 1)));
  return { current, sailed: [...points.slice(0, segment + 1), current], estimated: [...points.slice(segment + 1)] };
}

function harborTrackingFor(call: PortCall): ShipTracking {
  const liveEta = call.arrivalTimes.find((time) => time.kind === "live")?.value ?? primaryTime(call.arrivalTimes);
  const activeShift = getActiveShiftingOperation(call, BASE);
  const effective = getEffectivePlacement(call, MOCK_SNAPSHOT_FETCHED_AT);
  const departurePlacement = getDeparturePlacement(call);
  const initialPlacement: Placement = { berth: call.berth, bollardFrom: call.bollardFrom, bollardTo: call.bollardTo, side: call.side };
  const state = derivePortCallState(call, BASE);
  const activeShiftPlacement = activeShift ? getOperationPlacement(activeShift) : undefined;
  const statePlacement = state === "outbound" ? departurePlacement : state === "shifting" ? activeShiftPlacement ?? effective ?? initialPlacement : effective ?? initialPlacement;
  const routeBerth = statePlacement?.berth ?? call.berth;
  const inboundRoute = navigationRouteForBerth(routeBerth, "inbound");
  const outboundRoute = navigationRouteForBerth(routeBerth, "outbound");
  const target = berthPosition(routeBerth)!;
  const holding = holdingPointForBerth(routeBerth) ?? inboundRoute[0] ?? target;
  let current: HarborPoint;
  let sailed: HarborPoint[];
  let estimated: HarborPoint[];
  const arrival = Date.parse(liveEta);
  const departure = Date.parse(getDepartureOperation(call)?.at ?? primaryTime(call.departureTimes));
  if (state === "alongside" || state === "turning" || state === "shifting") {
    current = target; sailed = inboundRoute; estimated = outboundRoute.slice(1);
  } else if (state === "outbound") {
    const departureProgress = Number.isFinite(departure) ? Math.max(0.15, Math.min(0.82, (BASE - departure + 60 * MINUTE) / (60 * MINUTE))) : 0.3;
    const slice = routeSlice(outboundRoute, departureProgress); current = slice.current; sailed = slice.sailed; estimated = slice.estimated;
  } else if (state === "inbound" || state === "holding" || state === "outside") {
    const inboundProgress = Number.isFinite(arrival) && arrival > BASE ? Math.max(0, Math.min(0.9, 1 - (arrival - BASE) / (6 * 60 * MINUTE))) : 0.25;
    if (state === "holding" || state === "outside") { current = holding; sailed = [holding]; estimated = inboundRoute; }
    else { const slice = routeSlice(inboundRoute, inboundProgress); current = slice.current; sailed = slice.sailed; estimated = slice.estimated; }
  } else {
    current = holding; sailed = [holding]; estimated = inboundRoute;
  }
  return {
    vesselId: call.vesselId,
    currentPosition: routePoint(current, BASE),
    sailedRoute: sailed.map((point, index) => routePoint(point, BASE - (sailed.length - index) * 18 * MINUTE)),
    estimatedRoute: estimated.map((point, index) => routePoint(point, BASE + (index + 1) * 35 * MINUTE)),
    destinationBerth: routeBerth, updatedAt: MOCK_SNAPSHOT_FETCHED_AT, liveEta,
  };
}

const tracking: ShipTracking[] = calls.map(harborTrackingFor);
export const mockWatchlistSnapshot: WatchlistSnapshot = { calls, vessels, tracking, serviceOrders, fetchedAt: MOCK_SNAPSHOT_FETCHED_AT };
