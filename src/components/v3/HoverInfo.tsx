"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./HoverInfo.module.css";

/** One viewport-bound tooltip for all annotated controls, including lazy dialogs. */
export function HoverInfo() {
  const id = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [info, setInfo] = useState<{ title: string; body: string; x: number; y: number; above: boolean; dark: boolean } | null>(null);
  useEffect(() => {
    let active: HTMLElement | null = null;
    let previous: string | null = null;
    const clear = () => { clearTimeout(timer.current); };
    const close = () => {
      clear();
      if (active) { if (previous) active.setAttribute("aria-describedby", previous); else active.removeAttribute("aria-describedby"); }
      active = null; setInfo(null);
    };
    const show = (event: Event) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-info]") : null;
      if (!target) return;
      clear();
      if (target === active) return;
      close(); active = target; previous = target.getAttribute("aria-describedby");
      target.setAttribute("aria-describedby", [previous, id].filter(Boolean).join(" "));
      const rect = target.getBoundingClientRect(), width = Math.min(280, document.documentElement.clientWidth - 24);
      const above = window.innerHeight - rect.bottom < 220;
      setInfo({ title: target.dataset.infoTitle ?? "", body: target.dataset.info ?? "", x: Math.max(12, Math.min(rect.left, document.documentElement.clientWidth - width - 12)), y: above ? rect.top - 8 : rect.bottom + 8, above, dark: document.querySelector('[data-theme="dark"]') !== null });
    };
    const leave = (event: Event) => {
      const next = (event as MouseEvent).relatedTarget;
      if (next instanceof Element && (next.closest(`[id="${CSS.escape(id)}"]`) || next.closest("[data-info]") === active)) return;
      clear(); timer.current = setTimeout(close, 180);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    const pointer = (event: PointerEvent) => { if (event.pointerType !== "touch") show(event); };
    document.addEventListener("pointerover", pointer);
    document.addEventListener("pointerout", leave);
    document.addEventListener("focusin", show);
    document.addEventListener("focusout", leave);
    document.addEventListener("keydown", escape);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      close(); document.removeEventListener("pointerover", pointer); document.removeEventListener("pointerout", leave);
      document.removeEventListener("focusin", show); document.removeEventListener("focusout", leave); document.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close);
    };
  }, [id]);
  return info ? createPortal(<div id={id} role="tooltip" className={styles.info} data-dark={info.dark} style={{ left: info.x, top: info.y, maxHeight: Math.max(40, info.above ? info.y - 12 : window.innerHeight - info.y - 12), overflowY: "auto", transform: info.above ? "translateY(-100%)" : undefined }} onPointerEnter={() => clearTimeout(timer.current)}>
    {info.title && <strong>{info.title}</strong>}<span>{info.body}</span>
  </div>, document.body) : null;
}
