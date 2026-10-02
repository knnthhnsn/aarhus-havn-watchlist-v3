import type { ReactNode } from "react";
import { BrandIcon } from "@/components/brand/BrandIcon";
import { PROTOTYPE_OPERATIONS_NOW, formatBerthCode, formatDateTime, getNextActionableOperation, getOperationPlacement, isOptionalOperation, sameOperationIdentity, type Locale, type CallServiceOrder, type PortCall, type PortOperation, type WatchlistSettings } from "@/lib/watchlist";
import { lifecycleOperations, operationTimes, operationPrimaryTime, operationState, operationPlacement, optionalSummaryOperations, operationLabel, operationStateLabel, serviceValues, serviceLabel, stateFromTimeKind, formatMobileDateTime } from "./lifecycleData";
export * from "./lifecycleData";
import styles from "./WatchlistPrototype.module.css";

export function ServiceBadges({ operation, locale }: { operation?: PortOperation; locale: Locale }) {
  const values = serviceValues(operation);
  if (!values.length) return null;
  const label = serviceLabel(operation, locale);
  return <span className={styles.serviceBadges} aria-label={label} data-hover-info={label} data-hover-label={locale === "da" ? "Service" : "Service"}>{values.map((value) => <b key={value}>{value}</b>)}</span>;
}

export function PlacementLabel({
  call,
  operation,
  locale,
  onSelectBerth,
  filterable = true,
  showBollards = true,
  showSide = true,
}: {
  call: PortCall;
  operation?: PortOperation;
  locale: Locale;
  onSelectBerth?: (berth: string) => void;
  filterable?: boolean;
  showBollards?: boolean;
  showSide?: boolean;
}) {
  const placement = operationPlacement(call, operation);
  if (!placement.berth) return null;
  const side = placement.side === "port" ? (locale === "da" ? "BB" : "P") : (locale === "da" ? "SB" : "S");
  const label = `${locale === "da" ? "Filtrér efter kaj" : "Filter by berth"}: ${formatBerthCode(placement.berth)}`;
  return <span className={styles.lifecyclePlacement}>
    {onSelectBerth && filterable ? <button className={`${styles.berth} ${styles.berthButton}`} type="button" data-hover-info={label} data-hover-label={locale === "da" ? "Kajfilter" : "Berth filter"} data-hover-tone="action" aria-label={label} onClick={() => onSelectBerth?.(placement.berth!)}>{formatBerthCode(placement.berth)}</button> : <b className={styles.berthText}>{formatBerthCode(placement.berth)}</b>}
    {showBollards && placement.bollardFrom !== undefined && placement.bollardTo !== undefined && <span className={styles.bollards}>{placement.bollardFrom}-{placement.bollardTo}</span>}
    {showSide && <span className={styles.lifecycleSide}>{side}</span>}
  </span>;
}

export function LifecycleEvent({
  call,
  operation,
  label,
  settings,
  onSelectBerth,
  isBerthFilterable,
  onOpenDetail,
  compact = false,
  showPlacement = true,
  supplement,
}: {
  call: PortCall;
  operation?: PortOperation;
  label: string;
  settings: WatchlistSettings;
  onSelectBerth?: (berth: string) => void;
  isBerthFilterable?: (berth: string, operation?: PortOperation) => boolean;
  onOpenDetail?: () => void;
  compact?: boolean;
  showPlacement?: boolean;
  supplement?: ReactNode;
}) {
  const legacyTimes = operation?.type === "arrival" ? call.arrivalTimes : operation?.type === "departure" ? call.departureTimes : [];
  const isMobileOverride = operation?.source === "mobile-override";
  const times = isMobileOverride
    ? [{ kind: operation.state, value: operation.mobileRegisteredAt ?? operation.at }]
    : operationTimes(operation, legacyTimes);
  const time = isMobileOverride ? operation.mobileRegisteredAt ?? operation.at : operationPrimaryTime(operation, legacyTimes);
  const state = isMobileOverride ? operation.state : operationState(operation, legacyTimes);
  const stateLabel = operationStateLabel(state, settings.locale);
  const timeSummary = times.map((item) => `${item.kind === "live" ? "Live ETA" : operationStateLabel(stateFromTimeKind(item.kind), settings.locale)}: ${formatDateTime(item.value, settings.locale, settings.dateFormat)}`).join("; ");
  const filterable = operation?.placement?.berth || operation?.berth
    ? isBerthFilterable?.((operation?.placement?.berth ?? operation?.berth) as string, operation) ?? true
    : true;
  return <article className={`${styles.lifecycleEvent} ${compact ? styles.lifecycleEventCompact : ""} ${styles[`lifecycle_${state}`]}`} data-state={state} aria-label={`${label}: ${stateLabel}${timeSummary ? ` · ${timeSummary}` : ""}`}>
    <header className={styles.lifecycleEventHeader}><strong>{label}</strong><span>{stateLabel}</span></header>
    {time && (onOpenDetail ? <button className={`${styles.lifecycleTime} ${styles[`time_${state}`]}`} onClick={onOpenDetail} data-hover-info={timeSummary} data-hover-label={`${label} · ${stateLabel}`} data-hover-tone={state === "expected" ? "warning" : state === "ordered" ? "action" : "default"} aria-label={`${label}, ${stateLabel}, ${timeSummary}`}><time dateTime={time}><span className={styles.lifecycleTimeFull}>{formatDateTime(time, settings.locale, settings.dateFormat)}</span><span className={styles.lifecycleTimeCompact}>{formatMobileDateTime(time)}</span></time></button> : <span className={`${styles.lifecycleTime} ${styles[`time_${state}`]}`} data-hover-info={timeSummary} data-hover-label={`${label} · ${stateLabel}`} data-hover-tone={state === "expected" ? "warning" : state === "ordered" ? "action" : "default"} aria-label={`${label}, ${stateLabel}, ${timeSummary}`}><time dateTime={time}><span className={styles.lifecycleTimeFull}>{formatDateTime(time, settings.locale, settings.dateFormat)}</span><span className={styles.lifecycleTimeCompact}>{formatMobileDateTime(time)}</span></time></span>)}
    {supplement}
    <div className={styles.lifecycleEventMeta}><ServiceBadges operation={operation} locale={settings.locale} />{showPlacement && <PlacementLabel call={call} operation={operation} locale={settings.locale} onSelectBerth={onSelectBerth} filterable={filterable} />}</div>
  </article>;
}

