import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { mockWatchlistSnapshot } from "@/data/mockWatchlist";
import { mobileTaskData, mobileTaskKey, type MobileTaskOverride } from "@/lib/mobileTask";
import { getArrivalOperation, getNextActionableOperation, isStudCall, primaryTime, type CallServiceOrder, type PortOperation } from "@/lib/watchlist";
import { OperationRegistration, registrationServices, registrationTime, registrationWorkLocation } from "./OperationRegistration";
import { sanitizeLocalState } from "./localState";

const operation: PortOperation = { id: "arrival-test", type: "arrival", label: "Ankomst", at: "2026-08-21T08:00:00+02:00", state: "ordered", serviceCodes: ["H", "B"], tugQuantity: 2 };
const call = { ...mockWatchlistSnapshot.calls[0], visibility: "public" as const, operations: [operation], arrivalTimes: [{ kind: "ordered" as const, value: operation.at }] };
const key = mobileTaskKey(call.id, operation.id);

describe("per-operation registration", () => {
  it("uses the same planned time as the card instead of live ETA in both registration labels", () => {
    const planned = "2026-08-21T08:15:00+02:00";
    const source = { ...call, arrivalTimes: [{ kind: "ordered" as const, value: planned }, { kind: "live" as const, value: operation.at }] };
    expect(registrationTime(operation, source)).toBe(planned);
    const html = renderToStaticMarkup(createElement(OperationRegistration, { call: source, operations: [operation], initialOperation: operation, locale: "da", onSave: vi.fn(), onCancel: vi.fn() }));
    expect(html.match(/08:15/g)).toHaveLength(2);
    expect(html).not.toContain("08:00");
    expect(operation.at).toBe("2026-08-21T08:00:00+02:00");
  });
  it("retains actual-time priority, departure timing, and other operations' own timestamps", () => {
    const actual = "2026-08-21T08:20:00+02:00";
    expect(registrationTime(operation, { ...call, arrivalTimes: [...call.arrivalTimes, { kind: "actual", value: actual }] })).toBe(actual);
    expect(registrationTime({ ...operation, type: "departure" }, { ...call, departureTimes: [{ kind: "ordered", value: actual }] })).toBe(actual);
    expect(registrationTime({ ...operation, type: "anchorage" }, call)).toBe(operation.at);
    expect(registrationTime(operation, { ...call, arrivalTimes: [] })).toBe(operation.at);
  });
  it("initializes legacy services without silently completing them", () => {
    expect(registrationServices(operation)).toEqual({ H: "ordered", B: "ordered" });
    expect(registrationServices({ ...operation, serviceStates: { H: "actual", B: "expected" } })).toEqual({ H: "actual", B: "expected" });
  });
  it("renders all three status choices and all supported service toggles", () => {
    const html = renderToStaticMarkup(createElement(OperationRegistration, { call, operations: [operation], initialOperation: operation, locale: "da", onSave: vi.fn(), onCancel: vi.fn() }));
    for (const label of ["Forventet", "Bestilt", "Faktisk", "Trosseføring", "Lods", "Bugserbåd", "Gem registrering"]) expect(html).toContain(label);
    expect(html).not.toMatch(/Prototype|prototypens|Ingen bestilling sendes/);
    expect(html.match(/type="radio"/g)).toHaveLength(9);
    expect(html).not.toContain("Registrér som udført?");
    expect(html).not.toContain("STUD");
    expect(html).not.toContain("Arbejdssted");
  });
  it("offers STUD only while registering assistance", () => {
    const assistance = { ...operation, id: "assistance-test", type: "assistance" as const, label: "Assistance" };
    const assistanceCall = { ...call, operations: [assistance] };
    const html = renderToStaticMarkup(createElement(OperationRegistration, { call: assistanceCall, operations: [assistance], initialOperation: assistance, locale: "da", onSave: vi.fn(), onCancel: vi.fn() }));
    expect(html).toContain("Arbejdssted");
    expect(html).toContain("STUD · kørsel ud til skibet");
    for (const type of ["arrival", "departure", "anchorage", "shifting"] as const) {
      const ordinary = { ...operation, id: `${type}-test`, type };
      const ordinaryHtml = renderToStaticMarkup(createElement(OperationRegistration, { call: { ...call, operations: [ordinary] }, operations: [ordinary], initialOperation: ordinary, locale: "da", onSave: vi.fn(), onCancel: vi.fn() }));
      expect(ordinaryHtml).not.toContain("STUD");
      expect(ordinaryHtml).not.toContain("Arbejdssted");
    }
    expect(registrationWorkLocation(assistance, "stud")).toBe("stud");
    expect(registrationWorkLocation(operation, "stud")).toBeUndefined();
    expect(registrationWorkLocation({ ...operation, workLocation: "stud" }, "quay")).toBe("stud");
  });
  it("lists and persists real STUD arrival, assistance and departure registrations", () => {
    const studCall = mockWatchlistSnapshot.calls.find(isStudCall)!;
    const arrival = getArrivalOperation(studCall)!;
    const html = renderToStaticMarkup(createElement(OperationRegistration, { call: studCall, operations: studCall.operations, initialOperation: arrival, locale: "da", onSave: vi.fn(), onCancel: vi.fn() }));
    expect(html).toContain("Ankomst");
    expect(html).toContain("Assistance");
    expect(html).toContain("Afgang");
    expect(html).not.toContain("Arbejdssted");
    expect(registrationWorkLocation(arrival, "quay")).toBe("stud");

    const registeredAt = "2026-08-21T08:12:00+02:00";
    const result = mobileTaskData([studCall], [], {
      [mobileTaskKey(studCall.id, arrival.id)]: { state: "actual", registeredAt },
    }).calls[0];
    expect(result.status).toBe("arrived");
    expect(primaryTime(result.arrivalTimes)).toBe(registeredAt);
    expect(result.operations.find(item => item.id === arrival.id)).toMatchObject({ state: "actual", at: registeredAt, workLocation: "stud" });
    expect(isStudCall(result)).toBe(true);
  });
  it("persists independent service states, quantity and deselection through JSON", () => {
    const value: MobileTaskOverride = { state: "expected", services: { H: "ordered", L: "actual", B: "expected" }, tugQuantity: 3 };
    const saved = sanitizeLocalState(JSON.parse(JSON.stringify({ overrides: { [key]: value } })), [call]);
    expect(saved.overrides[key]).toEqual(value);
    const result = mobileTaskData([call], [], saved.overrides).calls[0];
    expect(result.operations[0]).toMatchObject({ state: "expected", serviceStates: value.services, serviceCodes: ["H", "L", "B"], tugQuantity: 3 });
    expect(result.arrivalTimes[0]).toEqual({ kind: "expected", value: operation.at });
    const disabled = mobileTaskData([call], [], { [key]: { state: "ordered", services: {} } }).calls[0].operations[0];
    expect(disabled.serviceCodes).toEqual([]);
    expect(disabled.tugQuantity).toBeUndefined();
    expect(operation.serviceCodes).toEqual(["H", "B"]);
  });
  it("keeps linked service status independent of the parent operation", () => {
    const order: CallServiceOrder = { id: "order", portCallId: call.id, operationId: operation.id, dutyCode: "H", serviceCode: "H", displayText: "Trosseføring", scheduledAt: operation.at, quantity: 1, status: "ordered" };
    const result = mobileTaskData([call], [order], { [key]: { state: "expected", services: { H: "actual" } } });
    expect(result.serviceOrders[0].status).toBe("actual");
    expect(getNextActionableOperation(result.calls[0], "2026-08-21T06:00:00+02:00", result.serviceOrders)?.state).toBe("expected");
    expect(mobileTaskData([call], [order], { [key]: { state: "ordered", services: {} } }).serviceOrders).toEqual([]);
  });
  it("rejects malformed service state/quantity and never persists protected calls", () => {
    for (const value of [{ state: "expected", services: { H: "done" } }, { state: "ordered", tugQuantity: 0 }, { state: "actual", services: [] }]) {
      expect(sanitizeLocalState({ overrides: { [key]: value } }, [call]).overrides).toEqual({});
    }
    expect(sanitizeLocalState({ overrides: { [key]: { state: "ordered", services: { H: "actual" } } } }, [{ ...call, visibility: "restricted" }]).overrides).toEqual({});
  });
  it("does not replace the planned arrival with live ETA when only services change", () => {
    const planned = "2026-08-21T08:15:00+02:00";
    const source = { ...call, arrivalTimes: [{ kind: "ordered" as const, value: planned }, { kind: "live" as const, value: operation.at }] };
    const result = mobileTaskData([source], [], { [key]: { state: "ordered", services: { H: "actual" } } });
    expect(result.calls[0].arrivalTimes).toEqual(source.arrivalTimes);
  });
});
