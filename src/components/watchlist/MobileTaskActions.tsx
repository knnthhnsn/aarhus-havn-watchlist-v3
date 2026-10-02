"use client";

import { useEffect, useRef, useState } from "react";

import { BrandIcon } from "@/components/brand/BrandIcon";
import {
  formatClock,
  formatDateTime,
  getNextActionableOperation,
  getOperationPlacement,
  liveTime,
  sameOperationIdentity,
  type CallServiceOrder,
  type OperationState,
  type PortCall,
  type PortOperation,
  type WatchlistSettings,
} from "@/lib/watchlist";
import {
  mobileTaskKey,
  mobileTaskRegistrationTime,
  mobileTaskSwipeIntent,
  mobileTaskState,
  MOBILE_TASK_STATE_ORDER,
  nextMobileTask,
  type MobileTaskOverrideMap,
} from "@/lib/mobileTask";

import {
  PlacementLabel,
  ServiceBadges,
  lifecycleOperations,
  operationLabel,
  operationPrimaryTime,
} from "./lifecycle";
import styles from "./MobileTaskActions.module.css";

export type MobileTaskLabels = {
  taskList: string;
  task: string;
  next: string;
  chooseStatus: string;
  register: string;
  edit: string;
  editShort: string;
  close: string;
  showMore: string;
  showLess: string;
  liveEta: string;
  registered: string;
  noTime: string;
  states: Record<OperationState, string>;
};

type MobileTaskActionsProps = {
  call: PortCall;
  settings: WatchlistSettings;
  now: string | number;
  serviceOrders: readonly CallServiceOrder[];
  overrides: MobileTaskOverrideMap;
  labels: MobileTaskLabels;
  feedbackEnabled: boolean;
  compactTable?: boolean;
  onRegister: (operation: PortOperation, state: OperationState) => void;
  onSelectBerth?: (berth: string) => void;
  isBerthFilterable?: (berth: string, operation?: PortOperation) => boolean;
};

function cueStatusTap(enabled: boolean): void {
  if (!enabled || typeof window === "undefined") return;
  try {
    const navigatorWithVibrate = window.navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean };
    navigatorWithVibrate.vibrate?.(8);
  } catch {
    // Haptics are progressive enhancement and may be unavailable in a browser.
  }
  try {
    const windowWithWebAudio = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioContextConstructor = window.AudioContext ?? windowWithWebAudio.webkitAudioContext;
    if (!AudioContextConstructor) return;
    const context = new AudioContextConstructor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 660;
    gain.gain.value = 0.025;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => {
      try { void context.close().catch(() => undefined); } catch { /* autoplay/close may be blocked */ }
    };
    oscillator.start();
    oscillator.stop(context.currentTime + 0.045);
  } catch {
    // Audio is optional; the state change and visual feedback always remain.
  }
}

function legacyTimes(call: PortCall, operation: PortOperation) {
  return operation.type === "arrival" ? call.arrivalTimes : operation.type === "departure" ? call.departureTimes : [];
}

function taskId(callId: string, operationId: string): string {
  return mobileTaskKey(callId, operationId).replace(/[^a-zA-Z0-9_-]/g, "-");
}

