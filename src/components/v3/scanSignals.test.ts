import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mockWatchlistSnapshot } from "@/data/mockWatchlist";
import type { PortCall, PortCallNote } from "@/lib/watchlist";
import { MobileCallList } from "./MobileCallList";
import { NotesButton, NotesIndicator, writtenNoteCount } from "./NotesControl";
import { ScheduleTable } from "./ScheduleTable";

const note = (text: string, id = "note-1"): PortCallNote => ({ id, text, authorRole: "Havnevagt", createdAt: "2026-08-21T06:00:00+02:00" });
const calls: PortCall[] = mockWatchlistSnapshot.calls.slice(0, 3).map((call, index) => ({ ...call, notes: index === 1 ? [note("Kontrollér kajplaceringen"), note(" ", "empty")] : [] }));
const noop = () => {};
const shared = { calls, allCalls: calls, serviceOrders: [], locale: "da" as const, now: "2026-08-21T07:00:00+02:00", pins: [], onPin: noop, onOpen: noop, onBerth: noop };

describe("written-note signals", () => {
  it("counts actual content, not empty records or whitespace", () => {
    expect(writtenNoteCount([])).toBe(0);
    expect(writtenNoteCount([note(""), note(" \n\t ")])).toBe(0);
    expect(writtenNoteCount([note(" En note "), note("En anden", "second"), note(" ")])).toBe(2);
  });

  it.each([NotesButton, NotesIndicator])("keeps count, accessible label and filled state synchronized", Component => {
    const render = (call: PortCall) => renderToStaticMarkup(createElement(Component, { call, locale: "da", onClick: noop }));
    expect(render(calls[0])).toContain('data-has-notes="false" data-notes-count="0"');
    expect(render(calls[0])).toContain(`aria-label="0 noter for ${calls[0].vesselName}"`);
    expect(render(calls[1])).toContain('data-has-notes="true" data-notes-count="1"');
    expect(render(calls[1])).toContain(`aria-label="1 noter for ${calls[1].vesselName}"`);
    expect(renderToStaticMarkup(createElement(Component, { call: calls[1], locale: "en", onClick: noop }))).toContain(`aria-label="1 notes for ${calls[1].vesselName}"`);
  });
});

describe("row scanning", () => {
  it.each([false, true])("stripes displayed table calls independently of optional OPS rows (compact=%s)", compact => {
    for (const orderedCalls of [calls, [...calls].reverse(), calls.slice(1)]) {
      const markup = renderToStaticMarkup(createElement(ScheduleTable, { ...shared, calls: orderedCalls, compact, columns: ["vessel", "operations", "notes"], sort: "job-order", direction: "asc", onSort: noop }));
      const rows = [...markup.matchAll(/<tr\b[^>]*data-call-id="([^"]+)"[^>]*data-stripe="(\d)"/g)];
      expect(rows.map(row => row[1])).toEqual(orderedCalls.map(call => call.id));
      expect(rows.map(row => Number(row[2]))).toEqual(orderedCalls.map((_, index) => index % 2));
      const stripes = [...markup.matchAll(/<tr\b[^>]*data-stripe="(\d)"/g)].map(row => Number(row[1]));
      expect(stripes).toEqual(orderedCalls.flatMap((_, index) => {
        return Array.from({ length: 1 + Number(compact) }, () => index % 2);
      }));
      expect(markup).toContain('data-has-notes="true" data-notes-count="1"');
      expect(markup).toContain('data-has-notes="false" data-notes-count="0"');
    }
  });

  it.each([false, true])("keeps one note signal in the mobile summary (compact=%s)", compact => {
    const markup = renderToStaticMarkup(createElement(MobileCallList, { ...shared, compact, preset: "office", onRegister: noop, onShowMap: noop }));
    expect([...markup.matchAll(/<li\b[^>]*data-call-id="([^"]+)"[^>]*data-stripe="(\d)"/g)].map(row => Number(row[2]))).toEqual([0, 1, 0]);
    const summaries = [...markup.matchAll(/<article\b[\s\S]*?<\/article>/g)].map(row => row[0]);
    expect(summaries).toHaveLength(3);
    expect(summaries[0]).toContain('data-has-notes="false" data-notes-count="0"');
    expect(summaries[1]).toContain('data-has-notes="true" data-notes-count="1"');
    expect(markup.match(/data-has-notes="true" data-notes-count="1"/g)).toHaveLength(1);
    if (compact) expect(summaries[1]).toContain('role="img"');
  });
});
