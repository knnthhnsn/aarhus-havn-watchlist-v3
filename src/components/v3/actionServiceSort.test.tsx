import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { mockWatchlistSnapshot } from "@/data/mockWatchlist";
import { cycleServiceSort, restoredServiceSort, sortByActionService } from "./actionServiceSort";
import { ScheduleTable } from "./ScheduleTable";
import { presetColumns } from "./columns";

const base = mockWatchlistSnapshot.calls[0];
const noop = () => {};
describe("action-specific service columns", () => {
  it.each(["H", "L", "B"] as const)("separates arrival, OPS and departure for %s", code => {
    const calls = (["arrival", "assistance", "departure"] as const).map(type => ({ ...base, id: type, operations: [{ ...base.operations[0], type, serviceCodes: [code] }] }));
    for (const [column, id] of [["eta", "arrival"], ["operations", "assistance"], ["etd", "departure"]] as const) {
      expect(sortByActionService(calls, { column, code, direction: "desc" }, [], [])[0].id).toBe(id);
      expect(sortByActionService(calls, { column, code, direction: "asc" }, [], []).at(-1)?.id).toBe(id);
      expect(sortByActionService(calls, { column, code, direction: "desc" }, [], ["departure"])[0].id).toBe("departure");
    }
  });
  it("assigns standalone service orders only to OPS", () => {
    const calls = [{ ...base, id: "empty", operations: [] }, { ...base, id: "service", operations: [] }];
    const orders = [{ id: "order", portCallId: "service", dutyCode: "TUG", displayText: "Tug", scheduledAt: base.operations[0].at, status: "ordered" as const, quantity: 2, serviceCode: "B" as const }];
    expect(sortByActionService(calls, { column: "operations", code: "B", direction: "desc" }, orders, [])[0].id).toBe("service");
    expect(sortByActionService(calls, { column: "eta", code: "B", direction: "desc" }, orders, [])[0].id).toBe("empty");
  });
  it.each(["full", "office", "port"] as const)("adds nine separate columns only in full (%s)", preset => {
    const html = renderToStaticMarkup(<ScheduleTable calls={[base]} allCalls={[base]} serviceOrders={[]} locale="da" now={mockWatchlistSnapshot.fetchedAt} columns={presetColumns[preset]} preset={preset} compact={false} pins={[]} sort="job-order" direction="asc" onSort={noop} onServiceSort={noop} onPin={noop} onOpen={noop} onBerth={noop} />);
    expect([...html.matchAll(/<th[^>]*data-service-column=/g)]).toHaveLength(preset === "full" ? 9 : 0);
    if (preset === "full") expect(html).toContain('aria-label="Afgang · B"');
  });
  it("cycles present first, absent first, reset and validates persisted selections", () => {
    const first = cycleServiceSort(null, "eta", "H");
    const second = cycleServiceSort(first, "eta", "H");
    expect(first?.direction).toBe("desc");
    expect(second?.direction).toBe("asc");
    expect(cycleServiceSort(second, "eta", "H")).toBeNull();
    expect(restoredServiceSort(first)).toEqual(first);
    expect(restoredServiceSort({ column: "vessel", code: "H", direction: "asc" })).toBeNull();
  });
});
