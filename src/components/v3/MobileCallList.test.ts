import { describe, expect, it } from "vitest";
import { mockWatchlistSnapshot } from "@/data/mockWatchlist";
import { getNextActionableOperation, type PortCall, type PortOperation } from "@/lib/watchlist";
import { getMobileCallOperations } from "./MobileCallList";

describe("mobile OPS disclosure", () => {
  it("keeps both Nordic Kestrel forhalings visible with their distinct placements", () => {
    const call = mockWatchlistSnapshot.calls.find(item => item.vesselName === "Nordic Kestrel")!;
    expect(call).toBeDefined();
    const sourceShifts = call.operations.filter(operation => operation.type === "shifting");
    expect(sourceShifts).toHaveLength(2);
    const operations = getMobileCallOperations(call, mockWatchlistSnapshot.serviceOrders);
    expect(operations.filter(operation => operation.type === "shifting").map(operation => operation.id)).toEqual(sourceShifts.map(operation => operation.id));
    expect(operations.filter(operation => operation.type === "shifting").map(operation => operation.placement)).toEqual(sourceShifts.map(operation => operation.placement));
    expect(operations.every(operation => operation.type !== "arrival" && operation.type !== "departure")).toBe(true);
  });

  it("does not remove an optional operation because it is also the next task", () => {
    const source = mockWatchlistSnapshot.calls.find(call => call.operations.some(operation => operation.type === "shifting"))!;
    const shift = source.operations.find(operation => operation.type === "shifting")!;
    const call: PortCall = { ...source, operations: source.operations.map(operation => ({ ...operation, state: operation.id === shift.id ? "ordered" : "actual" })) };
    const next = getNextActionableOperation(call);
    expect(next?.id).toBe(shift.id);
    expect(getMobileCallOperations(call).some(operation => operation.id === next?.id)).toBe(true);
  });

  it("retains completed optional tasks and adds standalone service tasks chronologically", () => {
    const source = mockWatchlistSnapshot.calls[0];
    const completed: PortOperation = { id: "done-assistance", type: "assistance", label: "Assistance", at: "2026-08-21T07:00:00+02:00", state: "actual", serviceCodes: ["H"] };
    const call: PortCall = { ...source, operations: [completed] };
    const operations = getMobileCallOperations(call, [{ id: "next-service", portCallId: call.id, dutyCode: "L", displayText: "Pilot", scheduledAt: "2026-08-21T08:00:00+02:00", quantity: 1, status: "ordered", serviceCode: "L" }]);
    expect(operations.map(operation => operation.id)).toEqual(["done-assistance", "next-service"]);
    expect(operations[0].state).toBe("actual");
  });
});
