import { mobileTaskKey, type MobileTaskOverride, type MobileTaskOverrideMap } from "@/lib/mobileTask";
import { getArrivalOperation, getDepartureOperation, type PortCall, type PortCallNote } from "@/lib/watchlist";

export interface LocalState {
  pins: string[];
  notes: Record<string, PortCallNote[]>;
  overrides: MobileTaskOverrideMap;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isTimestamp(value: unknown): value is string {
  return isNonemptyString(value) && Number.isFinite(Date.parse(value));
}

function readNote(value: unknown): PortCallNote | undefined {
  if (!isRecord(value)
    || !isNonemptyString(value.id)
    || !isNonemptyString(value.text)
    || !isNonemptyString(value.authorRole)
    || !isTimestamp(value.createdAt)) return undefined;
  // Copy the allowed fields only: unknown payload fields must not be persisted.
  return { id: value.id, text: value.text, authorRole: value.authorRole, createdAt: value.createdAt };
}

function readOverride(value: unknown): MobileTaskOverride | undefined {
  if (!isRecord(value) || (value.state !== "actual" && value.state !== "ordered" && value.state !== "expected")) return undefined;
  if (value.registeredAt !== undefined && !isTimestamp(value.registeredAt)) return undefined;
  if (value.workLocation !== undefined && value.workLocation !== "quay" && value.workLocation !== "stud") return undefined;
  const services: NonNullable<MobileTaskOverride["services"]> = {};
  if (value.services !== undefined) {
    if (!isRecord(value.services)) return undefined;
    for (const code of ["H", "L", "B"] as const) {
      const state = value.services[code];
      if (state === undefined) continue;
      if (state !== "expected" && state !== "ordered" && state !== "actual") return undefined;
      services[code] = state;
    }
  }
  if (value.tugQuantity !== undefined && (!Number.isInteger(value.tugQuantity) || Number(value.tugQuantity) < 1 || Number(value.tugQuantity) > 9)) return undefined;
  return { state: value.state, ...(value.workLocation ? { workLocation: value.workLocation as "quay" | "stud" } : {}), ...(value.registeredAt !== undefined ? { registeredAt: value.registeredAt as string } : {}),
    ...(value.services !== undefined ? { services } : {}), ...(value.tugQuantity !== undefined ? { tugQuantity: Number(value.tugQuantity) } : {}) };
}

/**
 * Reconcile browser/in-memory state with the current authoritative call set.
 * Only explicitly public, currently visible calls may contribute persisted ids.
 * Use this on hydration, before applying overrides, and immediately before a
 * storage write. Re-sanitizing on every snapshot prevents a formerly public or
 * visible record from surviving a visibility change in local persistence.
 *
 * This does not authorise persistence of a restricted workspace: the caller
 * must additionally keep its context-wide canPersist guard and clear storage.
 */
export function sanitizeLocalState(raw: unknown, calls: readonly PortCall[]): LocalState {
  const source = isRecord(raw) ? raw : {};
  // Conflicting visibility for the same identifier is denied, rather than
  // allowing a public duplicate to resurrect a restricted record's local data.
  const deniedIds = new Set(calls.filter(call => call.visibility !== "public").map(call => call.id));
  const publicCalls = calls.filter(call => call.visibility === "public" && !deniedIds.has(call.id));
  const allowedCalls = new Set(publicCalls.map(call => call.id));
  const allowedTasks = new Set<string>();
  for (const call of publicCalls) {
    const operations = [...call.operations, getArrivalOperation(call), getDepartureOperation(call)];
    for (const operation of operations) {
      if (operation) allowedTasks.add(mobileTaskKey(call.id, operation.id));
    }
    // The next actionable item can be an order-only task, whose operation id
    // is the service order id until mobileTaskData materialises the operation.
    for (const orderId of call.serviceOrderIds) allowedTasks.add(mobileTaskKey(call.id, orderId));
  }

  const pins = Array.isArray(source.pins)
    ? [...new Set(source.pins.filter((id): id is string => typeof id === "string" && allowedCalls.has(id)))]
    : [];

  const notes = Object.fromEntries(isRecord(source.notes) ? Object.entries(source.notes).flatMap(([callId, values]) => {
    if (!allowedCalls.has(callId) || !Array.isArray(values)) return [];
    const seen = new Set<string>();
    const items = values.flatMap(value => {
      const note = readNote(value);
      if (!note || seen.has(note.id)) return [];
      seen.add(note.id);
      return [note];
    });
    return items.length ? [[callId, items] as const] : [];
  }) : []);

  const overrides = Object.fromEntries(isRecord(source.overrides) ? Object.entries(source.overrides).flatMap(([key, value]) => {
    if (!allowedTasks.has(key)) return [];
    const override = readOverride(value);
    return override ? [[key, override] as const] : [];
  }) : []);

  return { pins, notes, overrides };
}