export function OptionalEventSummary({
  call,
  settings,
  now = PROTOTYPE_OPERATIONS_NOW,
  serviceOrders = [],
  onSelectBerth,
  isBerthFilterable,
  onOpenDetail,
  compactSummary = false,
  excludeNextOperation = false,
}: {
  call: PortCall;
  settings: WatchlistSettings;
  now?: string | number;
  serviceOrders?: readonly CallServiceOrder[];
  onSelectBerth?: (berth: string) => void;
  isBerthFilterable?: (berth: string, operation?: PortOperation) => boolean;
  onOpenDetail?: (operation: PortOperation) => void;
  compactSummary?: boolean;
  excludeNextOperation?: boolean;
}) {
  const operations = optionalSummaryOperations(call, now, serviceOrders, excludeNextOperation);
  if (!operations.length) return null;
  const next = getNextActionableOperation(call, now, serviceOrders);
  const first = next && isOptionalOperation(next) && operations.some((operation) => sameOperationIdentity(operation, next)) ? next : operations[0];
  const remaining = Math.max(0, operations.length - 1);
  if (compactSummary) {
    const time = operationPrimaryTime(first);
    const placement = getOperationPlacement(first);
    const berth = placement?.berth ? formatBerthCode(placement.berth) : "";
    const berthCanFilter = Boolean(placement?.berth && onSelectBerth && (isBerthFilterable ? isBerthFilterable(placement.berth, first) : true));
    const operationText = operationLabel(first, settings.locale, call);
    const extraText = settings.locale === "da" ? "Ekstra drift" : "Optional operations";
    const detailLabel = `${operationText}${time ? ` · ${formatMobileDateTime(time)}` : ""}${remaining > 0 ? ` · +${remaining}` : ""}`;
    const berthLabel = `${settings.locale === "da" ? "Filtrér efter kaj" : "Filter by berth"}: ${berth}`;
    return <div className={styles.optionalDisclosure} aria-label={`${extraText}: ${detailLabel}${berth ? ` · ${berth}` : ""}`}>
      <button type="button" className={styles.optionalDisclosureMain} onClick={() => onOpenDetail?.(first)} aria-label={detailLabel}>
        <small>{extraText}</small><strong>{operationText}</strong>{time && <time dateTime={time}>{formatMobileDateTime(time)}</time>}
      </button>
      {berth && (berthCanFilter ? <button type="button" className={`${styles.berth} ${styles.berthButton} ${styles.optionalDisclosureBerth}`} onClick={() => onSelectBerth?.(placement!.berth!)} aria-label={berthLabel}>{berth}</button> : <span className={`${styles.berth} ${styles.optionalDisclosureBerthText}`}>{berth}</span>)}
      <span className={styles.optionalDisclosureMeta}>{remaining > 0 && <b>+{remaining}</b>}<BrandIcon name="arrowUpRight" /></span>
    </div>;
  }
  return <div className={styles.optionalSummary} aria-label={settings.locale === "da" ? "Næste ekstra opgaver" : "Next optional operations"}>
    <LifecycleEvent call={call} operation={first} label={operationLabel(first, settings.locale, call)} settings={settings} onSelectBerth={onSelectBerth} isBerthFilterable={isBerthFilterable} onOpenDetail={() => onOpenDetail?.(first)} compact />
    {remaining > 0 && <span className={styles.optionalCount}>+{remaining}</span>}
  </div>;
}

export function allLifecycleEvents(call: PortCall, settings: WatchlistSettings): ReactNode {
  return lifecycleOperations(call).map((operation) => <LifecycleEvent key={operation.id} call={call} operation={operation} label={operationLabel(operation, settings.locale, call)} settings={settings} compact={false} />);
}
