import { describe, expect, it } from "vitest";

import { mockWatchlistSnapshot } from "@/data/mockWatchlist";
import {
  ALL_COLUMNS,
  DEFAULT_FILTERS,
  DEFAULT_SETTINGS,
  MIN_REFRESH_MINUTES,
  PRESET_COLUMNS,
  PROTOTYPE_OPERATIONS_NOW,
  PROTOTYPE_OPERATIONS_HORIZON_HOURS,
  PREVIOUS_WATCHLIST_SETTINGS_VERSION,
  SORT_KEYS,
  SORTABLE_COLUMN_SORT_KEYS,
  WATCHLIST_SETTINGS_VERSION,
  dataAgeMinutes,
  getArrivalOperation,
  getActiveShiftingOperation,
  getDepartureOperation,
  getDeparturePlacement,
  getEffectivePlacement,
  filterPortCalls,
  formatBerthCode,
  formatDateTime,
  getLastCompletedOperation,
  getNextActionableOperation,
  getNextFutureOperation,
  getNextOperation,
  getOperationalWarnings,
  getHistoricalWarnings,
  classifyWarnings,
  cycleSort,
  getOccupancySegments,
  getOperationPlacement,
  getOperationallyActiveCalls,
  getRelevantBerthAssignments,
  getShiftingOperations,
  getWarnings,
  isOperationallyActiveCall,
  isStudCall,
  liveTime,
  mergeFilters,
  mergeSettings,
  moveColumn,
  moveColumnTo,
  naturalSortDirection,
  normalizeBerthCode,
  normalizeBerthOptions,
  paginate,
  primaryTime,
  removeRedundantNextOperation,
  searchPortCalls,
  selectBerthFilter,
  sortPortCalls,
  sortKeyForColumn,
  togglePinnedId,
  visibleColumns,
  type CallServiceOrder,
  type Placement,
  type PortCall,
  type PortOperation,
} from "./watchlist";

const calls = mockWatchlistSnapshot.calls;

function lifecycleFixture(): { call: PortCall; initial: Placement; shifted: Placement; future: Placement } {
  const source = calls.find((call) => getShiftingOperations(call).length >= 2)!;
  const arrival = getArrivalOperation(source)!; const departure = getDepartureOperation(source)!; const shifts = getShiftingOperations(source);
  const initial = getOperationPlacement(arrival)!; const shifted = getOperationPlacement(shifts[0])!; const future = getOperationPlacement(shifts[1])!;
  const now = Date.parse(PROTOTYPE_OPERATIONS_NOW);
  const updatedArrival = { ...arrival, at: new Date(now - 120 * 60_000).toISOString(), state: "actual" as const, placement: initial, berth: initial.berth, bollardFrom: initial.bollardFrom, bollardTo: initial.bollardTo, side: initial.side };
  const updatedShift = { ...shifts[0], at: new Date(now - 60 * 60_000).toISOString(), state: "actual" as const, placement: shifted, berth: shifted.berth, bollardFrom: shifted.bollardFrom, bollardTo: shifted.bollardTo, side: shifted.side };
  const upcomingShift = { ...shifts[1], at: new Date(now + 60 * 60_000).toISOString(), state: "expected" as const, placement: future, berth: future.berth, bollardFrom: future.bollardFrom, bollardTo: future.bollardTo, side: future.side };
  const updatedDeparture = { ...departure, at: new Date(now + 3 * 60 * 60_000).toISOString(), state: "expected" as const, placement: future, berth: future.berth, bollardFrom: future.bollardFrom, bollardTo: future.bollardTo, side: future.side };
  return { call: { ...source, id: "lifecycle-fixture", callNumber: "NPC-LIFECYCLE", status: "arrived", berth: initial.berth, bollardFrom: initial.bollardFrom, bollardTo: initial.bollardTo, side: initial.side, operations: [updatedArrival, updatedShift, upcomingShift, updatedDeparture] }, initial, shifted, future };
}

