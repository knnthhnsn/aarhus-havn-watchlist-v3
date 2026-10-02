import "server-only";

/**
 * Fictional restricted calls for the server-side prototype path.
 *
 * IMPORTANT: keep this module out of every client-imported module. It is
 * imported only by `src/services/watchlistServer.ts` and the watchlist API
 * route, so anonymous/public bundles and JSON responses never contain these
 * records or their identifiers.
 */
import type {
  CallServiceOrder,
  OperationalTime,
  Placement,
  PortCall,
  PortOperation,
  ShipTracking,
  Vessel,
  WatchlistSnapshot,
} from "@/lib/watchlist";
import { berthPosition, getBerthGeometry, HARBOR_NAVIGATION_NODES } from "@/lib/harbor";
import { PROTOTYPE_OPERATIONS_NOW } from "@/lib/watchlist";
import { withinBookingWindow } from "@/lib/bookingWindow";

const BASE = Date.parse(PROTOTYPE_OPERATIONS_NOW);
const MINUTE = 60_000;
const iso = (value: number): string => new Date(value).toISOString();

type RestrictedSpec = {
  id: string;
  callNumber: string;
  vesselId: string;
  vesselName: string;
  imo: string;
  callSign: string;
  berth: string;
  arrivalOffsetMinutes: number;
  departureOffsetMinutes: number;
  status: PortCall["status"];
  side: Placement["side"];
};

const SPECS: readonly RestrictedSpec[] = [
  {
    id: "restricted-call-001", callNumber: "011401", vesselId: "restricted-vessel-001",
    vesselName: "HDMS Northwind", imo: "9799001", callSign: "OZDW1", berth: "Berth 201",
    arrivalOffsetMinutes: -15, departureOffsetMinutes: 150, status: "arrived", side: "starboard",
  },
  {
    id: "restricted-call-002", callNumber: "011402", vesselId: "restricted-vessel-002",
    vesselName: "Danish Defender", imo: "9799002", callSign: "OZDW2", berth: "Berth 406",
    arrivalOffsetMinutes: 45, departureOffsetMinutes: 270, status: "en-route", side: "port",
  },
  {
    id: "restricted-call-003", callNumber: "011403", vesselId: "restricted-vessel-003",
    vesselName: "Fjord Sentinel", imo: "9799003", callSign: "OZDW3", berth: "Berth 113",
    arrivalOffsetMinutes: 210, departureOffsetMinutes: 540, status: "expected", side: "starboard",
  },
  {
    id: "restricted-call-004", callNumber: "011404", vesselId: "restricted-vessel-004",
    vesselName: "Skagerrak Watch", imo: "9799004", callSign: "OZDW4", berth: "Berth 203",
    arrivalOffsetMinutes: 390, departureOffsetMinutes: 780, status: "expected", side: "port",
  },
];

function times(offsetMinutes: number, status: PortCall["status"], kind: "arrival" | "departure"): OperationalTime[] {
  const value = iso(BASE + offsetMinutes * MINUTE);
  if (kind === "arrival") {
    if (status === "arrived") return [{ kind: "expected", value }, { kind: "live", value }, { kind: "actual", value: iso(BASE - 5 * MINUTE) }];
    return [{ kind: "expected", value }, { kind: "live", value: iso(BASE + (offsetMinutes + 8) * MINUTE) }];
  }
  if (status === "departed") return [{ kind: "expected", value }, { kind: "actual", value }];
  return [{ kind: "expected", value }, ...(withinBookingWindow(value, BASE) ? [{ kind: "ordered" as const, value }] : [])];
}

function operation(spec: RestrictedSpec, type: PortOperation["type"], at: string, state: PortOperation["state"], placement: Placement, idSuffix: string, label: string): PortOperation {
  return {
    id: `${spec.id}-${idSuffix}`, type, label, at, state, placement,
    berth: placement.berth, bollardFrom: placement.bollardFrom, bollardTo: placement.bollardTo, side: placement.side,
    serviceCodes: type === "assistance" ? ["H"] : [],
    details: "Protected operation; visible to the Sikret drift access profile.",
  };
}

