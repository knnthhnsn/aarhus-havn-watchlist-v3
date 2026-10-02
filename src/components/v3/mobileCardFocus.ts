import { lifecycleOperations, operationPrimaryTime, operationState } from "@/components/watchlist/lifecycleData";
import type { CallServiceOrder, PortCall, PortOperation } from "@/lib/watchlist";

/** Two useful slots, selected independently for every call; history stays in the timeline. */
export function mobileCardFocus(call: PortCall, now: string | number, orders: readonly CallServiceOrder[] = []) {
  const operations = lifecycleOperations(call, orders).map(op => {
    const times = op.type === "arrival" ? call.arrivalTimes : op.type === "departure" ? call.departureTimes : [];
    return { ...op, at: operationPrimaryTime(op, times), state: operationState(op, times) };
  });
  const departed = call.status === "departed" || call.departureTimes.some(t => t.kind === "actual") || operations.some(op => op.type === "departure" && op.state === "actual");
  const arrived = departed || call.status === "arrived" || call.arrivalTimes.some(t => t.kind === "actual") || operations.some(op => op.type === "arrival" && op.state === "actual");
  const phase = departed ? "completed" : arrived ? "alongside" : "inbound";
  const validClock = Number.isFinite(typeof now === "number" ? now : Date.parse(now));
  const candidates: PortOperation[] = departed || !validClock ? [] : operations.filter(op => op.state !== "actual" && Number.isFinite(Date.parse(op.at))
    && !(arrived && op.type === "arrival"));
  candidates.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id));
  const pending = candidates;
  // Keep the inbound milestone alongside an earlier assistance/anchorage task.
  const first = pending[0];
  const second = !arrived && first?.type !== "arrival" ? pending.find(op => op.type === "arrival") ?? pending[1] : pending[1];
  return { phase, candidates, operations: [first, second].filter((op): op is PortOperation => Boolean(op)) };
}
