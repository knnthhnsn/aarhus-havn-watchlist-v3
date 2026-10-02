import { describe, expect, it } from "vitest";
import { ALL_COLUMNS, SORT_KEYS } from "@/lib/watchlist";
import { columnNames, presetColumns, restoredColumns, sortColumns } from "./columns";

describe("operational column parity", () => {
  it("shows agent rather than crane in Harbour and includes crane in Office", () => {
    expect(presetColumns.port).toContain("agent");
    expect(presetColumns.port).not.toContain("crane");
    expect(presetColumns.office).toContain("crane");
  });
  it("makes every V2 field individually available and sortable", () => {
    expect(presetColumns.full).toHaveLength(18);
    expect(new Set(presetColumns.full)).toEqual(new Set(ALL_COLUMNS.filter(column => column !== "beam" && column !== "category")));
    expect(new Set(Object.entries(sortColumns).filter(([column]) => column !== "customer").map(([, key]) => key))).toEqual(new Set(SORT_KEYS.filter(key => key !== "customer")));
    for (const locale of ["da", "en"] as const) for (const column of ALL_COLUMNS) expect(columnNames[locale][column]).toBeTruthy();
    expect(presetColumns.full).not.toContain("customer");
    expect(columnNames.da.signal).toBe("OPS.");
    expect(columnNames.da.operations).toBe("Handling");
  });
  it("keeps independent OPS and next task in every working preset", () => {
    for (const columns of Object.values(presetColumns)) {
      expect(columns[0]).toBe("pin");
      expect(columns[1]).toBe("vessel");
      expect(columns.at(-1)).toBe("signal");
      expect(columns).toContain("operations");
      expect(columns).toContain("nextJob");
    }
  });
  it("migrates obsolete merged columns without removing operations", () => {
    expect(restoredColumns(["vessel", "parties", "arrival"], undefined)).toBeNull();
    expect(restoredColumns(["vessel", "notes", "notes", "operations"], 2)).toEqual(["vessel", "notes", "operations"]);
    expect(restoredColumns(["notes"], 2)).toBeNull();
    expect(restoredColumns(["vessel", "signal", "pin", "notes"], 2)).toEqual(["pin", "vessel", "notes", "signal"]);
    expect(restoredColumns(["pin", "vessel", "notes", "signal"], 2)).toEqual(["pin", "vessel", "notes", "signal"]);
    expect(restoredColumns(["pin", "vessel", "customer", "notes", "signal"], 2)).toEqual(["pin", "vessel", "notes", "signal"]);
  });
});
