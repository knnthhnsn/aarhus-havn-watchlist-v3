import { describe, expect, it } from "vitest";
import { mobileTaskKey } from "@/lib/mobileTask";
import { getArrivalOperation, getDepartureOperation, type PortCall, type PortCallNote, type PortOperation } from "@/lib/watchlist";
import { sanitizeLocalState } from "./localState";

const at = "2026-08-21T07:00:00+02:00";
const note: PortCallNote = { id: "note-1", text: "Confirm the mooring arrangement.", authorRole: "Coordinator", createdAt: at };

function makeCall(id: string, visibility: PortCall["visibility"] = "public"): PortCall {
  const operation = (type: PortOperation["type"]): PortOperation => ({ id: `${id}-${type}`, type, label: type, at, state: "ordered", serviceCodes: [] });
  return {
    id, callNumber: id, vesselId: `${id}-vessel`, vesselName: "Test vessel", imo: "9300001", callSign: "TEST",
    status: "expected", craneStatus: "none", berth: "110", bollardFrom: 1, bollardTo: 9, side: "port",
    customer: "Customer", agent: "Agent", category: "General cargo", loaMeters: 100, beamMeters: 20,
    arrivalTimes: [{ kind: "ordered", value: at }], departureTimes: [{ kind: "expected", value: at }],
    operations: [operation("arrival"), operation("assistance"), operation("departure")], notes: [], documents: [],
    serviceOrderIds: [`${id}-standalone-order`], dataQuality: "verified", visibility,
  };
}