describe("fictional watchlist dataset", () => {
  it("contains a realistic 70+ call workload with unique operational identifiers", () => {
    expect(calls).toHaveLength(76);
    expect(new Set(calls.map((call) => call.id)).size).toBe(76);
    expect(new Set(calls.map((call) => call.callNumber)).size).toBe(76);
    expect(new Set(calls.map((call) => call.imo)).size).toBe(76);
  });

  it("contains all four statuses and optional operation groups", () => {
    expect(new Set(calls.map((call) => call.status))).toEqual(new Set(["expected", "en-route", "arrived", "departed"]));
    expect(calls.some((call) => call.operations.some((item) => item.type === "shifting"))).toBe(true);
    expect(calls.some((call) => call.operations.some((item) => item.type === "assistance"))).toBe(true);
    expect(calls.some((call) => call.operations.some((item) => item.type === "anchorage"))).toBe(true);
    expect(calls.some((call) => call.operations.every((item) => item.type === "arrival" || item.type === "departure"))).toBe(true);
    expect(calls.some((call) => call.craneStatus !== "none")).toBe(true);
    expect(calls.some((call) => call.operations.some((item) => item.serviceCodes?.length))).toBe(true);
  });

  it("removes only the first redundant optional operation and matches linked service-order ids", () => {
    const makeOperation = (overrides: Partial<PortOperation>): PortOperation => ({
      id: "operation", type: "assistance", label: "Assistance", at: "2026-08-21T07:00:00.000Z", state: "ordered", serviceCodes: [], ...overrides,
    });
    const first = makeOperation({ id: "operation-1", serviceOrderId: "order-1" });
    const linkedNext = makeOperation({ id: "order-1", serviceOrderId: "order-1", source: "service-order" });
    const second = makeOperation({ id: "operation-2", at: "2026-08-21T08:00:00.000Z" });

    expect(removeRedundantNextOperation([first, second], linkedNext)).toEqual([second]);
    expect(removeRedundantNextOperation([second, first], linkedNext)).toEqual([second, first]);
    expect(removeRedundantNextOperation([first], makeOperation({ id: "arrival-1", type: "arrival" }))).toEqual([first]);
  });

  it("keeps service orders linked through IDs and uses configurable duty-code-shaped data", () => {
    const orderIds = new Set(mockWatchlistSnapshot.serviceOrders.map((order) => order.id));
    calls.flatMap((call) => call.serviceOrderIds).forEach((id) => expect(orderIds.has(id)).toBe(true));
    expect(mockWatchlistSnapshot.serviceOrders.every((order) => order.dutyCode.length > 2 && order.displayText.length > 3)).toBe(true);
  });

  it("contains multiple notes and restricted FlexPort mock states", () => {
    expect(calls.some((call) => call.notes.length > 1)).toBe(true);
    expect(calls.some((call) => call.documents.some((document) => document.state === "restricted"))).toBe(true);
  });

  it("keeps quay calls normalized and gives explicit STUD calls registrable off-quay lifecycle operations", () => {
    const quayCalls = calls.filter(call => !isStudCall(call));
    const studCalls = calls.filter(isStudCall);
    expect(quayCalls.every((call) => call.operations.filter((operation) => operation.type === "arrival").length === 1)).toBe(true);
    expect(quayCalls.every((call) => call.operations.filter((operation) => operation.type === "departure").length === 1)).toBe(true);
    expect(studCalls).toHaveLength(2);
    expect(studCalls.every(call => call.workLocation === "stud")).toBe(true);
    expect(studCalls.every(call => call.operations.map(operation => operation.type).join(",") === "arrival,assistance,departure")).toBe(true);
    expect(studCalls.every(call => call.operations.every(operation => operation.workLocation === "stud" && getOperationPlacement(operation) === undefined))).toBe(true);
    expect(studCalls.every(call => call.operations.every((operation, index, operations) => index === 0 || Date.parse(operations[index - 1].at) < Date.parse(operation.at)))).toBe(true);
    expect(studCalls.every(call => getRelevantBerthAssignments(call).length === 0 && getOccupancySegments(call).length === 0 && getEffectivePlacement(call) === undefined)).toBe(true);
    const legacyAssistanceStud = { ...quayCalls[0], workLocation: undefined, operations: [{ ...quayCalls[0].operations[0], type: "assistance" as const, workLocation: "stud" as const, placement: undefined, berth: undefined, bollardFrom: undefined, bollardTo: undefined, side: undefined }] };
    expect(isStudCall(legacyAssistanceStud)).toBe(true);
    const legacyArrivalStud = { ...legacyAssistanceStud, operations: [{ ...legacyAssistanceStud.operations[0], type: "arrival" as const }] };
    expect(isStudCall(legacyArrivalStud)).toBe(false);
    expect(isStudCall({ ...studCalls[0], workLocation: "quay" })).toBe(false);
    expect(calls.every((call) => call.operations.every((operation) => Array.isArray(operation.serviceCodes)))).toBe(true);
    const tugOperations = calls.flatMap((call) => call.operations).filter((operation) => operation.serviceCodes.includes("B"));
    expect(tugOperations.length).toBeGreaterThan(0);
    expect(tugOperations.every((operation) => Number.isInteger(operation.tugQuantity) && operation.tugQuantity! > 0)).toBe(true);
    expect(calls.filter((call) => getShiftingOperations(call).length > 0).every((call) => getShiftingOperations(call).every((operation) => {
      const placement = getOperationPlacement(operation);
      return placement && placement.berth && Number.isFinite(placement.bollardFrom) && Number.isFinite(placement.bollardTo) && placement.side;
    }))).toBe(true);
  });

  it("keeps the operation timestamp and state aligned with its operative arrival/departure time", () => {
    const stateFor = (times: PortCall["arrivalTimes"], at: string): "expected" | "ordered" | "actual" => {
      const selected = times.find((time) => time.kind === "actual" && time.value === at)
        ?? times.find((time) => time.kind === "ordered" && time.value === at)
        ?? times.find((time) => time.kind === "expected" && time.value === at);
      const kind = selected?.kind ?? "expected";
      return kind === "actual" ? "actual" : kind === "expected" ? "expected" : "ordered";
    };
    calls.filter(call => !isStudCall(call)).forEach((call) => {
      const arrival = getArrivalOperation(call)!; const departure = getDepartureOperation(call)!;
      expect(arrival.at).toBe(primaryTime(call.arrivalTimes.filter(time => time.kind !== "live")));
      expect(arrival.state).toBe(stateFor(call.arrivalTimes, arrival.at));
      expect(departure.at).toBe(primaryTime(call.departureTimes.filter(time => time.kind !== "live")));
      expect(departure.state).toBe(stateFor(call.departureTimes, departure.at));
      expect(getOperationPlacement(departure)).toEqual(getDeparturePlacement(call));
    });
  });

  it("keeps departed calls completed when live and actual timestamps coincide", () => {
    const departed = calls.filter((call) => call.status === "departed");
    expect(departed.length).toBeGreaterThan(0);
    expect(departed.every((call) => getArrivalOperation(call)?.state === "actual")).toBe(true);
    expect(departed.every((call) => getDepartureOperation(call)?.state === "actual")).toBe(true);
    const duplicateLiveActual = departed.find((call) => call.arrivalTimes.some((time) => time.kind === "live" && call.arrivalTimes.some((other) => other.kind === "actual" && other.value === time.value)));
    expect(duplicateLiveActual).toBeDefined();
    const actualTime = duplicateLiveActual!.arrivalTimes.find((time) => time.kind === "actual")!.value;
    expect(getArrivalOperation(duplicateLiveActual!)?.at).toBe(actualTime);
    expect(getArrivalOperation(duplicateLiveActual!)?.state).toBe("actual");
    expect(departed.every((call) => getNextActionableOperation(call) === undefined)).toBe(true);
    expect(departed.every((call) => !getWarnings(call, departed).some((warning) => warning.type === "overdue"))).toBe(true);
  });

  it("uses normalized arrival placement when legacy top-level placement is stale", () => {
    const source = calls.find((call) => call.status === "arrived" && getShiftingOperations(call).length === 0)!;
    const arrival = getArrivalOperation(source)!;
    const arrivalPlacement = getOperationPlacement(arrival)!;
    const staleSide = arrivalPlacement.side === "port" ? "starboard" : "port";
    const call = {
      ...source,
      berth: "Legacy berth",
      bollardFrom: 900,
      bollardTo: 910,
      side: staleSide as Placement["side"],
      operations: source.operations.map((operation) => operation.type === "departure"
        ? { ...operation, placement: undefined, berth: undefined, bollardFrom: undefined, bollardTo: undefined, side: undefined }
        : operation),
    };
    expect(getEffectivePlacement(call)).toEqual(arrivalPlacement);
    expect(getDeparturePlacement(call)).toEqual(arrivalPlacement);
  });

  it("represents a currently shifted vessel and a multi-shift vessel", () => {
    const currentShift = calls.find((call) => call.status === "arrived" && getShiftingOperations(call).some((operation) => operation.state === "actual"));
    expect(currentShift).toBeDefined();
    expect(getEffectivePlacement(currentShift!)).toEqual(getOperationPlacement(getShiftingOperations(currentShift!).find((operation) => operation.state === "actual")!));
    const multiShift = calls.find((call) => getShiftingOperations(call).length > 1);
    expect(multiShift).toBeDefined();
    expect(getShiftingOperations(multiShift!).length).toBeGreaterThanOrEqual(2);
    expect(getDeparturePlacement(multiShift!)).toEqual(getOperationPlacement(getDepartureOperation(multiShift!)!));
  });
});

