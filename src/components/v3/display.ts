import { PROTOTYPE_OPERATIONS_NOW, getArrivalOperation, getDeparturePlacement, getOperationPlacement, getRelevantBerthAssignments, isStudCall, type Locale, type OperationalTime, type OperationType, type Placement, type PortCall, type PortCallStatus, type TimeKind } from "@/lib/watchlist";

export interface CallPlacementPresentation {
  placement: Placement;
  kind: "current" | "upcoming" | "historical";
  filterable: boolean;
  isStud: boolean;
}

/** One placement for list, cards and map facts; historical berths are not active filters. */
export function getCallPlacementPresentation(call: PortCall, now: string | number = PROTOTYPE_OPERATIONS_NOW): CallPlacementPresentation {
  if (isStudCall(call)) {
    return { placement: { berth: call.berth, bollardFrom: call.bollardFrom, bollardTo: call.bollardTo, side: call.side }, kind: "upcoming", filterable: false, isStud: true };
  }
  const assignment = getRelevantBerthAssignments(call, now)[0];
  if (assignment) {
    const { berth, bollardFrom, bollardTo, side } = assignment;
    return { placement: { berth, bollardFrom, bollardTo, side }, kind: assignment.kind, filterable: true, isStud: false };
  }

  // With a valid clock, the domain only returns no assignments for a completed call.
  // This also handles an actual departure before the call's status has caught up.
  const validClock = Number.isFinite(typeof now === "number" ? now : Date.parse(now));
  if (call.status === "departed" || validClock) {
    return { placement: getDeparturePlacement(call), kind: "historical", filterable: false, isStud: false };
  }

  // An invalid clock cannot establish current occupancy. Keep the planned location
  // readable, but do not offer an operational filter without a relevant assignment.
  const { berth, bollardFrom, bollardTo, side } = call;
  const placement = getOperationPlacement(getArrivalOperation(call)) ?? { berth, bollardFrom, bollardTo, side };
  return { placement, kind: "upcoming", filterable: false, isStud: false };
}

export const statusNames: Record<Locale, Record<PortCallStatus, string>> = {
  da: { expected: "Forventet", "en-route": "På vej", arrived: "Ved kaj", departed: "Afgået" },
  en: { expected: "Expected", "en-route": "En route", arrived: "Alongside", departed: "Departed" },
};
export const operationNames: Record<Locale, Record<OperationType, string>> = {
  da: { arrival: "Ankomst", departure: "Afgang", shifting: "Forhaling", assistance: "Assistance", anchorage: "Ankring" },
  en: { arrival: "Arrival", departure: "Departure", shifting: "Shifting", assistance: "Assistance", anchorage: "Anchorage" },
};
export const timeNames: Record<Locale, Record<TimeKind, string>> = {
  da: { expected: "Forventet", ordered: "Bestilt", actual: "Faktisk", live: "Live ETA" },
  en: { expected: "Expected", ordered: "Ordered", actual: "Actual", live: "Live ETA" },
};
export function plannedTime(times: readonly OperationalTime[]) {
  return times.find(t => t.kind === "actual") ?? times.find(t => t.kind === "ordered") ?? times.find(t => t.kind === "expected") ?? times[0];
}
const shortDateFormatters = {
  da: new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", day: "numeric", month: "short" }),
  en: new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Copenhagen", day: "numeric", month: "short" }),
};
export function shortDate(at: string, locale: Locale = "da") {
  if (!at || !Number.isFinite(Date.parse(at))) return "—";
  return shortDateFormatters[locale].format(new Date(at));
}
export function categoryName(value: string, locale: Locale) {
  if (locale === "en") return value;
  return ({ "General cargo": "Stykgods", "Container ship": "Containerskib", "Chemical tanker": "Kemikalietanker", "Bulk carrier": "Bulkskib", "Ro-ro cargo": "Ro-ro" } as Record<string, string>)[value] ?? value;
}
