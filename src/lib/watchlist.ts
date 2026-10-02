export type Locale = "en" | "da";
export type Theme = "light" | "dark";
export type Density = "normal" | "compact";
export type MobileLayout = "cards" | "table";
export type ViewPreset = "full" | "office" | "port" | "quick";
export type DateFormat = "full" | "compact";
export type DataState = "ready" | "loading" | "empty" | "error" | "stale";
export type PortCallStatus = "expected" | "en-route" | "arrived" | "departed";
export type TimeKind = "expected" | "ordered" | "live" | "actual";
export type OperationType = "arrival" | "shifting" | "assistance" | "anchorage" | "departure";
export type OperationState = "expected" | "ordered" | "actual";
export type PortSide = "port" | "starboard";
export type CraneStatus = "none" | "requested" | "modified" | "approved" | "accepted";
export type ServiceCode = "H" | "L" | "B";
export const SORT_KEYS = [
  "signal", "pin", "call-number", "job-order", "imo", "call-sign", "crane", "vessel", "status", "eta", "etd", "berth", "bollards", "side",
  "operations", "customer", "agent", "loa", "beam", "category", "notes",
] as const;
export type SortKey = typeof SORT_KEYS[number];
export type SortDirection = "asc" | "desc";
export type WarningType = "delay" | "overlap" | "conflict" | "uncertain" | "overdue";
export type PortCallVisibility = "public" | "restricted";
export type ColumnKey = "signal" | "pin" | "callNumber" | "imo" | "callSign" | "crane" | "vessel" | "status" | "eta" | "etd" | "berth" | "bollards" | "side" | "nextJob" | "customer" | "agent" | "loa" | "beam" | "category" | "operations" | "notes";

/**
 * The single simulated operations clock used by the prototype.
 *
 * SHIFT 04 starts at 06:40 on the fixture date. Keeping this in the domain
 * layer prevents the list, map and mock snapshot from silently using
 * different moments in the same shift.
 */
export const PROTOTYPE_OPERATIONS_NOW = "2026-08-21T06:40:00+02:00" as const;
export const PROTOTYPE_SHIFT_START = PROTOTYPE_OPERATIONS_NOW;
export const PROTOTYPE_SHIFT_HOURS = 8 as const;
export const PROTOTYPE_OPERATIONS_HORIZON_HOURS = PROTOTYPE_SHIFT_HOURS;
export const PROTOTYPE_OPERATIONS_HORIZON_MS = PROTOTYPE_OPERATIONS_HORIZON_HOURS * 60 * 60 * 1_000;
export const WATCHLIST_SETTINGS_VERSION = 6 as const;
export const LEGACY_WATCHLIST_SETTINGS_VERSION = 1 as const;
export const PREVIOUS_WATCHLIST_SETTINGS_VERSION = 5 as const;

export function prototypeOperationsNow(): string { return PROTOTYPE_OPERATIONS_NOW; }

export interface Vessel {
  id: string; imo: string; callSign: string; name: string; category: string;
  loaMeters: number; beamMeters: number; customer: string; agent: string;
  flag: string; lastPort: string; nextPort: string;
}

export interface RoutePoint { latitude: number; longitude: number; recordedAt: string }

export interface ShipTracking {
  vesselId: string; currentPosition: RoutePoint; sailedRoute: readonly RoutePoint[];
  estimatedRoute: readonly RoutePoint[]; destinationBerth: string; updatedAt: string; liveEta: string;
}

export interface CallServiceOrder {
  id: string; portCallId: string; dutyCode: string; displayText: string;
  scheduledAt: string; quantity: number; status: OperationState; serviceCode?: ServiceCode; operationId?: string;
}

export interface PortCallNote { id: string; text: string; authorRole: string; createdAt: string }
export interface FlexPortDocument { id: string; name: string; type: "file" | "note"; state: "mock-available" | "restricted" }
export interface OperationalTime { kind: TimeKind; value: string }

/** A complete legacy placement assignment, including the P/P/S placement fields. */
export interface Placement {
  berth: string;
  bollardFrom: number;
  bollardTo: number;
  side: PortSide;
}

/** Explicit alias for callers that prefer the operation-specific name. */
export type OperationPlacement = Placement;

export interface PortOperation {
  workLocation?: "quay" | "stud";
  id: string; type: OperationType; label: string; at: string; state: OperationState;
  /** Normalized placement for arrival, shifting and departure operations. */
  placement?: OperationPlacement;
  /** Flattened legacy fields retained for existing consumers and old fixtures. */
  berth?: string; bollardFrom?: number; bollardTo?: number; side?: PortSide;
  details?: string; serviceCodes: readonly ServiceCode[]; tugQuantity?: number;
  /** Independent service states; absence means the legacy operation-level state. */
  serviceStates?: Partial<Record<ServiceCode, OperationState>>;
  source?: "operation" | "service-order" | "mobile-override"; serviceOrderId?: string;
  /** Local-only registration timestamp; the scheduled `at` value stays intact. */
  mobileRegisteredAt?: string;
}

export interface PortCall {
  /** Explicit call identity. Legacy snapshots may omit this and are inferred below. */
  workLocation?: "quay" | "stud";
  /** Source B is independent of customer-service and live estimates. */
  vesselReportedTimes?: { arrival?: string };
  craneTimes?: { requested?: string; approved?: string; accepted?: string; start?: string; end?: string };
  id: string; callNumber: string; vesselId: string; vesselName: string; imo: string; callSign: string;
  status: PortCallStatus; craneStatus: CraneStatus; berth: string; bollardFrom: number; bollardTo: number;
  side: "port" | "starboard"; customer: string; agent: string; category: string;
  loaMeters: number; beamMeters: number; arrivalTimes: readonly OperationalTime[];
  departureTimes: readonly OperationalTime[]; operations: readonly PortOperation[];
  notes: readonly PortCallNote[]; documents: readonly FlexPortDocument[];
  serviceOrderIds: readonly string[]; dataQuality: "verified" | "uncertain"; explicitConflict?: string;
  /** Every call must carry an explicit visibility classification. */
  visibility: PortCallVisibility;
}

export interface WarningSignal { type: WarningType; message: string }
export interface WarningClassification {
  /** Warnings relevant to the current operational shift/horizon. */
  operational: WarningSignal[];
  /** Warnings retained for audit/history, but not counted as current work. */
  historical: WarningSignal[];
}
export interface WatchlistFilters { query: string; statuses: readonly PortCallStatus[]; berths: readonly string[]; attentionOnly: boolean; operationalOnly: boolean; studOnly?: boolean; serviceCodes?: readonly ServiceCode[] }

export interface WatchlistSettings {
  /** Persisted schema marker; untouched v1-v5 records are migrated once. */
  settingsVersion: number;
  preset: ViewPreset; density: Density; mobileLayout: MobileLayout; locale: Locale; theme: Theme; dateFormat: DateFormat;
  sortKey: SortKey; sortDirection: SortDirection; columns: readonly ColumnKey[];
  hiddenColumns: readonly ColumnKey[]; pinnedIds: readonly string[]; pageSize: number; refreshMinutes: number;
}

export interface WatchlistSnapshot {
  calls: readonly PortCall[]; vessels: readonly Vessel[]; tracking: readonly ShipTracking[];
  serviceOrders: readonly CallServiceOrder[]; fetchedAt: string;
}

export const MIN_REFRESH_MINUTES = 10;

export const DEFAULT_FILTERS: WatchlistFilters = {
  query: "", statuses: [], berths: [], attentionOnly: false, operationalOnly: false,
};

export const ALL_COLUMNS: readonly ColumnKey[] = [
  "signal", "pin", "callNumber", "imo", "callSign", "crane", "vessel", "status", "berth", "bollards", "side",
  "eta", "operations", "etd", "nextJob", "agent", "loa", "beam", "category", "notes",
];

