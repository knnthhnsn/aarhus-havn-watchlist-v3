import { BrandIcon } from "@/components/brand/BrandIcon";
import type { Locale, PortCall } from "@/lib/watchlist";
import styles from "./NotesControl.module.css";

type NoteProps = { call: Pick<PortCall, "notes" | "vesselName">; locale: Locale };

/** Empty records must not signal that a vessel has written notes. */
export function writtenNoteCount(notes: PortCall["notes"]): number {
  return notes.filter(note => note.text.trim().length > 0).length;
}

function noteLabel({ call, locale }: NoteProps, count: number) {
  return `${count} ${locale === "da" ? "noter for" : "notes for"} ${call.vesselName}`;
}

export function NotesButton({ call, locale, showLabel = false, onClick }: NoteProps & { showLabel?: boolean; onClick: () => void }) {
  const count = writtenNoteCount(call.notes);
  return <button type="button" className={styles.button} data-info-title={noteLabel({ call, locale }, count)} data-info={count ? call.notes.filter(note => note.text.trim()).map(note => note.text).join("\n").slice(0, 240) : (locale === "da" ? "Ingen skrevne noter. Åbn for at tilføje en note." : "No written notes. Open to add a note.")} data-has-notes={count > 0} data-notes-count={count} onClick={onClick} aria-label={noteLabel({ call, locale }, count)}>
    <BrandIcon name="note" /><b>{count}</b>{showLabel && <span>{locale === "da" ? "Noter" : "Notes"}</span>}
  </button>;
}

/** A compact, non-interactive count; the More tray retains the full notes action. */
export function NotesIndicator({ call, locale }: NoteProps) {
  const count = writtenNoteCount(call.notes);
  return <span className={styles.indicator} data-has-notes={count > 0} data-notes-count={count} role="img" aria-label={noteLabel({ call, locale }, count)}>
    <BrandIcon name="note" /><b aria-hidden="true">{count}</b>
  </span>;
}
