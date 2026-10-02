import type { OperationalTime, PortOperation, WatchlistSnapshot } from "./watchlist";

export function withinBookingWindow(at: string, now: string | number): boolean {
  const delta = Date.parse(at) - (typeof now === "number" ? now : Date.parse(now));
  // Once the ordering threshold is reached it must not revert after the due time.
  return Number.isFinite(delta) && delta <= 2 * 60 * 60 * 1000;
}
/** Display-domain rule requested in the V3 analysis; never creates actual events. */
export function applyBookingWindow(snapshot: WatchlistSnapshot, now: string | number): WatchlistSnapshot {
  const times = (values: readonly OperationalTime[]): OperationalTime[] => {
    if (values.some(value => value.kind === "actual" || value.kind === "ordered")) return [...values];
    const expected = values.find(value => value.kind === "expected" && withinBookingWindow(value.value, now));
    return expected ? [...values, { kind: "ordered", value: expected.value }] : [...values];
  };
  const operation = (op: PortOperation): PortOperation => {
    if (!withinBookingWindow(op.at, now) || op.state === "actual") return op;
    return { ...op, state: op.state === "expected" ? "ordered" : op.state,
      ...(op.serviceStates ? { serviceStates: Object.fromEntries(Object.entries(op.serviceStates).map(([code, state]) => [code, state === "expected" ? "ordered" : state])) } : {}) };
  };
  return { ...snapshot,
    calls: snapshot.calls.map(call => ({ ...call, arrivalTimes: times(call.arrivalTimes), departureTimes: times(call.departureTimes), operations: call.operations.map(operation) })),
    serviceOrders: snapshot.serviceOrders.map(order => order.status === "expected" && withinBookingWindow(order.scheduledAt, now) ? { ...order, status: "ordered" } : order),
  };
}
