import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { routeSegments, validMapPoint } from "./mapRoutes";
const a = { latitude: 56.1, longitude: 10.2 };
const b = { latitude: 56.2, longitude: 10.3 };
const c = { latitude: 56.3, longitude: 10.4 };
describe("map route evidence", () => {
  it("leaves Leaflet SVG dimensions outside the UI icon rule", () => {
    const css = readFileSync(new URL("./VesselSchedule.module.css", import.meta.url), "utf8");
    expect(css).not.toMatch(/\.app\s+svg\s*\{/);
    expect(css).toContain("svg[data-brand-icon]");
  });
  it("rejects invalid coordinates", () => {
    expect(validMapPoint({ latitude: 91, longitude: 10 })).toBe(false);
    expect(validMapPoint({ latitude: 56, longitude: Infinity })).toBe(false);
    expect(validMapPoint(a)).toBe(true);
  });
  it("does not draw empty, singleton or degenerate routes", () => {
    expect(routeSegments([])).toEqual([]);
    expect(routeSegments([a])).toEqual([]);
    expect(routeSegments([a, a])).toEqual([]);
  });
  it("deduplicates adjacent points without changing coordinates", () => {
    expect(routeSegments([a, a, b, c])).toEqual([[a, b, c]]);
  });
  it("never bridges invalid evidence", () => {
    expect(routeSegments([a, b, { latitude: NaN, longitude: 10 }, b, c])).toEqual([[a, b], [b, c]]);
  });
});
