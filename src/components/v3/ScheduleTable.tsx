"use client";

import { isServiceSortColumn, type ActionServiceSort, type ServiceSortColumn } from "./actionServiceSort";
import { liveEtaLabel, showLiveEtaDate } from "./liveEtaLabel";
import { Fragment, useState } from "react";
import { BrandIcon as Icon } from "@/components/brand/BrandIcon";
import { lifecycleOperations, operationLabel } from "@/components/watchlist/lifecycleData";
import { formatBerthCode, formatClock, getNextActionableOperation, getOperationalWarnings, getOperationPlacement, liveTime, type ServiceCode, type CallServiceOrder, type Locale, type PortCall, type PortOperation, type SortKey } from "@/lib/watchlist";
import { categoryName, getCallPlacementPresentation, operationNames, plannedTime, shortDate, statusNames, timeNames } from "./display";
import { columnNames, orderColumns, sortColumns, type Column } from "./columns";
import type { DetailTab } from "./CallDetail";
import { NotesButton } from "./NotesControl";
import { PinButton } from "./PinControl";
import { StateLabel } from "./StateLabel";
import stateSurface from "./StateSurface.module.css";
import s from "./ScheduleTable.module.css";
import { CraneBadge } from "./CraneBadge";
import { OperationServices } from "./OperationServices";

type Props = {
  calls: readonly PortCall[]; allCalls: readonly PortCall[]; serviceOrders: readonly CallServiceOrder[];
  locale: Locale; now: string; columns: Column[]; compact: boolean; pins: readonly string[];
  sort: SortKey; direction: "asc" | "desc";
  preset?: "full" | "office" | "port";
  serviceSort?: ActionServiceSort | null; onServiceSort?: (column: ServiceSortColumn, code: ServiceCode) => void;
  onSort: (key: SortKey) => void; onPin: (call: PortCall) => void;
  onOpen: (call: PortCall, tab: DetailTab) => void; onBerth: (berth: string) => void; onStud?: () => void;
};
const columnWeights: Partial<Record<Column, number>> = { status: 1.35, imo: 1.35, callNumber: 1.15, callSign: 1.05, vessel: 1.9, operations: 1.8, eta: 2.35, etd: 1.4, nextJob: 1.5, customer: 1.25, agent: 1.25, signal: .85, pin: .85, berth: .65, side: .45, crane: .8, notes: .85 };
const columnWeight = (column: Column) => columnWeights[column] ?? 1;