/**
 * Every visible table field has a deterministic sort representation. The
 * next-job column keeps its legacy job-order key so saved preferences and the
 * central sort control remain backwards compatible.
 */
export const SORTABLE_COLUMN_SORT_KEYS: Readonly<Record<ColumnKey, SortKey>> = {
  signal: "signal", pin: "pin", callNumber: "call-number", imo: "imo", callSign: "call-sign", crane: "crane", vessel: "vessel", status: "status",
  eta: "eta", etd: "etd", berth: "berth", bollards: "bollards", side: "side", nextJob: "job-order", operations: "operations",
  customer: "customer", agent: "agent", loa: "loa", beam: "beam", category: "category", notes: "notes",
};

/** v4 Full order before the redundant Type/category column was removed. */
const LEGACY_V4_FULL_PRESET_COLUMNS: readonly ColumnKey[] = ALL_COLUMNS.filter((column) => column !== "status");

export const PRESET_COLUMNS: Record<ViewPreset, readonly ColumnKey[]> = {
  full: ALL_COLUMNS.filter((column) => column !== "status" && column !== "category"),
  // Notes remain available through the column chooser but stay out of the
  // compact Office scan by default so the actionable sequence fits first.
  office: ["signal", "pin", "callNumber", "vessel", "berth", "eta", "operations", "etd", "nextJob", "agent"],
  port: ["signal", "pin", "vessel", "berth", "eta", "operations", "etd", "nextJob"],
  quick: ["signal", "pin", "vessel", "callNumber", "berth", "eta", "etd", "nextJob"],
};

/** v4 defaults emitted before the combined berth cell removed duplicate P/S columns. */
const LEGACY_V4_PRESET_COLUMNS: Record<Exclude<ViewPreset, "full">, readonly ColumnKey[]> = {
  office: ["signal", "pin", "callNumber", "vessel", "berth", "bollards", "side", "eta", "operations", "etd", "nextJob", "customer", "agent", "notes"],
  port: ["signal", "pin", "vessel", "berth", "bollards", "side", "eta", "operations", "etd", "nextJob"],
  quick: ["signal", "pin", "vessel", "callNumber", "berth", "bollards", "side", "eta", "etd", "nextJob"],
};

/** v3 order before the lifecycle column grouping was introduced. */
const LEGACY_V3_PRESET_COLUMNS: Record<ViewPreset, readonly ColumnKey[]> = {
  full: ["signal", "pin", "callNumber", "imo", "callSign", "crane", "vessel", "status", "eta", "etd", "berth", "bollards", "side", "nextJob", "customer", "agent", "loa", "beam", "category", "operations", "notes"],
  office: ["signal", "pin", "callNumber", "vessel", "eta", "etd", "berth", "bollards", "side", "nextJob", "customer", "agent", "operations", "notes"],
  port: ["signal", "pin", "vessel", "eta", "etd", "berth", "nextJob"],
  quick: ["signal", "pin", "vessel", "callNumber", "eta", "etd", "berth"],
};

const LEGACY_COMPACT_PRESET_COLUMNS: Record<Exclude<ViewPreset, "full">, readonly ColumnKey[]> = {
  office: ["signal", "pin", "callNumber", "vessel", "status", "eta", "etd", "berth", "bollards", "side", "nextJob", "customer", "agent", "operations", "notes"],
  port: ["signal", "pin", "vessel", "status", "eta", "etd", "berth", "nextJob"],
  quick: ["signal", "pin", "vessel", "status", "callNumber", "eta", "etd", "berth"],
};

const LEGACY_FULL_PRESET_COLUMNS: readonly ColumnKey[] = ALL_COLUMNS;

/** Exact defaults emitted by the first v2 build before the SHIFT 04 redesign. */
const LEGACY_UNTOUCHED_DEFAULTS = {
  preset: "office" as const,
  density: "compact" as const,
  locale: "en" as const,
  theme: "dark" as const,
  dateFormat: "full" as const,
  sortKey: "call-number" as const,
  sortDirection: "asc" as const,
  columns: LEGACY_V3_PRESET_COLUMNS.office,
  hiddenColumns: [] as readonly ColumnKey[],
  pinnedIds: [] as readonly string[],
  pageSize: 10,
  refreshMinutes: MIN_REFRESH_MINUTES,
};

export const DEFAULT_SETTINGS: WatchlistSettings = {
  settingsVersion: WATCHLIST_SETTINGS_VERSION,
  preset: "office", density: "compact", mobileLayout: "cards", locale: "da", theme: "light", dateFormat: "full",
  sortKey: "job-order", sortDirection: "asc", columns: PRESET_COLUMNS.office,
  hiddenColumns: [], pinnedIds: [], pageSize: 10, refreshMinutes: MIN_REFRESH_MINUTES,
};

/** The first direction shown when a column is selected from an inactive state. */
export const SORT_KEY_DEFAULT_DIRECTIONS: Readonly<Record<SortKey, SortDirection>> = {
  signal: "desc", pin: "desc", "call-number": "asc", "job-order": "asc", imo: "asc", "call-sign": "asc", crane: "asc", vessel: "asc", status: "asc",
  eta: "asc", etd: "asc", berth: "asc", bollards: "asc", side: "asc", operations: "asc", customer: "asc", agent: "asc", loa: "desc", beam: "desc", category: "asc", notes: "desc",
};

export function sortKeyForColumn(column: ColumnKey): SortKey {
  return SORTABLE_COLUMN_SORT_KEYS[column];
}

export function naturalSortDirection(key: SortKey): SortDirection {
  return SORT_KEY_DEFAULT_DIRECTIONS[key];
}

export interface SortSelection { sortKey: SortKey; sortDirection: SortDirection; activeSortKey: SortKey | null }

/**
 * Header sorting is intentionally tri-state: select the natural order, flip
 * it, then return to the persisted/default job-order view. Keeping this
 * transition in the domain module lets the dropdown and table headers share
 * exactly the same state contract.
 */
export function cycleSort(currentKey: SortKey, currentDirection: SortDirection, nextKey: SortKey, activeSortKey: SortKey | null): SortSelection {
  const natural = naturalSortDirection(nextKey);
  if (activeSortKey !== nextKey) return { sortKey: nextKey, sortDirection: natural, activeSortKey: nextKey };
  if (currentDirection === natural) return { sortKey: nextKey, sortDirection: natural === "asc" ? "desc" : "asc", activeSortKey: nextKey };
  return { sortKey: DEFAULT_SETTINGS.sortKey, sortDirection: DEFAULT_SETTINGS.sortDirection, activeSortKey: null };
}

function timeValue(times: readonly OperationalTime[], preferred: TimeKind): string | undefined {
  return times.find((time) => time.kind === preferred)?.value;
}

export function primaryTime(times: readonly OperationalTime[]): string {
  return timeValue(times, "actual") ?? timeValue(times, "live") ?? timeValue(times, "ordered") ?? timeValue(times, "expected") ?? "";
}

/** A live estimate is actionable only until an actual event is recorded. */
export function liveTime(times: readonly OperationalTime[]): string | undefined {
  return timeValue(times, "actual") ? undefined : timeValue(times, "live");
}

function timestamp(value: string | number): number {
  return typeof value === "number" ? value : Date.parse(value);
}

export interface BerthAssignment extends Placement {
  kind: "current" | "upcoming";
  source: "initial" | "shifting" | "departure";
  operationId?: string;
  at?: string;
  state?: OperationState;
}

export interface OccupancySegment {
  id: string;
  portCallId: string;
  placement: Placement;
  startAt: string;
  endAt: string;
  startOperationId?: string;
  endOperationId?: string;
}

function clonePlacement(placement: Placement): Placement {
  return { berth: placement.berth, bollardFrom: placement.bollardFrom, bollardTo: placement.bollardTo, side: placement.side };
}

