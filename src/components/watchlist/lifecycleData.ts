import { PROTOTYPE_OPERATIONS_NOW, getNextActionableOperation, getOperationPlacement, liveTime, primaryTime, removeRedundantNextOperation, type Locale, type CallServiceOrder, type OperationState, type OperationType, type OperationalTime, type PortCall, type PortOperation, type ServiceCode, type TimeKind } from "@/lib/watchlist";

export type LifecyclePlacement = {
  berth?: string;
  bollardFrom?: number;
  bollardTo?: number;
  side?: "port" | "starboard";
};

export const OPERATION_TYPES: readonly OperationType[] = ["arrival", "shifting", "assistance", "anchorage", "departure"];

function serviceOrderOperation(order: CallServiceOrder): PortOperation {
  return { id: order.id, type: "assistance", label: order.displayText, at: order.scheduledAt, state: order.status, serviceCodes: order.serviceCode ? [order.serviceCode] : [], tugQuantity: order.serviceCode === "B" ? order.quantity : undefined, source: "service-order", serviceOrderId: order.id };
}

export function lifecycleOperations(call: PortCall, serviceOrders: readonly CallServiceOrder[] = []): PortOperation[] {
  const operations = [...call.operations];
  serviceOrders.filter((order) => order.portCallId === call.id && !operations.some((operation) => operation.id === order.operationId || operation.id === order.id || (operation.type === "assistance" && operation.at === order.scheduledAt && operation.label === order.displayText))).forEach((order) => operations.push(serviceOrderOperation(order)));
  return operations.sort((left, right) => Date.parse(left.at) - Date.parse(right.at) || left.id.localeCompare(right.id));
}

function legacyStateEntry(times: readonly OperationalTime[]): OperationalTime | undefined {
  return times.find((time) => time.kind === "actual")
    ?? times.find((time) => time.kind === "ordered")
    ?? times.find((time) => time.kind === "expected")
    ?? times.find((time) => time.kind === "live");
}

/**
 * Legacy ordered/expected time is the primary operational time. Live ETA is a
 * separately labelled supplement, so it must not displace an ordered value.
 * Reuse the domain precedence helper after removing that supplemental entry.
 */
function legacyPrimaryTime(times: readonly OperationalTime[]): string {
  const legacyTimes = times.filter((time) => time.kind !== "live");
  return primaryTime(legacyTimes.length ? legacyTimes : times);
}

/** A recorded actual makes any tracking/live ETA stale for presentation. */
function visibleLegacyTimes(times: readonly OperationalTime[]): readonly OperationalTime[] {
  return times.some((time) => time.kind === "actual") && liveTime(times) === undefined
    ? times.filter((time) => time.kind !== "live")
    : times;
}

export function stateFromTimeKind(kind: TimeKind | undefined): OperationState {
  return kind === "actual" ? "actual" : kind === "ordered" || kind === "live" ? "ordered" : "expected";
}

export function formatMobileDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Copenhagen",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}/${get("month")} · ${get("hour")}:${get("minute")}`;
}

export function operationTimes(operation: PortOperation | undefined, fallback: readonly OperationalTime[] = []): readonly OperationalTime[] {
  if (!operation) return visibleLegacyTimes(fallback);
  if ((operation.type === "arrival" || operation.type === "departure") && fallback.length) return visibleLegacyTimes(fallback);
  return [{ kind: operation.state === "actual" ? "actual" : operation.state, value: operation.at }];
}

export function operationPrimaryTime(operation: PortOperation | undefined, fallback: readonly OperationalTime[] = []): string {
  if (operation && (operation.type === "arrival" || operation.type === "departure") && fallback.length) return legacyPrimaryTime(fallback);
  return operation?.at ?? legacyPrimaryTime(fallback);
}

export function operationState(operation: PortOperation | undefined, fallback: readonly OperationalTime[] = []): OperationState {
  if (!operation) return stateFromTimeKind(legacyStateEntry(fallback)?.kind);
  if ((operation.type === "arrival" || operation.type === "departure") && fallback.length) {
    return stateFromTimeKind(legacyStateEntry(fallback)?.kind);
  }
  return operation.state;
}

export function operationPlacement(call: PortCall, operation: PortOperation | undefined): LifecyclePlacement {
  // Operations carry the normalized legacy placement. The call fallback is only
  // for placement-only presentation cells that intentionally pass an effective
  // call snapshot without an operation.
  if (operation) return getOperationPlacement(operation) ?? {};
  return {
    berth: call.berth,
    bollardFrom: call.bollardFrom,
    bollardTo: call.bollardTo,
    side: call.side,
  };
}

/** Presentation-only list of populated optional groups; timing/actionability comes from the domain next-action helper. */
export function optionalLifecycleOperations(call: PortCall, serviceOrders: readonly CallServiceOrder[] = []): PortOperation[] {
  return lifecycleOperations(call, serviceOrders).filter((operation) => operation.type === "shifting" || operation.type === "assistance" || operation.type === "anchorage").filter((operation) => operation.state !== "actual");
}

export function optionalSummaryOperations(
  call: PortCall,
  now: string | number = PROTOTYPE_OPERATIONS_NOW,
  serviceOrders: readonly CallServiceOrder[] = [],
  excludeNextOperation = false,
): PortOperation[] {
  const operations = optionalLifecycleOperations(call, serviceOrders);
  if (!excludeNextOperation) return operations;
  return removeRedundantNextOperation(operations, getNextActionableOperation(call, now, serviceOrders));
}

export function operationLabel(operation: PortOperation, locale: Locale, call?: PortCall): string {
  const labels = locale === "da"
    ? { arrival: "Ankomst", shifting: "Forhaling", assistance: "Assistance", anchorage: "Ankring", departure: "Afgang" }
    : { arrival: "Arrival", shifting: "Shift", assistance: "Assistance", anchorage: "Anchorage", departure: "Departure" };
  if (operation.type !== "shifting") return labels[operation.type];
  const number = call ? lifecycleOperations(call).filter((item) => item.type === "shifting").findIndex((item) => item.id === operation.id) + 1 : 1;
  return `${labels.shifting} ${Math.max(1, number)}`;
}

export function operationStateLabel(state: OperationState, locale: Locale): string {
  if (locale === "da") return { expected: "Forventet", ordered: "Bestilt", actual: "Faktisk" }[state];
  return { expected: "Expected", ordered: "Ordered", actual: "Actual" }[state];
}

const SERVICE_LABELS: Record<Locale, Record<ServiceCode, string>> = {
  da: { H: "Trosseføring", L: "Lods", B: "Bugserbåd" },
  en: { H: "Linesmen", L: "Pilot", B: "Tugs" },
};

export function serviceValues(operation: PortOperation | undefined): string[] {
  if (!operation?.serviceCodes?.length) return [];
  return operation.serviceCodes.map((code) => code === "B" && operation.tugQuantity ? `B${operation.tugQuantity}` : code);
}

export function serviceLabel(operation: PortOperation | undefined, locale: Locale): string {
  if (!operation?.serviceCodes?.length) return "";
  return operation.serviceCodes.map((code) => `${SERVICE_LABELS[locale][code]}${code === "B" && operation.tugQuantity ? ` · ${operation.tugQuantity}` : ""}${operation.serviceStates?.[code] ? ` · ${operationStateLabel(operation.serviceStates[code], locale)}` : ""}`).join(", ");
}
