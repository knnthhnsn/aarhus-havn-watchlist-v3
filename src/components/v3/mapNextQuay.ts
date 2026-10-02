import { getRelevantBerthAssignments, type BerthAssignment, type PortCall } from "@/lib/watchlist";
import { getQuayAssignmentTiming } from "./quayData";

function plannedTimestamp(call: PortCall, assignment: BerthAssignment): number {
  const value = getQuayAssignmentTiming({ call, assignment }).primary?.value;
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

/**
 * Returns the vessel's next destination for the map, never its current berth
 * or a departure-only placement. Before arrival this is the initial berth;
 * once alongside it is the first still-pending shift by that shift's own time.
 */
export function getNextMapQuay(call: PortCall | undefined, now: string | number): BerthAssignment | undefined {
  if (!call) return undefined;

  const assignments = getRelevantBerthAssignments(call, now);
  const initial = assignments.find((assignment) => assignment.source === "initial" && assignment.kind === "upcoming" && assignment.state !== "actual");
  if (initial) return initial;

  return assignments
    .filter((assignment) => assignment.source === "shifting" && assignment.kind === "upcoming" && assignment.state !== "actual")
    .sort((left, right) => plannedTimestamp(call, left) - plannedTimestamp(call, right) || (left.operationId ?? "").localeCompare(right.operationId ?? ""))[0];
}