function isPlacement(value: Partial<Placement> | undefined): value is Placement {
  const bollardFrom = value?.bollardFrom; const bollardTo = value?.bollardTo;
  return Boolean(value && typeof value.berth === "string" && value.berth.trim() && typeof bollardFrom === "number" && typeof bollardTo === "number" && Number.isFinite(bollardFrom) && Number.isFinite(bollardTo) && bollardFrom <= bollardTo && (value.side === "port" || value.side === "starboard"));
}

/** Reads the normalized placement and falls back to flattened legacy fields. */
export function getOperationPlacement(operation: PortOperation | undefined): Placement | undefined {
  if (!operation) return undefined;
  if (isPlacement(operation.placement)) return clonePlacement(operation.placement);
  const flattened = { berth: operation.berth, bollardFrom: operation.bollardFrom, bollardTo: operation.bollardTo, side: operation.side };
  return isPlacement(flattened) ? clonePlacement(flattened) : undefined;
}

/** STUD work happens at the vessel and deliberately has no quay assignment. */
export function isStudOperation(operation: PortOperation | undefined): operation is PortOperation {
  return operation?.workLocation === "stud";
}

/**
 * Explicit call identity wins. The assistance-only fallback preserves old
 * saved STUD snapshots without misclassifying arbitrary lifecycle operations.
 */
export function isStudCall(call: PortCall): boolean {
  if (call.workLocation) return call.workLocation === "stud";
  return call.operations.length > 0 && call.operations.every(operation => operation.type === "assistance" && isStudOperation(operation));
}

function initialPlacement(call: PortCall): Placement {
  return { berth: call.berth, bollardFrom: call.bollardFrom, bollardTo: call.bollardTo, side: call.side };
}

function operationTime(operation: PortOperation): number { return Date.parse(operation.at); }

function byOperationTime(left: PortOperation, right: PortOperation): number {
  const leftAt = operationTime(left); const rightAt = operationTime(right);
  return (Number.isFinite(leftAt) ? leftAt : Number.POSITIVE_INFINITY) - (Number.isFinite(rightAt) ? rightAt : Number.POSITIVE_INFINITY) || left.id.localeCompare(right.id);
}

export function getArrivalOperation(call: PortCall): PortOperation | undefined {
  return [...call.operations].filter((operation) => operation.type === "arrival").sort(byOperationTime)[0];
}

export function getDepartureOperation(call: PortCall): PortOperation | undefined {
  return [...call.operations].filter((operation) => operation.type === "departure").sort(byOperationTime)[0];
}

export function getShiftingOperations(call: PortCall): PortOperation[] {
  return [...call.operations].filter((operation) => operation.type === "shifting").sort(byOperationTime);
}

export function getActiveShiftingOperation(call: PortCall, now: string | number = PROTOTYPE_OPERATIONS_NOW): PortOperation | undefined {
  const nowTimestamp = timestamp(now);
  if (!Number.isFinite(nowTimestamp)) return undefined;
  return getShiftingOperations(call)
    .filter((operation) => {
      const at = operationTime(operation);
      return Number.isFinite(at) && nowTimestamp >= at - 20 * 60_000 && nowTimestamp < at + 45 * 60_000;
    })
    // A vessel can have overlapping shift windows. The latest scheduled
    // shift is the authoritative current placement in that case.
    .sort((left, right) => operationTime(right) - operationTime(left) || right.id.localeCompare(left.id))[0];
}

function departureCompleted(call: PortCall, nowTimestamp: number): boolean {
  if (call.status === "departed") return true;
  const departure = getDepartureOperation(call);
  return Boolean(departure?.state === "actual" && Number.isFinite(nowTimestamp) && operationTime(departure) <= nowTimestamp);
}

/** The planned final berth placement, after every known shift and at departure. */
export function getDeparturePlacement(call: PortCall): Placement {
  const departure = getDepartureOperation(call);
  if (departure) {
    const placement = getOperationPlacement(departure);
    if (placement) return placement;
  }
  const shifts = getShiftingOperations(call).map(getOperationPlacement).filter((placement): placement is Placement => Boolean(placement));
  return clonePlacement(shifts.at(-1) ?? getOperationPlacement(getArrivalOperation(call)) ?? initialPlacement(call));
}

/** Current effective placement; undefined means the vessel is not currently alongside. */
export function getEffectivePlacement(call: PortCall, now: string | number = PROTOTYPE_OPERATIONS_NOW): Placement | undefined {
  if (isStudCall(call)) return undefined;
  const nowTimestamp = timestamp(now);
  if (!Number.isFinite(nowTimestamp) || departureCompleted(call, nowTimestamp)) return undefined;
  const arrival = getArrivalOperation(call);
  const arrivalAt = arrival ? operationTime(arrival) : Date.parse(primaryTime(call.arrivalTimes));
  const arrived = call.status === "arrived"
    ? !Number.isFinite(arrivalAt) || arrivalAt <= nowTimestamp
    : Boolean(arrival?.state === "actual" && Number.isFinite(arrivalAt) && arrivalAt <= nowTimestamp);
  if (!arrived) return undefined;
  let current = getOperationPlacement(arrival) ?? initialPlacement(call);
  getShiftingOperations(call).forEach((operation) => {
    const at = operationTime(operation); const placement = getOperationPlacement(operation);
    if (placement && operation.state === "actual" && Number.isFinite(at) && at <= nowTimestamp) current = placement;
  });
  return clonePlacement(current);
}

function assignmentKey(placement: Placement): string {
  return `${normalizeBerthCode(placement.berth)}|${placement.bollardFrom}|${placement.bollardTo}|${placement.side}`;
}

/** Current and later planned berth assignments, excluding berths already left. */
export function getRelevantBerthAssignments(call: PortCall, now: string | number = PROTOTYPE_OPERATIONS_NOW): BerthAssignment[] {
  if (isStudCall(call)) return [];
  const nowTimestamp = timestamp(now);
  if (!Number.isFinite(nowTimestamp) || departureCompleted(call, nowTimestamp)) return [];
  const assignments: BerthAssignment[] = [];
  const effective = getEffectivePlacement(call, now);
  if (effective) {
    const lastActualShift = getShiftingOperations(call).filter((operation) => operation.state === "actual" && operationTime(operation) <= nowTimestamp && getOperationPlacement(operation)).at(-1);
    assignments.push({ ...effective, kind: "current", source: lastActualShift ? "shifting" : "initial", operationId: lastActualShift?.id, at: lastActualShift?.at, state: lastActualShift?.state ?? "actual" });
  } else {
    const arrival = getArrivalOperation(call);
    const arrivalPlacement = arrival ? getOperationPlacement(arrival) : undefined;
    assignments.push({ ...(arrivalPlacement ?? initialPlacement(call)), kind: "upcoming", source: "initial", at: arrival?.at, state: arrival?.state });
  }
  getShiftingOperations(call).forEach((operation) => {
    const at = operationTime(operation); const placement = getOperationPlacement(operation);
    if (!placement || !Number.isFinite(at)) return;
    if (operation.state !== "actual" || at > nowTimestamp) assignments.push({ ...placement, kind: "upcoming", source: "shifting", operationId: operation.id, at: operation.at, state: operation.state });
  });
  const departure = getDepartureOperation(call); const departurePlacement = getDeparturePlacement(call);
  if (departure && departure.state !== "actual") assignments.push({ ...departurePlacement, kind: "upcoming", source: "departure", operationId: departure.id, at: departure.at, state: departure.state });
  const seen = new Set<string>();
  return assignments.filter((assignment) => {
    const key = assignmentKey(assignment); if (seen.has(key)) return false; seen.add(key); return true;
  });
}

