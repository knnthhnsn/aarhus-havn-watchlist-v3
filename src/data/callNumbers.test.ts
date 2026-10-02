import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { mockWatchlistSnapshot } from "./mockWatchlist";
import { restrictedWatchlistSnapshot } from "./restrictedWatchlist";
import { columnNames } from "@/components/v3/columns";

describe("legacy Call identification", () => {
  it("uses unique six-digit strings including leading zeroes in both demo datasets", () => {
    const calls = [...mockWatchlistSnapshot.calls, ...restrictedWatchlistSnapshot.calls];
    expect(new Set(calls.map(call => call.callNumber)).size).toBe(calls.length);
    for (const call of calls) expect(call.callNumber).toMatch(/^\d{6}$/);
    expect(calls[0].callNumber).toBe("011300");
  });
  it("labels the identifier Call in both languages", () => {
    expect(columnNames.da.callNumber).toBe("Call");
    expect(columnNames.en.callNumber).toBe("Call");
  });
});
