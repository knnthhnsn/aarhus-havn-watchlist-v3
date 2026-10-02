import {
  getArrivalOperation,
  getDepartureOperation,
  sameOperationIdentity,
  type CallServiceOrder,
  type OperationalTime,
  type OperationState,
  type PortCall,
  type PortOperation,
  type ServiceCode,
} from "./watchlist";

export type MobileTaskOverride = {
  workLocation?: "quay" | "stud";
  state: OperationState;
  registeredAt?: string;
  services?: Partial<Record<ServiceCode, OperationState>>;
  tugQuantity?: number;
};

export type MobileTaskOverrideMap = Readonly<Record<string, MobileTaskOverride>>;

export type MobileRegistrationStatus = "pending" | "sent" | "error";

/**
 * Local-only outbox entry. It deliberately describes a simulated handoff;
 * there is no network request or Finance & Operations credential behind it.
 */
export interface MobileTaskOutboxEntry {
  id: string;
  key: string;
  callId: string;
  operationId: string;
  state: OperationState;
  registeredAt?: string;
  previous?: MobileTaskOverride;
  status: MobileRegistrationStatus;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export type MobileTaskOutbox = Readonly<Record<string, MobileTaskOutboxEntry>>;

export type MobileTaskAuditAction = "register" | "undo";

export interface MobileTaskAuditEntry {
  id: string;
  key: string;
  callId: string;
  operationId: string;
  label: string;
  action: MobileTaskAuditAction;
  state: OperationState;
  previousState?: OperationState;
  status: MobileRegistrationStatus | "undone";
  createdAt: string;
}

export type MobileTaskAuditLog = readonly MobileTaskAuditEntry[];

export interface MobileTaskUndoInput {
  key: string;
  entryId: string;
  callId: string;
  operationId: string;
  operationLabel: string;
  state: OperationState;
  previous?: MobileTaskOverride;
  auditId: string;
}

export interface MobileTaskUndoResult {
  outbox: MobileTaskOutbox;
  audit: MobileTaskAuditEntry;
}

export const MOBILE_TASK_OUTBOX_STORAGE_KEY = "aarhus-havn-watchlist-v2.mobile-outbox";
export const MOBILE_TASK_AUDIT_STORAGE_KEY = "aarhus-havn-watchlist-v2.mobile-audit";

export const MOBILE_TASK_STATE_ORDER: readonly OperationState[] = ["actual", "expected", "ordered"];
export const MOBILE_TASK_SWIPE_THRESHOLD = 72;
export const MOBILE_FEEDBACK_READY_DELAY_MS = 260;
export const MOBILE_FEEDBACK_DISMISS_DELAY_MS = 3_000;
export const MOBILE_OUTBOX_SETTLE_DELAY_MS = 720;
export const MOBILE_UNDO_WINDOW_MS = 5_000;

export type MobileTaskSwipeIntent = "open" | "close" | null;

/** A rightward swipe opens the task tray; a leftward swipe closes it. */
export function mobileTaskSwipeIntent(
  deltaX: number,
  threshold = MOBILE_TASK_SWIPE_THRESHOLD,
): MobileTaskSwipeIntent {
  if (deltaX >= threshold) return "open";
  if (deltaX <= -threshold) return "close";
  return null;
}

/**
 * Local demo state is scoped to the fictional access profile. The base keys
 * stay exported for backwards compatibility with existing consumers, while
 * browser storage callers should append the active profile id.
 */
export function mobileTaskStorageKey(baseKey: string, profileId: string): string {
  return `${baseKey}.${profileId}`;
}

export type MobileFeedbackTimerApi = {
  setTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (timer: number) => void;
};

/**
 * Runs the short simulated-registration feedback flow and returns a
 * cancellation function so a newer action can replace every pending timer.
 */
export function scheduleMobileFeedback(
  pending: string,
  ready: string,
  setMessage: (message: string) => void,
  timerApi: MobileFeedbackTimerApi,
): () => void {
  let readyTimer: number | null = null;
  let dismissTimer: number | null = null;
  let cancelled = false;

  setMessage(pending);
  readyTimer = timerApi.setTimeout(() => {
    readyTimer = null;
    if (cancelled) return;
    setMessage(ready);
    dismissTimer = timerApi.setTimeout(() => {
      dismissTimer = null;
      if (cancelled) return;
      setMessage("");
    }, MOBILE_FEEDBACK_DISMISS_DELAY_MS);
  }, MOBILE_FEEDBACK_READY_DELAY_MS);

  return () => {
    cancelled = true;
    if (readyTimer !== null) timerApi.clearTimeout(readyTimer);
    if (dismissTimer !== null) timerApi.clearTimeout(dismissTimer);
    readyTimer = null;
    dismissTimer = null;
  };
}

export function mobileTaskKey(callId: string, operationId: string): string {
  return `${callId}::${operationId}`;
}

export function mobileTaskOverride(
  callId: string,
  operation: PortOperation,
  overrides: MobileTaskOverrideMap,
): MobileTaskOverride | undefined {
  return overrides[mobileTaskKey(callId, operation.id)];
}

export function mobileTaskState(
  callId: string,
  operation: PortOperation,
  overrides: MobileTaskOverrideMap,
): OperationState {
  return mobileTaskOverride(callId, operation, overrides)?.state ?? operation.state;
}

export function mobileTaskRegistrationTime(
  callId: string,
  operation: PortOperation,
  overrides: MobileTaskOverrideMap,
): string | undefined {
  return mobileTaskOverride(callId, operation, overrides)?.registeredAt;
}

/** Apply a local registration; optional jobs keep schedule time, lifecycle jobs use actual time. */
export function mobileTaskOperation(
  callId: string,
  operation: PortOperation,
  overrides: MobileTaskOverrideMap,
): PortOperation {
  const override = mobileTaskOverride(callId, operation, overrides);
  if (!override) return operation;
  const isLifecycleOperation = operation.type === "arrival" || operation.type === "departure";
  const actualAt = override.state === "actual" ? override.registeredAt ?? operation.at : undefined;
  return {
    ...operation,
    ...(actualAt && isLifecycleOperation ? { at: actualAt } : {}),
    state: override.state,
    ...(override.workLocation ? { workLocation: override.workLocation } : {}),
    ...(override.services !== undefined ? {
      serviceStates: { ...override.services },
      serviceCodes: (["H", "L", "B"] as const).filter(code => override.services?.[code]),
      tugQuantity: override.services.B ? override.tugQuantity ?? operation.tugQuantity ?? 1 : undefined,
    } : {}),
    source: "mobile-override",
    mobileRegisteredAt: override.registeredAt,
  };
}

export function mobileTaskOperations(
  callId: string,
  operations: readonly PortOperation[],
  overrides: MobileTaskOverrideMap,
): PortOperation[] {
  return operations.map((operation) => mobileTaskOperation(callId, operation, overrides));
}

function serviceOrderMatchesOperation(operation: PortOperation, order: CallServiceOrder): boolean {
  return operation.id === order.operationId
    || operation.serviceOrderId === order.id
    || (operation.type === "assistance" && operation.at === order.scheduledAt && operation.label === order.displayText);
}

function operationFromServiceOrder(order: CallServiceOrder): PortOperation {
  return {
    id: order.id,
    type: "assistance",
    label: order.displayText,
    at: order.scheduledAt,
    state: order.status,
    serviceCodes: order.serviceCode ? [order.serviceCode] : [],
    tugQuantity: order.serviceCode === "B" ? order.quantity : undefined,
    source: "service-order",
    serviceOrderId: order.id,
  };
}

function projectRegisteredTime(
  times: readonly OperationalTime[],
  operation: PortOperation | undefined,
  overrides: MobileTaskOverrideMap,
  callId: string,
): readonly OperationalTime[] {
  if (!operation) return times;
  const override = mobileTaskOverride(callId, operation, overrides);
  if (!override) return times;
  const previousState = times.some(time => time.kind === "actual") ? "actual" : times.some(time => time.kind === "ordered") ? "ordered" : "expected";
  // Editing services alone must not replace the legacy planned time with live ETA.
  if (override.state !== "actual" && override.state === previousState) return times;
  if (override.state !== "actual") return [
    { kind: override.state, value: operation.at },
    ...times.filter(time => time.kind === "live" || (override.state === "ordered" && time.kind === "expected")),
  ];
  const actualAt = override.registeredAt ?? operation.at;
  return [
    { kind: "actual", value: actualAt },
    ...times.filter((time) => time.kind !== "actual" && time.kind !== "live"),
  ];
}

function projectCallTimes(
  call: PortCall,
  operations: readonly PortOperation[],
  overrides: MobileTaskOverrideMap,
): Pick<PortCall, "arrivalTimes" | "departureTimes"> {
  const operationCall = { ...call, operations };
  return {
    arrivalTimes: projectRegisteredTime(call.arrivalTimes, getArrivalOperation(operationCall), overrides, call.id),
    departureTimes: projectRegisteredTime(call.departureTimes, getDepartureOperation(operationCall), overrides, call.id),
  };
}

/**
 * Build the local view of the snapshot after mobile registrations. Linked
 * service orders remain in the effective snapshot and receive the same local
 * status as their operation. Service-order-only jobs are materialised once on
 * the call while their source order is retained, so list, detail, map,
 * metrics and duty-code search all keep the same simulation context.
 */
export function mobileTaskData(
  calls: readonly PortCall[],
  serviceOrders: readonly CallServiceOrder[],
  overrides: MobileTaskOverrideMap,
): { calls: PortCall[]; serviceOrders: CallServiceOrder[] } {
  const callById = new Map(calls.map((call) => [call.id, call]));
  const extraOperations = new Map<string, PortOperation[]>();
  const effectiveServiceOrders = serviceOrders.flatMap((order) => {
    const call = callById.get(order.portCallId);
    if (!call) return order;
    const linked = call.operations.find((operation) => serviceOrderMatchesOperation(operation, order));
    const key = mobileTaskKey(call.id, linked?.id ?? order.id);
    const override = overrides[key];
    if (override?.services !== undefined && order.serviceCode) {
      const status = override.services[order.serviceCode];
      return status ? [{ ...order, status, ...(order.serviceCode === "B" ? { quantity: override.tugQuantity ?? order.quantity } : {}) }] : [];
    }
    return override ? { ...order, status: override.state } : order;
  });

  serviceOrders.forEach((order) => {
    const call = callById.get(order.portCallId);
    if (!call) return;
    const linked = call.operations.find((operation) => serviceOrderMatchesOperation(operation, order));
    const key = mobileTaskKey(call.id, linked?.id ?? order.id);
    if (!overrides[key]) return;
    if (!linked) {
      const existing = extraOperations.get(call.id) ?? [];
      if (!existing.some((operation) => operation.id === order.id || operation.serviceOrderId === order.id)) {
        existing.push(operationFromServiceOrder(order));
      }
      extraOperations.set(call.id, existing);
    }
  });

  const effectiveCalls = calls.map((call) => {
    const extras = extraOperations.get(call.id) ?? [];
    const operations = [...call.operations, ...extras];
    const effectiveOperations = mobileTaskOperations(call.id, operations, overrides).map((operation) => call.workLocation === "stud"
      ? {
          ...operation,
          workLocation: "stud" as const,
          placement: undefined,
          berth: undefined,
          bollardFrom: undefined,
          bollardTo: undefined,
          side: undefined,
        }
      : operation);
    const projectedTimes = projectCallTimes(call, effectiveOperations, overrides);
    const operationCall = { ...call, operations: effectiveOperations };
    const status = getDepartureOperation(operationCall)?.state === "actual"
      ? "departed" as const
      : getArrivalOperation(operationCall)?.state === "actual"
        ? "arrived" as const
        : call.status;
    return {
      ...call,
      status,
      operations: effectiveOperations,
      ...projectedTimes,
    };
  });

  return {
    calls: effectiveCalls,
    serviceOrders: effectiveServiceOrders,
  };
}

/** Settle a persisted pending registration deterministically on reload. */
export function settleMobileTaskOutbox(
  outbox: MobileTaskOutbox,
  settledAt: string,
): MobileTaskOutbox {
  let changed = false;
  const next = Object.fromEntries(Object.entries(outbox).map(([key, entry]) => {
    if (entry.status !== "pending") return [key, entry];
    changed = true;
    return [key, { ...entry, status: "sent" as const, updatedAt: settledAt, error: undefined }];
  }));
  return changed ? next : outbox;
}

/** Keep the audit trail aligned with the deterministic outbox settlement. */
export function settleMobileTaskAuditLog(
  auditLog: MobileTaskAuditLog,
  settledAt: string,
): MobileTaskAuditEntry[] {
  let changed = false;
  const next = auditLog.map((entry) => {
    if (entry.status !== "pending") return entry;
    changed = true;
    return { ...entry, status: "sent" as const, createdAt: entry.createdAt || settledAt };
  });
  return changed ? next : [...auditLog];
}

/** Reconcile demo registrations after a refresh without leaking stale call ids. */
export function reconcileMobileTaskOutbox(
  outbox: MobileTaskOutbox,
  callIds: ReadonlySet<string>,
): MobileTaskOutbox {
  let changed = false;
  const next = Object.fromEntries(Object.entries(outbox).filter(([, entry]) => {
    const keep = callIds.has(entry.callId);
    if (!keep) changed = true;
    return keep;
  }));
  return changed ? next : outbox;
}

export function reconcileMobileTaskAuditLog(
  auditLog: MobileTaskAuditLog,
  callIds: ReadonlySet<string>,
): MobileTaskAuditEntry[] {
  const next = auditLog.filter((entry) => callIds.has(entry.callId));
  return next.length === auditLog.length ? [...auditLog] : next;
}

export function mobileTaskOverridesFromOutbox(outbox: MobileTaskOutbox): MobileTaskOverrideMap {
  return Object.fromEntries(Object.values(outbox).map((entry) => [entry.key, {
    state: entry.state,
    ...(entry.registeredAt ? { registeredAt: entry.registeredAt } : {}),
  }]));
}

/**
 * Roll back the latest local registration only when the outbox still points at
 * the same entry. This protects a newer registration for the same task from an
 * older Undo click and always returns the matching audit record.
 */
export function undoMobileTask(
  outbox: MobileTaskOutbox,
  action: MobileTaskUndoInput,
  createdAt: string,
): MobileTaskUndoResult | undefined {
  const currentEntry = outbox[action.key];
  if (!currentEntry || currentEntry.id !== action.entryId) return undefined;

  const nextOutbox = { ...outbox };
  if (action.previous) {
    const restored: MobileTaskOutboxEntry = {
      ...currentEntry,
      state: action.previous.state,
      status: "sent",
      updatedAt: createdAt,
      error: undefined,
      ...(action.previous.registeredAt ? { registeredAt: action.previous.registeredAt } : {}),
    };
    if (!action.previous.registeredAt) delete restored.registeredAt;
    nextOutbox[action.key] = restored;
  } else {
    delete nextOutbox[action.key];
  }

  return {
    outbox: nextOutbox,
    audit: {
      id: `${action.auditId}-undo`,
      key: action.key,
      callId: action.callId,
      operationId: action.operationId,
      label: action.operationLabel,
      action: "undo",
      state: action.state,
      ...(action.previous ? { previousState: action.previous.state } : {}),
      status: "undone",
      createdAt,
    },
  };
}

function isOperationState(value: unknown): value is OperationState {
  return value === "actual" || value === "expected" || value === "ordered";
}

function isRegistrationStatus(value: unknown): value is MobileRegistrationStatus {
  return value === "pending" || value === "sent" || value === "error";
}

function parseOverride(value: unknown): MobileTaskOverride | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<MobileTaskOverride>;
  if (!isOperationState(candidate.state)) return undefined;
  return {
    state: candidate.state,
    ...(typeof candidate.registeredAt === "string" ? { registeredAt: candidate.registeredAt } : {}),
  };
}

