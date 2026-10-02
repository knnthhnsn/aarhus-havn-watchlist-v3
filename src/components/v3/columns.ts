import { ALL_COLUMNS, SORTABLE_COLUMN_SORT_KEYS, type ColumnKey, type Locale } from "@/lib/watchlist";

export type Column = ColumnKey;
export type Preset = "full" | "office" | "port";
/** Keep the two scan controls at opposite edges, including restored custom lists. */
export function orderColumns(columns: readonly Column[]): Column[] {
  const visible = columns.filter(column => column !== "customer");
  return [...(visible.includes("pin") ? ["pin" as const] : []), ...visible.filter(column => column !== "pin" && column !== "signal"), ...(visible.includes("signal") ? ["signal" as const] : [])];
}
export const presetColumns: Record<Preset, Column[]> = {
  full: orderColumns(["vessel", ...ALL_COLUMNS.filter(column => column !== "vessel" && column !== "beam" && column !== "category")]),
  office: orderColumns(["vessel", "signal", "pin", "callNumber", "crane", "berth", "eta", "operations", "etd", "nextJob", "agent", "notes"]),
  port: orderColumns(["vessel", "signal", "pin", "berth", "bollards", "side", "eta", "operations", "etd", "nextJob", "agent", "notes"]),
};
export const columnNames: Record<Locale, Record<Column, string>> = {
  da: { signal: "OPS.", pin: "Pin", callNumber: "Call", imo: "IMO", callSign: "Kaldsignal", crane: "Kran", vessel: "Skib", status: "Status", berth: "Kaj", bollards: "Pullerter", side: "Side", eta: "Ankomst", operations: "Handling", etd: "Afgang", nextJob: "Næste opgave", customer: "Kunde", agent: "Agent", loa: "LOA", beam: "Bredde", category: "Type", notes: "Noter" },
  en: { signal: "OPS.", pin: "Pin", callNumber: "Call", imo: "IMO", callSign: "Call sign", crane: "Crane", vessel: "Vessel", status: "Status", berth: "Quay", bollards: "Bollards", side: "Side", eta: "Arrival", operations: "Actions", etd: "Departure", nextJob: "Next task", customer: "Customer", agent: "Agent", loa: "LOA", beam: "Beam", category: "Type", notes: "Notes" },
};
export const sortColumns = SORTABLE_COLUMN_SORT_KEYS;

/** Ignore the obsolete nine-column schema rather than silently dropping OPS. */
export function restoredColumns(value: unknown, version: unknown): Column[] | null {
  const knownColumns: readonly Column[] = [...ALL_COLUMNS, "customer"];
  if (version !== 2 || !Array.isArray(value) || !value.includes("vessel") || !value.every(column => typeof column === "string" && knownColumns.includes(column as Column))) return null;
  return orderColumns([...new Set(value)].filter(column => column !== "customer") as Column[]);
}
