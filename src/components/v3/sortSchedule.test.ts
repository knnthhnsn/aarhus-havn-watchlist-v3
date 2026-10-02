import { describe, expect, it } from "vitest";
import { mockWatchlistSnapshot } from "@/data/mockWatchlist";
import { PROTOTYPE_OPERATIONS_NOW, formatBerthCode, type PortCall } from "@/lib/watchlist";
import { getCallPlacementPresentation } from "./display";
import { sortScheduleCalls } from "./sortSchedule";

describe("visible table value sorting", () => {
  it("sorts ordered arrival as displayed, keeping supplementary live ETA separate", () => {
    const source = mockWatchlistSnapshot.calls[0];
    const first: PortCall = { ...source, id: "first", arrivalTimes: [{ kind: "ordered", value: "2026-08-21T08:00:00+02:00" }, { kind: "live", value: "2026-08-21T11:00:00+02:00" }] };
    const second: PortCall = { ...source, id: "second", arrivalTimes: [{ kind: "ordered", value: "2026-08-21T09:00:00+02:00" }] };
    expect(sortScheduleCalls([second, first], "eta", "asc", [], PROTOTYPE_OPERATIONS_NOW, [])[0]).toBe(first);
    expect(first.arrivalTimes).toHaveLength(2);
  });
  it("sorts the same projected quay that is displayed and returns original records", () => {
    const calls = mockWatchlistSnapshot.calls;
    const result = sortScheduleCalls(calls, "berth", "asc", [], PROTOTYPE_OPERATIONS_NOW, []);
    const quays = result.map(call => formatBerthCode(getCallPlacementPresentation(call, PROTOTYPE_OPERATIONS_NOW).placement.berth));
    expect(quays).toEqual([...quays].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
    expect(result.every(call => calls.includes(call))).toBe(true);
  });
});
