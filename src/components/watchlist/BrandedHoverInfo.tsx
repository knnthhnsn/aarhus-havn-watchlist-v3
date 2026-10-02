"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import styles from "./WatchlistPrototype.module.css";

type HoverInfoTone = "default" | "action" | "warning" | "alert" | "restricted";
type HoverInfoState = {
  label?: string;
  message: string;
  placement: "top" | "bottom";
  theme: "dark" | "light";
  tone: HoverInfoTone;
  x: number;
  y: number;
};

const TOOLTIP_ID = "vessel-schedule-hover-info";
const TOOLTIP_SELECTOR = "[data-hover-info]";

function tooltipTarget(value: EventTarget | null): HTMLElement | null {
  return value instanceof Element ? value.closest<HTMLElement>(TOOLTIP_SELECTOR) : null;
}

function tooltipPosition(target: HTMLElement) {
  const rect = target.getBoundingClientRect();
  const maxWidth = Math.min(328, window.innerWidth - 24);
  const halfWidth = maxWidth / 2;
  return {
    placement: rect.top >= 132 ? "top" as const : "bottom" as const,
    x: Math.min(Math.max(rect.left + rect.width / 2, halfWidth + 12), window.innerWidth - halfWidth - 12),
    y: rect.top >= 132 ? rect.top - 12 : rect.bottom + 12,
  };
}

export function BrandedHoverInfo() {
  const [info, setInfo] = useState<HoverInfoState | null>(null);
  const timerRef = useRef<number | null>(null);
  const pendingTargetRef = useRef<HTMLElement | null>(null);
  const describedTargetRef = useRef<{ element: HTMLElement; previous: string | null } | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      pendingTargetRef.current = null;
    };
    const restoreDescription = () => {
      const described = describedTargetRef.current;
      if (!described) return;
      if (described.previous) described.element.setAttribute("aria-describedby", described.previous);
      else described.element.removeAttribute("aria-describedby");
      describedTargetRef.current = null;
    };
    const hide = () => {
      clearTimer();
      restoreDescription();
      setInfo(null);
    };
    const reveal = (target: HTMLElement) => {
      if (!target.isConnected) return;
      const message = target.dataset.hoverInfo?.trim() || target.getAttribute("aria-label")?.trim();
      if (!message) return;
      restoreDescription();
      const previous = target.getAttribute("aria-describedby");
      target.setAttribute("aria-describedby", [previous, TOOLTIP_ID].filter(Boolean).join(" "));
      describedTargetRef.current = { element: target, previous };
      const { placement, x, y } = tooltipPosition(target);
      const tone = target.dataset.hoverTone as HoverInfoTone | undefined;
      const app = target.closest<HTMLElement>("[data-theme]");
      setInfo({
        label: target.dataset.hoverLabel?.trim() || undefined,
        message,
        placement,
        theme: app?.dataset.theme === "light" ? "light" : "dark",
        tone: tone && ["action", "warning", "alert", "restricted"].includes(tone) ? tone : "default",
        x,
        y,
      });
    };
    const schedule = (target: HTMLElement, delay: number) => {
      if (pendingTargetRef.current === target || describedTargetRef.current?.element === target) return;
      clearTimer();
      restoreDescription();
      setInfo(null);
      pendingTargetRef.current = target;
      timerRef.current = window.setTimeout(() => {
        pendingTargetRef.current = null;
        timerRef.current = null;
        reveal(target);
      }, delay);
    };
    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const target = tooltipTarget(event.target);
      const previous = tooltipTarget(event.relatedTarget);
      if (target && target !== previous) schedule(target, 260);
    };
    const onPointerOut = (event: PointerEvent) => {
      const target = tooltipTarget(event.target);
      const next = tooltipTarget(event.relatedTarget);
      if (target && target !== next) hide();
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = tooltipTarget(event.target);
      if (target) schedule(target, 40);
    };
    const onFocusOut = (event: FocusEvent) => {
      const target = tooltipTarget(event.target);
      const next = tooltipTarget(event.relatedTarget);
      if (target && target !== next) hide();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };

    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerout", onPointerOut);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", hide);
    window.addEventListener("scroll", hide, true);
    return () => {
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", hide);
      window.removeEventListener("scroll", hide, true);
      clearTimer();
      restoreDescription();
    };
  }, []);

  if (!info || typeof document === "undefined") return null;
  const position = { left: `${info.x}px`, top: `${info.y}px` } as CSSProperties;
  return createPortal(
    <aside
      id={TOOLTIP_ID}
      className={styles.brandedHoverInfo}
      data-placement={info.placement}
      data-theme={info.theme}
      data-tone={info.tone}
      role="tooltip"
      style={position}
    >
      <span className={styles.brandedHoverCopy}>
        {info.label && <strong>{info.label}</strong>}
        <span>{info.message.replaceAll("; ", "\n")}</span>
      </span>
    </aside>,
    document.body,
  );
}