export function MobileTaskActions({
  call,
  settings,
  now,
  serviceOrders,
  overrides,
  labels,
  feedbackEnabled,
  onRegister,
  onSelectBerth,
  isBerthFilterable,
  compactTable = false,
}: MobileTaskActionsProps) {
  const operations = lifecycleOperations(call, serviceOrders);
  const sourceNext = getNextActionableOperation(call, now, serviceOrders);
  const next = nextMobileTask(call.id, operations, overrides, sourceNext);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dragX, setDragX] = useState(0);
  const [updatedKey, setUpdatedKey] = useState<string | null>(null);
  const pointerRef = useRef<{ pointerId: number; key: string; startX: number; startY: number; horizontal: boolean } | null>(null);
  const animationTimerRef = useRef<number | null>(null);
  const openTrayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => {
    if (animationTimerRef.current !== null) window.clearTimeout(animationTimerRef.current);
  }, []);

  useEffect(() => {
    if (!openTaskId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpenTaskId(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [openTaskId]);

  useEffect(() => {
    if (!openTaskId || compactTable || !openTrayRef.current) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = window.requestAnimationFrame(() => openTrayRef.current?.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" }));
    return () => window.cancelAnimationFrame(frame);
  }, [compactTable, openTaskId]);

  const resetPointer = (event?: React.PointerEvent<HTMLElement>) => {
    if (event && pointerRef.current?.pointerId === event.pointerId) {
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* capture can already be released */ }
    }
    pointerRef.current = null;
    setDraggingKey(null);
    setDragX(0);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>, key: string) => {
    if (event.pointerType === "mouse" || (event.target as HTMLElement).closest("button")) return;
    pointerRef.current = { pointerId: event.pointerId, key, startX: event.clientX, startY: event.clientY, horizontal: false };
    setDraggingKey(key);
    setDragX(0);
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* touch browsers may not expose capture */ }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - pointer.startX;
    const deltaY = event.clientY - pointer.startY;
    if (Math.abs(deltaY) > Math.abs(deltaX) || Math.abs(deltaX) < 5) return;
    pointer.horizontal = true;
    event.preventDefault();
    const directionalDelta = openTaskId === pointer.key ? Math.min(0, deltaX) : Math.max(0, deltaX);
    setDragX(Math.max(-120, Math.min(120, directionalDelta)));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - pointer.startX;
    const intent = pointer.horizontal ? mobileTaskSwipeIntent(deltaX) : null;
    if (intent === "open") setOpenTaskId(pointer.key);
    if (intent === "close") setOpenTaskId(null);
    resetPointer(event);
  };

  const chooseState = (operation: PortOperation, state: OperationState) => {
    const key = mobileTaskKey(call.id, operation.id);
    setUpdatedKey(key);
    if (animationTimerRef.current !== null) window.clearTimeout(animationTimerRef.current);
    animationTimerRef.current = window.setTimeout(() => setUpdatedKey(null), 420);
    onRegister(operation, state);
    cueStatusTap(feedbackEnabled);
    setOpenTaskId(null);
  };

  const fallbackTask = [...operations].reverse().find((operation) => mobileTaskState(call.id, operation, overrides) === "actual") ?? operations.at(-1);
  const firstTask = next ?? operations.find((operation) => mobileTaskState(call.id, operation, overrides) !== "actual") ?? fallbackTask;
  const visibleOperations = compactTable ? (firstTask ? [firstTask] : []) : showAllTasks ? operations : firstTask ? [firstTask] : [];
  const hiddenCount = Math.max(0, operations.length - visibleOperations.length);

  return <ol className={`${styles.taskList} ${compactTable ? styles.taskListCompact : ""}`} aria-label={labels.taskList}>
    {visibleOperations.map((operation) => {
      const key = mobileTaskKey(call.id, operation.id);
      const safeId = taskId(call.id, operation.id);
      const state = mobileTaskState(call.id, operation, overrides);
      const registrationAt = mobileTaskRegistrationTime(call.id, operation, overrides);
      const taskTime = operationPrimaryTime(operation, legacyTimes(call, operation));
      const liveArrival = operation.type === "arrival" ? liveTime(call.arrivalTimes) : undefined;
      const showLiveArrival = Boolean(liveArrival && liveArrival !== taskTime);
      const placement = getOperationPlacement(operation);
      const berthFilterable = placement?.berth ? (isBerthFilterable?.(placement.berth, operation) ?? true) : true;
      const operationText = operationLabel(operation, settings.locale, call);
      const taskPosition = operations.indexOf(operation) + 1;
      const isNext = Boolean(next && sameOperationIdentity(next, operation));
      const isOpen = openTaskId === key;
      const isUpdated = updatedKey === key;
      const actionText = isOpen ? labels.close : state === "actual" ? labels.edit : labels.register;
      const compactActionText = isOpen ? labels.close : state === "actual" ? labels.editShort : labels.register;
      return <li
        key={key}
        className={styles.taskItem}
        data-state={state}
        data-open={isOpen}
        data-dragging={draggingKey === key}
        data-updated={isUpdated}
        style={draggingKey === key ? { transform: `translateX(${dragX}px)` } : undefined}
        onPointerDown={(event) => handlePointerDown(event, key)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={(event) => resetPointer(event)}
        onLostPointerCapture={() => resetPointer()}
      >
        <div className={styles.taskMain} data-state={state} data-next={isNext}>
          <div className={styles.taskKicker}>
            <span className={isNext ? styles.nextBadge : styles.taskSequence}>{isNext ? labels.next : labels.task}</span>
            <span className={styles.taskProgress} aria-label={`${labels.task} ${taskPosition} / ${operations.length}`}>{taskPosition} / {operations.length}</span>
          </div>
          <div className={styles.taskHeading}>
            <span className={styles.taskType}>{operationText}</span>
            <span className={styles.taskState} aria-label={labels.states[state]}><i aria-hidden="true" />{labels.states[state]}</span>
          </div>
          <div className={styles.taskTimeRow}>
            <BrandIcon name="calendar" className={styles.taskTimeIcon} />
            <time dateTime={taskTime || undefined}>{taskTime ? formatDateTime(taskTime, settings.locale, "compact") : labels.noTime}</time>
            {registrationAt && <span className={styles.registrationTime}>{labels.registered} · {formatClock(registrationAt)}</span>}
          </div>
          <div className={styles.taskMeta}>
            <ServiceBadges operation={operation} locale={settings.locale} />
            <PlacementLabel call={call} operation={operation} locale={settings.locale} onSelectBerth={onSelectBerth} filterable={berthFilterable} />
            {showLiveArrival && <span className={styles.liveEta}>{labels.liveEta} · {formatClock(liveArrival!)}</span>}
          </div>
        </div>
        <button
          type="button"
          className={styles.taskAction}
          aria-expanded={isOpen}
          aria-controls={isOpen ? safeId : undefined}
          aria-label={`${operationText} · ${actionText}`}
          onClick={() => setOpenTaskId(isOpen ? null : key)}
        >
          <span>{compactTable ? compactActionText : actionText}</span><BrandIcon name={isOpen ? "close" : "arrowRight"} />
        </button>
        {isOpen && <div ref={openTrayRef} id={safeId} className={styles.statusTray} role="group" aria-labelledby={`${safeId}-label`}>
          <div className={styles.trayHeader}>
            <span id={`${safeId}-label`} className={styles.trayLabel}><span>{labels.chooseStatus}</span><strong>{operationText}</strong></span>
            <button type="button" className={styles.trayClose} aria-label={labels.close} onClick={() => setOpenTaskId(null)}><span>{labels.close}</span><BrandIcon name="close" /></button>
          </div>
          {MOBILE_TASK_STATE_ORDER.map((option) => <button
            key={option}
            type="button"
            className={styles[`status_${option}`]}
            aria-pressed={state === option}
            onClick={() => chooseState(operation, option)}
          >
            <span>{labels.states[option]}</span>{state === option && <BrandIcon name="check" />}
          </button>)}
        </div>}
      </li>;
    })}
    {operations.length > 1 && <li className={styles.taskDisclosure}>
      <button
        type="button"
        className={styles.taskDisclosureButton}
        aria-expanded={showAllTasks}
        onClick={() => { setShowAllTasks((value) => !value); setOpenTaskId(null); }}
      >
        <span>{showAllTasks ? labels.showLess : `${labels.showMore} (+${hiddenCount})`}</span>
        <BrandIcon name={showAllTasks ? "arrowUp" : "arrowDown"} />
      </button>
    </li>}
  </ol>;
}