/** Occupancy intervals from arrival, through every shift, to final departure. */
export function getOccupancySegments(call: PortCall): OccupancySegment[] {
  if (isStudCall(call)) return [];
  const arrival = getArrivalOperation(call); const departure = getDepartureOperation(call);
  const startAt = arrival?.at ?? primaryTime(call.arrivalTimes); const endAt = departure?.at ?? primaryTime(call.departureTimes);
  const startTimestamp = Date.parse(startAt); const endTimestamp = Date.parse(endAt);
  if (!Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp) || endTimestamp <= startTimestamp) return [];
  let current = getOperationPlacement(arrival) ?? initialPlacement(call);
  let currentStart = startAt; let currentOperationId = arrival?.id;
  const segments: OccupancySegment[] = [];
  const shifts = getShiftingOperations(call).filter((operation) => Number.isFinite(operationTime(operation)) && operationTime(operation) > startTimestamp && operationTime(operation) < endTimestamp);
  shifts.forEach((shift) => {
    const placement = getOperationPlacement(shift); if (!placement) return;
    const shiftAt = shift.at; if (Date.parse(shiftAt) > Date.parse(currentStart)) segments.push({ id: `${call.id}:${segments.length + 1}`, portCallId: call.id, placement: clonePlacement(current), startAt: currentStart, endAt: shiftAt, startOperationId: currentOperationId, endOperationId: shift.id });
    current = placement; currentStart = shiftAt; currentOperationId = shift.id;
  });
  if (Date.parse(endAt) > Date.parse(currentStart)) segments.push({ id: `${call.id}:${segments.length + 1}`, portCallId: call.id, placement: clonePlacement(current), startAt: currentStart, endAt, startOperationId: currentOperationId, endOperationId: departure?.id });
  return segments;
}

function operationFromServiceOrder(order: CallServiceOrder): PortOperation {
  const serviceCodes = order.serviceCode ? [order.serviceCode] : [];
  return { id: order.id, type: "assistance", label: order.displayText, at: order.scheduledAt, state: order.status, serviceCodes, tugQuantity: order.serviceCode === "B" ? order.quantity : undefined, source: "service-order", serviceOrderId: order.id };
}

function serviceOrderIsDuplicate(call: PortCall, order: CallServiceOrder): boolean {
  return call.operations.some((operation) => operation.id === order.operationId || operation.serviceOrderId === order.id || (operation.type === "assistance" && operation.at === order.scheduledAt && operation.label === order.displayText));
}

function serviceOrderForOperation(operation: PortOperation, serviceOrders: readonly CallServiceOrder[]): CallServiceOrder | undefined {
  return serviceOrders.find((order) => order.operationId === operation.id || order.id === operation.serviceOrderId);
}

/**
 * Merge the authoritative service-order status into a linked operation.
 * D365/legacy feeds can update an assistance order after the original
 * operation was written, so callers must not treat the two records as two
 * independent jobs or keep the stale operation state.
 */
function reconcileOperation(operation: PortOperation, serviceOrders: readonly CallServiceOrder[]): PortOperation {
  if (operation.source === "mobile-override" && operation.serviceStates !== undefined) return operation;
  const order = serviceOrderForOperation(operation, serviceOrders);
  if (!order) return operation;
  return {
    ...operation,
    label: order.displayText || operation.label,
    at: order.scheduledAt || operation.at,
    state: order.status,
    source: "service-order",
    serviceOrderId: order.id,
  };
}

function actionableCandidates(call: PortCall, serviceOrders: readonly CallServiceOrder[]): PortOperation[] {
  const candidates = call.operations.map((operation) => reconcileOperation(operation, serviceOrders));
  serviceOrders.filter((order) => order.portCallId === call.id && !serviceOrderIsDuplicate(call, order)).forEach((order) => candidates.push(operationFromServiceOrder(order)));
  return candidates;
}

function isActionable(operation: PortOperation): boolean {
  return operation.state !== "actual" && Number.isFinite(operationTime(operation));
}

/**
 * Returns only a future, actionable operation. In particular, it never falls
 * back to a completed/past event when a call has no work left in the window.
 */
export function getNextFutureOperation(call: PortCall, now: string | number = PROTOTYPE_OPERATIONS_NOW, serviceOrders: readonly CallServiceOrder[] = []): PortOperation | undefined {
  const nowTimestamp = timestamp(now);
  if (!Number.isFinite(nowTimestamp)) return undefined;
  return actionableCandidates(call, serviceOrders)
    .filter((operation) => operation.state !== "actual" && operationTime(operation) >= nowTimestamp)
    .sort((left, right) => operationTime(left) - operationTime(right) || left.id.localeCompare(right.id))[0];
}

/** Earliest unfinished event, including overdue ordered/expected work. */
export function getNextActionableOperation(
  call: PortCall,
  now: string | number = PROTOTYPE_OPERATIONS_NOW,
  serviceOrders: readonly CallServiceOrder[] = [],
): PortOperation | undefined {
  if (!Number.isFinite(timestamp(now))) return undefined;
  return actionableCandidates(call, serviceOrders).filter(isActionable).sort((left, right) => operationTime(left) - operationTime(right) || left.id.localeCompare(right.id))[0];
}

export function isOptionalOperation(operation: PortOperation | undefined): operation is PortOperation {
  return Boolean(operation && (operation.type === "shifting" || operation.type === "assistance" || operation.type === "anchorage"));
}

/**
 * A service order can be represented once by its own id and once by the
 * linked operation id. Treat either identifier as the same operational item.
 */
export function sameOperationIdentity(left: PortOperation | undefined, right: PortOperation | undefined): boolean {
  if (!left || !right) return false;
  const leftIds = [left.id, left.serviceOrderId].filter((value): value is string => Boolean(value));
  const rightIds = [right.id, right.serviceOrderId].filter((value): value is string => Boolean(value));
  return leftIds.some((id) => rightIds.includes(id));
}

/** Remove only a redundant first optional operation already shown as Næste. */
export function removeRedundantNextOperation(operations: readonly PortOperation[], next: PortOperation | undefined): PortOperation[] {
  if (!isOptionalOperation(next) || !operations[0] || !sameOperationIdentity(operations[0], next)) return [...operations];
  return operations.slice(1);
}

/** The last operation explicitly recorded as completed before the clock. */
export function getLastCompletedOperation(call: PortCall, now: string | number = PROTOTYPE_OPERATIONS_NOW, serviceOrders: readonly CallServiceOrder[] = []): PortOperation | undefined {
  const nowTimestamp = timestamp(now);
  if (!Number.isFinite(nowTimestamp)) return undefined;
  return actionableCandidates(call, serviceOrders)
    .filter((operation) => operation.state === "actual" && operationTime(operation) <= nowTimestamp)
    .sort((left, right) => operationTime(right) - operationTime(left) || right.id.localeCompare(left.id))[0];
}

/** Backwards-compatible next-job helper; it now follows actionable semantics. */
export function getNextOperation(
  call: PortCall,
  now: string | number = PROTOTYPE_OPERATIONS_NOW,
  serviceOrders: readonly CallServiceOrder[] = [],
): PortOperation | undefined {
  return getNextActionableOperation(call, now, serviceOrders);
}

function hasActionableOperationWithin(call: PortCall, nowTimestamp: number, horizonMs: number, serviceOrders: readonly CallServiceOrder[]): boolean {
  const horizonEnd = nowTimestamp + horizonMs;
  return actionableCandidates(call, serviceOrders).some((operation) => {
    const at = operationTime(operation);
    return isActionable(operation) && (at < nowTimestamp || at <= horizonEnd);
  });
}

/**
 * Calls that belong on the operational watchlist for the current shift:
 * arrived/en-route calls remain active while underway, and expected calls
 * enter the list only when an actionable operation is within the next eight
 * hours. Departed and far-future calls stay out of the active metric.
 */