describe("V3 local state visibility reconciliation", () => {
  it("retains valid public notes and operation overrides without mutating input", () => {
    const call = makeCall("public-a");
    const key = mobileTaskKey(call.id, call.operations[1].id);
    const source = {
      pins: [call.id, call.id],
      notes: { [call.id]: [{ ...note, unusedPrivatePayload: "discard me" }] },
      overrides: { [key]: { state: "actual", registeredAt: at, privateMetadata: "discard me" } },
    };
    const before = structuredClone(source);
    const result = sanitizeLocalState(source, [call]);
    expect(result).toEqual({ pins: [call.id], notes: { [call.id]: [note] }, overrides: { [key]: { state: "actual", registeredAt: at } } });
    expect(source).toEqual(before);
    expect(result.notes[call.id][0]).not.toBe(source.notes[call.id][0]);
    expect(result.overrides[key]).not.toBe(source.overrides[key]);
  });

  it("removes invisible calls, restricted calls and unknown/cross-call operation ids", () => {
    const publicCall = makeCall("visible");
    const restricted = makeCall("restricted", "restricted");
    const hidden = makeCall("not-in-snapshot");
    const validKey = mobileTaskKey(publicCall.id, publicCall.operations[0].id);
    const result = sanitizeLocalState({
      pins: [hidden.id, restricted.id, publicCall.id, 42],
      notes: { [hidden.id]: [note], [restricted.id]: [note], [publicCall.id]: [note] },
      overrides: {
        [validKey]: { state: "actual" },
        [mobileTaskKey(restricted.id, restricted.operations[0].id)]: { state: "actual" },
        [mobileTaskKey(hidden.id, hidden.operations[0].id)]: { state: "actual" },
        [mobileTaskKey(publicCall.id, restricted.operations[0].id)]: { state: "actual" },
        [mobileTaskKey(publicCall.id, "no-such-operation")]: { state: "actual" },
      },
    }, [publicCall, restricted]);
    expect(result).toEqual({ pins: [publicCall.id], notes: { [publicCall.id]: [note] }, overrides: { [validKey]: { state: "actual" } } });
  });

  it("cannot persist restricted identifiers through public → restricted → public snapshots", () => {
    const publicCall = makeCall("public-a");
    const restricted = makeCall("protected-b", "restricted");
    const publicKey = mobileTaskKey(publicCall.id, publicCall.operations[0].id);
    const protectedKey = mobileTaskKey(restricted.id, restricted.operations[0].id);
    const initial = sanitizeLocalState({ pins: [publicCall.id], notes: { [publicCall.id]: [note] }, overrides: { [publicKey]: { state: "actual", registeredAt: at } } }, [publicCall]);
    const whileRestricted = sanitizeLocalState({
      pins: [...initial.pins, restricted.id],
      notes: { ...initial.notes, [restricted.id]: [{ ...note, id: "protected-note" }] },
      overrides: { ...initial.overrides, [protectedKey]: { state: "actual", registeredAt: at } },
    }, [publicCall, restricted]);
    const returned = sanitizeLocalState(JSON.parse(JSON.stringify(whileRestricted)), [publicCall]);
    expect(whileRestricted).toEqual(initial);
    expect(returned).toEqual(initial);
    expect(JSON.stringify(whileRestricted)).not.toContain(restricted.id);
    expect(JSON.stringify(returned)).not.toContain("protected-note");
  });

  it("revokes a previously public record and does not resurrect it after visibility changes back", () => {
    const original = makeCall("visibility-changes");
    const initial = sanitizeLocalState({ pins: [original.id], notes: { [original.id]: [note] }, overrides: { [mobileTaskKey(original.id, original.operations[0].id)]: { state: "actual" } } }, [original]);
    const revoked = sanitizeLocalState(initial, [{ ...original, visibility: "restricted" }]);
    const restored = sanitizeLocalState(revoked, [original]);
    expect(revoked).toEqual({ pins: [], notes: {}, overrides: {} });
    expect(restored).toEqual(revoked);
  });

  it("keeps normalized arrival/departure keys and public standalone service-order tasks", () => {
    const call = makeCall("public-a");
    const arrival = getArrivalOperation(call)!;
    const departure = getDepartureOperation(call)!;
    const keys = [arrival.id, departure.id, call.serviceOrderIds[0]].map(id => mobileTaskKey(call.id, id));
    const overrides = Object.fromEntries(keys.map(key => [key, { state: "actual", registeredAt: at }]));
    expect(sanitizeLocalState({ overrides }, [call]).overrides).toEqual(overrides);
  });

  it("removes stale operation ids when the public call remains but its plan changes", () => {
    const original = makeCall("public-a");
    const retained = original.operations[0];
    const removed = original.operations[1];
    const oldOrder = original.serviceOrderIds[0];
    const changed = { ...original, operations: [retained], serviceOrderIds: [] };
    const source = { overrides: Object.fromEntries([retained.id, removed.id, oldOrder].map(id => [mobileTaskKey(original.id, id), { state: "expected" }])) };
    expect(sanitizeLocalState(source, [changed]).overrides).toEqual({ [mobileTaskKey(original.id, retained.id)]: { state: "expected" } });
  });

  it("rejects malformed note fields while retaining valid note siblings and original text", () => {
    const call = makeCall("public-a");
    const spaced = { ...note, text: "  Keep this exact wording.\n" };
    const badNotes = [null, {}, { ...note, id: 3 }, { ...note, text: [] }, { ...note, authorRole: undefined }, { ...note, createdAt: "not-a-date" }];
    const result = sanitizeLocalState({ notes: { [call.id]: [...badNotes, spaced, spaced] } }, [call]);
    expect(result.notes).toEqual({ [call.id]: [spaced] });
  });

  it("rejects malformed override states and dates", () => {
    const call = makeCall("public-a");
    const key = mobileTaskKey(call.id, call.operations[0].id);
    for (const invalid of [null, [], {}, { state: "done" }, { state: "actual", registeredAt: 42 }, { state: "actual", registeredAt: "not-a-date" }]) {
      expect(sanitizeLocalState({ overrides: { [key]: invalid } }, [call]).overrides).toEqual({});
    }
    for (const state of ["actual", "ordered", "expected"]) {
      expect(sanitizeLocalState({ overrides: { [key]: { state } } }, [call]).overrides).toEqual({ [key]: { state } });
    }
  });

  it("denies ambiguous visibility and an empty allowed snapshot", () => {
    const call = makeCall("duplicate-id");
    const source = { pins: [call.id], notes: { [call.id]: [note] }, overrides: { [mobileTaskKey(call.id, call.operations[0].id)]: { state: "actual" } } };
    expect(sanitizeLocalState(source, [call, { ...call, visibility: "restricted" }])).toEqual({ pins: [], notes: {}, overrides: {} });
    expect(sanitizeLocalState(source, [])).toEqual({ pins: [], notes: {}, overrides: {} });
  });

  it("accepts untrusted storage shapes without coercing them into records", () => {
    const call = makeCall("public-a");
    for (const source of [undefined, null, [], 0, "stored", { pins: {}, notes: [], overrides: [] }]) {
      expect(sanitizeLocalState(source, [call])).toEqual({ pins: [], notes: {}, overrides: {} });
    }
  });
});
