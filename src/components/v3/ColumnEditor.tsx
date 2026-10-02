"use client";

import { useRef, useState } from "react";
import { BrandIcon } from "@/components/brand/BrandIcon";
import type { Locale } from "@/lib/watchlist";
import { columnNames, orderColumns, type Column } from "./columns";
import s from "./ColumnEditor.module.css";

const fixed = (column: Column) => ["pin", "vessel", "signal"].includes(column);
export function ColumnEditor({ columns, locale, onChange }: { columns: Column[]; locale: Locale; onChange: (columns: Column[]) => void }) {
  const [dragging, setDragging] = useState<Column | null>(null);
  const [target, setTarget] = useState<Column | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const drag = useRef<{ column: Column; y: number; moved: boolean } | null>(null);
  const da = locale === "da";
  const safeColumns = columns.filter(column => column !== "customer") as Column[];
  const movable: Column[] = safeColumns.filter(column => !fixed(column));
  function move(from: Column, to: Column) {
    if (from === to || !movable.includes(from) || !movable.includes(to)) return;
    const reordered = [...movable];
    reordered.splice(reordered.indexOf(from), 1);
    reordered.splice(movable.indexOf(to), 0, from);
    let index = 0;
    onChange(safeColumns.map(column => fixed(column) ? column : reordered[index++]));
    setAnnouncement(`${columnNames[locale][from]}: ${da ? "ny placering" : "new position"} ${safeColumns.indexOf(to) + 1}`);
  }
  const all = [...safeColumns, ...(Object.keys(columnNames[locale]) as Column[]).filter(column => column !== "customer" && !safeColumns.includes(column))];
  return <><p className={s.hint}>{da ? "Træk i prikkerne for at ændre rækkefølgen. Pin, Skib og OPS. har faste pladser." : "Drag the dots to reorder. Pin, Vessel and OPS. have fixed positions."}</p>
    <div ref={list} className={s.list}>{all.map(column => {
      const enabled = safeColumns.includes(column);
      const index = movable.indexOf(column);
      const name = columnNames[locale][column];
      return <div key={column} className={s.row} data-column={column} data-dragging={dragging === column} data-target={target === column}>
        {enabled && !fixed(column) ? <button type="button" className={s.handle} aria-label={`${da ? "Træk for at flytte" : "Drag to move"}: ${name}`} title={da ? "Træk, eller brug piletasterne" : "Drag, or use arrow keys"}
          onKeyDown={event => {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              const next = movable[index + (event.key === "ArrowUp" ? -1 : 1)];
              if (next) move(column, next);
            }
          }}
          onPointerDown={event => { if (!event.isPrimary || event.button !== 0) return; drag.current = { column, y: event.clientY, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }}
          onPointerMove={event => {
            const active = drag.current;
            if (!active) return;
            if (Math.abs(event.clientY - active.y) > 5) active.moved = true;
            if (!active.moved) return;
            setDragging(active.column);
            const bounds = list.current?.getBoundingClientRect();
            if (bounds && list.current) {
              if (event.clientY < bounds.top + 35) list.current.scrollTop -= 16;
              if (event.clientY > bounds.bottom - 35) list.current.scrollTop += 16;
            }
            const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-column]");
            const next = hit?.dataset.column as Column | undefined;
            setTarget(next && movable.includes(next) ? next : null);
          }}
          onPointerUp={() => { if (drag.current?.moved && target) move(column, target); drag.current = null; setDragging(null); setTarget(null); }}
          onPointerCancel={() => { drag.current = null; setDragging(null); setTarget(null); }}
          onLostPointerCapture={() => { drag.current = null; setDragging(null); setTarget(null); }}><BrandIcon name="grip" /></button> : <span className={s.spacer} />}
        <label><input type="checkbox" disabled={column === "vessel"} checked={enabled} onChange={event => onChange(orderColumns(event.target.checked ? [...safeColumns, column] : safeColumns.filter(item => item !== column)))} />{name}</label>
        {enabled && !fixed(column) && <div className={s.actions}>
          <button type="button" disabled={index === 0} aria-label={`${da ? "Flyt op" : "Move up"}: ${name}`} onClick={() => move(column, movable[index - 1])}><BrandIcon name="arrowUp" /></button>
          <button type="button" disabled={index === movable.length - 1} aria-label={`${da ? "Flyt ned" : "Move down"}: ${name}`} onClick={() => move(column, movable[index + 1])}><BrandIcon name="arrowDown" /></button>
        </div>}
      </div>;
    })}</div><p className={s.srOnly} role="status">{announcement}</p></>;
}