export function isOperationallyActiveCall(
  call: PortCall,
  now: string | number = PROTOTYPE_OPERATIONS_NOW,
  horizonHours = PROTOTYPE_OPERATIONS_HORIZON_HOURS,
  serviceOrders: readonly CallServiceOrder[] = [],
): boolean {
  if (call.status === "departed") return false;
  if (call.status === "arrived" || call.status === "en-route") return true;
  const nowTimestamp = timestamp(now);
  const horizonMs = Math.max(0, horizonHours) * 60 * 60 * 1_000;
  return Number.isFinite(nowTimestamp) && hasActionableOperationWithin(call, nowTimestamp, horizonMs, serviceOrders);
}

export function getOperationallyActiveCalls(
  calls: readonly PortCall[],
  now: string | number = PROTOTYPE_OPERATIONS_NOW,
  horizonHours = PROTOTYPE_OPERATIONS_HORIZON_HOURS,
  serviceOrders: readonly CallServiceOrder[] = [],
): PortCall[] {
  return calls.filter((call) => isOperationallyActiveCall(call, now, horizonHours, serviceOrders));
}

function intervalsOverlap(left: OccupancySegment, right: OccupancySegment): boolean {
  const leftStart = Date.parse(left.startAt); const leftEnd = Date.parse(left.endAt);
  const rightStart = Date.parse(right.startAt); const rightEnd = Date.parse(right.endAt);
  return Number.isFinite(leftStart) && Number.isFinite(leftEnd) && Number.isFinite(rightStart) && Number.isFinite(rightEnd)
    && leftStart < rightEnd && rightStart < leftEnd;
}

function bollardsOverlap(left: Placement, right: Placement): boolean {
  return left.bollardFrom <= right.bollardTo && right.bollardFrom <= left.bollardTo;
}

export function getWarnings(
  call: PortCall,
  allCalls: readonly PortCall[],
  now: string | number = PROTOTYPE_OPERATIONS_NOW,
  serviceOrders: readonly CallServiceOrder[] = [],
): WarningSignal[] {
  const warnings: WarningSignal[] = [];
  const expected = timeValue(call.arrivalTimes, "expected");
  const live = liveTime(call.arrivalTimes);
  if (expected && live) {
    const delay = Math.round((Date.parse(live) - Date.parse(expected)) / 60_000);
    if (delay > 120) warnings.push({ type: "delay", message: `Live ETA is ${delay} minutes later than expected.` });
  }
  const plannedDeparture = timeValue(call.departureTimes, "ordered") ?? timeValue(call.departureTimes, "expected");
  if (live && plannedDeparture && Date.parse(live) > Date.parse(plannedDeparture)) {
    warnings.push({ type: "conflict", message: `Live ETA is later than the planned departure at ${formatClock(plannedDeparture)}.` });
  }
  const ownSegments = getOccupancySegments(call);
  let overlap: { other: PortCall; ownSegment: OccupancySegment; otherSegment: OccupancySegment } | undefined;
  for (const other of allCalls) {
    if (other.id === call.id) continue;
    for (const otherSegment of getOccupancySegments(other)) {
      const ownSegment = ownSegments.find((segment) => normalizeBerthCode(segment.placement.berth) === normalizeBerthCode(otherSegment.placement.berth) && bollardsOverlap(segment.placement, otherSegment.placement) && intervalsOverlap(segment, otherSegment));
      if (ownSegment) {
        overlap = { other, ownSegment, otherSegment };
        break;
      }
    }
    if (overlap) break;
  }
  if (overlap) {
    const { other, ownSegment, otherSegment } = overlap;
    warnings.push({ type: "overlap", message: `${ownSegment.placement.berth} bollards ${ownSegment.placement.bollardFrom}-${ownSegment.placement.bollardTo} overlap ${other.callNumber} at ${otherSegment.placement.berth} bollards ${otherSegment.placement.bollardFrom}-${otherSegment.placement.bollardTo}.` });
  }
  const nowTimestamp = timestamp(now);
  const overdue = Number.isFinite(nowTimestamp) && actionableCandidates(call, serviceOrders)
    .filter((operation) => isActionable(operation) && operationTime(operation) < nowTimestamp)
    .sort((left, right) => operationTime(left) - operationTime(right) || left.id.localeCompare(right.id))[0];
  if (overdue) warnings.push({ type: "overdue", message: `${overdue.label} is unfinished and overdue since ${formatClock(overdue.at)}.` });
  if (call.explicitConflict) warnings.push({ type: "conflict", message: call.explicitConflict });
  if (call.dataQuality === "uncertain") warnings.push({ type: "uncertain", message: "Vessel identity or operational data is incomplete and must be verified." });
  return warnings;
}

/**
 * Split the complete warning set into current operational work and retained
 * history. This lets the dashboard count only work that can still be acted
 * on while the detail view keeps data-quality and past-conflict evidence.
 */
export function classifyWarnings(
  call: PortCall,
  allCalls: readonly PortCall[],
  now: string | number = PROTOTYPE_OPERATIONS_NOW,
  serviceOrders: readonly CallServiceOrder[] = [],
): WarningClassification {
  const warnings = getWarnings(call, allCalls, now, serviceOrders);
  return isOperationallyActiveCall(call, now, PROTOTYPE_OPERATIONS_HORIZON_HOURS, serviceOrders)
    ? { operational: warnings, historical: [] }
    : { operational: [], historical: warnings };
}

export function getOperationalWarnings(
  call: PortCall,
  allCalls: readonly PortCall[],
  now: string | number = PROTOTYPE_OPERATIONS_NOW,
  serviceOrders: readonly CallServiceOrder[] = [],
): WarningSignal[] {
  return classifyWarnings(call, allCalls, now, serviceOrders).operational;
}

export function getHistoricalWarnings(
  call: PortCall,
  allCalls: readonly PortCall[],
  now: string | number = PROTOTYPE_OPERATIONS_NOW,
  serviceOrders: readonly CallServiceOrder[] = [],
): WarningSignal[] {
  return classifyWarnings(call, allCalls, now, serviceOrders).historical;
}

/**
 * Search labels used by the watchlist UI. The fixture feed keeps stable
 * English operation types while the operator-facing prototype is Danish, so
 * both values need to be searchable. Keep these as aliases instead of
 * replacing the source value: integrations and detail views still need the
 * original feed terminology.
 */
const OPERATION_TYPE_SEARCH_TERMS: Readonly<Record<OperationType, readonly string[]>> = {
  arrival: ["arrival", "ankomst"],
  shifting: ["shifting", "shift", "skift", "forhaling", "flytning"],
  assistance: ["assistance", "hjælp", "hjaelp", "bugsering", "lods", "fortøjning", "fortojning"],
  anchorage: ["anchorage", "holding", "ankring", "venteplads"],
  departure: ["departure", "afgang"],
};

const OPERATION_STATE_SEARCH_TERMS: Readonly<Record<OperationState, readonly string[]>> = {
  expected: ["expected", "forventet"],
  ordered: ["ordered", "bestilt"],
  actual: ["actual", "faktisk", "udført", "udfort"],
};

const CALL_STATUS_SEARCH_TERMS: Readonly<Record<PortCallStatus, readonly string[]>> = {
  expected: ["expected", "forventet"],
  "en-route": ["en-route", "på vej", "pa vej"],
  arrived: ["arrived", "ankommet"],
  departed: ["departed", "afgået", "afgaaet"],
};

/** Make Danish queries work whether the operator types accents or not. */
function normalizeSearchText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("da-DK");
}

function operationSearchValues(operation: PortOperation): readonly unknown[] {
  return [
    operation.id,
    operation.type,
    operation.label,
    operation.details,
    operation.at,
    operation.state,
    operation.source,
    operation.serviceOrderId,
    operation.workLocation,
    operation.tugQuantity,
    ...operation.serviceCodes,
    ...(OPERATION_TYPE_SEARCH_TERMS[operation.type] ?? []),
    ...(OPERATION_STATE_SEARCH_TERMS[operation.state] ?? []),
  ];
}

