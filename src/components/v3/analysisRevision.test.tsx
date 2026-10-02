import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mockWatchlistSnapshot } from "@/data/mockWatchlist";
import { applyBookingWindow, withinBookingWindow } from "@/lib/bookingWindow";
import { DEFAULT_FILTERS, filterPortCalls, type PortOperation } from "@/lib/watchlist";
import { mobileTaskData, mobileTaskKey } from "@/lib/mobileTask";
import { CraneBadge, cranePresentation } from "./CraneBadge";
import { OperationServices } from "./OperationServices";
import { sanitizeLocalState } from "./localState";
import { CallDetail, TimeCard } from "./CallDetail";
import { MobileCallList } from "./MobileCallList";

const now = "2026-08-21T06:00:00+02:00";
const op: PortOperation = { id: "test-op", type: "arrival", label: "Arrival", at: "2026-08-21T08:00:00+02:00", state: "expected", serviceCodes: ["H", "L", "B"], serviceStates: { H: "actual", L: "expected", B: "ordered" }, tugQuantity: 3 };
const call = { ...mockWatchlistSnapshot.calls[14], visibility: "public" as const, operations: [op], arrivalTimes: [{ kind: "expected" as const, value: op.at }] };
const noop = () => {};
describe("September analysis requirements", () => {
  it("shows vessel-reported time only on arrival, never on departure", () => {
    const item = { ...call, vesselReportedTimes: { arrival: "2026-08-21T09:17:00+02:00" } };
    const arrival = renderToStaticMarkup(createElement(TimeCard, { call: item, type: "arrival", locale: "da" }));
    const departure = renderToStaticMarkup(createElement(TimeCard, { call: item, type: "departure", locale: "da" }));
    expect(arrival).toContain('<dt>Skib</dt>');
    expect(arrival).toContain('09:17');
    expect(departure).not.toContain('<dt>Skib</dt>');
    expect(departure).not.toContain('data-state="vessel"');
  });
  it.each(["expected", "ordered", "actual"] as const)("does not repeat the primary %s time below the heading", state => {
    const value = "2026-08-21T08:00:00+02:00";
    const item = { ...call, arrivalTimes: [{ kind: state, value }], vesselReportedTimes: { arrival: "2026-08-21T08:15:00+02:00" } };
    const html = renderToStaticMarkup(createElement(TimeCard, { call: item, type: "arrival", locale: "da" }));
    expect(html.match(new RegExp(`dateTime="${value.replaceAll("+", "\\+")}"`, "g"))).toHaveLength(1);
    expect(html).not.toContain(`<dt>${{ expected: "Forventet", ordered: "Bestilt", actual: "Faktisk" }[state]}</dt>`);
    expect(html).toContain("<dt>Skib</dt>");
  });
  it("orders at exactly two hours, not before, and never reverts after the due time", () => {
    expect(withinBookingWindow("2026-08-21T08:00:01+02:00", now)).toBe(false);
    expect(withinBookingWindow(op.at, now)).toBe(true);
    expect(withinBookingWindow("2026-08-21T05:00:00+02:00", now)).toBe(true);
    expect(withinBookingWindow("invalid", now)).toBe(false);
    const source = { ...mockWatchlistSnapshot, calls: [call] };
    const result = applyBookingWindow(source, now);
    expect(result.calls[0].operations[0].state).toBe("ordered");
    expect(result.calls[0].operations[0].serviceStates).toEqual({ H: "actual", L: "ordered", B: "ordered" });
    expect(result.calls[0].arrivalTimes).toContainEqual({ kind: "ordered", value: op.at });
    expect(source.calls[0].operations[0].state).toBe("expected");
    expect(applyBookingWindow({ ...source, calls: [{ ...call, operations: [{ ...op, state: "actual" }] }] }, now).calls[0].operations[0].state).toBe("actual");
  });
  it("keeps independent service states, names and tug count visible", () => {
    const html = renderToStaticMarkup(createElement(OperationServices, { operation: op, locale: "da" }));
    expect(html).toContain("Trosseføring"); expect(html).toContain("Lods"); expect(html).toContain("Bugserbåd × 3");
    for (const state of ["expected", "ordered", "actual"]) expect(html).toContain(`data-state="${state}"`);
  });
  it("models crane registration, approval and acceptance without treating legacy M as approval", () => {
    expect(cranePresentation("modified", "da").state).toBe("requested");
    expect(cranePresentation("requested", "da").code).toBe("R");
    for (const status of ["approved", "accepted"] as const) {
      expect(cranePresentation(status, "da").code).toBe("V");
      expect(renderToStaticMarkup(createElement(CraneBadge, { status, locale: "da" }))).toContain(`data-crane="${status}"`);
    }
    expect(renderToStaticMarkup(createElement(CraneBadge, { status: "none", locale: "da" }))).toBe("");
  });
  it("persists STUD as work location, filters it, and leaves the real berth unchanged", () => {
    const assistance: PortOperation = { ...op, id: "stud-persistence", type: "assistance", label: "Assistance", workLocation: undefined };
    const studCall = { ...call, operations: [assistance] };
    const key = mobileTaskKey(studCall.id, assistance.id);
    const saved = sanitizeLocalState({ overrides: { [key]: { state: "ordered", workLocation: "stud" } } }, [studCall]);
    const result = mobileTaskData([studCall], [], saved.overrides);
    expect(result.calls[0].operations[0].workLocation).toBe("stud");
    expect(result.calls[0].berth).toBe(studCall.berth);
    expect(filterPortCalls(result.calls, { ...DEFAULT_FILTERS, studOnly: true })).toHaveLength(1);
    expect(filterPortCalls([studCall], { ...DEFAULT_FILTERS, studOnly: true })).toHaveLength(0);
    expect(sanitizeLocalState({ overrides: { [key]: { state: "ordered", workLocation: "bogus" } } }, [studCall]).overrides).toEqual({});
  });
  it("shows real STUD operations in chronological order with registration controls", () => {
    const assistance: PortOperation = { id: "stud-assistance", type: "assistance", label: "Assistance", at: "2026-08-21T08:00:00+02:00", state: "ordered", serviceCodes: ["H"], workLocation: "stud" };
    const arrival: PortOperation = { ...assistance, id: "stud-arrival", type: "arrival", state: "expected", at: "2026-08-21T07:30:00+02:00", serviceCodes: [] };
    const departure: PortOperation = { ...assistance, id: "stud-departure", type: "departure", state: "expected", at: "2026-08-21T16:48:00+02:00", serviceCodes: [] };
    const item = { ...call, workLocation: "stud" as const, operations: [arrival, assistance, departure], arrivalTimes: [{ kind: "expected" as const, value: arrival.at }, { kind: "live" as const, value: "2026-08-21T08:15:00+02:00" }] };
    const mobile = renderToStaticMarkup(createElement(MobileCallList, { calls: [item], allCalls: [item], serviceOrders: [], locale: "da", preset: "office", compact: false, now, pins: [], onPin: noop, onOpen: noop, onBerth: noop, onRegister: noop, onShowMap: noop }));
    expect(mobile).toContain(">STUD<");
    expect(mobile.match(/>STUD</g)).toHaveLength(1);
    expect(mobile).toContain("Assistance");
    expect(mobile).toContain("Live ETA 08:15");
    expect(mobile).toContain('data-mode="arrival"');
    expect(mobile).toContain('data-mode="assistance"');
    expect(mobile).toContain('aria-label="Registrér Ankomst');
    expect(mobile).toContain('aria-label="Registrér Assistance');
    expect(mobile.indexOf('data-mode="arrival"')).toBeLessThan(mobile.indexOf('data-mode="assistance"'));
    expect(mobile).not.toContain("Call afsluttet");
    expect(mobile).not.toContain("Arbejdssted");
    const clickable = renderToStaticMarkup(createElement(MobileCallList, { calls: [item], allCalls: [item], serviceOrders: [], locale: "da", preset: "office", compact: true, now, pins: [], onPin: noop, onOpen: noop, onBerth: noop, onStud: noop, onRegister: noop, onShowMap: noop }));
    expect(clickable).toContain('aria-label="Filtrér STUD"');
    expect(clickable.match(/>STUD</g)).toHaveLength(1);
    expect(clickable).toMatch(/<strong>08:00<\/strong>[\s\S]*?data-services="true"/);

    const detail = renderToStaticMarkup(createElement(CallDetail, { call: item, allCalls: [item], serviceOrders: [], locale: "da", initialTab: "call", onClose: noop, onPin: noop, pinned: false, onAddNote: noop, onRegister: noop, onShowMap: noop }));
    expect(detail).toContain("Arbejdssted");
    expect(detail).toContain("Assistance uden kajplacering.");
    expect(detail).not.toContain("Kaj &amp; placering");
    expect(detail).toMatch(/aria-selected="true"[^>]*>Oversigt<\/button>/);
    expect(detail).not.toContain("data-operation-id=");
    expect(detail).not.toContain("<time");
    const timeline = renderToStaticMarkup(createElement(CallDetail, { call: item, allCalls: [item], serviceOrders: [], locale: "da", initialTab: "timeline", onClose: noop, onPin: noop, pinned: false, onAddNote: noop, onRegister: noop, onShowMap: noop }));
    expect(timeline).toContain(">Handlinger<");
    expect(timeline).not.toContain("Fra ankomst til afgang");
    expect(timeline).toContain('aria-label="Ankomst: Forventet"');
    expect(timeline).toContain('aria-label="Afgang:');
    expect(timeline).toContain("07:30");
  });
  it("shows source B on the timeline and crane times only on the crane tab", () => {
    const item = { ...call, craneStatus: "accepted" as const, vesselReportedTimes: { arrival: "2026-08-21T09:17:00+02:00" }, craneTimes: { start: "2026-08-21T10:23:00+02:00" } };
    const overview = renderToStaticMarkup(createElement(CallDetail, { call: item, allCalls: [item], serviceOrders: [], locale: "da", initialTab: "call", onClose: noop, onPin: noop, pinned: false, onAddNote: noop, onRegister: noop, onShowMap: noop }));
    expect(overview).not.toContain("09:17");
    expect(overview).not.toContain("Kranstart");
    expect(overview).not.toContain("10:23");

    const timeline = renderToStaticMarkup(createElement(CallDetail, { call: item, allCalls: [item], serviceOrders: [], locale: "da", initialTab: "timeline", onClose: noop, onPin: noop, pinned: false, onAddNote: noop, onRegister: noop, onShowMap: noop }));
    for (const text of ["Forventet", "<dt>Skib</dt>", "09:17"]) expect(timeline).toContain(text);
    expect(timeline.match(/<dt>Skib<\/dt>/g)).toHaveLength(1);
    expect(timeline).not.toContain("Kranstart");

    const crane = renderToStaticMarkup(createElement(CallDetail, { call: item, allCalls: [item], serviceOrders: [], locale: "da", initialTab: "crane", onClose: noop, onPin: noop, pinned: false, onAddNote: noop, onRegister: noop, onShowMap: noop }));
    expect(crane).toContain("Kranstart");
    expect(crane).toContain("10:23");
    expect(crane).not.toContain("09:17");
    for (const html of [overview, timeline, crane]) for (const text of ["Tid A", "Tid B", "Tid C"]) expect(html).not.toContain(text);
  });
  it.each([false, true])("prioritizes arrival before completion and departure afterwards (arrived=%s)", arrived => {
    const item = { ...call, operations: [op, { ...op, id: "departure-test", type: "departure" as const }], status: arrived ? "arrived" as const : "expected" as const, arrivalTimes: [{ kind: arrived ? "actual" as const : "expected" as const, value: op.at }] };
    const html = renderToStaticMarkup(createElement(MobileCallList, { calls: [item], allCalls: [item], serviceOrders: [], locale: "da", preset: "office", compact: true, now, pins: [], onPin: noop, onOpen: noop, onBerth: noop, onRegister: noop, onShowMap: noop }));
    expect(html.includes(`Registrér Ankomst for ${call.vesselName}:`)).toBe(!arrived);
    expect(html).toContain(`${call.loaMeters} m`);
    expect(html).toContain(`data-focused="${arrived ? "departure" : "arrival"}"`);
  });
});