function makeCall(spec: RestrictedSpec): PortCall {
  const geometry = getBerthGeometry(spec.berth);
  if (!geometry) throw new Error(`Restricted berth is not mapped: ${spec.berth}`);
  const arrival = times(spec.arrivalOffsetMinutes, spec.status, "arrival");
  const departure = times(spec.departureOffsetMinutes, spec.status, "departure");
  const placement: Placement = { berth: spec.berth, bollardFrom: 18, bollardTo: 31, side: spec.side };
  const arrivalAt = arrival.find((item) => item.kind === "actual")?.value ?? arrival[0].value;
  const departureAt = departure.find((item) => item.kind === "actual")?.value ?? departure.find((item) => item.kind === "ordered")?.value ?? departure[0].value;
  const arrivalState = spec.status === "arrived" ? "actual" : withinBookingWindow(arrivalAt, BASE) ? "ordered" : "expected";
  const operations: PortOperation[] = [
    operation(spec, "arrival", arrivalAt, arrivalState, placement, "arrival", "Arrival"),
    operation(spec, "assistance", iso(BASE + (spec.arrivalOffsetMinutes - 30) * MINUTE), spec.status === "arrived" ? "actual" : spec.arrivalOffsetMinutes - 30 <= 120 ? "ordered" : "expected", placement, "assistance", "Restricted port assistance"),
    operation(spec, "departure", departureAt, spec.status === "departed" ? "actual" : "expected", placement, "departure", "Departure"),
  ];
  return {
    id: spec.id, callNumber: spec.callNumber, vesselId: spec.vesselId, vesselName: spec.vesselName,
    imo: spec.imo, callSign: spec.callSign, status: spec.status, craneStatus: "none", berth: placement.berth,
    bollardFrom: placement.bollardFrom, bollardTo: placement.bollardTo, side: placement.side,
    customer: "Danish Defence Maritime Command", agent: "Defence Port Liaison", category: "Military vessel",
    loaMeters: Math.min(geometry.maxLoaMeters - 5, 145), beamMeters: Math.min(geometry.maxBeamMeters - 2, 22),
    arrivalTimes: arrival, departureTimes: departure, operations,
    notes: [{ id: `${spec.id}-note`, text: "Protected movement; restricted access.", authorRole: "Duty officer", createdAt: iso(BASE) }],
    documents: [{ id: `${spec.id}-brief`, name: "Restricted movement brief", type: "file", state: "restricted" }],
    serviceOrderIds: [`${spec.id}-service-order`], dataQuality: "verified", visibility: "restricted",
  };
}

const calls = SPECS.map(makeCall);

const vessels: Vessel[] = calls.map((call) => ({
  id: call.vesselId, imo: call.imo, callSign: call.callSign, name: call.vesselName, category: call.category,
  loaMeters: call.loaMeters, beamMeters: call.beamMeters, customer: call.customer, agent: call.agent,
  flag: "DK", lastPort: "DKAAR", nextPort: "RESTRICTED",
}));

const serviceOrders: CallServiceOrder[] = calls.map((call) => {
  const assistance = call.operations.find((item) => item.type === "assistance")!;
  return { id: `${call.id}-service-order`, portCallId: call.id, dutyCode: "MIL-OPS", displayText: assistance.label, scheduledAt: assistance.at, quantity: 1, status: assistance.state, serviceCode: "H", operationId: assistance.id };
});

function trackingFor(call: PortCall): ShipTracking {
  const position = berthPosition(call.berth) ?? HARBOR_NAVIGATION_NODES["outer-fairway"];
  return {
    vesselId: call.vesselId,
    currentPosition: { latitude: position.latitude, longitude: position.longitude, recordedAt: PROTOTYPE_OPERATIONS_NOW },
    sailedRoute: [HARBOR_NAVIGATION_NODES["outer-fairway"], position].map((point, index) => ({ ...point, recordedAt: iso(BASE - (30 - index * 15) * MINUTE) })),
    estimatedRoute: [{ latitude: position.latitude, longitude: position.longitude, recordedAt: iso(BASE + 35 * MINUTE) }], destinationBerth: call.berth, updatedAt: PROTOTYPE_OPERATIONS_NOW,
    liveEta: call.arrivalTimes.find((item) => item.kind === "live")?.value ?? call.arrivalTimes[0].value,
  };
}

const tracking = calls.map(trackingFor);

export const restrictedWatchlistSnapshot: WatchlistSnapshot = Object.freeze({
  calls: Object.freeze(calls), vessels: Object.freeze(vessels), tracking: Object.freeze(tracking),
  serviceOrders: Object.freeze(serviceOrders), fetchedAt: PROTOTYPE_OPERATIONS_NOW,
});
