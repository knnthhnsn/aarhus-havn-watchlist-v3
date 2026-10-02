import { describe, expect, it } from "vitest";

import { mockWatchlistSnapshot } from "@/data/mockWatchlist";
import { PROTOTYPE_OPERATIONS_NOW, getRelevantBerthAssignments, isStudCall, type Placement, type PortCall, type PortOperation } from "@/lib/watchlist";
import { getCallPlacementPresentation } from "./display";

const NOW = Date.parse(PROTOTYPE_OPERATIONS_NOW);
const legacy: Placement = { berth: "101", bollardFrom: 1, bollardTo: 3, side: "port" };
const arrival: Placement = { berth: "110", bollardFrom: 5, bollardTo: 10, side: "starboard" };
const shifted: Placement = { berth: "202", bollardFrom: 12, bollardTo: 18, side: "port" };
const final: Placement = { berth: "303", bollardFrom: 21, bollardTo: 27, side: "starboard" };

function operation(type: PortOperation["type"], placement: Placement, offsetMinutes: number, state: PortOperation["state"] = "ordered"): PortOperation {
  return { id: `${type}-${offsetMinutes}`, type, label: type, placement, at: new Date(NOW + offsetMinutes * 60_000).toISOString(), state, serviceCodes: [] };
}

function call(overrides: Partial<PortCall> = {}): PortCall {
  return {
    ...mockWatchlistSnapshot.calls[0], ...legacy, status: "expected",
    operations: [operation("arrival", arrival, 60), operation("departure", final, 240)],
    ...overrides,
  };
}

describe("getCallPlacementPresentation", () => {
  it.each(["expected", "en-route"] as const)("uses the normalized arrival instead of stale legacy fields for %s calls", (status) => {
    expect(getCallPlacementPresentation(call({ status }))).toEqual({ placement: arrival, kind: "upcoming", filterable: true, isStud: false });
  });

  it("uses the current actual shift, not the original or future berth", () => {
    const source = call({ status: "arrived", operations: [operation("arrival", arrival, -120, "actual"), operation("shifting", shifted, -60, "actual"), operation("shifting", final, 60), operation("departure", final, 240)] });
    expect(getCallPlacementPresentation(source, NOW)).toEqual({ placement: shifted, kind: "current", filterable: true, isStud: false });
  });

  it("uses the final departure assignment for departed calls without exposing a filter", () => {
    expect(getCallPlacementPresentation(call({ status: "departed" }))).toEqual({ placement: final, kind: "historical", filterable: false, isStud: false });
  });

  it("treats an actual past departure as history even while the call status is stale", () => {
    const source = call({ status: "arrived", operations: [operation("arrival", arrival, -120, "actual"), operation("departure", final, -30, "actual")] });
    expect(getCallPlacementPresentation(source)).toEqual({ placement: final, kind: "historical", filterable: false, isStud: false });
  });

  it("does not treat a future-dated actual departure as already completed", () => {
    const source = call({ status: "arrived", operations: [operation("arrival", arrival, -120, "actual"), operation("departure", final, 30, "actual")] });
    expect(getCallPlacementPresentation(source)).toEqual({ placement: arrival, kind: "current", filterable: true, isStud: false });
  });

  it("uses the domain's last-shift fallback when a departed call has no departure placement", () => {
    const source = call({ status: "departed", operations: [operation("arrival", arrival, -180, "actual"), operation("shifting", shifted, -60, "actual")] });
    expect(getCallPlacementPresentation(source)).toEqual({ placement: shifted, kind: "historical", filterable: false, isStud: false });
  });

  it("keeps complete legacy placement fields when normalized operations are absent", () => {
    expect(getCallPlacementPresentation(call({ operations: [] }))).toEqual({ placement: legacy, kind: "upcoming", filterable: true, isStud: false });
  });

  it("does not expose an operational filter when the clock is invalid", () => {
    expect(getCallPlacementPresentation(call(), "invalid")).toEqual({ placement: arrival, kind: "upcoming", filterable: false, isStud: false });
    expect(getCallPlacementPresentation(call({ status: "departed" }), Number.NaN)).toEqual({ placement: final, kind: "historical", filterable: false, isStud: false });
  });

  it("only makes placements filterable when the domain includes them as current or upcoming", () => {
    for (const source of mockWatchlistSnapshot.calls) {
      const presentation = getCallPlacementPresentation(source);
      const assignments = getRelevantBerthAssignments(source);
      expect(presentation.filterable).toBe(assignments.length > 0);
      if (presentation.filterable) expect(assignments).toContainEqual(expect.objectContaining(presentation.placement));
      else if (isStudCall(source)) expect(presentation).toMatchObject({ kind: "upcoming", isStud: true });
      else expect(presentation.kind).toBe("historical");
    }
  });

  it("returns placement fields without mutating or exposing the source object", () => {
    const source = call();
    const before = structuredClone(source);
    const presentation = getCallPlacementPresentation(source);
    presentation.placement.berth = "changed";
    expect(source).toEqual(before);
  });

  it("identifies STUD work without exposing an operational quay filter", () => {
    const source = mockWatchlistSnapshot.calls.find(isStudCall)!;
    expect(getCallPlacementPresentation(source)).toMatchObject({ isStud: true, filterable: false });
    expect(getRelevantBerthAssignments(source)).toEqual([]);
  });
});
