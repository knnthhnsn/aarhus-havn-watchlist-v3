import { describe, expect, it } from "vitest";

import {
  mobileTaskData,
  mobileTaskKey,
  mobileTaskOperation,
  mobileTaskOverridesFromOutbox,
  mobileTaskRegistrationTime,
  mobileTaskSwipeIntent,
  mobileTaskState,
  nextMobileTask,
  mobileTaskStorageKey,
  parseMobileTaskAuditLog,
  parseMobileTaskOutbox,
  reconcileMobileTaskAuditLog,
  reconcileMobileTaskOutbox,
  scheduleMobileFeedback,
  settleMobileTaskAuditLog,
  settleMobileTaskOutbox,
  undoMobileTask,
} from "./mobileTask";
import { getNextActionableOperation, getOccupancySegments, getRelevantBerthAssignments, isStudCall, primaryTime, searchPortCalls } from "./watchlist";
import type { CallServiceOrder, PortCall, PortOperation } from "./watchlist";

function operation(id: string, at: string, state: PortOperation["state"] = "expected"): PortOperation {
  return {
    id,
    type: "assistance",
    label: id,
    at,
    state,
    serviceCodes: [],
  };
}

function portCall(id: string, operations: readonly PortOperation[], serviceOrderIds: readonly string[] = [], times: { arrivalTimes?: PortCall["arrivalTimes"]; departureTimes?: PortCall["departureTimes"] } = {}): PortCall {
  return {
    id,
    callNumber: "CALL-1",
    vesselId: "vessel-1",
    vesselName: "Test vessel",
    imo: "IMO0000001",
    callSign: "TEST",
    status: "expected",
    craneStatus: "none",
    berth: "101",
    bollardFrom: 1,
    bollardTo: 2,
    side: "starboard",
    customer: "Customer",
    agent: "Agent",
    category: "General cargo",
    loaMeters: 100,
    beamMeters: 20,
    arrivalTimes: times.arrivalTimes ?? [],
    departureTimes: times.departureTimes ?? [],
    operations,
    notes: [],
    documents: [],
    serviceOrderIds,
    dataQuality: "verified",
    visibility: "public",
  };
}

function serviceOrder(id: string, portCallId: string, operationId?: string): CallServiceOrder {
  return {
    id,
    portCallId,
    operationId,
    dutyCode: "ASSIST",
    displayText: "Assistance",
    scheduledAt: "2026-08-24T08:00:00+02:00",
    quantity: 1,
    status: "expected",
    serviceCode: "H",
  };
}