export function parseMobileTaskOutbox(value: unknown): MobileTaskOutbox {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries: [string, MobileTaskOutboxEntry][] = [];
  Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
    if (!raw || typeof raw !== "object") return;
    const candidate = raw as Partial<MobileTaskOutboxEntry>;
    if (typeof candidate.id !== "string" || typeof candidate.callId !== "string" || typeof candidate.operationId !== "string" || !isOperationState(candidate.state) || !isRegistrationStatus(candidate.status) || typeof candidate.createdAt !== "string" || typeof candidate.updatedAt !== "string") return;
    const previous = parseOverride(candidate.previous);
    entries.push([key, {
      id: candidate.id,
      key: typeof candidate.key === "string" ? candidate.key : key,
      callId: candidate.callId,
      operationId: candidate.operationId,
      state: candidate.state,
      ...(typeof candidate.registeredAt === "string" ? { registeredAt: candidate.registeredAt } : {}),
      ...(previous ? { previous } : {}),
      status: candidate.status,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
      ...(typeof candidate.error === "string" ? { error: candidate.error } : {}),
    }]);
  });
  return Object.fromEntries(entries);
}

export function parseMobileTaskAuditLog(value: unknown): MobileTaskAuditEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((raw): raw is MobileTaskAuditEntry => {
    if (!raw || typeof raw !== "object") return false;
    const candidate = raw as Partial<MobileTaskAuditEntry>;
    return typeof candidate.id === "string"
      && typeof candidate.key === "string"
      && typeof candidate.callId === "string"
      && typeof candidate.operationId === "string"
      && typeof candidate.label === "string"
      && (candidate.action === "register" || candidate.action === "undo")
      && isOperationState(candidate.state)
      && (candidate.previousState === undefined || isOperationState(candidate.previousState))
      && (candidate.status === "pending" || candidate.status === "sent" || candidate.status === "error" || candidate.status === "undone")
      && typeof candidate.createdAt === "string";
  }).slice(0, 40);
}

/** Finds the first non-actual task while respecting the stable call/operation key. */
export function nextMobileTask(
  callId: string,
  operations: readonly PortOperation[],
  overrides: MobileTaskOverrideMap,
  sourceNext?: PortOperation,
): PortOperation | undefined {
  const sourceMatch = sourceNext && operations.find((operation) => sameOperationIdentity(operation, sourceNext));
  if (sourceMatch && mobileTaskState(callId, sourceMatch, overrides) !== "actual") return sourceMatch;
  return operations.find((operation) => mobileTaskState(callId, operation, overrides) !== "actual");
}
