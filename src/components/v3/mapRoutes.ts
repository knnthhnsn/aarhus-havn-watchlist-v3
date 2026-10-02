import type { HarborPoint } from "@/lib/harbor";

export function validMapPoint(point: HarborPoint | undefined): point is HarborPoint {
  return Boolean(point && Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180);
}

/** Invalid positions split a route; never bridge a missing stretch of evidence. */
export function routeSegments(points: readonly HarborPoint[]): HarborPoint[][] {
  const segments: HarborPoint[][] = [];
  let current: HarborPoint[] = [];
  const flush = () => { if (current.length > 1) segments.push(current); current = []; };
  for (const point of points) {
    if (!validMapPoint(point)) { flush(); continue; }
    const previous = current.at(-1);
    if (!previous || previous.latitude !== point.latitude || previous.longitude !== point.longitude) current.push(point);
  }
  flush();
  return segments;
}