describe("search and filter", () => {
  const first = calls[0];

  it.each(["callNumber", "vesselName", "imo", "callSign"] as const)("searches the %s field", (field) => {
    expect(searchPortCalls(calls, first[field])).toContainEqual(first);
  });

  it("searches current and upcoming berths, agent and category but not customer", () => {
    const current = calls.find((call) => call.berth === "Berth 304");
    const upcoming = current && {
      ...current,
      id: "upcoming-304",
      callNumber: "NPC-304-UPCOMING",
      berth: "Berth 302",
      operations: [
        { ...current.operations[0], id: "upcoming-304-history", berth: "Berth 404", at: "2026-08-21T04:00:00+02:00", state: "actual" as const },
        { ...current.operations[0], id: "upcoming-304-berth", berth: "Berth 304", at: "2026-08-21T12:00:00+02:00", state: "expected" as const },
      ],
    };
    expect(current).toBeDefined();
    expect(upcoming).toBeDefined();
    expect(searchPortCalls([...calls, upcoming!], "304")).toEqual(expect.arrayContaining([current, upcoming]));
    expect(searchPortCalls([upcoming!], "404")).toEqual([]);
    const customerOnly = { ...first, customer: "Customer-only lookup token" };
    expect(searchPortCalls([customerOnly], customerOnly.customer)).toEqual([]);
    expect(searchPortCalls(calls, first.agent)).toContainEqual(first);
    expect(searchPortCalls(calls, first.category)).toContainEqual(first);
  });

  it("searches lifecycle operations through Danish type aliases and source labels/details", () => {
    const source = calls.find((call) => call.operations.some((operation) => operation.type === "shifting"))!;
    const departed = calls.find((call) => call.status === "departed")!;
    const shifted = source.operations.find((operation) => operation.type === "shifting")!;
    const arrival = source.operations.find((operation) => operation.type === "arrival")!;
    const departure = source.operations.find((operation) => operation.type === "departure")!;

    expect(searchPortCalls([source], "skift")).toEqual([source]);
    expect(searchPortCalls([source], "forhaling")).toEqual([source]);
    expect(searchPortCalls([source], shifted.details!)).toEqual([source]);
    expect(searchPortCalls([source], "ankomst")).toEqual([source]);
    expect(searchPortCalls([source], "afgang")).toEqual([source]);
    expect(departed).toBeDefined();
    expect(searchPortCalls([departed], "afgaaet")).toEqual([departed]);
    expect(searchPortCalls([source], "afgaaet")).toEqual([]);
    expect(searchPortCalls([source], arrival.id)).toEqual([source]);
    expect(searchPortCalls([source], departure.at)).toEqual([source]);
  });

  it("searches linked and service-order-only fields, including duty and service codes", () => {
    const source = calls.find((call) => call.serviceOrderIds.length > 0)!;
    const order = mockWatchlistSnapshot.serviceOrders.find((candidate) => candidate.portCallId === source.id)!;
    const serviceOrderOnly: CallServiceOrder = {
      id: "service-search-only",
      portCallId: source.id,
      dutyCode: "PIL-SEARCH",
      displayText: "Lods ved kaj",
      scheduledAt: "2026-08-21T11:11:00+02:00",
      quantity: 7,
      status: "ordered",
      serviceCode: "L",
      operationId: undefined,
    };

    expect(searchPortCalls([source], order.dutyCode, PROTOTYPE_OPERATIONS_NOW, [order])).toEqual([source]);
    expect(searchPortCalls([source], order.serviceCode!, PROTOTYPE_OPERATIONS_NOW, [order])).toEqual([source]);
    expect(searchPortCalls([source], serviceOrderOnly.dutyCode, PROTOTYPE_OPERATIONS_NOW, [serviceOrderOnly])).toEqual([source]);
    expect(searchPortCalls([source], "lods", PROTOTYPE_OPERATIONS_NOW, [serviceOrderOnly])).toEqual([source]);
    expect(searchPortCalls([source], String(serviceOrderOnly.quantity), PROTOTYPE_OPERATIONS_NOW, [serviceOrderOnly])).toEqual([source]);
  });

  it("treats an empty query as a fresh complete result", () => {
    const result = searchPortCalls(calls, "   ");
    expect(result).toEqual(calls);
    expect(result).not.toBe(calls);
  });

  it("filters by berth for both current and upcoming calls", () => {
    const berth = "Berth 203";
    const result = filterPortCalls(calls, { query: "", statuses: [], berths: [berth], attentionOnly: false, operationalOnly: false });
    expect(result.length).toBeGreaterThan(2);
    expect(result.every((call) => getRelevantBerthAssignments(call).some((assignment) => assignment.berth === berth))).toBe(true);
    expect(result.some((call) => call.status === "expected" || call.status === "en-route")).toBe(true);
    expect(result.some((call) => call.status === "departed")).toBe(false);
  });

  it("filters call-level STUD work without leaking compatibility quay data", () => {
    const studCalls = filterPortCalls(calls, { ...DEFAULT_FILTERS, studOnly: true });
    expect(studCalls).toHaveLength(2);
    expect(studCalls.every(isStudCall)).toBe(true);
    expect(studCalls.every(call => call.operations.map(operation => operation.type).join(",") === "arrival,assistance,departure")).toBe(true);
    expect(studCalls.every(call => getRelevantBerthAssignments(call).length === 0)).toBe(true);
    expect(searchPortCalls(studCalls, "STUD")).toEqual(studCalls);
  });

  it("selects exactly one berth while preserving the other active filters", () => {
    const filters = {
      query: "Baltic", statuses: ["expected"] as const, berths: ["Berth 101"], attentionOnly: true, operationalOnly: false,
    };
    expect(selectBerthFilter(filters, " Berth 205 ")).toEqual({
      ...filters, berths: ["Berth 205"],
    });
    expect(selectBerthFilter(filters, "   ")).toEqual({
      ...filters, berths: [],
    });
  });

  it("filters berths by current or future assignments, not completed historical shifts", () => {
    const { call, initial, future } = lifecycleFixture();
    const baseFilters = { ...DEFAULT_FILTERS };
    // The canonical berth key intentionally matches the later return to the
    // same physical berth even though the earlier placement is historical.
    expect(filterPortCalls([call], { ...baseFilters, berths: [initial.berth] })).toEqual([call]);
    expect(filterPortCalls([call], { ...baseFilters, berths: [future.berth] })).toEqual([call]);
  });

  it("filters a vessel by its current actual shift and later planned shift, not its historical berth", () => {
    const { call, initial, shifted, future } = lifecycleFixture();
    const filters = { ...DEFAULT_FILTERS, berths: [shifted.berth] };
    expect(getEffectivePlacement(call)).toEqual(shifted);
    expect(getRelevantBerthAssignments(call).map((assignment) => assignment.berth)).toEqual(expect.arrayContaining([shifted.berth, future.berth]));
    expect(getRelevantBerthAssignments(call).map((assignment) => assignment.berth)).not.toContain(initial.berth);
    expect(filterPortCalls([call], filters)).toEqual([call]);
    expect(filterPortCalls([call], { ...DEFAULT_FILTERS, berths: [future.berth] })).toEqual([call]);
    expect(filterPortCalls([call], { ...DEFAULT_FILTERS, berths: [initial.berth] })).toEqual([call]);
  });

  it("treats Berth, Kaj and bare numeric labels as one filter key", () => {
    const source = calls.find((call) => call.status === "arrived" && getShiftingOperations(call).length === 0)!;
    const variants = ["105", "Kaj 105", "Berth 105"].map((berth, index) => ({
      ...source,
      id: `mixed-berth-${index}`,
      callNumber: `NPC-MIXED-${index}`,
      berth,
      operations: source.operations.map((operation) => {
        const placement = getOperationPlacement(operation);
        return placement ? { ...operation, placement: { ...placement, berth }, berth } : operation;
      }),
    }));
    const result = filterPortCalls(variants, { ...DEFAULT_FILTERS, berths: ["Kaj 105"] });
    expect(result.map((call) => call.id)).toEqual(variants.map((call) => call.id));
    expect(mergeFilters({ ...DEFAULT_FILTERS, berths: ["105", "Kaj 105", "Berth 105", "105"] }).berths).toEqual(["105"]);
    expect(normalizeBerthCode("Berth 00105")).toBe("105");
  });

  it("deduplicates displayed berth filter choices by their normalized code", () => {
    expect(normalizeBerthOptions(["Berth 105", "Kaj 105", "105", "Berth 107", "", "  "])).toEqual(["105", "107"]);
    expect(normalizeBerthOptions(["Kaj 2A", "Berth 2A", "2A", "Kaj 11"])).toEqual(["2A", "11"]);
  });

  it("makes the operational-only filter exactly match the active-call metric", () => {
    const filtered = filterPortCalls(calls, { ...DEFAULT_FILTERS, operationalOnly: true }, calls);
    const active = getOperationallyActiveCalls(calls);
    expect(filtered.map((call) => call.id)).toEqual(active.map((call) => call.id));
    expect(filtered).toHaveLength(22);
  });

  it("keeps filtering and sorting as independent operations", () => {
    const filtered = filterPortCalls(calls, { query: "", statuses: ["expected"], berths: [], attentionOnly: false, operationalOnly: false });
    const sorted = sortPortCalls(filtered, "eta", "desc");
    expect(sorted.every((call) => call.status === "expected")).toBe(true);
    expect(sorted).not.toEqual(filtered);
  });
});

