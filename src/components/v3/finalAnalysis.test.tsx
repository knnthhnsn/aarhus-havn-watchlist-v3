import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mockWatchlistSnapshot } from "@/data/mockWatchlist";
import { ScheduleTable } from "./ScheduleTable";
import { MobileCallList } from "./MobileCallList";
import { liveEtaLabel, showLiveEtaDate } from "./liveEtaLabel";
import { presetColumns } from "./columns";

const noop = () => {};
const now = "2026-08-21T06:40:00+02:00";
const calls = mockWatchlistSnapshot.calls;
const table = (id: string) => renderToStaticMarkup(<ScheduleTable calls={calls.filter(c => c.id === id)} allCalls={calls} serviceOrders={mockWatchlistSnapshot.serviceOrders} locale="da" now={now} columns={presetColumns.full} preset="full" compact={false} pins={[]} sort="job-order" direction="asc" onSort={noop} onServiceSort={noop} onPin={noop} onOpen={noop} onBerth={noop} onStud={noop} />);

describe("final PDF analysis", () => {
  it.each(["full", "office", "port"] as const)("shows STUD once in the berth column and retains services in %s", preset => {
    const stud = calls.find(call => call.id === "call-010")!;
    for (const compact of [false, true]) {
      const html = renderToStaticMarkup(<ScheduleTable calls={[stud]} allCalls={calls} serviceOrders={mockWatchlistSnapshot.serviceOrders} locale="da" now={now} columns={presetColumns[preset]} preset={preset} compact={compact} pins={[]} sort="job-order" direction="asc" onSort={noop} onPin={noop} onOpen={noop} onBerth={noop} onStud={noop} />);
      expect(html.match(/>STUD</g)).toHaveLength(1);
      expect(html).toContain('aria-label="Filtrér STUD"');
      expect(html).toContain('aria-label="Bugserbåd');
      expect(html).toContain('aria-label="Trosseføring');
    }
  });
  it("aligns service columns with their own operation subrow", () => {
    const html = table("call-004");
    const rows = [...html.matchAll(/<tr[^>]*data-operation-row="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/g)];
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      const serviceOperations = [...row[2].matchAll(/data-service-operation="([^"]+)"/g)].map(m => m[1]);
      // Shared arrival/departure fields may span the row; inspect only OPS badges.
      const opsCell = row[2].match(/<td[^>]*data-service-column="operations-H"[\s\S]*?<\/td>/)?.[0] ?? "";
      if (opsCell.includes("data-service-operation")) expect(opsCell).toContain(`data-service-operation="${row[1]}"`);
      expect(serviceOperations).not.toContain(row[1].endsWith("assist") ? "call-004-shift-1" : "call-004-assist");
    }
    expect(html).toContain('rowSpan="2"');
  });
  it("marks the next actual action and keeps dates inside colored surfaces", () => {
    const html = table("call-015");
    expect(html).toMatch(/data-operation-id="call-015-holding" data-next-operation="true"/);
    expect(html).not.toContain('data-next-summary="true"');
    expect(html).toMatch(/data-time-surface="true"[\s\S]*?<small>21\. aug\.<\/small><\/span>/);
    expect(html).toContain("Live ETA 09:04");
    expect(html).toMatch(/data-live-eta="true"><span>Live ETA<\/span><time dateTime="[^"]+">09:04<\/time><\/small>/);
    expect(html).not.toContain('data-column="customer"');
    expect(html).not.toMatch(/<small[^>]*>(Forventet|Bestilt|Faktisk)<\/small>/);
    expect(html).not.toMatch(/<(?:span|b)[^>]*>Næste(?: opgave)?<\//);
  });
  it("only includes the Live ETA date when it differs from the arrival in harbor-local time", () => {
    expect(liveEtaLabel("2026-08-21T09:04:00+02:00", "2026-08-21T08:48:00+02:00", "da")).toBe("Live ETA 09:04");
    expect(liveEtaLabel("2026-08-22T00:04:00+02:00", "2026-08-21T23:48:00+02:00", "da")).toBe("Live ETA 22. aug. · 00:04");
    expect(liveEtaLabel("2026-08-21T22:04:00Z", "2026-08-22T00:00:00+02:00", "da")).toBe("Live ETA 00:04");
    expect(showLiveEtaDate("2027-08-21T09:00:00+02:00", "2026-08-21T09:00:00+02:00")).toBe(true);
    expect(showLiveEtaDate("2026-10-25T01:30:00Z", "2026-10-25T00:30:00Z")).toBe(false);
    expect(liveEtaLabel("2026-08-21T09:04:00+02:00", undefined, "da")).toBe("Live ETA 21. aug. · 09:04");
    expect(showLiveEtaDate("2026-08-21T09:04:00+02:00", "invalid")).toBe(true);
    expect(liveEtaLabel("invalid", undefined, "da")).toBe("Live ETA");
  });
  it("renders STUD as an accessible filter button when a handler is provided", () => {
    const stud = calls.find(call => call.operations.every(operation => operation.workLocation === "stud"))!;
    const html = table(stud.id);
    expect(html).toContain('aria-label="Filtrér STUD"');
    expect(html).toMatch(/data-column="eta"[\s\S]*?data-time-surface="true"/);
    expect(html).toMatch(/data-column="etd"[\s\S]*?data-time-surface="true"/);
  });
  it.each([false, true])("never highlights historical work as next on a completed mobile call (compact=%s)", compact => {
    const source = calls.find(call => call.id === "call-015")!;
    const completed = { ...source, status: "departed" as const, operations: source.operations.map(operation => ({ ...operation, state: "actual" as const })) };
    const html = renderToStaticMarkup(<MobileCallList calls={[completed]} allCalls={[completed]} serviceOrders={[]} locale="da" preset="full" compact={compact} now={now} pins={[]} onPin={noop} onOpen={noop} onBerth={noop} onRegister={noop} onShowMap={noop} />);
    expect(html).not.toContain('data-next="true"');
  });
});