function serviceOrderSearchValues(order: CallServiceOrder): readonly unknown[] {
  return [
    order.id,
    order.portCallId,
    order.dutyCode,
    order.displayText,
    order.scheduledAt,
    order.quantity,
    order.status,
    order.serviceCode,
    order.operationId,
    ...(OPERATION_STATE_SEARCH_TERMS[order.status] ?? []),
  ];
}

export function searchPortCalls(
  calls: readonly PortCall[],
  query: string,
  now: string | number = PROTOTYPE_OPERATIONS_NOW,
  serviceOrders: readonly CallServiceOrder[] = [],
): PortCall[] {
  const needle = query.trim().toLocaleLowerCase("en");
  if (!needle) return [...calls];
  return calls.filter((call) => {
    const currentAndUpcomingBerths = getRelevantBerthAssignments(call, now).map((assignment) => assignment.berth);
    const operationValues = actionableCandidates(call, serviceOrders).flatMap(operationSearchValues);
    const orderValues = serviceOrders
      .filter((order) => order.portCallId === call.id)
      .flatMap(serviceOrderSearchValues);
    const searchable = [
      call.callNumber, call.vesselName, call.imo, call.callSign,
      ...currentAndUpcomingBerths, call.agent, call.category, call.status,
      ...(CALL_STATUS_SEARCH_TERMS[call.status] ?? []),
      ...operationValues, ...orderValues,
    ];
    return normalizeSearchText(searchable.join(" ")).includes(normalizeSearchText(needle));
  });
}

export function filterPortCalls(
  calls: readonly PortCall[],
  filters: WatchlistFilters,
  allCalls: readonly PortCall[] = calls,
  now: string | number = PROTOTYPE_OPERATIONS_NOW,
  serviceOrders: readonly CallServiceOrder[] = [],
): PortCall[] {
  return searchPortCalls(calls, filters.query, now, serviceOrders).filter((call) => {
    const statusMatch = filters.statuses.length === 0 || filters.statuses.includes(call.status);
    const relevantBerths = new Set(getRelevantBerthAssignments(call, now).map((assignment) => normalizeBerthCode(assignment.berth)));
    const berthMatch = filters.berths.length === 0 || filters.berths.some((berth) => relevantBerths.has(normalizeBerthCode(berth)));
    const attentionMatch = !filters.attentionOnly || getOperationalWarnings(call, allCalls, now, serviceOrders).length > 0;
    const operationalMatch = !filters.operationalOnly || isOperationallyActiveCall(call, now, PROTOTYPE_OPERATIONS_HORIZON_HOURS, serviceOrders);
    const studMatch = !filters.studOnly || isStudCall(call);
    const serviceMatch = !filters.serviceCodes?.length || actionableCandidates(call, serviceOrders).some(operation => operation.serviceCodes.some(code => filters.serviceCodes!.includes(code)));
    return statusMatch && berthMatch && attentionMatch && operationalMatch && studMatch && serviceMatch;
  });
}

/**
 * Select one berth from an interactive berth label while retaining the
 * rest of the operator's filter context. A direct berth selection is
 * intentionally singular: choosing another berth replaces the previous
 * berth filter instead of silently broadening the result set.
 */
export function selectBerthFilter(filters: WatchlistFilters, berth: string): WatchlistFilters {
  const selectedBerth = berth.trim();
  return { ...filters, berths: selectedBerth ? [selectedBerth] : [] };
}

