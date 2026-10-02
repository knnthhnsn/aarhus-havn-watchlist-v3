"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import s from "./MobileRegistrationDialog.module.css";

/** Keep the editor mounted when dismissed so a swipe never discards a draft. */
export function MobileRegistrationDialog({ open, vesselName, callNumber, da, onClose, children }: {
  open: boolean; vesselName: string; callNumber: string; da: boolean;
  onClose: () => void; children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const title = useId();
  useEffect(() => {
    const node = dialog.current;
    if (!open || !node) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    node.showModal();
    document.body.style.overflow = "hidden";
    node.querySelector<HTMLElement>("h3")?.focus({ preventScroll: true });
    return () => {
      node.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open]);
  return <dialog ref={dialog} className={s.dialog} aria-labelledby={title}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => event.stopPropagation()}
    onClick={event => event.stopPropagation()}
    onPointerDown={event => event.stopPropagation()}
    onPointerMove={event => event.stopPropagation()}
    onPointerUp={event => event.stopPropagation()}>
    <header className={s.header}
      onPointerDown={event => { if (event.pointerType !== "mouse" && event.isPrimary) start.current = { x: event.clientX, y: event.clientY }; }}
      onPointerCancel={() => { start.current = null; }}
      onPointerUp={event => {
        const origin = start.current;
        start.current = null;
        if (origin && origin.x - event.clientX > 48 && Math.abs(origin.y - event.clientY) < 24) onClose();
      }}>
      <div><strong id={title}>{vesselName}</strong><span>Call {callNumber}</span></div>
      <button type="button" onClick={onClose}>{da ? "Luk" : "Close"}</button>
    </header>
    <div className={s.content}>{children}</div>
  </dialog>;
}
