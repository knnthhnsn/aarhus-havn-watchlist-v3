"use client";

import { useId, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { MobileTaskOverride } from "@/lib/mobileTask";
import { CraneBadge } from "./CraneBadge";
import { mobileCardFocus } from "./mobileCardFocus";
import { OperationServices } from "./OperationServices";
import { OperationRegistration } from "./OperationRegistration";
import { MobileRegistrationDialog } from "./MobileRegistrationDialog";
import { BrandIcon } from "@/components/brand/BrandIcon";
import {
  formatBerthCode, formatClock, formatDateTime, getNextActionableOperation, getOperationalWarnings, getOperationPlacement,
  isStudCall, liveTime, sameOperationIdentity, type CallServiceOrder, type Locale, type PortCall, type PortOperation,
} from "@/lib/watchlist";
import { lifecycleOperations, operationLabel, operationPrimaryTime, operationStateLabel } from "@/components/watchlist/lifecycleData";
import { categoryName, getCallPlacementPresentation, plannedTime, shortDate, statusNames, timeNames } from "./display";
import { liveEtaLabel } from "./liveEtaLabel";
import type { DetailTab } from "./CallDetail";
import { NotesButton, NotesIndicator } from "./NotesControl";
import { PinButton, PinIndicator } from "./PinControl";
import stateSurface from "./StateSurface.module.css";
import { mobileCallSwipeAction, mobileCallSwipeAxis, mobileCallSwipeIntent, type MobileCallSwipeAxis } from "./mobileCallSwipe";
import styles from "./MobileCallList.module.css";

export interface MobileCallListProps {
  calls: readonly PortCall[];
  allCalls: readonly PortCall[];
  serviceOrders: readonly CallServiceOrder[];
  locale: Locale;
  preset: "full" | "office" | "port";
  compact?: boolean;
  now: string | number;
  pins: readonly string[];
  onPin: (call: PortCall) => void;
  onOpen: (call: PortCall, tab: DetailTab) => void;
  onBerth: (berth: string) => void;
  onStud?: () => void;
  onRegister: (call: PortCall, operation: PortOperation, value?: MobileTaskOverride) => void;
  onShowMap: (call: PortCall) => void;
}

type RowProps = Omit<MobileCallListProps, "calls" | "pins"> & {
  call: PortCall;
  stripe: number;
  pinned: boolean;
  open: boolean;
  onTray: (id: string | null) => void;
};

/** Keep every optional operation visible, including next-task and actual entries. */
export function getMobileCallOperations(call: PortCall, serviceOrders: readonly CallServiceOrder[] = []): PortOperation[] {
  return lifecycleOperations(call, serviceOrders).filter(operation => operation.type === "shifting" || operation.type === "assistance" || operation.type === "anchorage");
}

function CompactTime({ call, locale, onOpen, onEdit, operation, isNext = false }: Pick<MobileCallListProps, "locale" | "onOpen"> & { call: PortCall; operation: PortOperation; onEdit?: () => void; isNext?: boolean }) {
  const mode = operation.type;
  const time = mode === "arrival" ? plannedTime(call.arrivalTimes) : mode === "departure" ? plannedTime(call.departureTimes) : { kind: operation.state, value: operation.at };
  const label = operationLabel(operation, locale, call);
  const description = `${label} for ${call.vesselName}: ${time ? `${timeNames[locale][time.kind]} ${formatDateTime(time.value, locale, "compact")}` : "—"}`;
  return <div className={styles.time} data-mode={mode} data-kind={time?.kind} data-next={isNext}>
    <button type="button" className={styles.timeInfo} onClick={() => onOpen(call, "timeline")} aria-label={description}><span className={styles.timeLabel}>{label}<small>{time ? shortDate(time.value, locale) : "—"}</small></span>
    <span className={styles.timeValue} data-kind={time?.kind}><strong>{time ? formatClock(time.value) : "—"}</strong><span className={styles.srOnly}>{time ? timeNames[locale][time.kind] : (locale === "da" ? "Ikke oplyst" : "Not set")}</span><OperationServices operation={operation} locale={locale} compact showWorkLocation={false} /></span>
    </button>{onEdit && <button type="button" className={styles.timeAction} onClick={onEdit} aria-label={`${locale === "da" ? "Registrér" : "Register"} ${description}`} title={locale === "da" ? "Registrér" : "Register"}><BrandIcon name="arrowRight" /><span>{locale === "da" ? "Registrér" : "Register"}</span></button>}
  </div>;
}

function OperationCard({ operation, call, locale, isNext = false, canRegister, onActivate }: { operation: PortOperation; call: PortCall; locale: Locale; isNext?: boolean; canRegister: boolean; onActivate: () => void }) {
  const statusId = useId();
  const da = locale === "da";
  const placement = getOperationPlacement(operation);
  const at = operation.mobileRegisteredAt ?? operationPrimaryTime(operation);
  return <button type="button" className={`${styles.primaryTask} ${styles.taskButton} ${stateSurface.surface}`} data-state={operation.state} data-next={isNext} onClick={onActivate}
    aria-label={`${canRegister ? (da ? "Registrér" : "Register") : (da ? "Se" : "View")} ${operationLabel(operation, locale, call)} for ${call.vesselName}`} aria-describedby={statusId}>
    <span className={styles.taskContent}>
      <span className={styles.taskHeading}><span>{da ? "Opgave" : "Task"}</span><span id={statusId} className={styles.srOnly}>{operationStateLabel(operation.state, locale)}</span></span>
      <strong>{operationLabel(operation, locale, call)}</strong>
      <span className={styles.taskTime}><BrandIcon name="calendar" />{shortDate(at, locale)} · <b>{formatClock(at)}</b></span>
      <span className={styles.taskPlacement}>{operation.workLocation !== "stud" && placement && <>{da ? "Kaj" : "Quay"} <b>{formatBerthCode(placement.berth)}</b> · P {placement.bollardFrom}–{placement.bollardTo} · </>}<span className={styles.placementTail}>{operation.workLocation !== "stud" && placement && (placement.side === "port" ? (da ? "BB" : "P") : (da ? "SB" : "S"))}<OperationServices operation={operation} locale={locale} compact inline showWorkLocation={!isStudCall(call)} /></span></span>
    </span>
    <span className={styles.registerNext} aria-hidden="true"><BrandIcon name="arrowRight" /><span>{canRegister ? (da ? "Registrér" : "Register") : (da ? "Detaljer" : "Details")}</span></span>
  </button>;
}

function MobileCallRow({ call, stripe, allCalls, serviceOrders, locale, preset, compact = false, now, pinned, open, onTray, onPin, onOpen, onBerth, onStud, onRegister, onShowMap }: RowProps) {
  const id = useId();
  const da = locale === "da";
  const canRegister = call.visibility === "public";
  const presentation = getCallPlacementPresentation(call, now);
  const placement = presentation.placement;
  const isStud = presentation.isStud;
  const focus = mobileCardFocus(call, now, serviceOrders);
  const next = focus.operations[0];
  const actionableNext = getNextActionableOperation(call, now, serviceOrders);
  // Normal has a dedicated next-task card; compact uses two adjacent priority fields.
  const featured = !compact && actionableNext && actionableNext.type !== "arrival" && actionableNext.type !== "departure" ? actionableNext : undefined;
  const focusedOperations = compact ? focus.operations : focus.candidates.filter(operation => !sameOperationIdentity(operation, featured)).slice(0, 2);
  const signals = getOperationalWarnings(call, allCalls, now, serviceOrders);
  const live = liveTime(call.arrivalTimes);
  const arrival = plannedTime(call.arrivalTimes);
  const liveEta = live && live !== arrival?.value ? liveEtaLabel(live, arrival?.value, locale) : null;
  const [confirmation, setConfirmation] = useState<PortOperation | null>(null);
  const [opsExpanded, setOpsExpanded] = useState(false);
  const [message, setMessage] = useState("");
  const [drag, setDrag] = useState(0);
  const pointer = useRef<{ id: number; x: number; y: number; axis: MobileCallSwipeAxis } | null>(null);
  const suppressClick = useRef(false);
  const disclosureRef = useRef<HTMLButtonElement>(null);
  const opsRef = useRef<HTMLButtonElement>(null);
  // Never repeat work already exposed in either a schedule slot or next-task card.
  const optionalOperations = getMobileCallOperations(call, serviceOrders)
    .filter(operation => !sameOperationIdentity(operation, featured) && !focusedOperations.some(item => sameOperationIdentity(item, operation)));

  const registrationOperations = lifecycleOperations(call, serviceOrders);
  function editOperation(operation: PortOperation) {
    if (!canRegister) return;
    setMessage("");
    onTray(call.id);
    setConfirmation(operation);
  }

  function closeTray(focus = false) {
    setConfirmation(null);
    setMessage("");
    onTray(null);
    if (focus) requestAnimationFrame(() => disclosureRef.current?.focus({ preventScroll: true }));
  }


  function resetPointer(event?: PointerEvent<HTMLElement>) {
    const active = pointer.current;
    pointer.current = null;
    setDrag(0);
    if (event && active?.id === event.pointerId && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    suppressClick.current = false;
    if (!event.isPrimary || event.pointerType === "mouse" || (event.target instanceof Element && event.target.closest("input, textarea, select, label, [contenteditable='true']"))) return;
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, axis: null };
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const active = pointer.current;
    if (!active || active.id !== event.pointerId) return;
    const dx = event.clientX - active.x, dy = event.clientY - active.y;
    if (!active.axis) active.axis = mobileCallSwipeAxis(dx, dy);
    if (active.axis !== "horizontal") return;
    suppressClick.current = true;
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
    if (event.cancelable) event.preventDefault();
    setDrag(Math.max(-28, Math.min(28, open ? Math.min(0, dx) / 3 : Math.max(0, dx) / 3)));
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    const active = pointer.current;
    if (!active || active.id !== event.pointerId) return;
    const dx = event.clientX - active.x, dy = event.clientY - active.y;
    const intent = mobileCallSwipeIntent(dx, dy, active.axis ?? mobileCallSwipeAxis(dx, dy));
    if (intent) suppressClick.current = true;
    resetPointer(event);
    const operation = next ?? registrationOperations[0];
    const action = mobileCallSwipeAction(intent, canRegister, !!operation, open && !!confirmation);
    if (action === "register" && operation) {
      setMessage("");
      onTray(call.id);
      setConfirmation(current => current ?? operation);
    }
    // A swipe hides, rather than discards, the editor and its unsaved fields.
    if (action === "close" && open) onTray(null);
  }

  function cancelConfirmation() {
    setConfirmation(null);
    onTray(null);
  }

  function confirmRegistration(operation: PortOperation, value: MobileTaskOverride) {
    if (!canRegister || !confirmation) return;
    if (!registrationOperations.some(item => sameOperationIdentity(item, operation))) {
      setConfirmation(null);
      setMessage(da ? "Opgaven er ændret. Kontrollér den næste opgave." : "The operation has changed. Check the next task.");
      return;
    }
    setConfirmation(null);
    onTray(null);
    onRegister(call, operation, value);
  }

  const quayLabel = isStud ? "STUD" : `${presentation.kind === "historical" ? (da ? "Sidste kaj" : "Last quay") : presentation.kind === "upcoming" ? (da ? "Planlagt kaj" : "Planned quay") : (da ? "Kaj" : "Quay")} ${formatBerthCode(placement.berth)}, ${da ? "pullerter" : "bollards"} ${placement.bollardFrom}–${placement.bollardTo}, ${placement.side === "port" ? (da ? "bagbord" : "port side") : (da ? "styrbord" : "starboard")}`;
  const quayContent = isStud ? <strong>STUD</strong> : <><span>{presentation.kind === "historical" ? (da ? "Sidste kaj" : "Last quay") : (da ? "Kaj" : "Quay")}</span><strong>{formatBerthCode(placement.berth)}<small>{placement.side === "port" ? (da ? "BB" : "P") : (da ? "SB" : "S")}</small></strong></>;
  const craneBadge = call.craneStatus !== "none" ? <button type="button" className={styles.craneSummary} aria-label={`${da ? "Vis krantider for" : "Show crane times for"} ${call.vesselName}`} onClick={() => onOpen(call, "crane")}>{da ? "Kran" : "Crane"} <CraneBadge status={call.craneStatus} locale={locale} /></button> : null;
  const opsButton = optionalOperations.length > 0 && <button ref={opsRef} type="button" className={styles.opsButton} aria-expanded={opsExpanded} aria-controls={`${id}-ops`} aria-label={`${opsExpanded ? (da ? "Skjul" : "Hide") : (da ? "Vis" : "Show")} ${optionalOperations.length} ${da ? "handlinger for" : "actions for"} ${call.vesselName}`} onClick={() => setOpsExpanded(value => !value)}><span>{compact ? (da ? "Handling" : "Action") : (da ? "Handlinger" : "Actions")}</span><strong>{optionalOperations.length}<BrandIcon name={opsExpanded ? "arrowUp" : "arrowDown"} /></strong></button>;
  const disclosureButton = <button ref={disclosureRef} type="button" className={styles.disclosure} aria-label={`${da ? "Vis på kort" : "Show on map"}: ${call.vesselName}`} onClick={() => { closeTray(); onShowMap(call); }}><BrandIcon name="map" /><span>{da ? "Kort" : "Map"}</span></button>;

  return <li className={styles.row} data-call-id={call.id} data-stripe={stripe} data-open={open} data-pinned={pinned} data-density={compact ? "compact" : "normal"} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={resetPointer} onLostPointerCapture={event => { if (event.target === event.currentTarget) resetPointer(); }}
    onClickCapture={event => { if (event.target instanceof Element && event.target.closest("dialog")) return; if (suppressClick.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}
    onKeyDown={event => { if (event.key !== "Escape" || (!open && !opsExpanded)) return; event.preventDefault(); if (confirmation && open) cancelConfirmation(); else if (open) closeTray(true); else { setOpsExpanded(false); opsRef.current?.focus({ preventScroll: true }); } }}>
    <article className={styles.summary} aria-labelledby={`${id}-name`} aria-describedby={`${id}-status`} style={{ "--row-drag": `${drag}px` } as CSSProperties} data-dragging={drag !== 0}
      onClick={event => { if (event.target instanceof Element && !event.target.closest("button, a, input, select, textarea, label") && !window.getSelection()?.toString()) onOpen(call, "call"); }}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <strong id={`${id}-name`}><button type="button" className={styles.nameButton} onClick={() => onOpen(call, "call")} aria-label={`${da ? "Åbn detaljer for" : "Open details for"} ${call.vesselName}`}>{call.vesselName}</button>{compact && pinned && <PinIndicator locale={locale} vesselName={call.vesselName} />}</strong><span><b className={styles.callNumber}>Call {call.callNumber}</b><i>·</i>{categoryName(call.category, locale)}{call.visibility === "restricted" && <BrandIcon name="security" />}</span>
          {preset === "office" && !compact && <span className={styles.identifiers}>Ksign {call.callSign}<i>·</i>IMO {call.imo}</span>}
        </div>
        <span className={styles.srOnly} id={`${id}-status`}>{statusNames[locale][call.status]}{call.visibility === "restricted" ? (da ? ", beskyttet call · kun visning" : ", protected call") : ""}</span>
        {signals.length > 0 && <button type="button" className={styles.signal} aria-label={`${signals.length} ${da ? "opmærksomhedspunkter for" : "attention items for"} ${call.vesselName}`} onClick={() => onOpen(call, "call")}><BrandIcon name="attention" /><span>{signals.length}</span></button>}
        {compact ? <>{opsButton}{disclosureButton}</> : <PinButton pinned={pinned} locale={locale} vesselName={call.vesselName} showLabel onClick={() => onPin(call)} />}
      </header>
      <div className={styles.schedule} data-arrival-kind={arrival?.kind} data-phase={focus.phase} data-single={focusedOperations.length < 2} data-focused={focusedOperations[0]?.type ?? focus.phase}>
        {isStud && onStud ? <button type="button" className={styles.quay} aria-label={da ? "Filtrér STUD" : "Filter STUD"} onClick={onStud}>{quayContent}</button> : presentation.filterable && !isStud ? <button type="button" className={styles.quay} aria-label={`${da ? "Filtrér" : "Filter"}: ${quayLabel}`} onClick={() => onBerth(placement.berth)}>{quayContent}</button> : <span className={styles.quay} aria-label={quayLabel}>{quayContent}</span>}
        {focusedOperations.map(operation => <CompactTime key={operation.id} call={call} operation={operation} isNext={!!actionableNext && sameOperationIdentity(operation, actionableNext)} locale={locale} onOpen={onOpen} onEdit={canRegister ? () => editOperation(operation) : undefined} />)}
        {focusedOperations.length === 0 && !featured && <button type="button" className={styles.focusFacts} onClick={() => onOpen(call, "timeline")}><span>{da ? "Call afsluttet" : "Call completed"}</span><strong>{da ? "Se tidslinje" : "View timeline"}</strong><BrandIcon name="arrowRight" /></button>}
      </div>
      {!compact && <div className={`${styles.context} ${preset === "office" ? styles.officeContext : ""}`}>
        {!isStud && <span>{da ? "P" : "B"} {placement.bollardFrom}–{placement.bollardTo}</span>}
        {liveEta && <span className={styles.live}>{liveEta}</span>}
        {preset === "office" && <>{craneBadge}</>}
        {preset === "port" && <span className={styles.party}>Agent: {call.agent}</span>}
        {preset === "full" && <span>IMO {call.imo} · {call.loaMeters} × {call.beamMeters} m</span>}
      </div>}
      {!compact && preset === "full" && <div className={styles.fullContext}><span><b>Agent</b> {call.agent}</span><span><b>Ksign</b> {call.callSign}{craneBadge && <> · {craneBadge}</>}</span></div>}
      {compact && <div className={styles.compactMeta}><span>LOA {call.loaMeters} m</span>{!isStud && <span>P {placement.bollardFrom}–{placement.bollardTo}</span>}{craneBadge}</div>}
      {compact ? <div className={styles.compactNext}><button type="button" onClick={() => onOpen(call, "timeline")}>{da ? "Alle tider" : "All times"}<BrandIcon name="arrowRight" /></button>{liveEta && <small>{liveEta}</small>}<NotesIndicator call={call} locale={locale} /></div> : <>
        {featured && <section className={styles.nextTaskSection}><h3>{da ? "Næste opgave" : "Next task"}</h3><OperationCard operation={featured} call={call} locale={locale} isNext={!!actionableNext && sameOperationIdentity(featured, actionableNext)} canRegister={canRegister} onActivate={() => canRegister ? editOperation(featured) : onOpen(call, "call")} /></section>}
        <div className={styles.nextRow}>{opsButton}<NotesButton call={call} locale={locale} showLabel onClick={() => onOpen(call, "notes")} />{disclosureButton}</div>
      </>}
    </article>
    {optionalOperations.length > 0 && <section className={styles.operations} id={`${id}-ops`} hidden={!opsExpanded} aria-label={`${da ? "Handlinger for" : "Actions for"} ${call.vesselName}`}>
      <div className={styles.operationsHeading}><strong>{da ? "Handlinger" : "Actions"}</strong><span>{optionalOperations.length} {da ? "handlinger" : "actions"}</span></div>
      <ol>{optionalOperations.map(operation => <li key={operation.id}><OperationCard operation={operation} call={call} locale={locale} canRegister={canRegister} onActivate={() => { if (canRegister) { onTray(call.id); setConfirmation(operation); } else onOpen(call, "call"); }} /></li>)}</ol>
    </section>}
    <MobileRegistrationDialog open={open && !!confirmation && canRegister} vesselName={call.vesselName} callNumber={call.callNumber} da={da} onClose={() => onTray(null)}>
      {confirmation && canRegister ? <OperationRegistration key={confirmation.id} call={call} operations={registrationOperations} initialOperation={confirmation} locale={locale} onSave={confirmRegistration} onCancel={cancelConfirmation} /> : null}
    </MobileRegistrationDialog>
    {message && <p className={styles.trayHint} role="status">{message}</p>}
  </li>;
}

export function MobileCallList(props: MobileCallListProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  return <div className={styles.list}>
    <p className={styles.swipeHint}><BrandIcon name="arrowRight" />{props.locale === "da" ? "Stryg højre: registrering · tryk på skibet: detaljer" : "Swipe right: register · tap vessel: details"}</p>
    <ol>{props.calls.map((call, index) => <MobileCallRow key={call.id} {...props} call={call} stripe={index % 2} pinned={props.pins.includes(call.id)} open={openId === call.id} onTray={setOpenId} />)}</ol>
  </div>;
}
