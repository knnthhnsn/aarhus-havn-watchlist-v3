import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mockWatchlistSnapshot } from "@/data/mockWatchlist";
import type { Locale, PortCall, PortOperation } from "@/lib/watchlist";
import { CallDetail, TimeCard } from "./CallDetail";

const noop = () => {};
const now = "2026-08-21T06:40:00+02:00";
const base = mockWatchlistSnapshot.calls[0];

const arrival: PortOperation = {
  id: "timeline-arrival",
  type: "arrival",
  label: "Arrival",
  at: "2026-08-21T07:00:00+02:00",
  state: "actual",
  serviceCodes: [],
};

const assistance: PortOperation = {
  id: "timeline-assistance",
  type: "assistance",
  label: "Assistance",
  at: "2026-08-21T08:15:00+02:00",
  state: "ordered",
  serviceCodes: ["H", "B"],
  serviceStates: { H: "actual", B: "ordered" },
  tugQuantity: 2,
};

const shifting: PortOperation = {
  id: "timeline-shifting",
  type: "shifting",
  label: "Shift",
  at: "2026-08-21T08:30:00+02:00",
  state: "expected",
  serviceCodes: ["L"],
};

const departure: PortOperation = {
  id: "timeline-departure",
  type: "departure",
  label: "Departure",
  at: "2026-08-21T12:00:00+02:00",
  state: "expected",
  serviceCodes: [],
};

function testCall(overrides: Partial<PortCall> = {}): PortCall {
  return {
    ...base,
    id: "timeline-detail-test",
    callNumber: "TIMELINE-TEST",
    visibility: "public",
    craneStatus: "none",
    status: "arrived",
    operations: [departure, shifting, arrival, assistance],
    arrivalTimes: [{ kind: "actual", value: arrival.at }],
    departureTimes: [{ kind: "expected", value: departure.at }],
    vesselReportedTimes: { arrival: "2026-08-21T06:55:00+02:00" },
    ...overrides,
  };
}

function detail(call: PortCall, locale: Locale = "da", initialTab: "call" | "timeline" = "timeline") {
  return renderToStaticMarkup(createElement(CallDetail, {
    call,
    allCalls: [call],
    serviceOrders: [],
    locale,
    now,
    initialTab,
    onClose: noop,
    onPin: noop,
    pinned: false,
    onAddNote: noop,
    onRegister: noop,
    onShowMap: noop,
  }));
}

function operationCard(html: string, id: string): string {
  return html.match(new RegExp(`<article[^>]*data-operation-id="${id}"[^>]*>[\\s\\S]*?<\\/article>`))?.[0] ?? "";
}

function timeCard(call: PortCall, operation: PortOperation, locale: Locale = "da"): string {
  return renderToStaticMarkup(createElement(TimeCard, { call, operation, type: operation.type, locale }));
}

