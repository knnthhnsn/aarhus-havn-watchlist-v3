import { describe, expect, it } from "vitest";
import { mapGroups } from "./mapGroups";
import type { PortCallStatus } from "@/lib/watchlist";
const point = { latitude: 56.16, longitude: 10.25 };
const record = (id: string, status: PortCallStatus) => ({ call: { id, status }, point });

describe("map status subgroups", () => {
  it("shows 9 blue and 3 yellow next to each other without changing coordinates", () => {
    const input = [...Array.from({length:9},(_,i)=>record(`blue${i}`,"en-route")), ...Array.from({length:3},(_,i)=>record(`yellow${i}`,"expected"))];
    const groups = mapGroups(input);
    expect(groups.map(g=>[g.records[0].call.status,g.records.length,g.offsetX])).toEqual([["expected",3,-26],["en-route",9,26]]);
    expect(groups.every(g=>g.counted)).toBe(true);
    expect(groups.flatMap(g=>g.records).every(r=>r.point===point)).toBe(true);
    expect(new Set(groups.flatMap(g=>g.records.map(r=>r.call.id))).size).toBe(12);
    expect(mapGroups([...input].reverse()).map(g=>g.offsetX)).toEqual([-26,26]);
  });
  it("keeps a count of one for a minority status in a shared position", () => {
    const groups = mapGroups([record("a","arrived"),record("b","expected")]);
    expect(groups.map(g=>[g.records.length,g.counted])).toEqual([[1,true],[1,true]]);
  });
  it("keeps separate locations and leaves solo vessels unclustered", () => {
    const groups = mapGroups([record("a","en-route"),{...record("b","en-route"),point:{...point,latitude:56.17}}]);
    expect(groups.map(g=>[g.offsetX,g.counted])).toEqual([[0,false],[0,false]]);
    expect(mapGroups([])).toEqual([]);
  });
  it("centres a single-colour group and spaces all statuses predictably", () => {
    expect(mapGroups([record("a","expected"),record("b","expected")])[0].offsetX).toBe(0);
    expect(mapGroups([record("a","arrived"),record("b","en-route"),record("c","expected")]).map(g=>g.offsetX)).toEqual([-52,0,52]);
  });
});
