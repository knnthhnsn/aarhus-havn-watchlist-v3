import { describe, expect, it } from "vitest";
import { mockWatchlistSnapshot } from "@/data/mockWatchlist";
import { PROTOTYPE_OPERATIONS_NOW, type PortCall, type PortOperation } from "@/lib/watchlist";
import { compareQuayCodes, filterCallsByQuays, getQuayAssignmentTiming, getQuayCalls } from "./quayData";

const NOW = Date.parse(PROTOTYPE_OPERATIONS_NOW);
function operation(type: PortOperation["type"], berth: string, minutes: number, state: PortOperation["state"]): PortOperation {
  return { id: `${type}-${minutes}`, type, label: type, at: new Date(NOW + minutes * 60_000).toISOString(), state, serviceCodes: [], placement: { berth, bollardFrom: 1, bollardTo: 10, side: "port" } };
}
function call(id: string, overrides: Partial<PortCall> = {}): PortCall {
  const result: PortCall = { ...mockWatchlistSnapshot.calls[0], id, vesselName: id, status: "arrived", operations: [operation("arrival", "110", -120, "actual"), operation("shifting", "202", -60, "actual"), operation("shifting", "303", 60, "ordered"), operation("departure", "303", 180, "ordered")], ...overrides };
  return { ...result, arrivalTimes: overrides.arrivalTimes ?? result.operations.filter((item) => item.type === "arrival").map((item) => ({ kind: item.state, value: item.at })), departureTimes: overrides.departureTimes ?? result.operations.filter((item) => item.type === "departure").map((item) => ({ kind: item.state, value: item.at })) };
}

describe("quay selection data", () => {
  it("excludes already-left berths and keeps current and future assignments", () => {
    const source = call("shifted");
    expect(getQuayCalls([source], "110")).toEqual([]);
    expect(getQuayCalls([source], "202")[0].assignment.kind).toBe("current");
    expect(getQuayCalls([source], "303")[0].assignment.kind).toBe("upcoming");
  });
  it("normalizes legacy quay labels and counts shift/departure duplicates once", () => {
    expect(getQuayCalls([call("one")], "Kaj 0303")).toHaveLength(1);
    expect(filterCallsByQuays([call("one")], ["Berth 0303"])).toHaveLength(1);
  });
  it("never exposes completed calls as current or upcoming", () => {
    const source = call("departed", { status: "departed" });
    const stale = call("stale", { operations: [operation("arrival", "110", -120, "actual"), operation("departure", "110", -30, "actual")] });
    expect(getQuayCalls([source, stale], "110")).toEqual([]);
    expect(filterCallsByQuays([source, stale], ["110", "202", "303"])).toEqual([]);
  });
  it("prefers current occupancy when a ship will return to the same quay", () => {
    const source = call("return", { operations: [operation("arrival", "110", -120, "actual"), operation("shifting", "202", 60, "ordered"), operation("shifting", "110", 90, "ordered")] });
    expect(getQuayCalls([source], "110")).toHaveLength(1);
    expect(getQuayCalls([source], "110")[0].assignment.kind).toBe("current");
  });
  it("preserves input privacy and other filters instead of pulling in other snapshot calls", () => {
    const visible = call("visible");
    expect(getQuayCalls([visible], "202").map((item) => item.call.id)).toEqual(["visible"]);
    expect(filterCallsByQuays([], ["202"])).toEqual([]);
  });
  it("supports multiple quay filters and returns the original scope when cleared", () => {
    const sources = [call("first"), call("second", { operations: [operation("arrival", "406", 60, "ordered")] }), call("third", { operations: [operation("arrival", "501", 60, "ordered")] })];
    expect(filterCallsByQuays(sources, ["202", "406"]).map((item) => item.id)).toEqual(["first", "second"]);
    expect(filterCallsByQuays(sources, [])).toBe(sources);
  });
  it("sorts current calls before upcoming calls, then upcoming calls by scheduled assignment", () => {
    const future = call("future", { status: "expected", operations: [operation("arrival", "202", 120, "ordered")] });
    const soon = call("soon", { status: "expected", operations: [operation("arrival", "202", 60, "ordered")] });
    expect(getQuayCalls([future, soon, call("current")], "202").map((item) => item.call.id)).toEqual(["current", "soon", "future"]);
  });
  it("returns an empty quay without changing its selection or fabricating calls", () => {
    expect(getQuayCalls([call("one")], "999")).toEqual([]);
    expect(filterCallsByQuays([call("one")], ["999"])).toEqual([]);
  });
  it("keeps Meridian's expected arrival separate from its live ETA outside the booking window", () => {
    const meridian = mockWatchlistSnapshot.calls.find((item) => item.vesselName === "Meridian Kestrel")!;
    const entry = getQuayCalls([meridian], "110")[0];
    const timing = getQuayAssignmentTiming(entry);
    expect(timing.primary).toEqual(meridian.arrivalTimes.find((item) => item.kind === "expected"));
    expect(timing.live).toBe(meridian.arrivalTimes.find((item) => item.kind === "live")?.value);
    expect(timing.primary?.value).not.toBe(timing.live);
  });
  it("uses a future shift's own date and state, not the vessel's arrival times", () => {
    const source = call("future-shift");
    const entry = getQuayCalls([source], "303")[0];
    expect(entry.assignment.source).toBe("shifting");
    expect(getQuayAssignmentTiming(entry)).toEqual({ primary: { value: source.operations[2].at, kind: "ordered" }, live: undefined });
  });
  it("applies actual-before-ordered-before-expected precedence to departure assignments", () => {
    const actual = new Date(NOW + 180 * 60_000).toISOString();
    const source = call("final", { operations: [operation("arrival", "110", -120, "actual"), operation("departure", "303", 190, "ordered")], departureTimes: [{ kind: "expected", value: new Date(NOW + 220 * 60_000).toISOString() }, { kind: "ordered", value: new Date(NOW + 200 * 60_000).toISOString() }, { kind: "actual", value: actual }] });
    const entry = getQuayCalls([source], "303")[0];
    expect(entry.assignment.source).toBe("departure");
    expect(getQuayAssignmentTiming(entry).primary).toEqual({ kind: "actual", value: actual });
  });
  it("sorts quay codes naturally by their displayed number, including legacy labels", () => {
    expect(["109", "Kaj 0108", "103", "Berth 105", "107"].sort(compareQuayCodes)).toEqual(["103", "Berth 105", "107", "Kaj 0108", "109"]);
  });
});