describe("warnings and job order", () => {
  it("separates historical warnings from current operational attention", () => {
    const departed = calls.find((call) => call.status === "departed")!;
    const classification = classifyWarnings(departed, calls);
    expect(classification.operational).toEqual([]);
    expect(classification.historical).toEqual(getWarnings(departed, calls));
    expect(getOperationalWarnings(departed, calls)).toEqual([]);
    expect(getHistoricalWarnings(departed, calls).length).toBeGreaterThan(0);
  });

  it("chooses the latest shift when shift windows overlap", () => {
    const source = calls.find((call) => getShiftingOperations(call).length >= 2)!;
    const shifts = getShiftingOperations(source);
    const now = Date.parse(PROTOTYPE_OPERATIONS_NOW);
    const first = { ...shifts[0], at: new Date(now - 10 * 60_000).toISOString() };
    const second = { ...shifts[1], at: new Date(now - 5 * 60_000).toISOString() };
    const call = { ...source, operations: source.operations.map((operation) => operation.id === first.id ? first : operation.id === second.id ? second : operation) };
    expect(getActiveShiftingOperation(call)?.id).toBe(second.id);
  });

  it("reconciles a linked service order instead of keeping stale operation state", () => {
    const source = calls.find((call) => call.serviceOrderIds.length > 0)!;
    const serviceOrder = mockWatchlistSnapshot.serviceOrders.find((order) => order.portCallId === source.id)!;
    const assistance = source.operations.find((operation) => operation.id === serviceOrder.operationId)!;
    const oldAt = new Date(Date.parse(PROTOTYPE_OPERATIONS_NOW) - 30 * 60_000).toISOString();
    const call = { ...source, operations: source.operations.map((operation) => operation.id === assistance.id ? { ...operation, at: oldAt, state: "ordered" as const } : operation) };
    const reconciled = { ...serviceOrder, status: "actual" as const, scheduledAt: oldAt };
    expect(getNextActionableOperation(call, PROTOTYPE_OPERATIONS_NOW, [reconciled])?.id).not.toBe(assistance.id);
    expect(getWarnings(call, [call], PROTOTYPE_OPERATIONS_NOW, [reconciled]).some((warning) => warning.type === "overdue" && warning.message.includes(assistance.label))).toBe(false);
  });

  it("explains delay, overlap, conflict, and uncertain-data signals", () => {
    const allWarnings = calls.flatMap((call) => getWarnings(call, calls));
    expect(new Set(allWarnings.map((warning) => warning.type))).toEqual(new Set(["delay", "overlap", "conflict", "uncertain"]));
    expect(allWarnings.every((warning) => warning.message.length > 20)).toBe(true);
  });

  it("warns when a live arrival crosses the planned departure", () => {
    const source = calls[0];
    const conflicted: PortCall = {
      ...source,
      arrivalTimes: [{ kind: "expected", value: "2026-08-21T08:00:00Z" }, { kind: "live", value: "2026-08-21T14:00:00Z" }],
      departureTimes: [{ kind: "expected", value: "2026-08-21T12:00:00Z" }],
    };
    expect(getWarnings(conflicted, [conflicted]).some((warning) => warning.message.includes("planned departure"))).toBe(true);
  });

  it("stops treating live ETA as actionable after an actual arrival", () => {
    const departed = calls.find((call) => call.callNumber === "011300")!;
    expect(departed.arrivalTimes.some((time) => time.kind === "actual")).toBe(true);
    expect(departed.arrivalTimes.some((time) => time.kind === "live")).toBe(true);
    expect(liveTime(departed.arrivalTimes)).toBeUndefined();
    const warnings = getWarnings(departed, [departed]);
    expect(warnings.some((warning) => warning.type === "delay")).toBe(false);
    expect(warnings.some((warning) => warning.message.includes("Live ETA"))).toBe(false);
    const unfinishedArrival = [{ kind: "expected", value: "2026-08-21T01:00:00Z" }, { kind: "live", value: "2026-08-21T04:20:00Z" }] as const;
    expect(liveTime(unfinishedArrival)).toBe("2026-08-21T04:20:00Z");
    expect(liveTime([...unfinishedArrival, { kind: "actual", value: "2026-08-21T01:35:00Z" }])).toBeUndefined();
  });

  it("uses the next future operation across every operation group", () => {
    const multiShift = calls.find((call) => call.operations.filter((operation) => operation.type === "shifting").length > 1)!;
    const now = "2026-08-21T00:00:00+02:00";
    const next = getNextFutureOperation(multiShift, now);
    const sorted = [...multiShift.operations].filter((operation) => operation.state !== "actual" && Date.parse(operation.at) >= Date.parse(now)).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    expect(next?.id).toBe(sorted[0].id);
    expect(getNextOperation(multiShift, now)?.id).toBe(next?.id);
  });

  it("never reports a completed past operation as next", () => {
    const source = calls[0];
    const now = PROTOTYPE_OPERATIONS_NOW;
    const completed: PortCall = {
      ...source,
      operations: source.operations.map((operation) => ({ ...operation, at: "2026-08-21T04:00:00+02:00", state: "actual" as const })),
    };
    expect(getNextFutureOperation(completed, now)).toBeUndefined();
    expect(getNextOperation(completed, now)).toBeUndefined();
    expect(getLastCompletedOperation(completed, now)?.at).toBe("2026-08-21T04:00:00+02:00");
  });

  it("returns an overdue unfinished event before later future work", () => {
    const source = calls.find((call) => call.status === "arrived")!;
    const now = Date.parse(PROTOTYPE_OPERATIONS_NOW);
    const arrival = getArrivalOperation(source)!; const departure = getDepartureOperation(source)!;
    const overdue = { ...arrival, id: "overdue-arrival", at: new Date(now - 30 * 60_000).toISOString(), state: "ordered" as const };
    const future = { ...departure, id: "future-departure", at: new Date(now + 30 * 60_000).toISOString(), state: "expected" as const };
    const call = { ...source, operations: [overdue, future] };
    expect(getNextActionableOperation(call)?.id).toBe("overdue-arrival");
    expect(getNextFutureOperation(call)?.id).toBe("future-departure");
    expect(getNextOperation(call)?.id).toBe("overdue-arrival");
    expect(getWarnings(call, [call]).some((warning) => warning.type === "overdue")).toBe(true);
    const completed = { ...call, operations: call.operations.map((operation) => ({ ...operation, state: "actual" as const, at: new Date(now - 5 * 60_000).toISOString() })) };
    expect(getWarnings(completed, [completed]).some((warning) => warning.type === "overdue")).toBe(false);
  });

  it("includes unique service events without double-counting linked assistance", () => {
    const source = calls.find((call) => call.serviceOrderIds.length > 0)!;
    const duplicateOrders = mockWatchlistSnapshot.serviceOrders.filter((order) => order.portCallId === source.id);
    const uniqueOrder: CallServiceOrder = { id: "service-unique", portCallId: source.id, dutyCode: "TUG1", displayText: "Extra tug service", scheduledAt: "2026-08-21T06:20:00+02:00", quantity: 1, status: "ordered", serviceCode: "B" };
    const allActual = source.operations.map((operation) => ({ ...operation, state: "actual" as const }));
    const call = { ...source, operations: allActual };
    expect(getNextActionableOperation(call, PROTOTYPE_OPERATIONS_NOW, [...duplicateOrders, uniqueOrder])?.id).toBe("service-unique");
    expect(getNextActionableOperation(source, PROTOTYPE_OPERATIONS_NOW, duplicateOrders)?.id).not.toBe(duplicateOrders[0]?.id);
  });

  it("creates berth occupancy segments for every shift and uses the final placement for departure", () => {
    const { call, initial, shifted, future } = lifecycleFixture();
    const segments = getOccupancySegments(call);
    expect(segments).toHaveLength(3);
    expect(segments.map((segment) => segment.placement.berth)).toEqual([initial.berth, shifted.berth, future.berth]);
    expect(segments.every((segment) => Date.parse(segment.startAt) < Date.parse(segment.endAt))).toBe(true);
    expect(getDeparturePlacement(call)).toEqual(future);
    expect(getOperationPlacement(getDepartureOperation(call)!)).toEqual(future);
  });

  it("warns on overlapping assignment segments and stays quiet for disjoint intervals", () => {
    const { call } = lifecycleFixture();
    const other = { ...call, id: "overlap-other", callNumber: "NPC-OVERLAP", operations: call.operations.map((operation) => ({ ...operation, id: `${operation.id}-other` })) };
    const staleTopLevel = { ...call, berth: "Legacy berth", bollardFrom: 900, bollardTo: 910 };
    const overlapWarning = getWarnings(staleTopLevel, [staleTopLevel, other]).find((warning) => warning.type === "overlap");
    const firstSegment = getOccupancySegments(staleTopLevel)[0];
    expect(overlapWarning).toBeDefined();
    expect(overlapWarning?.message).toContain(`${firstSegment.placement.berth} bollards ${firstSegment.placement.bollardFrom}-${firstSegment.placement.bollardTo}`);
    expect(overlapWarning?.message).toContain("NPC-OVERLAP");
    expect(overlapWarning?.message).not.toContain("Legacy berth");
    const disjoint = { ...other, operations: other.operations.map((operation) => ({ ...operation, at: new Date(Date.parse(operation.at) + 12 * 60 * 60_000).toISOString() })) };
    expect(getWarnings(staleTopLevel, [staleTopLevel, disjoint]).some((warning) => warning.type === "overlap")).toBe(false);
  });

  it("sorts by job order and preserves call number as a stable tie-breaker", () => {
    const sorted = sortPortCalls(calls.slice(25, 50), "job-order", "asc");
    const operations = sorted.map((call) => getNextFutureOperation(call)?.at);
    const actionable = operations.filter((operation): operation is string => operation !== undefined).map(Date.parse);
    expect(actionable).toEqual([...actionable].sort((a, b) => a - b));
    expect(operations.slice(actionable.length)).toEqual(operations.slice(actionable.length).map(() => undefined));
  });

  it("uses job order as the default sort", () => {
    const unsorted = [calls[12], calls[3], calls[9]];
    expect(DEFAULT_SETTINGS.sortKey).toBe("job-order");
    const sorted = sortPortCalls(unsorted, DEFAULT_SETTINGS.sortKey, DEFAULT_SETTINGS.sortDirection);
    const expected = [...unsorted].sort((a, b) => {
      const left = getNextFutureOperation(a);
      const right = getNextFutureOperation(b);
      if (left && !right) return -1;
      if (!left && right) return 1;
      return (left && right ? Date.parse(left.at) - Date.parse(right.at) : 0) || a.callNumber.localeCompare(b.callNumber, "en", { numeric: true });
    });
    expect(sorted.map((call) => call.id)).toEqual(expected.map((call) => call.id));
  });
});

