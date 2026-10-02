import { expect, it } from "vitest";
import { mapBearing, quayHeading, routeHeading } from "./mapOrientation";
const p = { latitude: 56, longitude: 10 };
it("uses clockwise map bearings", () => {
  expect(mapBearing(p, { ...p, longitude: 11 })).toBeCloseTo(90);
  expect(mapBearing(p, { ...p, latitude: 57 })).toBeCloseTo(0);
  expect(mapBearing(p, { ...p, latitude: 55 })).toBeCloseTo(180);
  expect(mapBearing(p, { ...p, longitude: 9 })).toBeCloseTo(270);
});
it("skips repeated route points without inventing a north heading", () => {
  expect(routeHeading(p, [p], [p, { ...p, longitude: 11 }])).toBeCloseTo(90);
  expect(routeHeading(p, [p], [p])).toBeUndefined();
});
it("keeps the sailed direction ahead of a future turn", () => {
  expect(routeHeading(p, [{ ...p, longitude: 9 }, p], [{ ...p, latitude: 57 }])).toBeCloseTo(90);
});
it("aligns the correct side toward the quay", () => {
  expect(quayHeading(34, "right", "port")).toBe(34);
  expect(quayHeading(34, "right", "starboard")).toBe(214);
  expect(quayHeading(34, "left", "port")).toBe(214);
  expect(quayHeading(34, "left", "starboard")).toBe(34);
});
