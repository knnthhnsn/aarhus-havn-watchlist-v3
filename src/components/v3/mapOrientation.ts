import type { HarborPoint } from "@/lib/harbor";
import { validMapPoint } from "./mapRoutes";

/** Clockwise from north in the map's Web Mercator projection. */
export function mapBearing(from: HarborPoint, to: HarborPoint): number | undefined {
  if (!validMapPoint(from) || !validMapPoint(to) || Math.abs(from.latitude) >= 85.051129 || Math.abs(to.latitude) >= 85.051129) return undefined;
  const radians = Math.PI / 180;
  const dx = ((to.longitude - from.longitude + 540) % 360 - 180) * radians;
  const dy = Math.log(Math.tan(Math.PI / 4 + to.latitude * radians / 2)) - Math.log(Math.tan(Math.PI / 4 + from.latitude * radians / 2));
  if (Math.abs(dx) + Math.abs(dy) < 1e-10) return undefined;
  return (Math.atan2(dx, dy) / radians + 360) % 360;
}

export function routeHeading(current: HarborPoint, sailed: readonly HarborPoint[], planned: readonly HarborPoint[]): number | undefined {
  // Last observed leg takes precedence; stop at invalid data rather than bridging gaps.
  for (let i = sailed.length - 1; i >= 0; i--) {
    if (!validMapPoint(sailed[i])) break;
    const heading = mapBearing(sailed[i], current);
    if (heading !== undefined) return heading;
  }
  for (const next of planned) {
    if (!validMapPoint(next)) break;
    const heading = mapBearing(current, next);
    if (heading !== undefined) return heading;
  }
  return undefined;
}

/** waterSide is relative to quayStart -> quayEnd; the mooring side faces land. */
export function quayHeading(heading: number, waterSide: "left" | "right", side: "port" | "starboard"): number {
  const forward = (waterSide === "right") === (side === "port");
  return ((heading + (forward ? 0 : 180)) % 360 + 360) % 360;
}