function compareText(a: string, b: string): number { return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" }); }

function compareStableCallIdentity(left: PortCall, right: PortCall): number {
  return compareText(left.callNumber, right.callNumber) || compareText(left.id, right.id);
}

function directionFactor(direction: SortDirection): 1 | -1 { return direction === "asc" ? 1 : -1; }

/** Empty or invalid values sort last in either direction. */
function compareOptionalText(left: string | undefined | null, right: string | undefined | null, direction: SortDirection): number {
  const a = typeof left === "string" ? left.trim() : "";
  const b = typeof right === "string" ? right.trim() : "";
  if (!a || !b) return !a && !b ? 0 : !a ? 1 : -1;
  return compareText(a, b) * directionFactor(direction);
}

/** Empty or invalid values sort last in either direction. */
function compareOptionalNumber(left: number | undefined | null, right: number | undefined | null, direction: SortDirection): number {
  const aValid = typeof left === "number" && Number.isFinite(left);
  const bValid = typeof right === "number" && Number.isFinite(right);
  if (!aValid || !bValid) return !aValid && !bValid ? 0 : !aValid ? 1 : -1;
  return (left! - right!) * directionFactor(direction);
}

function compareOptionalDate(left: string | undefined | null, right: string | undefined | null, direction: SortDirection): number {
  const a = typeof left === "string" && left.trim() ? Date.parse(left) : Number.NaN;
  const b = typeof right === "string" && right.trim() ? Date.parse(right) : Number.NaN;
  const aValid = Number.isFinite(a); const bValid = Number.isFinite(b);
  if (!aValid || !bValid) return !aValid && !bValid ? 0 : !aValid ? 1 : -1;
  return (a - b) * directionFactor(direction);
}

const STATUS_SORT_RANK: Readonly<Record<PortCallStatus, number>> = { expected: 0, "en-route": 1, arrived: 2, departed: 3 };
// Pending crane work is surfaced before completed approval: a request needs
// operator follow-up, a modified request needs review, no crane is neutral,
// and an approved request is the least actionable state.
const CRANE_SORT_RANK: Readonly<Record<CraneStatus, number>> = { requested: 0, modified: 0, none: 2, approved: 3, accepted: 4 };
const SIDE_SORT_RANK: Readonly<Record<PortSide, number>> = { port: 0, starboard: 1 };

function getNextOptionalActionableOperation(call: PortCall, serviceOrders: readonly CallServiceOrder[]): PortOperation | undefined {
  return actionableCandidates(call, serviceOrders)
    .filter((operation) => isOptionalOperation(operation) && isActionable(operation))
    .sort((left, right) => operationTime(left) - operationTime(right) || left.id.localeCompare(right.id))[0];
}

export function sortPortCalls(
  calls: readonly PortCall[],
  key: SortKey,
  direction: SortDirection,
  pinnedIds: readonly string[] = [],
  now: string | number = PROTOTYPE_OPERATIONS_NOW,
  serviceOrders: readonly CallServiceOrder[] = [],
): PortCall[] {
  const ranks = new Map(pinnedIds.map((id, index) => [id, index]));
  return [...calls].sort((a, b) => {
    const aPin = ranks.get(a.id); const bPin = ranks.get(b.id);
    if (key !== "pin" && (aPin !== undefined || bPin !== undefined)) {
      if (aPin === undefined) return 1; if (bPin === undefined) return -1; return aPin - bPin;
    }
    if (key === "pin" && (aPin !== undefined || bPin !== undefined)) {
      if (aPin !== undefined && bPin !== undefined) return aPin - bPin;
      return (Number(aPin !== undefined) - Number(bPin !== undefined)) * directionFactor(direction);
    }
    const aNext = key === "job-order" ? getNextActionableOperation(a, now, serviceOrders) : undefined;
    const bNext = key === "job-order" ? getNextActionableOperation(b, now, serviceOrders) : undefined;
    if (key === "job-order") {
      // Actionable calls always precede calls with no future work, even when
      // the user flips the chronological direction. Pinned order is handled
      // above and is likewise independent of the selected direction.
      if (aNext && !bNext) return -1;
      if (!aNext && bNext) return 1;
      if (aNext && bNext) {
        const nextResult = (operationTime(aNext) - operationTime(bNext)) * directionFactor(direction);
        if (nextResult) return nextResult;
        return compareStableCallIdentity(a, b);
      }
      return compareStableCallIdentity(a, b);
    }
    let result = 0;
    switch (key) {
      case "signal": result = (getOperationalWarnings(a, calls, now, serviceOrders).length - getOperationalWarnings(b, calls, now, serviceOrders).length) * directionFactor(direction); break;
      case "pin": result = (Number(aPin !== undefined) - Number(bPin !== undefined)) * directionFactor(direction); break;
      case "call-number": result = compareOptionalText(a.callNumber, b.callNumber, direction); break;
      case "imo": result = compareOptionalText(a.imo, b.imo, direction); break;
      case "call-sign": result = compareOptionalText(a.callSign, b.callSign, direction); break;
      case "crane": result = compareOptionalNumber(CRANE_SORT_RANK[a.craneStatus], CRANE_SORT_RANK[b.craneStatus], direction); break;
      case "vessel": result = compareOptionalText(a.vesselName, b.vesselName, direction); break;
      case "status": result = compareOptionalNumber(STATUS_SORT_RANK[a.status], STATUS_SORT_RANK[b.status], direction); break;
      case "eta": result = compareOptionalDate(primaryTime(a.arrivalTimes), primaryTime(b.arrivalTimes), direction); break;
      case "etd": result = compareOptionalDate(primaryTime(a.departureTimes), primaryTime(b.departureTimes), direction); break;
      case "berth": result = compareOptionalText(normalizeBerthCode(a.berth), normalizeBerthCode(b.berth), direction); break;
      case "bollards": result = compareOptionalNumber(a.bollardFrom, b.bollardFrom, direction) || compareOptionalNumber(a.bollardTo, b.bollardTo, direction); break;
      case "side": result = compareOptionalNumber(SIDE_SORT_RANK[a.side], SIDE_SORT_RANK[b.side], direction); break;
      case "operations": {
        const aOperation = getNextOptionalActionableOperation(a, serviceOrders); const bOperation = getNextOptionalActionableOperation(b, serviceOrders);
        result = compareOptionalDate(aOperation?.at, bOperation?.at, direction);
        break;
      }
      case "customer": result = compareOptionalText(a.customer, b.customer, direction); break;
      case "agent": result = compareOptionalText(a.agent, b.agent, direction); break;
      case "loa": result = compareOptionalNumber(a.loaMeters, b.loaMeters, direction); break;
      case "beam": result = compareOptionalNumber(a.beamMeters, b.beamMeters, direction); break;
      case "category": result = compareOptionalText(a.category, b.category, direction); break;
      case "notes": result = (a.notes.length - b.notes.length) * directionFactor(direction); break;
    }
    return result || compareStableCallIdentity(a, b);
  });
}

export function togglePinnedId(ids: readonly string[], id: string): string[] { return ids.includes(id) ? ids.filter((item) => item !== id) : [id, ...ids]; }

export function moveColumn(columns: readonly ColumnKey[], key: ColumnKey, direction: -1 | 1): ColumnKey[] {
  const result = [...columns]; const from = result.indexOf(key); if (from < 0) return result;
  const to = Math.max(0, Math.min(result.length - 1, from + direction));
  result.splice(from, 1); result.splice(to, 0, key); return result;
}

/**
 * Move one column onto another column's original position.
 *
 * This is deliberately different from an adjacent move: dropping a source
 * onto a target means the source takes that target's original index; the
 * target shifts one slot as required. Keeping the target index from the
 * original array also makes downward drops (including the final row)
 * deterministic after the source is removed.
 */
export function moveColumnTo(columns: readonly ColumnKey[], source: ColumnKey, target: ColumnKey): ColumnKey[] {
  const result = [...columns];
  const sourceIndex = result.indexOf(source);
  const targetIndex = result.indexOf(target);
  if (sourceIndex < 0 || targetIndex < 0 || source === target) return result;
  result.splice(sourceIndex, 1);
  result.splice(targetIndex, 0, source);
  return result;
}

export function visibleColumns(settings: WatchlistSettings): ColumnKey[] { return settings.columns.filter((column) => !settings.hiddenColumns.includes(column)); }

export interface PageResult<T> { items: T[]; page: number; pages: number; total: number }
export function paginate<T>(items: readonly T[], page: number, pageSize: number): PageResult<T> {
  const size = Math.max(1, Math.trunc(pageSize)); const pages = Math.max(1, Math.ceil(items.length / size));
  const safePage = Math.max(1, Math.min(pages, Math.trunc(page) || 1)); const start = (safePage - 1) * size;
  return { items: items.slice(start, start + size), page: safePage, pages, total: items.length };
}

const WEEKDAYS: Record<Locale, readonly string[]> = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  da: ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"],
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Copenhagen", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
const clockFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Copenhagen", hour: "2-digit", minute: "2-digit", hour12: false });
const weekdayFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Copenhagen", weekday: "long" });

export function formatDateTime(value: string, locale: Locale, format: DateFormat): string {
  const date = new Date(value); if (Number.isNaN(date.getTime())) return "—";
  const parts = dateTimeFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const compact = `${get("day")}-${get("month")}-${get("year")} · ${get("hour")}:${get("minute")}`;
  if (format === "compact") return compact;
  return `${WEEKDAYS[locale][WEEKDAYS.en.indexOf(weekdayFormatter.format(date))]} ${compact}`;
}

export function formatClock(value: string): string {
  const date = new Date(value); if (Number.isNaN(date.getTime())) return "—";
  return clockFormatter.format(date);
}

/**
 * Canonical berth key used for filtering and de-duplication. Legacy feeds
 * use all of `105`, `Kaj 105` and `Berth 105`; those labels must address the
 * same physical berth without changing the human-readable source label.
 */
export function normalizeBerthCode(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^(?:(?:berth|kaj)\s*)?([0-9]+[a-z]?)$/i);
  if (!match) return trimmed.toLocaleLowerCase("en").replace(/\s+/g, " ");
  const code = match[1];
  const digits = code.match(/^\d+/)?.[0] ?? code;
  const suffix = code.slice(digits.length).toUpperCase();
  return `${Number(digits)}${suffix}`;
}

/**
 * Build the compact berth choices shown in the filter UI.
 *
 * Legacy feeds can describe one physical berth as `105`, `Kaj 105` or
 * `Berth 105`. The filter itself already matches those values by their
 * canonical key; keeping the same canonical key here also prevents duplicate
 * checkboxes from appearing in the chooser.
 */
export function normalizeBerthOptions(values: readonly string[]): string[] {
  const unique = new Set<string>();
  values.forEach((value) => {
    if (typeof value !== "string" || !value.trim()) return;
    unique.add(normalizeBerthCode(value));
  });
  return [...unique].sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
}

export function formatBerthCode(value: string): string {
  const trimmed = value.trim();
  return trimmed.replace(/^(?:berth|kaj)\s+/i, "") || trimmed;
}

export function dataAgeMinutes(fetchedAt: string, now = Date.now()): number { return Math.max(0, Math.floor((now - Date.parse(fetchedAt)) / 60_000)); }

function sameStringArray(value: unknown, expected: readonly string[]): boolean {
  return Array.isArray(value) && value.length === expected.length && value.every((item, index) => item === expected[index]);
}

/**
 * Recognises only the untouched first-release defaults. A real preference
 * change (language, theme, mobile layout, sort, date format, columns, pins,
 * page size or refresh interval) opts the record out of the automatic default upgrade.
 */