describe("column sorting", () => {
  it("maps every table column to the shared sort-key contract", () => {
    expect(Object.keys(SORTABLE_COLUMN_SORT_KEYS)).toHaveLength(ALL_COLUMNS.length + 1);
    ALL_COLUMNS.forEach((column) => expect(sortKeyForColumn(column)).toBe(SORTABLE_COLUMN_SORT_KEYS[column]));
    expect(ALL_COLUMNS).not.toContain("customer");
    expect(sortKeyForColumn("customer")).toBe("customer");
    expect(sortKeyForColumn("nextJob")).toBe("job-order");
    expect(SORT_KEYS).toContain("operations");
    expect(SORT_KEYS).toContain("notes");
  });

  it("cycles natural direction, reverse direction, then resets to default job order", () => {
    expect(naturalSortDirection("signal")).toBe("desc");
    expect(naturalSortDirection("loa")).toBe("desc");
    expect(naturalSortDirection("job-order")).toBe("asc");
    expect(cycleSort("job-order", "asc", "job-order", null)).toEqual({ sortKey: "job-order", sortDirection: "asc", activeSortKey: "job-order" });
    expect(cycleSort("job-order", "asc", "job-order", "job-order")).toEqual({ sortKey: "job-order", sortDirection: "desc", activeSortKey: "job-order" });
    expect(cycleSort("job-order", "desc", "job-order", "job-order")).toEqual({ sortKey: "job-order", sortDirection: "asc", activeSortKey: null });
    expect(cycleSort("job-order", "asc", "agent", null)).toEqual({ sortKey: "agent", sortDirection: "asc", activeSortKey: "agent" });
    expect(cycleSort("agent", "asc", "agent", "agent")).toEqual({ sortKey: "agent", sortDirection: "desc", activeSortKey: "agent" });
    expect(cycleSort("agent", "desc", "agent", "agent")).toEqual({ sortKey: "job-order", sortDirection: "asc", activeSortKey: null });
    expect(cycleSort("signal", "desc", "signal", "signal")).toEqual({ sortKey: "signal", sortDirection: "asc", activeSortKey: "signal" });
    expect(cycleSort("signal", "asc", "signal", "signal")).toEqual({ sortKey: "job-order", sortDirection: "asc", activeSortKey: null });
    expect(cycleSort("loa", "desc", "loa", null)).toEqual({ sortKey: "loa", sortDirection: "desc", activeSortKey: "loa" });
  });

  it("sorts empty values last in both directions and retains deterministic ties", () => {
    const source = calls[0];
    const fixture = [
      { ...source, id: "sort-empty", callNumber: "NPC-SORT-001", agent: "" },
      { ...source, id: "sort-zulu", callNumber: "NPC-SORT-002", agent: "Zulu" },
      { ...source, id: "sort-alpha", callNumber: "NPC-SORT-003", agent: "Alpha" },
    ];
    expect(sortPortCalls(fixture, "agent", "asc").map((call) => call.id)).toEqual(["sort-alpha", "sort-zulu", "sort-empty"]);
    expect(sortPortCalls(fixture, "agent", "desc").map((call) => call.id)).toEqual(["sort-zulu", "sort-alpha", "sort-empty"]);
    expect(fixture.map((call) => call.id)).toEqual(["sort-empty", "sort-zulu", "sort-alpha"]);
  });

  it("keeps saved pin order inside pinned-first and unpinned-first views", () => {
    const fixture = [calls[2], calls[1], calls[0]];
    const pinnedIds = [calls[0].id, calls[2].id];
    expect(sortPortCalls(fixture, "pin", "desc", pinnedIds).map((call) => call.id)).toEqual([calls[0].id, calls[2].id, calls[1].id]);
    expect(sortPortCalls(fixture, "pin", "asc", pinnedIds).map((call) => call.id)).toEqual([calls[1].id, calls[0].id, calls[2].id]);
  });
});

