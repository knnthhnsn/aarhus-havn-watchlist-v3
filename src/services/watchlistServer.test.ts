import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { anonymousViewer, demoViewer } from "@/lib/access";
import { getNextActionableOperation, PROTOTYPE_OPERATIONS_NOW } from "@/lib/watchlist";
import { composeSnapshotForViewer, sanitizeSnapshot } from "./watchlistServer";

const authorised = demoViewer("secure");

describe("server watchlist visibility", () => {
  it("never puts restricted records or identifiers in the anonymous response", () => {
    const snapshot = composeSnapshotForViewer(anonymousViewer());
    const json = JSON.stringify(snapshot);
    expect(snapshot.calls).toHaveLength(76);
    expect(snapshot.calls.every((call) => call.visibility !== "restricted")).toBe(true);
    expect(json).not.toContain("restricted-call-001");
    expect(json).not.toContain("011401");
    expect(json).not.toContain("HDMS Northwind");
    expect(snapshot.vessels.some((vessel) => vessel.id.startsWith("restricted-"))).toBe(false);
    expect(snapshot.tracking.some((track) => track.vesselId.startsWith("restricted-"))).toBe(false);
  });

  it("interleaves authorised military calls in the same job-order sequence", () => {
    const snapshot = composeSnapshotForViewer(authorised);
    const restrictedIndexes = snapshot.calls.map((call, index) => call.visibility === "restricted" ? index : -1).filter((index) => index >= 0);
    expect(snapshot.calls).toHaveLength(80);
    expect(restrictedIndexes).toHaveLength(4);
    expect(restrictedIndexes.some((index) => index > 0 && index < snapshot.calls.length - 1)).toBe(true);
    expect(new Set(snapshot.calls.map((call) => call.id)).size).toBe(snapshot.calls.length);
    expect(new Set(snapshot.calls.map((call) => call.callNumber)).size).toBe(snapshot.calls.length);
    const actionableTimes = snapshot.calls.map((call) => {
      const operation = getNextActionableOperation(call, PROTOTYPE_OPERATIONS_NOW, snapshot.serviceOrders);
      return operation ? Date.parse(operation.at) : Number.POSITIVE_INFINITY;
    });
    expect(actionableTimes).toEqual([...actionableTimes].sort((left, right) => left - right));
  });

  it("keeps the standard Havnevagt demo at the public 76-call boundary", () => {
    const snapshot = composeSnapshotForViewer(demoViewer("harbor"));
    expect(snapshot.calls).toHaveLength(76);
    expect(snapshot.calls.every((call) => call.visibility === "public")).toBe(true);
  });

  it("strips all associated sensitive arrays when a restricted call is denied", () => {
    const source = composeSnapshotForViewer(authorised);
    const denied = sanitizeSnapshot(source, anonymousViewer());
    expect(denied.calls.every((call) => call.visibility !== "restricted")).toBe(true);
    expect(denied.serviceOrders.every((order) => denied.calls.some((call) => call.id === order.portCallId))).toBe(true);
    expect(denied.vessels.every((vessel) => denied.calls.some((call) => call.vesselId === vessel.id))).toBe(true);
    expect(denied.tracking.every((track) => denied.vessels.some((vessel) => vessel.id === track.vesselId))).toBe(true);
  });

  it("denies missing or unknown visibility classifications", () => {
    const source = composeSnapshotForViewer(authorised);
    const base = source.calls.find((call) => call.visibility === "public")!;
    const missing = { ...base, id: "missing-visibility", callNumber: "NPC-MISSING", vesselId: "vessel-missing", visibility: undefined } as unknown as typeof base;
    const unknown = { ...base, id: "unknown-visibility", callNumber: "NPC-UNKNOWN", vesselId: "vessel-unknown", visibility: "internal" } as unknown as typeof base;
    const malformed = { ...source, calls: [missing, unknown] };
    expect(sanitizeSnapshot(malformed, anonymousViewer()).calls).toHaveLength(0);
    expect(sanitizeSnapshot(malformed, authorised).calls).toHaveLength(0);
  });

  it("marks every public fixture explicitly public", () => {
    const source = composeSnapshotForViewer(anonymousViewer());
    expect(source.calls).not.toHaveLength(0);
    expect(source.calls.every((call) => call.visibility === "public")).toBe(true);
  });
});