function isLegacyUntouchedDefaults(candidate: Partial<WatchlistSettings>): boolean {
  const version = candidate.settingsVersion;
  const legacyOfficeColumns = sameStringArray(candidate.columns, LEGACY_COMPACT_PRESET_COLUMNS.office)
    || sameStringArray(candidate.columns, LEGACY_V3_PRESET_COLUMNS.office)
    || sameStringArray(candidate.columns, PRESET_COLUMNS.office);
  const legacyVersion = version === undefined
    || (Number.isFinite(Number(version)) && Number(version) >= LEGACY_WATCHLIST_SETTINGS_VERSION && Number(version) <= PREVIOUS_WATCHLIST_SETTINGS_VERSION);
  return legacyVersion
    && candidate.preset === LEGACY_UNTOUCHED_DEFAULTS.preset
    && candidate.density === LEGACY_UNTOUCHED_DEFAULTS.density
    && (candidate.mobileLayout === undefined || candidate.mobileLayout === "cards")
    && candidate.locale === LEGACY_UNTOUCHED_DEFAULTS.locale
    && candidate.theme === LEGACY_UNTOUCHED_DEFAULTS.theme
    && candidate.dateFormat === LEGACY_UNTOUCHED_DEFAULTS.dateFormat
    && candidate.sortKey === LEGACY_UNTOUCHED_DEFAULTS.sortKey
    && candidate.sortDirection === LEGACY_UNTOUCHED_DEFAULTS.sortDirection
    && legacyOfficeColumns
    && sameStringArray(candidate.hiddenColumns, LEGACY_UNTOUCHED_DEFAULTS.hiddenColumns)
    && sameStringArray(candidate.pinnedIds, LEGACY_UNTOUCHED_DEFAULTS.pinnedIds)
    && Number(candidate.pageSize) === LEGACY_UNTOUCHED_DEFAULTS.pageSize
    && Number(candidate.refreshMinutes) === LEGACY_UNTOUCHED_DEFAULTS.refreshMinutes;
}

export function mergeSettings(value: unknown): WatchlistSettings {
  if (!value || typeof value !== "object") return DEFAULT_SETTINGS;
  const rawCandidate = value as Partial<WatchlistSettings>;
  // Keep the source schema version for migration checks.  Untouched legacy
  // defaults are stamped with v6 below, but their v1-v5 column arrays must
  // still be recognised during this same merge.
  const rawVersionNumber = Number(rawCandidate.settingsVersion);
  const migrationEligible = rawCandidate.settingsVersion === undefined
    || (Number.isFinite(rawVersionNumber) && rawVersionNumber >= LEGACY_WATCHLIST_SETTINGS_VERSION && rawVersionNumber <= PREVIOUS_WATCHLIST_SETTINGS_VERSION);
  const candidate = isLegacyUntouchedDefaults(rawCandidate)
    ? { ...rawCandidate, locale: DEFAULT_SETTINGS.locale, theme: DEFAULT_SETTINGS.theme, sortKey: DEFAULT_SETTINGS.sortKey, settingsVersion: WATCHLIST_SETTINGS_VERSION }
    : rawCandidate;
  const presets = ["full", "office", "port", "quick"] as const;
  const densities = ["normal", "compact"] as const;
  const mobileLayouts = ["cards", "table"] as const;
  const locales = ["en", "da"] as const;
  const themes = ["light", "dark"] as const;
  const dateFormats = ["full", "compact"] as const;
  const sortKeys = SORT_KEYS;
  const sortDirections = ["asc", "desc"] as const;
  const preset = presets.includes(candidate.preset as ViewPreset) ? (candidate.preset as ViewPreset) : DEFAULT_SETTINGS.preset;
  const columns = Array.isArray(candidate.columns) ? candidate.columns.filter((column): column is ColumnKey => ALL_COLUMNS.includes(column as ColumnKey)) : [...PRESET_COLUMNS[preset]];
  const legacyPreset = preset === "full" ? LEGACY_FULL_PRESET_COLUMNS : LEGACY_COMPACT_PRESET_COLUMNS[preset];
  const visibleLegacy = (legacyColumns: readonly ColumnKey[] | undefined) => legacyColumns?.filter(column => column !== "customer");
  const matchesVisibleLegacy = (legacyColumns: readonly ColumnKey[] | undefined) => {
    const expected = visibleLegacy(legacyColumns);
    return expected?.length === columns.length && expected.every((column, index) => columns[index] === column);
  };
  const isLegacyPreset = matchesVisibleLegacy(legacyPreset)
    || (migrationEligible && preset === "full" && matchesVisibleLegacy(LEGACY_V4_FULL_PRESET_COLUMNS))
    || (preset !== "full" && matchesVisibleLegacy(LEGACY_V4_PRESET_COLUMNS[preset]))
    || (migrationEligible && matchesVisibleLegacy(LEGACY_V3_PRESET_COLUMNS[preset]));
  const normalizedColumns = isLegacyPreset ? [...PRESET_COLUMNS[preset]] : columns;
  const density = densities.includes(candidate.density as Density) ? candidate.density as Density : DEFAULT_SETTINGS.density;
  const mobileLayout = mobileLayouts.includes(candidate.mobileLayout as MobileLayout) ? candidate.mobileLayout as MobileLayout : DEFAULT_SETTINGS.mobileLayout;
  const locale = locales.includes(candidate.locale as Locale) ? candidate.locale as Locale : DEFAULT_SETTINGS.locale;
  const theme = themes.includes(candidate.theme as Theme) ? candidate.theme as Theme : DEFAULT_SETTINGS.theme;
  const dateFormat = dateFormats.includes(candidate.dateFormat as DateFormat) ? candidate.dateFormat as DateFormat : DEFAULT_SETTINGS.dateFormat;
  const sortKey = sortKeys.includes(candidate.sortKey as SortKey) ? candidate.sortKey as SortKey : DEFAULT_SETTINGS.sortKey;
  const sortDirection = sortDirections.includes(candidate.sortDirection as SortDirection) ? candidate.sortDirection as SortDirection : DEFAULT_SETTINGS.sortDirection;
  const pageSizeCandidate = Number(candidate.pageSize);
  const refreshCandidate = Number(candidate.refreshMinutes);
  return {
    ...DEFAULT_SETTINGS, settingsVersion: WATCHLIST_SETTINGS_VERSION, preset, density, mobileLayout, locale, theme, dateFormat, sortKey, sortDirection,
    columns: normalizedColumns.length ? normalizedColumns : [...PRESET_COLUMNS[preset]],
    hiddenColumns: Array.isArray(candidate.hiddenColumns) ? candidate.hiddenColumns.filter((column): column is ColumnKey => ALL_COLUMNS.includes(column as ColumnKey)) : [],
    pinnedIds: Array.isArray(candidate.pinnedIds) ? candidate.pinnedIds.filter((id): id is string => typeof id === "string") : [],
    pageSize: [10, 25, 50].includes(pageSizeCandidate) ? pageSizeCandidate : DEFAULT_SETTINGS.pageSize,
    refreshMinutes: Number.isFinite(refreshCandidate) ? Math.max(MIN_REFRESH_MINUTES, refreshCandidate) : DEFAULT_SETTINGS.refreshMinutes,
  };
}

export function mergeFilters(value: unknown): WatchlistFilters {
  if (!value || typeof value !== "object") return DEFAULT_FILTERS;
  const candidate = value as Partial<WatchlistFilters>;
  const statuses = Array.isArray(candidate.statuses)
    ? [...new Set(candidate.statuses.filter((status): status is PortCallStatus => ["expected", "en-route", "arrived", "departed"].includes(status as PortCallStatus)))]
    : [];
  const berths: string[] = [];
  const berthKeys = new Set<string>();
  if (Array.isArray(candidate.berths)) {
    candidate.berths.forEach((berth) => {
      if (typeof berth !== "string" || !berth.trim()) return;
      const trimmed = berth.trim();
      const key = normalizeBerthCode(trimmed);
      if (berthKeys.has(key)) return;
      berthKeys.add(key);
      berths.push(trimmed);
    });
  }
  return {
    query: typeof candidate.query === "string" ? candidate.query : "",
    statuses,
    berths,
    attentionOnly: candidate.attentionOnly === true,
    operationalOnly: candidate.operationalOnly === true,
    ...(candidate.studOnly === true ? { studOnly: true } : {}),
    ...(Array.isArray(candidate.serviceCodes) ? { serviceCodes: [...new Set(candidate.serviceCodes.filter((code): code is ServiceCode => code === "H" || code === "L" || code === "B"))] } : {}),
  };
}
