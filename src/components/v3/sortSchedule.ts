import { sortPortCalls, type CallServiceOrder, type PortCall, type SortDirection, type SortKey } from "@/lib/watchlist";
import { getCallPlacementPresentation, plannedTime } from "./display";

/** Sort the values the operator actually sees; do not mutate source placements. */
export function sortScheduleCalls(calls: readonly PortCall[], key: SortKey, direction: SortDirection, pins: readonly string[], now: string, serviceOrders: readonly CallServiceOrder[]): PortCall[] {
  const originals = new Map(calls.map(call => [call.id, call]));
  const projected = calls.map(call => {
    if (key === "berth" || key === "bollards" || key === "side") return { ...call, ...getCallPlacementPresentation(call, now).placement };
    if (key === "eta") { const at = plannedTime(call.arrivalTimes); return { ...call, arrivalTimes: at ? [at] : [] }; }
    if (key === "etd") { const at = plannedTime(call.departureTimes); return { ...call, departureTimes: at ? [at] : [] }; }
    return call;
  });
  return sortPortCalls(projected, key, direction, pins, now, serviceOrders).map(call => originals.get(call.id)!);
}
