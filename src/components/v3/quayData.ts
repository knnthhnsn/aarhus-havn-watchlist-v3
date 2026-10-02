import { PROTOTYPE_OPERATIONS_NOW, formatBerthCode, getRelevantBerthAssignments, liveTime, normalizeBerthCode, type BerthAssignment, type PortCall, type TimeKind } from "@/lib/watchlist";
import { plannedTime } from "./display";

export interface QuayCall {
  call: PortCall;
  assignment: BerthAssignment;
}

export function compareQuayCodes(left: string, right: string): number {
  return formatBerthCode(left).localeCompare(formatBerthCode(right), undefined, { numeric: true });
}

/** The assignment's own lifecycle time; live arrival data must not relabel an ordered time. */
export function getQuayAssignmentTiming({ call, assignment }: QuayCall): { primary?: { value: string; kind?: TimeKind }; live?: string } {
  const times = assignment.source === "initial" ? call.arrivalTimes : assignment.source === "departure" ? call.departureTimes : undefined;
  const primary = (times ? plannedTime(times) : undefined) ?? (assignment.at ? { value: assignment.at, kind: assignment.state } : undefined);
  const live = times ? liveTime(times) : undefined;
  return { primary, live: live && live !== primary?.value ? live : undefined };
}

/** Counts calls once per quay; a current assignment takes precedence over a return visit. */
export function getQuayCalls(calls: readonly PortCall[], berth: string, now: string | number = PROTOTYPE_OPERATIONS_NOW): QuayCall[] {
  const key = normalizeBerthCode(berth);
  return calls.flatMap((call) => {
    const assignments = getRelevantBerthAssignments(call, now).filter((assignment) => normalizeBerthCode(assignment.berth) === key);
    const assignment = assignments.find((item) => item.kind === "current") ?? assignments[0];
    return assignment ? [{ call, assignment }] : [];
  }).sort((left, right) => {
    if (left.assignment.kind !== right.assignment.kind) return left.assignment.kind === "current" ? -1 : 1;
    const leftAt = Date.parse(getQuayAssignmentTiming(left).primary?.value ?? "");
    const rightAt = Date.parse(getQuayAssignmentTiming(right).primary?.value ?? "");
    return (Number.isFinite(leftAt) ? leftAt : Infinity) - (Number.isFinite(rightAt) ? rightAt : Infinity) || left.call.vesselName.localeCompare(right.call.vesselName);
  });
}

/** Retains the caller's other filters and never includes historical berth assignments. */
export function filterCallsByQuays(calls: readonly PortCall[], berths: readonly string[], now: string | number = PROTOTYPE_OPERATIONS_NOW): readonly PortCall[] {
  if (!berths.length) return calls;
  const keys = new Set(berths.map(normalizeBerthCode));
  return calls.filter((call) => getRelevantBerthAssignments(call, now).some((assignment) => keys.has(normalizeBerthCode(assignment.berth))));
}
