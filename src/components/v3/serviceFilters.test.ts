import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, filterPortCalls, mergeFilters, type CallServiceOrder } from "@/lib/watchlist";
import { mockWatchlistSnapshot } from "@/data/mockWatchlist";

const base = mockWatchlistSnapshot.calls[14];
const calls = (["H", "L", "B"] as const).map(code => ({ ...base, id: code, operations: [{ ...base.operations[0], serviceCodes: [code] }], serviceOrderIds: [] }));
describe("service filters", () => {
  it.each(["H", "L", "B"] as const)("filters %s independently", code => {
    expect(filterPortCalls(calls, { ...DEFAULT_FILTERS, serviceCodes: [code] }).map(c => c.id)).toEqual([code]);
  });
  it("combines selected services as OR, but respects the other filters", () => {
    expect(filterPortCalls(calls, { ...DEFAULT_FILTERS, serviceCodes: ["H", "B"] }).map(c => c.id)).toEqual(["H", "B"]);
    expect(filterPortCalls(calls, { ...DEFAULT_FILTERS, serviceCodes: ["H"], query: "no matching vessel" })).toEqual([]);
    expect(filterPortCalls(calls, { ...DEFAULT_FILTERS, serviceCodes: [] })).toHaveLength(3);
  });
  it("finds standalone service orders as well as operation-linked services", () => {
    const order: CallServiceOrder = { id: "order", portCallId: "H", dutyCode: "TUG", displayText: "Tug", scheduledAt: base.operations[0].at, status: "expected", quantity: 3, serviceCode: "B" };
    expect(filterPortCalls(calls, { ...DEFAULT_FILTERS, serviceCodes: ["B"] }, calls, mockWatchlistSnapshot.fetchedAt, [order]).map(c => c.id)).toEqual(["H", "B"]);
  });
  it("sanitizes persisted service choices", () => {
    expect(mergeFilters({ serviceCodes: ["H", "H", "B", "bogus", 2] }).serviceCodes).toEqual(["H", "B"]);
  });
});
