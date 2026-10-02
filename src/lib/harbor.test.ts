import { describe, expect, it } from "vitest";

import { mockWatchlistSnapshot, MOCK_SNAPSHOT_FETCHED_AT } from "@/data/mockWatchlist";

import {
  HARBOR_NAVIGATION_NODES,
  HARBOR_NAVIGATION_GRAPH,
  HARBOR_BERTHS,
  HARBOR_BERTH_ANCHORS,
  areAdjacentBerths,
  berthAnchor,
  berthPosition,
  berthSupportsVessel,
  deriveHarborState,
  derivePortCallState,
  getBerthGeometry,
  isOperationalHarborState,
  navigationRouteForBerth,
  normalizeHarborBerthCode,
} from "./harbor";

describe("Aarhus harbor tracking geometry", () => {
  const distanceMeters = (left: { latitude: number; longitude: number }, right: { latitude: number; longitude: number }) => {
    const latitudeMeters = (left.latitude - right.latitude) * 111_320;
    const longitudeMeters = (left.longitude - right.longitude) * 111_320 * Math.cos(((left.latitude + right.latitude) / 2) * Math.PI / 180);
    return Math.hypot(latitudeMeters, longitudeMeters);
  };

  it("keeps every generated call on an explicit, mapped quay segment", () => {
    expect(mockWatchlistSnapshot.calls.length).toBe(76);
    expect(mockWatchlistSnapshot.calls.every((call) => Boolean(getBerthGeometry(call.berth)))).toBe(true);
    expect(mockWatchlistSnapshot.calls.every((call) => berthAnchor(call.berth) !== undefined)).toBe(true);
    expect(mockWatchlistSnapshot.tracking.every((track) => track.destinationBerth && getBerthGeometry(track.destinationBerth))).toBe(true);
  });

  it("does not silently place unsupported legacy codes at the harbor centre", () => {
    for (const code of ["101", "102", "205", "411"]) {
      expect(getBerthGeometry(code)).toBeUndefined();
      expect(berthAnchor(`Berth ${code}`)).toBeUndefined();
      expect(berthPosition(`Berth ${code}`)).toBeUndefined();
      expect(HARBOR_BERTH_ANCHORS[code]).toBeUndefined();
    }
  });

  it("excludes ferry-only quays and their navigation branch", () => {
    for (const code of ["602", "604", "606", "608", "610", "612", "614"]) {
      expect(getBerthGeometry(code)).toBeUndefined();
      expect(navigationRouteForBerth(code, "inbound")).toEqual([]);
      expect(mockWatchlistSnapshot.calls.some(call => normalizeHarborBerthCode(call.berth) === code)).toBe(false);
    }
    expect(Object.keys(HARBOR_NAVIGATION_NODES)).not.toContain("ferry-approach");
  });

  it("normalizes legacy berth labels to one map lookup key", () => {
    expect(normalizeHarborBerthCode("105")).toBe("105");
    expect(normalizeHarborBerthCode("Kaj 105")).toBe("105");
    expect(normalizeHarborBerthCode("Berth 105")).toBe("105");
    expect(getBerthGeometry("Kaj 105")).toEqual(getBerthGeometry("Berth 105"));
  });

  it("contains the map's core legacy berth patterns and metadata", () => {
    for (const code of ["103", "105", "107", "109", "301", "313", "302", "326", "404", "428", "501", "509", "108", "128", "203"]) {
      const geometry = HARBOR_BERTHS[code];
      expect(geometry, code).toBeDefined();
      expect(geometry?.quay.length).toBeGreaterThanOrEqual(2);
      expect(geometry?.terminal).toBeTruthy();
      expect(geometry?.basin).toBeTruthy();
      expect(geometry?.approachNode).toBeTruthy();
      expect(geometry?.source).toContain("November 2025");
      expect(geometry?.provenance).toBeTruthy();
    }
    expect(HARBOR_BERTHS["203"].confidence).toBe("low");
  });

  it("locks audit-aligned planning centres so quay series cannot drift back", () => {
    const candidates: Record<string, [number, number]> = {
      "103": [56.1457692, 10.2142081], "105": [56.1465678, 10.2151959], "107": [56.1473722, 10.2161909], "109": [56.1484378, 10.2158799],
      "117": [56.1505774, 10.2154954], "203": [56.1572697, 10.2276337], "204": [56.1563461, 10.2285972], "206": [56.1573397, 10.2295116],
      "301": [56.1425981, 10.218534], "303": [56.1433887, 10.2195057], "304": [56.1419334, 10.2200937], "305": [56.1441113, 10.2203939], "312": [56.1440229, 10.2254341],
      "418": [56.1540797, 10.2405316], "503": [56.1505498, 10.2285966],
    };
    for (const [code, [latitude, longitude]] of Object.entries(candidates)) {
      const point = berthAnchor(code)!;
      expect(Math.abs(point.latitude - latitude), code).toBeLessThan(0.001);
      expect(Math.abs(point.longitude - longitude), code).toBeLessThan(0.001);
    }
  });

  it("follows the official quay numbering rather than reversed or truncated series", () => {
    for (const [south, north] of [["404", "428"], ["501", "509"], ["301", "311"], ["108", "128"]]) {
      expect(berthAnchor(north)!.latitude).toBeGreaterThan(berthAnchor(south)!.latitude);
    }
    expect(distanceMeters(berthAnchor("404")!, berthAnchor("428")!)).toBeGreaterThan(1100);
    expect(berthAnchor("110")!.latitude).toBeLessThan(56.151);
    expect(getBerthGeometry("313")!.confidence).toBe("low");
  });

  it("keeps the rendered quay axis close to the declared planning heading", () => {
    for (const code of ["103", "117", "301", "304", "418", "503"]) {
      const geometry = getBerthGeometry(code)!;
      const radians = Math.atan2((geometry.quayEnd.longitude - geometry.quayStart.longitude) * Math.cos(geometry.quayStart.latitude * Math.PI / 180), geometry.quayEnd.latitude - geometry.quayStart.latitude);
      const bearing = (radians * 180 / Math.PI + 360) % 360;
      const difference = Math.abs(((bearing - geometry.heading + 540) % 360) - 180);
      expect(difference, code).toBeLessThan(1);
    }
  });

  it("keeps neighboring segment envelopes from materially overlapping", () => {
    const series = new Map<string, string[]>();
    Object.values(HARBOR_BERTHS).forEach((berth) => {
      const key = `${berth.terminal}/${berth.basin}`;
      series.set(key, [...(series.get(key) ?? []), berth.code]);
    });
    for (const codes of series.values()) {
      for (let index = 1; index < codes.length; index += 1) {
        const left = HARBOR_BERTHS[codes[index - 1]];
        const right = HARBOR_BERTHS[codes[index]];
        const leftCentre = berthAnchor(left.code)!;
        const rightCentre = berthAnchor(right.code)!;
        const leftHalfLength = distanceMeters(leftCentre, left.quayStart);
        const rightHalfLength = distanceMeters(rightCentre, right.quayStart);
        // Planning geometry may leave a small seam, but never a long shared line.
        expect(distanceMeters(leftCentre, rightCentre) + 6).toBeGreaterThanOrEqual(leftHalfLength + rightHalfLength);
      }
    }
  });

  it("returns branch routes that start outside and terminate at the mapped quay centre", () => {
    for (const code of ["103", "301", "304", "418", "503", "117", "203"]) {
      const inbound = navigationRouteForBerth(code, "inbound");
      const outbound = navigationRouteForBerth(code, "outbound");
      const centre = berthAnchor(code)!;
      expect(inbound.length).toBeGreaterThanOrEqual(3);
      expect(inbound.at(-1)).toEqual(centre);
      expect(outbound[0]).toEqual(centre);
      expect(outbound.at(-1)).toEqual(inbound[0]);
      expect(inbound.every((point) => point.latitude > 56.14 && point.latitude < 56.19 && point.longitude > 10.20 && point.longitude < 10.32)).toBe(true);
    }
    expect(HARBOR_NAVIGATION_NODES["outer-fairway"].longitude).toBeGreaterThan(10.27);
  });

  it("keeps the final approach node close to its basin and never wraps a route to land", () => {
    for (const code of ["103", "301", "304", "418", "503", "117", "203"]) {
      const geometry = getBerthGeometry(code)!;
      const inbound = navigationRouteForBerth(code, "inbound");
      const preBerth = inbound.at(-2)!;
      const approach = HARBOR_NAVIGATION_NODES[geometry.approachNode];
      const distance = Math.hypot(preBerth.latitude - approach.latitude, preBerth.longitude - approach.longitude);
      expect(distance).toBeLessThan(0.0001);
      expect(Math.hypot(approach.latitude - berthAnchor(code)!.latitude, approach.longitude - berthAnchor(code)!.longitude)).toBeLessThan(0.012);
    }
  });

  it("routes oil and Sydhavnen through the container turning node", () => {
    const nodeIndex = (route: readonly { latitude: number; longitude: number }[], node: { latitude: number; longitude: number }) =>
      route.findIndex((point) => point.latitude === node.latitude && point.longitude === node.longitude);
    const oilRoute = navigationRouteForBerth("203", "inbound");
    const sydhavnenRoute = navigationRouteForBerth("103", "inbound");
    const northIndexOil = nodeIndex(oilRoute, HARBOR_NAVIGATION_NODES["north-approach"]);
    const containerIndexOil = nodeIndex(oilRoute, HARBOR_NAVIGATION_NODES["container-approach"]);
    const oilIndex = nodeIndex(oilRoute, HARBOR_NAVIGATION_NODES["oil-approach"]);
    const northIndexSydhavnen = nodeIndex(sydhavnenRoute, HARBOR_NAVIGATION_NODES["north-approach"]);
    const containerIndexSydhavnen = nodeIndex(sydhavnenRoute, HARBOR_NAVIGATION_NODES["container-approach"]);
    const oilIndexSydhavnen = nodeIndex(sydhavnenRoute, HARBOR_NAVIGATION_NODES["oil-approach"]);
    expect(northIndexOil).toBeGreaterThanOrEqual(0);
    expect(containerIndexOil).toBeGreaterThan(northIndexOil);
    expect(oilIndex).toBeGreaterThan(containerIndexOil);
    expect(containerIndexSydhavnen).toBeGreaterThan(northIndexSydhavnen);
    expect(oilIndexSydhavnen).toBeGreaterThan(containerIndexSydhavnen);
    expect(HARBOR_NAVIGATION_GRAPH["north-approach"]).not.toContain("oil-approach");
  });

  it("derives the complete clock-driven state sequence", () => {
    const base = Date.parse(MOCK_SNAPSHOT_FETCHED_AT);
    const timeline = { arrivalAt: new Date(base + 2 * 60 * 60_000).toISOString(), departureAt: new Date(base + 8 * 60 * 60_000).toISOString(), shiftAt: new Date(base + 4 * 60 * 60_000).toISOString() };
    expect(deriveHarborState(timeline, base - 13 * 60 * 60_000)).toBe("outside");
    expect(deriveHarborState(timeline, base - 3 * 60 * 60_000)).toBe("holding");
    expect(deriveHarborState(timeline, base + 60 * 60_000)).toBe("inbound");
    expect(deriveHarborState(timeline, base + 118 * 60_000)).toBe("turning");
    expect(deriveHarborState(timeline, base + 3 * 60 * 60_000)).toBe("alongside");
    expect(deriveHarborState(timeline, base + 4 * 60 * 60_000)).toBe("shifting");
    expect(deriveHarborState(timeline, base + 8 * 60 * 60_000 + 30 * 60_000)).toBe("outbound");
    expect(deriveHarborState(timeline, base + 10 * 60 * 60_000)).toBe("hidden");
    expect(isOperationalHarborState("alongside")).toBe(true);
    expect(isOperationalHarborState("outside")).toBe(false);
  });

  it("re-enters the shifting state for each planned shift window", () => {
    const base = Date.parse(MOCK_SNAPSHOT_FETCHED_AT);
    const timeline = {
      arrivalAt: new Date(base + 2 * 60 * 60_000).toISOString(),
      departureAt: new Date(base + 8 * 60 * 60_000).toISOString(),
      shiftAt: [new Date(base + 4 * 60 * 60_000).toISOString(), new Date(base + 6 * 60 * 60_000).toISOString()],
    };
    expect(deriveHarborState(timeline, base + 4 * 60 * 60_000)).toBe("shifting");
    expect(deriveHarborState(timeline, base + 5 * 60 * 60_000)).toBe("alongside");
    expect(deriveHarborState(timeline, base + 6 * 60 * 60_000)).toBe("shifting");
    expect(deriveHarborState(timeline, base + 7 * 60 * 60_000)).toBe("alongside");
    expect(deriveHarborState(timeline, base + 8 * 60 * 60_000 + 30 * 60_000)).toBe("outbound");
  });

  it("keeps the map snapshot clock and state machine aligned", () => {
    const now = Date.parse(MOCK_SNAPSHOT_FETCHED_AT);
    const states = mockWatchlistSnapshot.calls.map((call) => derivePortCallState(call, now));
    expect(new Set(states)).toEqual(new Set(["hidden", "alongside", "inbound", "holding", "outside", "outbound", "shifting", "turning"]));
    expect(states.filter(isOperationalHarborState).length).toBeLessThan(mockWatchlistSnapshot.calls.length);
    expect(mockWatchlistSnapshot.tracking.every((track) => track.updatedAt === MOCK_SNAPSHOT_FETCHED_AT)).toBe(true);
  });

  it("routes a vessel to its effective shift berth at the snapshot clock", () => {
    const now = Date.parse(MOCK_SNAPSHOT_FETCHED_AT);
    const currentShift = mockWatchlistSnapshot.calls.find((call) => derivePortCallState(call, now) === "shifting");
    expect(currentShift).toBeDefined();
    const tracking = mockWatchlistSnapshot.tracking.find((track) => track.vesselId === currentShift?.vesselId);
    expect(tracking?.destinationBerth).toBe(currentShift?.operations.find((operation) => operation.type === "shifting" && operation.state === "actual")?.berth);
  });

  it("keeps every generated shift on a direct neighboring quay", () => {
    const shifts = mockWatchlistSnapshot.calls.flatMap((call) => {
      let from = call.berth;
      return call.operations.filter((operation) => operation.type === "shifting" && operation.berth).map((operation) => {
        const pair = [from, operation.berth!] as const;
        from = operation.berth!;
        return pair;
      });
    });
    expect(shifts.length).toBeGreaterThan(0);
    expect(shifts.every(([from, to]) => areAdjacentBerths(from, to))).toBe(true);
    expect(shifts.every(([from, to]) => HARBOR_BERTHS[from.replace(/\D/g, "")]?.confidence === "medium" && HARBOR_BERTHS[to.replace(/\D/g, "")]?.confidence === "medium")).toBe(true);
  });

  it("checks dimensions against the mapped quay constraints", () => {
    expect(berthSupportsVessel("Berth 418", { loaMeters: 180, beamMeters: 28 })).toBe(true);
    expect(berthSupportsVessel("Berth 418", { loaMeters: 350, beamMeters: 28 })).toBe(false);
    expect(berthSupportsVessel("Berth 205", { loaMeters: 100, beamMeters: 20 })).toBe(false);
  });
});
