import { viewerFromDemoRequest } from "@/lib/access";
import { getWatchlistSnapshotForViewer } from "@/services/watchlistServer";

/** Profile-shaped, per-request demo data must never be statically cached. */
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const viewer = viewerFromDemoRequest(request);
  const snapshot = await getWatchlistSnapshotForViewer(viewer);
  return Response.json(snapshot, {
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
    },
  });
}
