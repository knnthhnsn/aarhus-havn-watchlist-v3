import "server-only";

/** Server-only watchlist composition and visibility boundary. */
import { mockWatchlistSnapshot } from "@/data/mockWatchlist";
import { restrictedWatchlistSnapshot } from "@/data/restrictedWatchlist";
import { canViewRestricted, type ViewerContext } from "@/lib/access";
import { sortPortCalls, type PortCall, type WatchlistSnapshot } from "@/lib/watchlist";

function isRestricted(call: PortCall): boolean {
  return call.visibility === "restricted";
}

function isPublic(call: PortCall): boolean {
  return call.visibility === "public";
}

/**
 * Remove records that are not visible to the supplied trusted viewer.
 * Unknown or missing visibility is deliberately denied for every viewer.
 */
export function sanitizeSnapshot(snapshot: WatchlistSnapshot, viewer: ViewerContext): WatchlistSnapshot {
  const includeRestricted = canViewRestricted(viewer);
  const calls = snapshot.calls.filter((call) => isPublic(call) || (includeRestricted && isRestricted(call)));
  const callIds = new Set(calls.map((call) => call.id));
  const vesselIds = new Set(calls.map((call) => call.vesselId));
  return {
    calls,
    vessels: snapshot.vessels.filter((vessel) => vesselIds.has(vessel.id)),
    tracking: snapshot.tracking.filter((track) => vesselIds.has(track.vesselId)),
    serviceOrders: snapshot.serviceOrders.filter((order) => callIds.has(order.portCallId)),
    fetchedAt: snapshot.fetchedAt,
  };
}

/**
 * Merge public and protected fixtures before ordering, so the Sikret drift
 * demo sees one normal job/date sequence rather than a separate military list
 * that can be accidentally omitted from the operational queue.
 */
export function composeSnapshotForViewer(viewer: ViewerContext): WatchlistSnapshot {
  const source: WatchlistSnapshot = canViewRestricted(viewer)
    ? {
        calls: [...mockWatchlistSnapshot.calls, ...restrictedWatchlistSnapshot.calls],
        vessels: [...mockWatchlistSnapshot.vessels, ...restrictedWatchlistSnapshot.vessels],
        tracking: [...mockWatchlistSnapshot.tracking, ...restrictedWatchlistSnapshot.tracking],
        serviceOrders: [...mockWatchlistSnapshot.serviceOrders, ...restrictedWatchlistSnapshot.serviceOrders],
        fetchedAt: mockWatchlistSnapshot.fetchedAt,
      }
    : mockWatchlistSnapshot;
  const sanitized = sanitizeSnapshot(source, viewer);
  const calls = sortPortCalls(sanitized.calls, "job-order", "asc", [], sanitized.fetchedAt, sanitized.serviceOrders);
  const order = new Map(calls.map((call, index) => [call.id, index]));
  return {
    ...sanitized,
    calls,
    // Keep associated arrays deterministic without leaking records from an
    // untrusted call set.
    vessels: [...sanitized.vessels].sort((left, right) => left.id.localeCompare(right.id)),
    tracking: [...sanitized.tracking].sort((left, right) => (order.get(sanitized.calls.find((call) => call.vesselId === left.vesselId)?.id ?? "") ?? 0) - (order.get(sanitized.calls.find((call) => call.vesselId === right.vesselId)?.id ?? "") ?? 0)),
    serviceOrders: [...sanitized.serviceOrders].sort((left, right) => (order.get(left.portCallId) ?? 0) - (order.get(right.portCallId) ?? 0) || left.id.localeCompare(right.id)),
  };
}

export async function getWatchlistSnapshotForViewer(viewer: ViewerContext): Promise<WatchlistSnapshot> {
  // Keep the async boundary so this can be replaced by a database/API
  // adapter without changing the route contract.
  await Promise.resolve();
  const snapshot = composeSnapshotForViewer(viewer);
  return { ...snapshot, fetchedAt: new Date().toISOString() };
}