describe("timeline detail regressions", () => {
  it.each([
    ["da", "Oversigt"],
    ["en", "Overview"],
  ] as const)("renames the %s call tab and keeps operational clocks out of its overview", (locale, label) => {
    const html = detail(testCall(), locale, "call");
    expect(html).toMatch(new RegExp(`aria-selected="true"[^>]*>${label}<\\/button>`));
    expect(html).not.toContain("data-operation-id=");
    expect(html).not.toContain("<time");
  });

  it("omits previous planning times entirely instead of repeating the current time", () => {
    const planned = "2026-08-21T08:00:00+02:00";
    const live = "2026-08-21T08:12:00+02:00";
    const orderedArrival: PortOperation = { ...arrival, at: planned, state: "ordered" };
    const orderedDeparture: PortOperation = { ...departure, state: "ordered" };
    const call = testCall({
      operations: [orderedArrival, orderedDeparture],
      arrivalTimes: [
        { kind: "expected", value: planned },
        { kind: "expected", value: planned },
        { kind: "ordered", value: planned },
        { kind: "live", value: live },
      ],
      departureTimes: [
        { kind: "ordered", value: departure.at },
        { kind: "live", value: "2026-08-21T12:10:00+02:00" },
      ],
      vesselReportedTimes: { arrival: "2026-08-21T07:55:00+02:00" },
    });

    const arrivalHtml = timeCard(call, orderedArrival);
    const departureHtml = timeCard(call, orderedDeparture);

    expect(arrivalHtml).toMatch(/<span[^>]*data-primary-status="ordered"[^>]*>Bestilt<\/span>/);
    expect(arrivalHtml.match(new RegExp(`dateTime="${planned.replaceAll("+", "\\+")}"`, "g"))).toHaveLength(1);
    expect(arrivalHtml).not.toContain('data-time-kind="expected"');
    expect(arrivalHtml).not.toContain('data-time-kind="ordered"');
    expect(arrivalHtml).toContain('data-time-kind="live"');
    expect(arrivalHtml).toContain("Live ETA");
    expect(arrivalHtml).toContain('data-time-kind="vessel"');
    expect(arrivalHtml).toContain("Skib");
    expect(arrivalHtml).not.toContain("Tidligere plantider");
    expect(arrivalHtml).not.toContain("<details");
    expect(arrivalHtml).not.toContain("Forventet");

    expect(departureHtml).toMatch(/<span[^>]*data-primary-status="ordered"[^>]*>Bestilt<\/span>/);
    expect(departureHtml).not.toContain('data-time-kind="live"');
    expect(departureHtml).not.toContain('data-time-kind="vessel"');
    expect(departureHtml).not.toContain("Live ETA");
    expect(departureHtml).not.toContain("Skib");
  });

  it("renders expected, ordered and actual arrival snapshots with exactly one current operational state", () => {
    const expectedAt = "2026-08-21T07:40:00+02:00";
    const orderedAt = "2026-08-21T08:00:00+02:00";
    const actualAt = "2026-08-21T08:06:00+02:00";
    const liveAt = "2026-08-21T08:04:00+02:00";
    const expectedOperation: PortOperation = { ...arrival, at: expectedAt, state: "expected" };
    const orderedOperation: PortOperation = { ...arrival, at: orderedAt, state: "ordered" };
    const actualOperation: PortOperation = { ...arrival, at: actualAt, state: "actual" };

    const expectedHtml = timeCard(testCall({
      operations: [expectedOperation],
      arrivalTimes: [{ kind: "expected", value: expectedAt }],
    }), expectedOperation);
    const orderedHtml = timeCard(testCall({
      operations: [orderedOperation],
      arrivalTimes: [
        { kind: "expected", value: expectedAt },
        { kind: "ordered", value: orderedAt },
        { kind: "live", value: liveAt },
      ],
    }), orderedOperation);
    const actualHtml = timeCard(testCall({
      operations: [actualOperation],
      arrivalTimes: [
        { kind: "expected", value: expectedAt },
        { kind: "ordered", value: orderedAt },
        { kind: "live", value: liveAt },
        { kind: "actual", value: actualAt },
      ],
    }), actualOperation);

    expect(expectedHtml).toContain('data-primary-status="expected"');
    expect(expectedHtml).not.toContain('data-time-history="true"');

    expect(orderedHtml).toContain('data-primary-status="ordered"');
    expect(orderedHtml).not.toContain('data-time-kind="expected"');
    expect(orderedHtml).not.toContain("<details");
    expect(orderedHtml).not.toContain(`dateTime="${expectedAt}"`);

    expect(actualHtml).toContain('data-primary-status="actual"');
    expect(actualHtml).not.toContain('data-time-kind="expected"');
    expect(actualHtml).not.toContain('data-time-kind="ordered"');
    expect(actualHtml).not.toContain('data-time-kind="actual"');
    expect(actualHtml).not.toContain('data-time-kind="live"');
    expect(actualHtml).not.toContain("Live ETA");
    expect(actualHtml).not.toContain("<details");
    expect(actualHtml).not.toContain(`dateTime="${expectedAt}"`);
    expect(actualHtml).not.toContain(`dateTime="${orderedAt}"`);
  });

  it("omits planning history in English as well as vessel and live rows on departure", () => {
    const expectedAt = "2026-08-21T11:30:00+02:00";
    const orderedAt = "2026-08-21T12:00:00+02:00";
    const actualAt = "2026-08-21T12:08:00+02:00";
    const actualDeparture: PortOperation = { ...departure, at: actualAt, state: "actual" };
    const call = testCall({
      operations: [actualDeparture],
      departureTimes: [
        { kind: "expected", value: expectedAt },
        { kind: "ordered", value: orderedAt },
        { kind: "live", value: "2026-08-21T12:05:00+02:00" },
        { kind: "actual", value: actualAt },
      ],
      vesselReportedTimes: { arrival: "2026-08-21T07:55:00+02:00" },
    });

    const html = timeCard(call, actualDeparture, "en");

    expect(html).toContain('data-primary-status="actual"');
    expect(html).not.toContain("Live ETA");
    expect(html).not.toContain('data-time-kind="live"');
    expect(html).not.toContain('data-time-kind="vessel"');
    expect(html).not.toContain("Vessel");
    expect(html).not.toContain("Previous planned times");
    expect(html).not.toContain("<details");
    expect(html).not.toContain(`dateTime="${expectedAt}"`);
    expect(html).not.toContain(`dateTime="${orderedAt}"`);
    expect(html).toContain(`dateTime="${actualAt}"`);
  });

  it("sorts the lifecycle, shows each status and services, and marks only the actionable next card", () => {
    const html = detail(testCall());
    const arrivalHtml = operationCard(html, arrival.id);
    const assistanceHtml = operationCard(html, assistance.id);
    const shiftingHtml = operationCard(html, shifting.id);
    const departureHtml = operationCard(html, departure.id);

    expect(arrivalHtml).not.toBe("");
    expect(assistanceHtml).not.toBe("");
    expect(shiftingHtml).not.toBe("");
    expect(departureHtml).not.toBe("");
    expect(html.indexOf(`data-operation-id="${arrival.id}"`)).toBeLessThan(html.indexOf(`data-operation-id="${assistance.id}"`));
    expect(html.indexOf(`data-operation-id="${assistance.id}"`)).toBeLessThan(html.indexOf(`data-operation-id="${shifting.id}"`));
    expect(html.indexOf(`data-operation-id="${shifting.id}"`)).toBeLessThan(html.indexOf(`data-operation-id="${departure.id}"`));

    expect(arrivalHtml).toMatch(/data-primary-status="actual"[^>]*>Faktisk<\/span>/);
    expect(assistanceHtml).toMatch(/data-primary-status="ordered"[^>]*>Bestilt<\/span>/);
    expect(shiftingHtml).toMatch(/data-primary-status="expected"[^>]*>Forventet<\/span>/);
    expect(assistanceHtml).toContain("Trosseføring");
    expect(assistanceHtml).toContain("Bugserbåd × 2");
    expect(shiftingHtml).toContain("Lods");

    expect(assistanceHtml).toContain('data-next="true"');
    expect(arrivalHtml).not.toContain('data-next="true"');
    expect(shiftingHtml).not.toContain('data-next="true"');
    expect(departureHtml).not.toContain('data-next="true"');
    expect(arrivalHtml).toContain('aria-label="Ret registrering: Ankomst"');
    expect(assistanceHtml).toContain('aria-label="Registrér Assistance"');
    expect(shiftingHtml).toContain('aria-label="Registrér Forhaling 1"');
    expect(departureHtml).toContain('aria-label="Registrér Afgang"');
  });

  it("omits every per-operation registration action for restricted calls", () => {
    const html = detail(testCall({ visibility: "restricted" }));
    expect(html).toContain(`data-operation-id="${assistance.id}"`);
    expect(html).not.toContain('aria-label="Registrér');
    expect(html).not.toContain('aria-label="Ret registrering:');
  });
});