describe("mobile task simulation helpers", () => {
  it("opens on a rightward swipe and closes on a leftward swipe", () => {
    expect(mobileTaskSwipeIntent(72)).toBe("open");
    expect(mobileTaskSwipeIntent(-72)).toBe("close");
    expect(mobileTaskSwipeIntent(71)).toBeNull();
    expect(mobileTaskSwipeIntent(-71)).toBeNull();
  });

  it("uses a stable call and operation key for local overrides", () => {
    const task = operation("assist-1", "2026-08-24T08:00:00+02:00");
    const key = mobileTaskKey("call-1", task.id);
    const overrides = { [key]: { state: "actual" as const, registeredAt: "2026-08-24T08:05:00+02:00" } };

    expect(key).toBe("call-1::assist-1");
    expect(mobileTaskState("call-1", task, overrides)).toBe("actual");
    expect(mobileTaskRegistrationTime("call-1", task, overrides)).toBe("2026-08-24T08:05:00+02:00");
    expect(mobileTaskState("other-call", task, overrides)).toBe("expected");
  });

  it("advances the next task when the current task is simulated as actual", () => {
    const first = operation("assist-1", "2026-08-24T08:00:00+02:00", "ordered");
    const second = operation("assist-2", "2026-08-24T09:00:00+02:00", "expected");
    const overrides = { [mobileTaskKey("call-1", first.id)]: { state: "actual" as const, registeredAt: "2026-08-24T08:05:00+02:00" } };

    expect(nextMobileTask("call-1", [first, second], overrides, first)).toBe(second);
  });

  it("replaces stale feedback timers and dismisses the ready message", () => {
    type Timer = { callback: () => void; cancelled: boolean };
    const timers = new Map<number, Timer>();
    let nextTimerId = 1;
    const timerApi = {
      setTimeout: (callback: () => void) => {
        const id = nextTimerId++;
        timers.set(id, { callback, cancelled: false });
        return id;
      },
      clearTimeout: (id: number) => {
        const timer = timers.get(id);
        if (timer) timer.cancelled = true;
      },
    };
    const fire = (id: number) => {
      const timer = timers.get(id);
      if (!timer || timer.cancelled) return;
      timer.callback();
    };
    const messages: string[] = [];
    const firstCancel = scheduleMobileFeedback("preparing first", "ready first", (message) => messages.push(message), timerApi);
    expect(messages).toEqual(["preparing first"]);
    firstCancel();
    const secondCancel = scheduleMobileFeedback("preparing second", "ready second", (message) => messages.push(message), timerApi);
    expect(messages).toEqual(["preparing first", "preparing second"]);
    fire(1);
    expect(messages).toEqual(["preparing first", "preparing second"]);
    fire(2);
    expect(messages).toEqual(["preparing first", "preparing second", "ready second"]);
    fire(3);
    expect(messages).toEqual(["preparing first", "preparing second", "ready second", ""]);
    secondCancel();

    const thirdCancel = scheduleMobileFeedback("preparing third", "ready third", (message) => messages.push(message), timerApi);
    thirdCancel();
    fire(4);
    expect(messages).toEqual(["preparing first", "preparing second", "ready second", "", "preparing third"]);
  });

  it("projects a local registration onto the operation while keeping its scheduled time", () => {
    const task = operation("assist-1", "2026-08-24T08:00:00+02:00");
    const registeredAt = "2026-08-24T08:05:00+02:00";
    const projected = mobileTaskOperation("call-1", task, {
      [mobileTaskKey("call-1", task.id)]: { state: "actual", registeredAt },
    });

    expect(projected.at).toBe(task.at);
    expect(projected.state).toBe("actual");
    expect(projected.source).toBe("mobile-override");
    expect(projected.mobileRegisteredAt).toBe(registeredAt);
  });

  it("projects actual arrival time onto legacy fields and removes the live ETA", () => {
    const registeredAt = "2026-08-24T08:05:00+02:00";
    const arrival: PortOperation = {
      id: "arrival-1",
      type: "arrival",
      label: "Arrival",
      at: "2026-08-24T08:00:00+02:00",
      state: "expected",
      serviceCodes: [],
    };
    const call = portCall("call-1", [arrival], [], {
      arrivalTimes: [
        { kind: "expected", value: arrival.at },
        { kind: "live", value: "2026-08-24T08:12:00+02:00" },
      ],
    });
    const projected = mobileTaskData([call], [], {
      [mobileTaskKey(call.id, arrival.id)]: { state: "actual", registeredAt },
    });

    expect(projected.calls[0].operations[0]).toMatchObject({ state: "actual", at: registeredAt, mobileRegisteredAt: registeredAt });
    expect(projected.calls[0].arrivalTimes).toEqual([
      { kind: "actual", value: registeredAt },
      { kind: "expected", value: arrival.at },
    ]);
  });

  it("keeps an explicit STUD lifecycle registrable, chronological and off-quay", () => {
    const arrival: PortOperation = { id: "stud-arrival", type: "arrival", label: "Arrival", at: "2026-08-24T08:00:00+02:00", state: "ordered", workLocation: "stud", serviceCodes: [] };
    const assistance: PortOperation = { id: "stud-assist", type: "assistance", label: "STUD assistance", at: "2026-08-24T08:30:00+02:00", state: "ordered", workLocation: "stud", serviceCodes: ["H"] };
    const departure: PortOperation = { id: "stud-departure", type: "departure", label: "Departure", at: "2026-08-24T12:00:00+02:00", state: "expected", workLocation: "stud", serviceCodes: [] };
    const call: PortCall = {
      ...portCall("stud-call", [arrival, assistance, departure], [], {
        arrivalTimes: [{ kind: "ordered", value: arrival.at }],
        departureTimes: [{ kind: "expected", value: departure.at }],
      }),
      workLocation: "stud",
    };
    const arrivalAt = "2026-08-24T08:12:00+02:00";
    const afterArrival = mobileTaskData([call], [], {
      [mobileTaskKey(call.id, arrival.id)]: { state: "actual", registeredAt: arrivalAt },
    }).calls[0];
    expect(afterArrival.status).toBe("arrived");
    expect(primaryTime(afterArrival.arrivalTimes)).toBe(arrivalAt);
    expect(getNextActionableOperation(afterArrival, "2026-08-24T07:00:00+02:00")?.id).toBe(assistance.id);

    const afterAssistance = mobileTaskData([call], [], {
      [mobileTaskKey(call.id, arrival.id)]: { state: "actual", registeredAt: arrivalAt },
      [mobileTaskKey(call.id, assistance.id)]: { state: "actual", registeredAt: "2026-08-24T08:35:00+02:00", workLocation: "quay" },
    }).calls[0];
    expect(getNextActionableOperation(afterAssistance, "2026-08-24T07:00:00+02:00")?.id).toBe(departure.id);
    expect(afterAssistance.operations.every(operation => operation.workLocation === "stud")).toBe(true);

    const departureAt = "2026-08-24T12:03:00+02:00";
    const completed = mobileTaskData([call], [], {
      [mobileTaskKey(call.id, arrival.id)]: { state: "actual", registeredAt: arrivalAt },
      [mobileTaskKey(call.id, assistance.id)]: { state: "actual", registeredAt: "2026-08-24T08:35:00+02:00" },
      [mobileTaskKey(call.id, departure.id)]: { state: "actual", registeredAt: departureAt },
    }).calls[0];
    expect(completed.status).toBe("departed");
    expect(primaryTime(completed.departureTimes)).toBe(departureAt);
    expect(isStudCall(completed)).toBe(true);
    expect(getRelevantBerthAssignments(completed)).toEqual([]);
    expect(getOccupancySegments(completed)).toEqual([]);
  });

  it("reconciles linked and service-order-only tasks into one effective local snapshot", () => {
    const linkedOperation = operation("assist-1", "2026-08-24T08:00:00+02:00");
    const linkedCall = portCall("call-1", [linkedOperation], ["order-1"]);
    const linkedOrder = serviceOrder("order-1", linkedCall.id, linkedOperation.id);
    const linkedKey = mobileTaskKey(linkedCall.id, linkedOperation.id);
    const linkedData = mobileTaskData([linkedCall], [linkedOrder], {
      [linkedKey]: { state: "actual", registeredAt: "2026-08-24T08:05:00+02:00" },
    });

    expect(linkedData.serviceOrders).toHaveLength(1);
    expect(linkedData.serviceOrders[0]).toMatchObject({ id: "order-1", status: "actual" });
    expect(linkedData.calls[0].operations[0].source).toBe("mobile-override");
    expect(linkedData.calls[0].operations[0].state).toBe("actual");
    expect(searchPortCalls(linkedData.calls, "ASSIST", undefined, linkedData.serviceOrders)).toHaveLength(1);

    const orderOnlyCall = portCall("call-2", [], ["order-2"]);
    const orderOnly = serviceOrder("order-2", orderOnlyCall.id);
    const orderOnlyData = mobileTaskData([orderOnlyCall], [orderOnly], {
      [mobileTaskKey(orderOnlyCall.id, orderOnly.id)]: { state: "ordered" },
    });

    expect(orderOnlyData.serviceOrders).toHaveLength(1);
    expect(orderOnlyData.serviceOrders[0]).toMatchObject({ id: "order-2", status: "ordered" });
    expect(orderOnlyData.calls[0].operations).toHaveLength(1);
    expect(orderOnlyData.calls[0].operations[0]).toMatchObject({ id: "order-2", state: "ordered", source: "mobile-override" });
  });

  it("accepts only valid persisted outbox and audit records", () => {
    const outbox = parseMobileTaskOutbox({
      valid: {
        id: "mobile-1",
        key: "call-1::assist-1",
        callId: "call-1",
        operationId: "assist-1",
        state: "actual",
        registeredAt: "2026-08-24T08:05:00+02:00",
        status: "sent",
        createdAt: "2026-08-24T08:05:00+02:00",
        updatedAt: "2026-08-24T08:05:01+02:00",
      },
      invalid: { id: "bad", callId: "call-2", operationId: "assist-2", state: "not-a-state", status: "sent" },
    });
    expect(Object.keys(outbox)).toEqual(["valid"]);
    expect(mobileTaskOverridesFromOutbox(outbox)).toEqual({
      "call-1::assist-1": { state: "actual", registeredAt: "2026-08-24T08:05:00+02:00" },
    });

    const audit = parseMobileTaskAuditLog([
      { id: "audit-1", key: "call-1::assist-1", callId: "call-1", operationId: "assist-1", label: "Assistance", action: "register", state: "actual", status: "sent", createdAt: "2026-08-24T08:05:01+02:00" },
      { id: "audit-bad", key: "bad", callId: "call-2", operationId: "assist-2", label: "Bad", action: "register", state: "invalid", status: "sent", createdAt: "2026-08-24T08:05:01+02:00" },
    ]);
    expect(audit).toHaveLength(1);
    expect(audit[0].status).toBe("sent");
  });

  it("scopes storage keys, settles pending records, and reconciles removed calls", () => {
    expect(mobileTaskStorageKey("demo-outbox", "harbor")).toBe("demo-outbox.harbor");
    const pendingOutbox = {
      keep: {
        id: "mobile-1",
        key: "call-1::assist-1",
        callId: "call-1",
        operationId: "assist-1",
        state: "actual" as const,
        status: "pending" as const,
        createdAt: "2026-08-24T08:05:00+02:00",
        updatedAt: "2026-08-24T08:05:00+02:00",
      },
      remove: {
        id: "mobile-2",
        key: "call-2::assist-2",
        callId: "call-2",
        operationId: "assist-2",
        state: "expected" as const,
        status: "sent" as const,
        createdAt: "2026-08-24T08:06:00+02:00",
        updatedAt: "2026-08-24T08:06:00+02:00",
      },
    };
    const settled = settleMobileTaskOutbox(pendingOutbox, "2026-08-24T08:10:00+02:00");
    expect(settled.keep).toMatchObject({ status: "sent", updatedAt: "2026-08-24T08:10:00+02:00" });
    expect(reconcileMobileTaskOutbox(settled, new Set(["call-1"]))).toEqual({ keep: settled.keep });

    const audit = settleMobileTaskAuditLog([
      {
        id: "audit-1",
        key: "call-1::assist-1",
        callId: "call-1",
        operationId: "assist-1",
        label: "Assistance",
        action: "register" as const,
        state: "actual" as const,
        status: "pending" as const,
        createdAt: "2026-08-24T08:05:00+02:00",
      },
    ], "2026-08-24T08:10:00+02:00");
    expect(audit[0].status).toBe("sent");
    expect(reconcileMobileTaskAuditLog([...audit, { ...audit[0], id: "audit-2", callId: "call-2" }], new Set(["call-1"]))).toHaveLength(1);
  });

  it("removes a first registration and returns an explicit undo audit", () => {
    const key = mobileTaskKey("call-1", "assist-1");
    const result = undoMobileTask({
      [key]: {
        id: "mobile-1",
        key,
        callId: "call-1",
        operationId: "assist-1",
        state: "actual",
        status: "sent",
        createdAt: "2026-08-24T08:05:00+02:00",
        updatedAt: "2026-08-24T08:05:01+02:00",
      },
    }, {
      key,
      entryId: "mobile-1",
      callId: "call-1",
      operationId: "assist-1",
      operationLabel: "Assistance",
      state: "actual",
      auditId: "mobile-1-audit",
    }, "2026-08-24T08:05:05+02:00");

    expect(result).toBeDefined();
    expect(result?.outbox).toEqual({});
    expect(result?.audit).toMatchObject({ action: "undo", status: "undone", key, state: "actual" });
  });

  it("restores a prior local override and rejects stale undo ids", () => {
    const key = mobileTaskKey("call-1", "assist-1");
    const outbox = {
      [key]: {
        id: "mobile-2",
        key,
        callId: "call-1",
        operationId: "assist-1",
        state: "ordered" as const,
        registeredAt: "2026-08-24T08:07:00+02:00",
        previous: { state: "expected" as const, registeredAt: "2026-08-24T08:06:00+02:00" },
        status: "sent" as const,
        createdAt: "2026-08-24T08:07:00+02:00",
        updatedAt: "2026-08-24T08:07:01+02:00",
      },
    };
    const action = { key, entryId: "mobile-2", callId: "call-1", operationId: "assist-1", operationLabel: "Assistance", state: "ordered" as const, previous: outbox[key].previous, auditId: "mobile-2-audit" };
    const restored = undoMobileTask(outbox, action, "2026-08-24T08:07:05+02:00");
    expect(restored?.outbox[key]).toMatchObject({ state: "expected", registeredAt: "2026-08-24T08:06:00+02:00", status: "sent" });
    expect(undoMobileTask(outbox, { ...action, entryId: "stale" }, "2026-08-24T08:07:05+02:00")).toBeUndefined();
  });
});