export function ScheduleTable({ calls, allCalls, serviceOrders, locale, now, columns: selectedColumns, compact, pins, sort, direction, onSort, onPin, onOpen, onBerth, onStud, preset, serviceSort, onServiceSort }: Props) {
  const columns = orderColumns(selectedColumns.filter(column => column !== "customer"));
  const displayColumns = columns.flatMap<Column | { column: ServiceSortColumn; code: ServiceCode }>(column => preset === "full" && isServiceSortColumn(column) ? [column, ...(["H", "L", "B"] as const).map(code => ({ column, code }))] : [column]);
  const displayWeight = (item: (typeof displayColumns)[number]) => typeof item === "string" ? columnWeight(item) : .42;
  const totalWeight = displayColumns.reduce((sum, item) => sum + displayWeight(item), 0);
  const shareTimingSpace = preset === "full" && columns.includes("eta") && columns.includes("operations");
  const columnWidth = (item: (typeof displayColumns)[number]) => {
    const proportionalWidth = `${100 * displayWeight(item) / totalWeight}%`;
    if (!shareTimingSpace) return proportionalWidth;
    if (item === "eta") return `var(--arrival-column-width, ${proportionalWidth})`;
    // Keep all other columns unchanged; assign exactly the saved arrival width
    // to operations. The variable is only bounded in the desktop Full table.
    if (item === "operations") return `calc(${100 * (columnWeight("eta") + columnWeight("operations")) / totalWeight}% - var(--arrival-column-width, ${100 * columnWeight("eta") / totalWeight}%))`;
    return proportionalWidth;
  };
  const [expanded, setExpanded] = useState<readonly string[]>([]);
  const da = locale === "da", t = (dk: string, en: string) => da ? dk : en;
  const optional = (call: PortCall) => lifecycleOperations(call, serviceOrders).filter(op => op.type !== "arrival" && op.type !== "departure");
  const operation = (call: PortCall, op: PortOperation, showServices = true) => {
    const place = getOperationPlacement(op);
    const showStud = op.workLocation === "stud" && !(columns.includes("berth") && getCallPlacementPresentation(call, now).isStud);
    const showPlacement = op.workLocation !== "stud" || showStud || (showServices && op.serviceCodes.length > 0);
    const at = op.mobileRegisteredAt ?? op.at;
    const isNext = getNextActionableOperation(call, now, serviceOrders)?.id === op.id;
    return <button key={op.id} className={`${s.operation} ${stateSurface.surface}`} data-state={op.state} data-operation-id={op.id} data-next-operation={isNext || undefined} aria-label={`${operationLabel(op, locale, call)} · ${timeNames[locale][op.state]} · ${shortDate(at, locale)} ${formatClock(at)}${isNext ? ` · ${t("Næste opgave", "Next action")}` : ""}`} onClick={() => onOpen(call, "timeline")}>
      <span className={s.operationHeading}><strong>{operationLabel(op, locale, call)}</strong></span>
      <span><b>{formatClock(at)}</b><small>{shortDate(at, locale)}</small></span>
      {showPlacement && <small className={s.operationPlacement}>{showStud && <b>STUD</b>}{op.workLocation !== "stud" && (place ? `${t("Kaj", "Quay")} ${formatBerthCode(place.berth)} · ${place.bollardFrom}–${place.bollardTo} · ` : op.label || t("Uden kajplacering", "No quay placement"))}<span className={s.placementTail}>{op.workLocation !== "stud" && place && (place.side === "port" ? "BB" : "SB")}{showServices && <OperationServices operation={op} locale={locale} compact inline showWorkLocation={false} />}</span></small>}
    </button>;
  };
  const time = (call: PortCall, mode: "eta" | "etd") => {
    const times = mode === "eta" ? call.arrivalTimes : call.departureTimes, at = plannedTime(times), live = mode === "eta" ? liveTime(times) : undefined;
    const next = getNextActionableOperation(call, now, serviceOrders);
    const isNext = next?.type === (mode === "eta" ? "arrival" : "departure");
    return at ? <button className={s.time} data-next-operation={isNext || undefined} onClick={() => onOpen(call, "timeline")} aria-label={`${columnNames[locale][mode]} ${timeNames[locale][at.kind]} ${shortDate(at.value, locale)} ${formatClock(at.value)}${live ? `. ${liveEtaLabel(live, at.value, locale)}` : ""}`}>
      <span data-state={at.kind} data-time-surface="true"><b>{formatClock(at.value)}</b><small>{shortDate(at.value, locale)}</small></span>
      {live && <small className={s.liveEta} data-live-eta="true"><span>Live ETA</span><time dateTime={live}>{formatClock(live)}</time>{showLiveEtaDate(live, at.value) && <span>{shortDate(live, locale)}</span>}</small>}{preset !== "full" && lifecycleOperations(call, serviceOrders).filter(op => op.type === (mode === "eta" ? "arrival" : "departure")).map(op => <OperationServices key={op.id} operation={op} locale={locale} compact showWorkLocation={false} />)}
    </button> : null;
  };
  const cell = (call: PortCall, column: Column) => {
    const { placement, filterable, isStud } = getCallPlacementPresentation(call, now);
    switch (column) {
      case "vessel": return <button className={s.identity} onClick={() => onOpen(call, "call")}><strong>{call.vesselName}</strong><small>{!columns.includes("category") && categoryName(call.category, locale)}{!columns.includes("callNumber") && ` · ${call.callNumber}`}</small>{preset === "office" && !compact && <span className={s.vesselIdentifiers}><span>Ksign {call.callSign}</span><span>IMO {call.imo}</span></span>}</button>;
      case "signal": { const warnings = getOperationalWarnings(call, allCalls, now, serviceOrders); return warnings.length ? <button className={s.alert} data-info-title={`${warnings.length} ${t("signaler", "alerts")} · ${call.vesselName}`} data-info={warnings.map(warning => warning.message).join("\n").slice(0, 360)} onClick={() => onOpen(call, "call")} aria-label={`${warnings.length} ${t("signaler for", "alerts for")} ${call.vesselName}`}><Icon name="attention"/><b>{warnings.length}</b></button> : null; }
      case "pin": return <PinButton pinned={pins.includes(call.id)} locale={locale} vesselName={call.vesselName} onClick={() => onPin(call)} />;
      case "callNumber": return <button className={s.link} onClick={() => onOpen(call, "call")}>{call.callNumber}</button>;
      case "imo": return <button type="button" className={s.detailLink} onClick={() => onOpen(call, "vessel")} aria-label={`${columnNames[locale][column]}: ${call.imo} · ${call.vesselName}`} data-info-title={columnNames[locale][column]} data-info={t("Åbn skibsoplysninger.", "Open vessel particulars.")}>{call.imo}</button>;
      case "callSign": return <button type="button" className={s.detailLink} onClick={() => onOpen(call, "vessel")} aria-label={`${columnNames[locale][column]}: ${call.callSign} · ${call.vesselName}`} data-info-title={columnNames[locale][column]} data-info={t("Åbn skibsoplysninger.", "Open vessel particulars.")}>{call.callSign}</button>;
      case "status": return <span className={s.statusCell} tabIndex={0} data-info-title={t("Status", "Status")} data-info={statusNames[locale][call.status]} aria-label={statusNames[locale][call.status]}><StateLabel state={call.status}>{call.status === "expected" ? t("Forv.", "Exp.") : statusNames[locale][call.status]}</StateLabel></span>;
      case "berth": return isStud ? (onStud ? <button type="button" className={`${s.quay} ${s.stud}`} aria-label={t("Filtrér STUD", "Filter STUD")} onClick={onStud}>STUD</button> : <span className={s.stud}>STUD</span>) : <div className={s.placement}>{filterable ? <button className={s.quay} data-info-title={`${t("Kaj", "Quay")} ${formatBerthCode(placement.berth)}`} data-info={t("Tryk for at filtrere listen til denne kaj.", "Select to filter the list to this quay.")} onClick={() => onBerth(placement.berth)} aria-label={`${t("Filtrér kaj", "Filter quay")} ${formatBerthCode(placement.berth)}`}>{formatBerthCode(placement.berth)}</button> : <span className={s.quay}>{formatBerthCode(placement.berth)}</span>}{!columns.includes("bollards") && <small>{placement.bollardFrom}–{placement.bollardTo}{!columns.includes("side") && ` ${placement.side === "port" ? "BB" : "SB"}`}</small>}</div>;
      case "bollards": return isStud ? null : `${placement.bollardFrom}–${placement.bollardTo}`;
      case "side": return isStud ? null : <abbr tabIndex={0} data-info-title={t("Side", "Side")} data-info={placement.side === "port" ? t("BB · Bagbord", "BB · Port side") : t("SB · Styrbord", "SB · Starboard side")}>{placement.side === "port" ? "BB" : "SB"}</abbr>;
      case "eta": case "etd": return time(call, column);
      case "operations": { const ops = optional(call); return !ops.length ? null : compact ? <button className={s.opsToggle} data-info-title={`${ops.length} ${t("handlinger", "actions")}`} data-info={t("Vis callets ekstra operationer og deres tid, status og placering.", "Show the call’s additional operations, times, status and placement.")} aria-expanded={expanded.includes(call.id)} aria-controls={`ops-${call.id}`} aria-label={`${t("Vis operationer for", "Show operations for")} ${call.vesselName}`} onClick={() => setExpanded(ids => ids.includes(call.id) ? ids.filter(id => id !== call.id) : [...ids, call.id])}><Icon name="operations"/><b>{ops.length}</b><span>{t("Handling", "Action")}</span><Icon name={expanded.includes(call.id) ? "arrowUp" : "arrowDown"}/></button> : <div className={s.operations}>{ops.map(op => operation(call, op, preset !== "full"))}</div>; }
      case "nextJob": { const op = getNextActionableOperation(call, now, serviceOrders); return op ? <button className={s.next} onClick={() => onOpen(call, "timeline")}><strong>{formatClock(op.at)} <span>{operationNames[locale][op.type]}</span></strong><small>{shortDate(op.at, locale)}</small></button> : <span className={s.muted}>{t("Afsluttet", "Completed")}</span>; }
      case "customer": return null;
      case "agent": return <button type="button" className={s.detailLink} onClick={() => onOpen(call, "call")} aria-label={`${columnNames[locale][column]}: ${call.agent} · ${call.vesselName}`} data-info-title={columnNames[locale][column]} data-info={t("Åbn call-detaljer og samarbejdspartnere.", "Open call details and partners.")}>{call.agent}</button>;
      case "loa": return <button type="button" className={s.detailLink} onClick={() => onOpen(call, "vessel")} aria-label={`${columnNames[locale][column]}: ${`${call.loaMeters} m`} · ${call.vesselName}`} data-info-title={columnNames[locale][column]} data-info={t("Åbn skibsoplysninger.", "Open vessel particulars.")}>{`${call.loaMeters} m`}</button>;
      case "beam": return <button type="button" className={s.detailLink} onClick={() => onOpen(call, "vessel")} aria-label={`${columnNames[locale][column]}: ${`${call.beamMeters} m`} · ${call.vesselName}`} data-info-title={columnNames[locale][column]} data-info={t("Åbn skibsoplysninger.", "Open vessel particulars.")}>{`${call.beamMeters} m`}</button>;
      case "category": return <button type="button" className={s.detailLink} onClick={() => onOpen(call, "vessel")} aria-label={`${columnNames[locale][column]}: ${categoryName(call.category, locale)} · ${call.vesselName}`} data-info-title={columnNames[locale][column]} data-info={t("Åbn skibsoplysninger.", "Open vessel particulars.")}>{categoryName(call.category, locale)}</button>;
      case "crane": return call.craneStatus === "none" ? null : <button className={s.detailLink} aria-label={`${t("Vis krantider for", "Show crane times for")} ${call.vesselName}`} onClick={() => onOpen(call, "crane")}><CraneBadge status={call.craneStatus} locale={locale} /></button>;
      case "notes": return <NotesButton call={call} locale={locale} showLabel={!compact} onClick={() => onOpen(call, "notes")} />;
    }
  };
  return <div className={s.scroll} role="region" aria-label={t("Call-tabel — rul vandret for alle kolonner", "Port call table — scroll horizontally for all columns")} tabIndex={0} data-density={compact ? "compact" : "normal"}>
    <table className={s.table} data-full={preset === "full"}><colgroup>{displayColumns.map((item, index) => <col key={index} style={{ width: columnWidth(item) }} />)}</colgroup>
      <thead><tr>{displayColumns.map(item => {
        if (typeof item !== "string") {
          const { column, code } = item, active = serviceSort?.column === column && serviceSort.code === code;
          return <th key={`${column}-${code}`} data-service-column={`${column}-${code}`} data-group-end={code === "B"} aria-sort={active ? serviceSort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" aria-label={`${columnNames[locale][column]} · ${code}`} data-info-title={`${columnNames[locale][column]} · ${code}`} data-info={t("Sortér kun efter denne service på denne handling. Første klik viser calls med servicen øverst.", "Sort only by this service on this action. First click puts calls with the service first.")} onClick={() => onServiceSort?.(column, code)}>{code}<Icon name={active && serviceSort.direction === "asc" ? "arrowUp" : "arrowDown"}/></button></th>;
        }
        const column = item;
        return <th key={column} data-column={column} aria-sort={!serviceSort && sort === sortColumns[column] ? direction === "asc" ? "ascending" : "descending" : "none"}><button data-info-title={columnNames[locale][column]} data-info={t("Tryk for at sortere efter dette felt.", "Select to sort by this field.")} aria-label={columnNames[locale][column]} onClick={() => onSort(sortColumns[column])}>{({ callSign: "Ksign", bollards: t("Pull.", "Boll."), nextJob: t("Næste", "Next") } as Partial<Record<Column, string>>)[column] ?? columnNames[locale][column]}<Icon name={sort === sortColumns[column] && direction === "desc" ? "arrowDown" : "arrowUp"}/></button></th>;
      })}</tr></thead>
      <tbody>{calls.map((call, index) => {
        const ops = optional(call);
        // Native table subrows keep every service badge aligned to its own action.
        const splitOps = preset === "full" && !compact && columns.includes("operations") && ops.length > 1;
        const rows: (PortOperation | undefined)[] = splitOps ? ops : [undefined];
        return <Fragment key={call.id}>{rows.map((rowOperation, rowIndex) => <tr key={rowOperation?.id ?? call.id} data-call-id={rowIndex === 0 ? call.id : undefined} data-call-group={call.id} data-operation-row={rowOperation?.id} data-operation-last={rowIndex === rows.length - 1} data-stripe={index % 2} data-pinned={pins.includes(call.id)}>{displayColumns.map(item => {
          const isActionCell = item === "operations" || (typeof item !== "string" && item.column === "operations");
          if (rowIndex > 0 && !isActionCell) return null;
          const rowSpan = splitOps && !isActionCell ? rows.length : undefined;
          if (typeof item === "string") return <td key={item} data-column={item} rowSpan={rowSpan}>{item === "operations" && rowOperation ? operation(call, rowOperation, false) : cell(call, item)}</td>;
          const { column, code } = item;
          const matching = (column === "operations" && rowOperation ? [rowOperation] : lifecycleOperations(call, serviceOrders)).filter(op => (column === "eta" ? op.type === "arrival" : column === "etd" ? op.type === "departure" : op.type !== "arrival" && op.type !== "departure") && op.serviceCodes.includes(code));
          return <td key={`${column}-${code}`} data-service-column={`${column}-${code}`} data-group-end={code === "B"} rowSpan={rowSpan}>{matching.length ? <button className={s.serviceCell} aria-label={`${columnNames[locale][column]} · ${code} · ${call.vesselName}`} onClick={() => onOpen(call, "timeline")}>{matching.map(op => <span key={op.id} data-service-operation={op.id} title={`${operationLabel(op, locale, call)} · ${formatClock(op.mobileRegisteredAt ?? op.at)}`}><OperationServices operation={{ ...op, serviceCodes: [code], workLocation: undefined }} locale={locale} compact /></span>)}</button> : null}</td>;
        })}</tr>)}{compact && columns.includes("operations") && <tr className={s.expanded} data-stripe={index % 2} hidden={!expanded.includes(call.id)}><td colSpan={displayColumns.length}><section id={`ops-${call.id}`} aria-label={`${call.vesselName} · ${t("Handlinger", "Actions")}`}><strong>{call.vesselName} · {t("Handlinger", "Actions")}</strong><div className={s.operations}>{ops.map(op => operation(call, op))}</div></section></td></tr>}</Fragment>;
      })}</tbody>
    </table>
  </div>;
}
