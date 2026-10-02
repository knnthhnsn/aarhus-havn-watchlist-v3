import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mockWatchlistSnapshot } from "@/data/mockWatchlist";
import { getNextActionableOperation, type PortCall } from "@/lib/watchlist";
import { MobileCallList } from "./MobileCallList";
import { PinButton, PinIndicator } from "./PinControl";
import { StateLabel } from "./StateLabel";
import { ScheduleTable } from "./ScheduleTable";
import { CallDetail } from "./CallDetail";

const noop = () => {};
const call = mockWatchlistSnapshot.calls.find(item => item.vesselName === "Meridian Kestrel")!;
const shared = { calls: [call], allCalls: [call], serviceOrders: mockWatchlistSnapshot.serviceOrders, locale: "da" as const, now: "2026-08-21T06:40:00+02:00", pins: [call.id], onPin: noop, onOpen: noop, onBerth: noop };

describe("recognizable interaction states", () => {
  it.each([false, true])("shows Office vessel identifiers only at normal density (compact=%s)", compact => {
    const html = renderToStaticMarkup(createElement(ScheduleTable, { ...shared, preset: "office", columns: ["vessel", "crane"], compact, sort: "vessel", direction: "asc", onSort: noop }));
    expect(html.includes(`Ksign ${call.callSign}`)).toBe(!compact);
    expect(html.includes(`IMO ${call.imo}`)).toBe(!compact);
  });
  it("includes the six-digit Call in vessel particulars", () => {
    const html = renderToStaticMarkup(createElement(CallDetail, { call, allCalls: [call], serviceOrders: [], locale: "da", initialTab: "vessel", pinned: false, onClose: noop, onPin: noop, onAddNote: noop, onRegister: noop, onShowMap: noop }));
    expect(html).toContain(`<dt>Call</dt><dd>${call.callNumber}</dd>`);
  });
  it.each(["none", "requested", "modified", "approved"] as const)("shows crane %s in the dedicated crane tab", craneStatus => {
    const html = renderToStaticMarkup(createElement(CallDetail, { call: { ...call, craneStatus }, allCalls: [call], serviceOrders: [], locale: "da", initialTab: "crane", pinned: false, onClose: noop, onPin: noop, onAddNote: noop, onRegister: noop, onShowMap: noop }));
    const crane = html.indexOf(`data-crane="${craneStatus === "modified" ? "requested" : craneStatus}"`);
    if (craneStatus === "none") {
      expect(crane).toBe(-1);
      expect(html).not.toContain("Krankode:");
      return;
    }
    expect(crane).toBeGreaterThan(-1);
    expect(crane).toBeGreaterThan(html.indexOf("Operationer og service"));
    expect(html).not.toContain("Kranbestilling</dt>");
    expect(html).toContain('aria-label="Kran:');
  });
  it.each([true, false])("fills normal mobile with departure while compact prioritizes next work (compact=%s)", compact => {
    const html = renderToStaticMarkup(createElement(MobileCallList, { ...shared, compact, preset: "office", onRegister: noop, onShowMap: noop }));
    expect(html).toContain("Registrér Ankomst for Meridian Kestrel:");
    expect(html.includes("Registrér Afgang for Meridian Kestrel:")).toBe(!compact);
    expect(html).toContain('aria-label="Åbn detaljer for Meridian Kestrel"');
    expect(html).toContain("Stryg højre: registrering");
    const protectedHtml = renderToStaticMarkup(createElement(MobileCallList, { ...shared, calls: [{ ...call, visibility: "restricted" }], compact, preset: "office", onRegister: noop, onShowMap: noop }));
    expect(protectedHtml).not.toContain("Registrér Ankomst for");
    expect(protectedHtml).not.toContain("Registrér Afgang for");
  });
  it("uses unbroken side/crane codes and pins-first signals-last table ordering", () => {
    const markup = renderToStaticMarkup(createElement(ScheduleTable, { ...shared, columns: ["vessel", "signal", "side", "crane", "callSign", "pin"], compact: false, sort: "vessel", direction: "asc", onSort: noop }));
    const headers = [...markup.matchAll(/<th[^>]*data-column="([^"]+)"/g)].map(match => match[1]);
    expect(headers).toEqual(["pin", "vessel", "side", "crane", "callSign", "signal"]);
    expect(markup).toContain('data-info="BB · Bagbord">BB</abbr>');
    expect(markup).toContain('>Ksign<');
    expect(markup).not.toContain('<span>Modificeret</span>');
    expect(markup).toContain('aria-label="Kran: Registreret"');
  });
  it.each([false, true])("exposes pin action, pressed state and visible label (pinned=%s)", pinned => {
    const markup = renderToStaticMarkup(createElement(PinButton, { pinned, locale: "da", vesselName: call.vesselName, showLabel: true, onClick: noop }));
    expect(markup).toContain(`data-pinned="${pinned}" aria-pressed="${pinned}"`);
    expect(markup).toContain(`aria-label="${pinned ? "Frigør" : "Fastgør"} ${call.vesselName}"`);
    expect(markup).toContain(`>${pinned ? "Fastgjort" : "Fastgør"}</span>`);
    // The active icon includes a check as a non-colour cue.
    expect(markup.match(/<svg/g)).toHaveLength(pinned ? 2 : 1);
  });

  it("exposes the compact pinned indicator without pretending it is a button", () => {
    const markup = renderToStaticMarkup(createElement(PinIndicator, { locale: "en", vesselName: call.vesselName }));
    expect(markup).toContain(`role="img" aria-label="${call.vesselName} is pinned"`);
    expect(markup).not.toContain("<button");
  });

  it.each(["expected", "ordered", "actual", "arrived", "en-route", "departed", "live"] as const)("pairs the filled %s surface with readable text, not a dot", state => {
    const markup = renderToStaticMarkup(<StateLabel state={state}>{state}</StateLabel>);
    expect(markup).toContain(`data-state="${state}">${state}</span>`);
    expect(markup).not.toContain("<i");
  });
});

