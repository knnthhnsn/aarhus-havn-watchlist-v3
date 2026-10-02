import { describe, expect, it } from "vitest";
import { mobileCardFocus } from "./mobileCardFocus";
import { mockWatchlistSnapshot } from "@/data/mockWatchlist";
import { applyBookingWindow } from "@/lib/bookingWindow";
import { PROTOTYPE_OPERATIONS_NOW, type PortCall, type PortOperation } from "@/lib/watchlist";

const now = Date.parse(PROTOTYPE_OPERATIONS_NOW);
const at = (minutes: number) => new Date(now + minutes * 60_000).toISOString();
const op = (type: PortOperation["type"], minutes: number, state: PortOperation["state"] = "expected"): PortOperation => ({ id: type, type, label: type, at: at(minutes), state, serviceCodes: ["B"], tugQuantity: 3 });
function call(arrived = false, extra: PortOperation[] = []): PortCall {
  return { ...mockWatchlistSnapshot.calls[14], status: arrived ? "arrived" : "en-route", arrivalTimes: [{ kind: arrived ? "actual" : "expected", value: at(arrived ? -30 : 180) }], departureTimes: [{ kind: "expected", value: at(600) }], operations: [op("arrival", arrived ? -30 : 180, arrived ? "actual" : "expected"), ...extra, op("departure", 600)] };
}
const types = (item: PortCall, clock = now) => mobileCardFocus(item, clock).operations.map(op => op.type);
describe("per-call mobile focus", () => {
  it("orders STUD arrival before later assistance, but keeps genuinely earlier assistance first", () => {
    const stud = mockWatchlistSnapshot.calls.find(item => item.id === "call-013")!;
    const northstar = mockWatchlistSnapshot.calls.find(item => item.vesselName === "Northstar Sound")!;
    expect(types(stud)).toEqual(["arrival", "assistance"]);
    expect(types(northstar)).toEqual(["assistance", "arrival"]);
    for (const item of [stud, northstar]) {
      const shown = mobileCardFocus(item, now).operations;
      expect(Date.parse(shown[0].at)).toBeLessThanOrEqual(Date.parse(shown[1].at));
    }
  });
  it("replaces distant departure with upcoming work before arrival", () => {
    expect(types(call(false, [op("anchorage", 15)]))).toEqual(["anchorage", "arrival"]);
    expect(types(call(false))).toEqual(["arrival", "departure"]); // departure fills the second slot when no earlier work competes
  });
  it("removes completed arrival and promotes the next shift, then departure", () => {
    expect(types(call(true, [op("shifting", 30)]))).toEqual(["shifting", "departure"]);
    expect(types(call(true, [op("shifting", 30, "actual")]))).toEqual(["departure"]);
  });
  it("does not reserve a slot for departure while two earlier jobs need attention", () => {
    expect(types(call(true, [op("shifting", 30), op("assistance", 60)]))).toEqual(["shifting", "assistance"]);
  });
  it("allows imminent departure when relevant even if arrival is still pending", () => {
    const item = call();
    expect(types({ ...item, arrivalTimes: [{ kind: "expected", value: at(5) }], departureTimes: [{ kind: "expected", value: at(100) }] })).toEqual(["arrival", "departure"]);
  });
  it("keeps overdue unfinished work but excludes completed history", () => {
    expect(types(call(true, [op("shifting", -10), op("assistance", -20, "actual")]))).toEqual(["shifting", "departure"]);
  });
  it("recognizes an actual departure before the status field catches up", () => {
    expect(types({ ...call(true), departureTimes: [{ kind: "actual", value: at(-1) }] })).toEqual([]);
  });
  it("selects different fields for different calls in the same list", () => {
    expect([call(false, [op("anchorage", 15)]), call(true)].map(c => types(c))).toEqual([["anchorage", "arrival"], ["departure"]]);
  });
});
describe("booking timing and seed data", () => {
  it("orders each operation independently at its own two-hour threshold", () => {
    const item = call(false, [op("shifting", 240)]);
    const source = { ...mockWatchlistSnapshot, calls: [item], serviceOrders: [] };
    const before = applyBookingWindow(source, now + 60 * 60_000 - 1).calls[0];
    expect(before.operations.every(op => op.state === "expected")).toBe(true);
    const boundary = applyBookingWindow(source, now + 60 * 60_000).calls[0];
    expect(boundary.operations.map(op => op.state)).toEqual(["ordered", "expected", "expected"]);
    expect(boundary.arrivalTimes.some(t => t.kind === "ordered")).toBe(true);
    expect(boundary.departureTimes.some(t => t.kind === "ordered")).toBe(false);
    expect(applyBookingWindow(source, now + 120 * 60_000).calls[0].operations.map(op => op.state)).toEqual(["ordered", "ordered", "expected"]);
  });
  it("has no artificially ordered distant operation, even with live ETA/en-route status", () => {
    const snapshot = applyBookingWindow(mockWatchlistSnapshot, now);
    const pending = snapshot.calls.flatMap(c => c.operations).filter(op => op.state !== "actual");
    for (const operation of pending) expect(operation.state).toBe(Date.parse(operation.at) - now <= 120 * 60_000 ? "ordered" : "expected");
    expect(pending.filter(op => op.state === "expected").length / pending.length).toBeGreaterThan(0.8);
    const juniper = snapshot.calls.find(c => c.vesselName === "Juniper Kestrel")!;
    expect(juniper.departureTimes.some(t => t.kind === "ordered")).toBe(false);
    expect(types(juniper)).toEqual(["departure"]);
  });
  it("retains deliberate manual bookings and actual records", () => {
    const item = call(true, [op("shifting", 300, "ordered")]);
    const result = applyBookingWindow({ ...mockWatchlistSnapshot, calls: [item] }, now).calls[0];
    expect(result.operations.map(op => op.state)).toEqual(["actual", "ordered", "expected"]);
  });
});
