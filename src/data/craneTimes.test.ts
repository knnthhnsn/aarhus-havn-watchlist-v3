import { describe, expect, it } from "vitest";
import { mockWatchlistSnapshot } from "./mockWatchlist";

describe("mock crane bookings", () => {
  it("provides ordered booking timestamps and a work window consistent with status", () => {
    for (const call of mockWatchlistSnapshot.calls) {
      const times = call.craneTimes;
      if (call.craneStatus === "none") { expect(times).toBeUndefined(); continue; }
      expect(times?.requested).toBeTruthy();
      expect(times?.start).toBeTruthy();
      expect(times?.end).toBeTruthy();
      expect(Boolean(times?.approved)).toBe(call.craneStatus === "approved" || call.craneStatus === "accepted");
      expect(Boolean(times?.accepted)).toBe(call.craneStatus === "accepted");
      const sequence = [times?.requested, times?.approved, times?.accepted, times?.start, times?.end].filter((time): time is string => !!time).map(Date.parse);
      expect(sequence.every(Number.isFinite)).toBe(true);
      expect(sequence).toEqual([...sequence].sort((a,b) => a-b));
      expect(Date.parse(times!.start!)).toBeLessThan(Date.parse(times!.end!));
    }
  });
});