describe("task-first mobile cards", () => {
  const mobile = (compact: boolean, overrides: Partial<PortCall> = {}) => renderToStaticMarkup(createElement(MobileCallList, { ...shared, calls: [{ ...call, ...overrides }], compact, preset: "office", onRegister: noop, onShowMap: noop }));

  it.each([false, true])("does not fill unused operational space with repeated contact information (compact=%s)", compact => {
    const html = mobile(compact, { operations: call.operations.filter(op => op.type === "arrival" || op.type === "departure") });
    expect(html).toContain('data-single="false"');
    expect(html).not.toContain('data-focus-info="contact"');
    expect(html).not.toContain('Kontaktoplysninger for');
    expect(html).toContain('data-mode="arrival"');
    expect(html).toContain('data-mode="departure"');
  });

  it.each(["office", "full", "port"] as const)("omits absent crane information from %s mobile views", preset => {
    for (const compact of [false, true]) {
      const html = renderToStaticMarkup(createElement(MobileCallList, { ...shared, calls: [{ ...call, craneStatus: "none" }], compact, preset, onRegister: noop, onShowMap: noop }));
      expect(html).not.toContain("Ingen kran");
      expect(html).not.toContain('data-crane="none"');
    }
  });

  it("shows the next operation as a complete status-coloured task and direct registration action", () => {
    const next = getNextActionableOperation(call, shared.now, shared.serviceOrders)!;
    const markup = mobile(false);
    const summary = markup.match(/<article\b[\s\S]*?<\/article>/)?.[0] ?? "";
    expect(summary).toContain(`data-state="${next.state}"`);
    expect(summary).toContain("Næste opgave");
    expect(summary).toContain(`aria-label="Registrér Ankring for ${call.vesselName}"`);
    expect(summary).toContain('data-pin-control="true"');
    expect(summary).toContain("Fastgjort");
    // A fresh card never renders an already-open confirmation.
    expect(markup).not.toContain("Ja, registrér");
  });

  it("keeps compact summaries short while exposing pinned state outside the hidden tray", () => {
    const summary = mobile(true).match(/<article\b[\s\S]*?<\/article>/)?.[0] ?? "";
    expect(summary).toContain('data-pin-indicator="true"');
    expect(summary).not.toContain('data-pin-control');
    expect(summary).toContain(`aria-label="Registrér Ankring for ${call.vesselName}:`);
    expect(summary).toContain('data-mode="anchorage"');
    expect(summary).not.toContain('data-compact-next="true"');
    expect(summary).toContain("Alle tider");
  });

  it("does not repeat the next task or show an empty tasks disclosure on normal mobile cards", () => {
    const markup = mobile(false);
    expect(markup.match(/aria-label="Registrér Ankring for Meridian Kestrel"/g)).toHaveLength(1);
    expect(markup).not.toContain('aria-label="Vis 1 operationer for Meridian Kestrel"');
    expect(markup).not.toContain('aria-label="Operationer for Meridian Kestrel"');
    expect(mobile(true)).not.toContain('aria-label="Vis 1 operationer for Meridian Kestrel"');
    expect(mobile(true).match(/aria-label="Registrér Ankring for Meridian Kestrel:/g)).toHaveLength(1);
  });

  it("does not expose registration on protected calls", () => {
    const markup = mobile(false, { visibility: "restricted" });
    expect(markup).not.toContain('aria-label="Registrér');
    expect(markup).not.toContain(">Registrér</span>");
    expect(markup).toContain("kun visning");
  });

  it.each([false, true])("opens the map directly without a More menu (compact=%s)", compact => {
    const markup = mobile(compact);
    const tray = markup.slice(markup.indexOf('role="region"'));
    expect(tray).not.toContain("Redigér operationer og service");
    expect(tray).not.toContain("Registrér ankring");
    expect(markup).toContain('aria-label="Vis på kort: Meridian Kestrel"');
    expect(markup).not.toContain(">Mere<");
    expect(tray).not.toContain(">Kort<");
    expect(tray).not.toContain(">Detaljer<");
  });

  it("fills each desktop operation rather than only colouring a small label", () => {
    const markup = renderToStaticMarkup(createElement(ScheduleTable, { ...shared, columns: ["pin", "operations"], compact: false, sort: "job-order", direction: "asc", onSort: noop }));
    expect(markup).toMatch(/<button[^>]*data-state="expected"/);
    expect(markup).toContain('data-pinned="true" aria-pressed="true"');
  });
});