describe("preferences and list behavior", () => {
  it("pins calls above the selected sort without mutating data", () => {
    const pinned = calls[40];
    const sorted = sortPortCalls(calls, "call-number", "asc", [pinned.id]);
    expect(sorted[0]).toEqual(pinned);
    expect(calls[0]).not.toEqual(pinned);
  });

  it("keeps pinned order first, then future work, then calls with no future work", () => {
    const source = calls[0];
    const completed: PortCall = {
      ...source,
      id: "completed-last",
      callNumber: "NPC-99999",
      operations: source.operations.map((operation) => ({ ...operation, at: "2026-08-21T04:00:00+02:00", state: "actual" as const })),
    };
    const pinned = calls[35];
    const sorted = sortPortCalls([completed, calls[20], pinned], "job-order", "asc", [pinned.id]);
    expect(sorted[0].id).toBe(pinned.id);
    expect(getNextFutureOperation(sorted[1])).toBeDefined();
    expect(getNextFutureOperation(sorted[2])).toBeUndefined();
  });

  it("toggles pinning without duplicates", () => {
    expect(togglePinnedId([], "a")).toEqual(["a"]);
    expect(togglePinnedId(["a", "b", "a"], "a")).toEqual(["b"]);
  });

  it("moves columns within bounds", () => {
    expect(moveColumn(["vessel", "eta", "berth"], "eta", -1)).toEqual(["eta", "vessel", "berth"]);
    expect(moveColumn(["vessel", "eta"], "vessel", -1)).toEqual(["vessel", "eta"]);
  });

  it("moves a dragged column to the target's original position", () => {
    const columns = ["vessel", "eta", "berth", "nextJob"] as const;
    expect(moveColumnTo(columns, "vessel", "eta")).toEqual(["eta", "vessel", "berth", "nextJob"]);
    expect(moveColumnTo(columns, "eta", "nextJob")).toEqual(["vessel", "berth", "nextJob", "eta"]);
    expect(moveColumnTo(columns, "nextJob", "eta")).toEqual(["vessel", "nextJob", "eta", "berth"]);
    expect(moveColumnTo(columns, "berth", "berth")).toEqual([...columns]);
    expect(moveColumnTo(columns, "status", "eta")).toEqual([...columns]);
    expect(moveColumnTo(columns, "eta", "status")).toEqual([...columns]);
  });

  it("supports pagination for all required page sizes", () => {
    expect(paginate(calls, 1, 10).pages).toBe(8);
    expect(paginate(calls, 2, 25).items).toHaveLength(25);
    expect(paginate(calls, 2, 50).items).toHaveLength(26);
  });

  it("has Danish, compact office mode, job order and a safe refresh floor by default", () => {
    expect(DEFAULT_SETTINGS.locale).toBe("da");
    expect(DEFAULT_SETTINGS.preset).toBe("office");
    expect(DEFAULT_SETTINGS.density).toBe("compact");
    expect(DEFAULT_SETTINGS.mobileLayout).toBe("cards");
    expect(DEFAULT_SETTINGS.theme).toBe("light");
    expect(DEFAULT_SETTINGS.sortKey).toBe("job-order");
    expect(DEFAULT_SETTINGS.sortDirection).toBe("asc");
    expect(DEFAULT_SETTINGS.refreshMinutes).toBe(MIN_REFRESH_MINUTES);
  });

  it("provides four materially different column presets", () => {
    expect(PRESET_COLUMNS.full.length).toBeGreaterThan(PRESET_COLUMNS.office.length);
    expect(PRESET_COLUMNS.full).not.toContain("status");
    expect(PRESET_COLUMNS.full).not.toContain("category");
    expect(PRESET_COLUMNS.full).toContain("bollards");
    expect(PRESET_COLUMNS.full).toContain("side");
    expect(PRESET_COLUMNS.office.length).toBeGreaterThan(PRESET_COLUMNS.port.length);
    expect(PRESET_COLUMNS.office).not.toContain("status");
    expect(PRESET_COLUMNS.port).not.toContain("status");
    expect(PRESET_COLUMNS.office).not.toContain("bollards");
    expect(PRESET_COLUMNS.office).not.toContain("side");
    expect(PRESET_COLUMNS.port).not.toContain("bollards");
    expect(PRESET_COLUMNS.port).not.toContain("side");
    expect(PRESET_COLUMNS.quick).toEqual(["signal", "pin", "vessel", "callNumber", "berth", "eta", "etd", "nextJob"]);
    expect(PRESET_COLUMNS.quick).not.toContain("status");
    expect(PRESET_COLUMNS.quick).not.toContain("bollards");
    expect(PRESET_COLUMNS.quick).not.toContain("side");
  });

  it("merges stored settings defensively and enforces the 10 minute floor", () => {
    const merged = mergeSettings({ preset: "quick", refreshMinutes: 1, pageSize: 999, columns: ["vessel", "bad"] });
    expect(merged.refreshMinutes).toBe(10);
    expect(merged.pageSize).toBe(10);
    expect(merged.columns).toEqual(["vessel"]);
  });

  it("preserves valid saved preferences while rejecting invalid preference values", () => {
    const merged = mergeSettings({ locale: "en", density: "normal", mobileLayout: "table", theme: "light", dateFormat: "compact", sortKey: "berth", sortDirection: "desc", pageSize: 25, refreshMinutes: 15 });
    expect(merged).toMatchObject({ locale: "en", density: "normal", mobileLayout: "table", theme: "light", dateFormat: "compact", sortKey: "berth", sortDirection: "desc", pageSize: 25, refreshMinutes: 15 });
    const safe = mergeSettings({ locale: "xx", density: "dense", mobileLayout: "wide", theme: "neon", dateFormat: "iso", sortKey: "unknown", sortDirection: "sideways" });
    expect(safe.locale).toBe(DEFAULT_SETTINGS.locale);
    expect(safe.density).toBe(DEFAULT_SETTINGS.density);
    expect(safe.mobileLayout).toBe(DEFAULT_SETTINGS.mobileLayout);
    expect(safe.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(safe.dateFormat).toBe(DEFAULT_SETTINGS.dateFormat);
    expect(safe.sortKey).toBe(DEFAULT_SETTINGS.sortKey);
    expect(safe.sortDirection).toBe(DEFAULT_SETTINGS.sortDirection);
  });

  it("upgrades only the untouched first-release defaults and stamps the new schema", () => {
    const legacy = {
      preset: "office", density: "compact", locale: "en", theme: "dark", dateFormat: "full",
      sortKey: "call-number", sortDirection: "asc", columns: [...PRESET_COLUMNS.office], hiddenColumns: [], pinnedIds: [], pageSize: 10, refreshMinutes: 10,
    };
    const migrated = mergeSettings(legacy);
    expect(migrated.settingsVersion).toBe(WATCHLIST_SETTINGS_VERSION);
    expect(migrated.locale).toBe("da");
    expect(migrated.theme).toBe("light");
    expect(migrated.sortKey).toBe("job-order");
    const versionedLegacy = mergeSettings({ ...legacy, settingsVersion: PREVIOUS_WATCHLIST_SETTINGS_VERSION });
    expect(versionedLegacy).toMatchObject({ settingsVersion: WATCHLIST_SETTINGS_VERSION, locale: "da", theme: "light", sortKey: "job-order" });

    const explicitTheme = mergeSettings({ ...legacy, theme: "light" });
    const explicitDarkTheme = mergeSettings({ ...legacy, settingsVersion: WATCHLIST_SETTINGS_VERSION, theme: "dark" });
    const explicitSort = mergeSettings({ ...legacy, sortKey: "berth" });
    const explicitDate = mergeSettings({ ...legacy, dateFormat: "compact" });
    const explicitColumns = mergeSettings({ ...legacy, columns: [...PRESET_COLUMNS.office, "category"] });
    const explicitPlacementColumns = mergeSettings({ ...legacy, columns: ["vessel", "berth", "bollards", "side"] });
    expect(explicitTheme).toMatchObject({ settingsVersion: WATCHLIST_SETTINGS_VERSION, locale: "en", theme: "light", sortKey: "call-number" });
    expect(explicitDarkTheme).toMatchObject({ settingsVersion: WATCHLIST_SETTINGS_VERSION, locale: "en", theme: "dark", sortKey: "call-number" });
    expect(explicitSort).toMatchObject({ settingsVersion: WATCHLIST_SETTINGS_VERSION, locale: "en", sortKey: "berth" });
    expect(explicitDate).toMatchObject({ settingsVersion: WATCHLIST_SETTINGS_VERSION, locale: "en", dateFormat: "compact", sortKey: "call-number" });
    expect(explicitColumns).toMatchObject({ settingsVersion: WATCHLIST_SETTINGS_VERSION, locale: "en", sortKey: "call-number", columns: [...PRESET_COLUMNS.office, "category"] });
    expect(explicitPlacementColumns.columns).toEqual(["vessel", "berth", "bollards", "side"]);
  });

  it("migrates the old compact presets without reintroducing the redundant status column", () => {
    const merged = mergeSettings({ preset: "office", columns: ["signal", "pin", "callNumber", "vessel", "status", "eta", "etd", "berth", "bollards", "side", "nextJob", "customer", "agent", "operations", "notes"] });
    expect(merged.columns).toEqual(PRESET_COLUMNS.office);
  });

  it("migrates the old full preset without reintroducing the redundant status column", () => {
    const merged = mergeSettings({ preset: "full", columns: [...ALL_COLUMNS] });
    expect(merged.columns).toEqual(PRESET_COLUMNS.full);
  });

  it("migrates the untouched v4 Full order while preserving a genuinely custom order", () => {
    const legacyV4Full = ALL_COLUMNS.filter((column) => column !== "status");
    const migrated = mergeSettings({ settingsVersion: PREVIOUS_WATCHLIST_SETTINGS_VERSION, preset: "full", columns: legacyV4Full });
    expect(migrated.settingsVersion).toBe(WATCHLIST_SETTINGS_VERSION);
    expect(migrated.columns).toEqual(PRESET_COLUMNS.full);
    const migratedV4 = mergeSettings({ settingsVersion: 4, preset: "full", columns: legacyV4Full });
    expect(migratedV4.settingsVersion).toBe(WATCHLIST_SETTINGS_VERSION);
    expect(migratedV4.columns).toEqual(PRESET_COLUMNS.full);
    const currentVersion = mergeSettings({ settingsVersion: WATCHLIST_SETTINGS_VERSION, preset: "full", columns: legacyV4Full });
    expect(currentVersion.columns).toEqual(legacyV4Full);

    const customOrder = ["vessel", "callNumber", "category", "berth", "nextJob"] as const;
    expect(mergeSettings({ settingsVersion: PREVIOUS_WATCHLIST_SETTINGS_VERSION, preset: "full", columns: customOrder }).columns).toEqual(customOrder);
  });

  it("keeps v1, v2 and v3 legacy preset migrations covered independently", () => {
    const v1Office = ["signal", "pin", "callNumber", "vessel", "status", "eta", "etd", "berth", "bollards", "side", "nextJob", "customer", "agent", "operations", "notes"];
    const v2Office = ["signal", "pin", "callNumber", "vessel", "eta", "etd", "berth", "bollards", "side", "nextJob", "customer", "agent", "operations", "notes"];
    const v3Office = [...v2Office];
    const legacy = {
      preset: "office" as const, density: "compact" as const, locale: "en" as const, theme: "dark" as const,
      dateFormat: "full" as const, sortKey: "call-number" as const, sortDirection: "asc" as const,
      hiddenColumns: [] as const, pinnedIds: [] as const, pageSize: 10, refreshMinutes: 10,
    };
    const migratedV1 = mergeSettings({ ...legacy, settingsVersion: 1, columns: v1Office });
    const migratedV2 = mergeSettings({ ...legacy, settingsVersion: 2, columns: v2Office });
    const migratedV3 = mergeSettings({ ...legacy, settingsVersion: 3, columns: v3Office });
    [migratedV1, migratedV2, migratedV3].forEach((settings) => {
      expect(settings.settingsVersion).toBe(WATCHLIST_SETTINGS_VERSION);
      expect(settings.columns).toEqual(PRESET_COLUMNS.office);
      expect(settings.locale).toBe("da");
      expect(settings.theme).toBe("light");
      expect(settings.sortKey).toBe("job-order");
    });
  });

  it("migrates old port and quick presets while retaining placement in full/custom views", () => {
    const legacyV3Port = ["signal", "pin", "vessel", "eta", "etd", "berth", "nextJob"];
    const legacyV3Quick = ["signal", "pin", "vessel", "callNumber", "eta", "etd", "berth"];
    expect(mergeSettings({ settingsVersion: 3, preset: "port", columns: legacyV3Port }).columns).toEqual(PRESET_COLUMNS.port);
    expect(mergeSettings({ settingsVersion: 3, preset: "quick", columns: legacyV3Quick }).columns).toEqual(PRESET_COLUMNS.quick);
    expect(PRESET_COLUMNS.full).toContain("bollards");
    expect(PRESET_COLUMNS.full).toContain("side");
    expect(mergeSettings({ preset: "full", columns: ["vessel", "berth", "bollards", "side"] }).columns).toEqual(["vessel", "berth", "bollards", "side"]);
  });

  it("repairs persisted v4 presets that still contain duplicate placement columns", () => {
    const v4Office = ["signal", "pin", "callNumber", "vessel", "berth", "bollards", "side", "eta", "operations", "etd", "nextJob", "customer", "agent", "notes"];
    const v4Port = ["signal", "pin", "vessel", "berth", "bollards", "side", "eta", "operations", "etd", "nextJob"];
    const v4Quick = ["signal", "pin", "vessel", "callNumber", "berth", "bollards", "side", "eta", "etd", "nextJob"];
    expect(mergeSettings({ settingsVersion: PREVIOUS_WATCHLIST_SETTINGS_VERSION, preset: "office", columns: v4Office }).columns).toEqual(PRESET_COLUMNS.office);
    expect(mergeSettings({ settingsVersion: PREVIOUS_WATCHLIST_SETTINGS_VERSION, preset: "port", columns: v4Port }).columns).toEqual(PRESET_COLUMNS.port);
    expect(mergeSettings({ settingsVersion: PREVIOUS_WATCHLIST_SETTINGS_VERSION, preset: "quick", columns: v4Quick }).columns).toEqual(PRESET_COLUMNS.quick);
    expect(mergeSettings({ settingsVersion: PREVIOUS_WATCHLIST_SETTINGS_VERSION, preset: "office", columns: [...v4Office, "category"] }).columns).toEqual([...v4Office.filter(column => column !== "customer"), "category"]);
  });

  it("preserves explicit custom columns and dark preferences in old-version records", () => {
    const custom = mergeSettings({
      settingsVersion: 3, preset: "office", density: "normal", locale: "en", theme: "dark", dateFormat: "compact",
      sortKey: "berth", sortDirection: "desc", columns: ["vessel", "berth", "eta", "category"], hiddenColumns: ["eta"], pinnedIds: ["call-007"], pageSize: 25, refreshMinutes: 20,
    });
    expect(custom).toMatchObject({ settingsVersion: WATCHLIST_SETTINGS_VERSION, density: "normal", locale: "en", theme: "dark", dateFormat: "compact", sortKey: "berth", sortDirection: "desc", pageSize: 25, refreshMinutes: 20 });
    expect(custom.columns).toEqual(["vessel", "berth", "eta", "category"]);
    expect(custom.hiddenColumns).toEqual(["eta"]);
    expect(custom.pinnedIds).toEqual(["call-007"]);
  });

  it("restores persisted filters defensively", () => {
    expect(mergeFilters({ query: "NPC-26", statuses: ["en-route", "bad", "en-route"], berths: ["Berth 101", 7], attentionOnly: true, operationalOnly: true })).toEqual({
      query: "NPC-26", statuses: ["en-route"], berths: ["Berth 101"], attentionOnly: true, operationalOnly: true,
    });
    expect(mergeFilters(null)).toEqual(DEFAULT_FILTERS);
    expect(mergeFilters({ studOnly: true })).toMatchObject({ studOnly: true });
  });

  it("hides selected columns without changing their saved order", () => {
    const settings = { ...DEFAULT_SETTINGS, columns: ["vessel", "eta", "berth"] as const, hiddenColumns: ["eta"] as const };
    expect(visibleColumns(settings)).toEqual(["vessel", "berth"]);
    expect(settings.columns).toEqual(["vessel", "eta", "berth"]);
  });
});

describe("time semantics", () => {
  it("exposes one SHIFT 04 clock and an eight-hour operational horizon", () => {
    expect(PROTOTYPE_OPERATIONS_NOW).toBe("2026-08-21T06:40:00+02:00");
    expect(PROTOTYPE_OPERATIONS_HORIZON_HOURS).toBe(8);
    expect(mockWatchlistSnapshot.fetchedAt).toBe(PROTOTYPE_OPERATIONS_NOW);
    expect(mockWatchlistSnapshot.tracking.every((track) => track.updatedAt === PROTOTYPE_OPERATIONS_NOW)).toBe(true);
  });

  it("includes underway calls and near-term work, excluding departed/far-future calls", () => {
    const active = getOperationallyActiveCalls(calls);
    expect(active.length).toBeGreaterThan(0);
    expect(active.every((call) => isOperationallyActiveCall(call))).toBe(true);
    expect(active.every((call) => call.status !== "departed")).toBe(true);
    expect(active.some((call) => call.status === "arrived" || call.status === "en-route")).toBe(true);
    const farFutureExpected = calls.find((call) => call.status === "expected" && call.operations.every((operation) => Date.parse(operation.at) > Date.parse(PROTOTYPE_OPERATIONS_NOW) + PROTOTYPE_OPERATIONS_HORIZON_HOURS * 60 * 60 * 1_000));
    expect(farFutureExpected).toBeDefined();
    expect(isOperationallyActiveCall(farFutureExpected!)).toBe(false);
    expect(getOperationallyActiveCalls(calls).some((call) => call.id === farFutureExpected!.id)).toBe(false);
  });

  it("keeps the berth header responsible for the location label", () => {
    expect(formatBerthCode("Berth 101")).toBe("101");
    expect(formatBerthCode("Kaj 117")).toBe("117");
  });

  it("prioritizes actual, live, ordered, then expected", () => {
    expect(primaryTime([
      { kind: "expected", value: "2026-08-21T01:00:00Z" },
      { kind: "ordered", value: "2026-08-21T02:00:00Z" },
      { kind: "live", value: "2026-08-21T03:00:00Z" },
      { kind: "actual", value: "2026-08-21T04:00:00Z" },
    ])).toBe("2026-08-21T04:00:00Z");
  });

  it("formats weekday/date/time and compact date/time together", () => {
    expect(formatDateTime("2026-06-30T10:15:00+02:00", "en", "full")).toMatch(/^Tuesday 30-06-2026 · 10:15$/);
    expect(formatDateTime("2026-06-30T10:15:00+02:00", "da", "compact")).toBe("30-06-2026 · 10:15");
  });

  it("calculates non-negative data age", () => {
    expect(dataAgeMinutes("2026-08-21T10:00:00Z", Date.parse("2026-08-21T10:09:59Z"))).toBe(9);
    expect(dataAgeMinutes("2026-08-21T10:00:00Z", Date.parse("2026-08-21T09:00:00Z"))).toBe(0);
  });
});

// Compile-time contract: PortCall remains the service/UI boundary.
const _portCallContract: PortCall = calls[0];
void _portCallContract;
