import { describe, expect, it } from "vitest";
import { mockWatchlistSnapshot } from "@/data/mockWatchlist";
import { PROTOTYPE_OPERATIONS_NOW, type PortCall, type PortOperation } from "@/lib/watchlist";
import { getNextMapQuay } from "./mapNextQuay";

const NOW = Date.parse(PROTOTYPE_OPERATIONS_NOW);

function operation(type: PortOperation["type"], berth: string, minutes: number, state: PortOperation["state"], bollardFrom = 1): PortOperation {
  return {
    id: `${type}-${berth}-${minutes}-${bollardFrom}`,
    type,
    label: type,
    at: new Date(NOW + minutes * 60_000).toISOString(),
    state,
    serviceCodes: [],
    placement: { berth, bollardFrom, bollardTo: bollardFrom + 9, side: "port" },
  };
}

function call(id: string, overrides: Partial<PortCall> = {}): PortCall {
  const result: PortCall = {
    ...mockWatchlistSnapshot.calls[0],
    id,
    vesselName: id,
    status: "expected",
    operations: [operation("arrival", "110", 60, "ordered")],
    ...overrides,
  };
  return {
    ...result,
    arrivalTimes: overrides.arrivalTimes ?? result.operations.filter((item) => item.type === "arrival").map((item) => ({ kind: item.state, value: item.at })),
    departureTimes: overrides.departureTimes ?? result.operations.filter((item) => item.type === "departure").map((item) => ({ kind: item.state, value: item.at })),
  };
}

describe("getNextMapQuay", () => {
  it("returns the upcoming initial berth before arrival", () => {
    expect(getNextMapQuay(call("arrival"), NOW)?.berth).toBe("110");
  });

  it("returns the first pending shift after arrival", () => {
    const source = call("shift", {
      status: "arrived",
      operations: [operation("arrival", "110", -120, "actual"), operation("shifting", "202", 45, "ordered")],
    });
    expect(getNextMapQuay(source, NOW)?.berth).toBe("202");
  });

  it("orders multiple pending shifts by the shift's own planned time", () => {
    const source = call("chronological", {
      status: "arrived",
      operations: [
        operation("arrival", "110", -120, "actual"),
        operation("shifting", "303", 90, "ordered"),
        operation("shifting", "202", 30, "expected"),
      ],
    });
    expect(getNextMapQuay(source, NOW)?.berth).toBe("202");
  });

  it("keeps a pending same-quay shift when its bollards change", () => {
    const source = call("same-quay", {
      status: "arrived",
      operations: [operation("arrival", "110", -120, "actual"), operation("shifting", "110", 30, "ordered", 30)],
    });
    expect(getNextMapQuay(source, NOW)).toMatchObject({ berth: "110", bollardFrom: 30, source: "shifting" });
  });

  it("does not treat completed movements or departure placements as a destination", () => {
    const source = call("completed", {
      status: "arrived",
      operations: [
        operation("arrival", "110", -120, "actual"),
        operation("shifting", "202", -60, "actual"),
        operation("departure", "303", 60, "ordered"),
      ],
    });
    expect(getNextMapQuay(source, NOW)).toBeUndefined();
  });

  it("excludes STUD, departed, and missing calls", () => {
    const stud = call("stud", { workLocation: "stud" });
    const departed = call("departed", { status: "departed" });
    expect(getNextMapQuay(stud, NOW)).toBeUndefined();
    expect(getNextMapQuay(departed, NOW)).toBeUndefined();
    expect(getNextMapQuay(undefined, NOW)).toBeUndefined();
  });
});
