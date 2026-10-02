import { lifecycleOperations } from "@/components/watchlist/lifecycleData";
import type { CallServiceOrder, PortCall, ServiceCode, SortDirection } from "@/lib/watchlist";

export type ServiceSortColumn = "eta" | "operations" | "etd";
export type ActionServiceSort = { column: ServiceSortColumn; code: ServiceCode; direction: SortDirection };

export function isServiceSortColumn(column: string): column is ServiceSortColumn {
  return column === "eta" || column === "operations" || column === "etd";
}

export function restoredServiceSort(value: unknown): ActionServiceSort | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ActionServiceSort>;
  return candidate.column && isServiceSortColumn(candidate.column)
    && (candidate.code === "H" || candidate.code === "L" || candidate.code === "B")
    && (candidate.direction === "asc" || candidate.direction === "desc") ? candidate as ActionServiceSort : null;
}

export function cycleServiceSort(current: ActionServiceSort | null, column: ServiceSortColumn, code: ServiceCode): ActionServiceSort | null {
  if (current?.column !== column || current.code !== code) return { column, code, direction: "desc" };
  return current.direction === "desc" ? { ...current, direction: "asc" } : null;
}

/** Group by service presence for this action only; keep the existing order within each group. */
export function sortByActionService(calls: readonly PortCall[], selection: ActionServiceSort, orders: readonly CallServiceOrder[], pins: readonly string[]): PortCall[] {
  const present = new Map(calls.map(call => [call.id, lifecycleOperations(call, orders).some(op =>
    (selection.column === "eta" ? op.type === "arrival" : selection.column === "etd" ? op.type === "departure" : op.type !== "arrival" && op.type !== "departure")
    && op.serviceCodes.includes(selection.code))]));
  const ranks = new Map(pins.map((id, index) => [id, index]));
  return [...calls].sort((a, b) => {
    const aPin = ranks.get(a.id), bPin = ranks.get(b.id);
    if (aPin !== undefined || bPin !== undefined) return aPin === undefined ? 1 : bPin === undefined ? -1 : aPin - bPin;
    return (Number(present.get(a.id)) - Number(present.get(b.id))) * (selection.direction === "desc" ? -1 : 1);
  });
}
