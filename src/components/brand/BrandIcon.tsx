import styles from "./BrandIcon.module.css";

export type BrandIconName =
  | "access"
  | "arrowDown"
  | "arrowLeft"
  | "arrowRight"
  | "arrowUp"
  | "arrowUpRight"
  | "attention"
  | "calendar"
  | "check"
  | "close"
  | "columns"
  | "density"
  | "expand"
  | "filter"
  | "followUp"
  | "grip"
  | "harbour"
  | "key"
  | "mail"
  | "map"
  | "note"
  | "operations"
  | "overview"
  | "pin"
  | "portCall"
  | "route"
  | "search"
  | "settings"
  | "security";

type BrandIconProps = {
  name: BrandIconName;
  className?: string;
};

const filledPaths: Partial<Record<BrandIconName, readonly string[]>> = {
  // Original vector contours: AAH_DESIGNMANUAL.pdf, p. 41, icon 01 Kalender.
  calendar: ["M21.0 11.0L29.0 11.0L29.0 14.0C29.0 14.55 29.45 15.0 30.0 15.0C30.55 15.0 31.0 14.55 31.0 14.0L31.0 6.0C31.0 5.45 30.55 5.0 30.0 5.0C29.45 5.0 29.0 5.45 29.0 6.0L29.0 9.0L21.0 9.0C20.45 9.0 20.0 9.45 20.0 10.0C20.0 10.55 20.45 11.0 21.0 11.0Z","M38.0 9.0L37.0 9.0C36.45 9.0 36.0 9.45 36.0 10.0C36.0 10.55 36.45 11.0 37.0 11.0L38.0 11.0C39.65 11.0 41.0 12.35 41.0 14.0L41.0 21.0L7.0 21.0L7.0 14.0C7.0 12.35 8.35 11.0 10.0 11.0L13.0 11.0L13.0 14.0C13.0 14.55 13.45 15.0 14.0 15.0C14.55 15.0 15.0 14.55 15.0 14.0L15.0 6.0C15.0 5.45 14.55 5.0 14.0 5.0C13.45 5.0 13.0 5.45 13.0 6.0L13.0 9.0L10.0 9.0C7.24 9.0 5.0 11.24 5.0 14.0L5.0 40.0C5.0 42.76 7.24 45.0 10.0 45.0L38.0 45.0C40.76 45.0 43.0 42.76 43.0 40.0L43.0 14.0C43.0 11.24 40.76 9.0 38.0 9.0M41.0 40.0C41.0 41.65 39.65 43.0 38.0 43.0L10.0 43.0C8.35 43.0 7.0 41.65 7.0 40.0L7.0 23.0L41.0 23.0L41.0 40.0Z"],
  access: [
    "M41 7H9c-2.76 0-5 2.24-5 5v20c0 2.76 2.24 5 5 5h20a1 1 0 1 0 0-2H9c-1.65 0-3-1.35-3-3V12c0-1.65 1.35-3 3-3h32c1.65 0 3 1.35 3 3v3H13a1 1 0 1 0 0 2h31v7a1 1 0 1 0 2 0V12c0-2.76-2.24-5-5-5Z",
    "M44.33 34.07V31.5c0-1.81-1.15-4.5-4.33-4.5s-4.33 2.69-4.33 4.5v2.57A2.2 2.2 0 0 0 34 36.2v4.6c0 1.21.99 2.2 2.2 2.2h7.6c1.21 0 2.2-.99 2.2-2.2v-4.6c0-1.03-.71-1.9-1.67-2.13Zm-6.66-2.57c0-.26.07-2.5 2.33-2.5s2.33 2.24 2.33 2.5V34h-4.66v-2.5ZM44 40.8c0 .11-.09.2-.2.2h-7.6a.2.2 0 0 1-.2-.2v-4.6c0-.11.09-.2.2-.2h7.6c.11 0 .2.09.2.2v4.6Z",
  ],
  arrowUpRight: ["M38.92 11.62a1 1 0 0 0-.22-.33 1 1 0 0 0-.71-.3H13.04a1 1 0 1 0 0 2h22.55L11.3 37.28a1 1 0 0 0 1.42 1.41L37.01 14.4v22.55a1 1 0 1 0 2 0V12a1 1 0 0 0-.09-.38Z"],
  close: ["M35.49 36.49a1 1 0 0 1-.71-.29L25 26.42l-9.78 9.78a1 1 0 0 1-1.41-1.41L23.59 25l-9.78-9.78a1 1 0 0 1 1.41-1.41L25 23.59l9.78-9.78a1 1 0 0 1 1.41 1.41L26.41 25l9.78 9.78a1 1 0 0 1-.7 1.71Z"],
  harbour: [
    "M33 24h-7v-7a1 1 0 1 0-2 0v7h-7a1 1 0 1 0 0 2h7v7a1 1 0 1 0 2 0v-7h7a1 1 0 1 0 0-2Z",
    "M9 16a1 1 0 0 0 1-1v-5h5a1 1 0 1 0 0-2H9a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1ZM9 28a1 1 0 0 0 1-1v-4a1 1 0 1 0-2 0v4a1 1 0 0 0 1 1ZM23 10h4a1 1 0 1 0 0-2h-4a1 1 0 1 0 0 2ZM27 40h-4a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2ZM41 22a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0v-4a1 1 0 0 0-1-1ZM41 8h-6a1 1 0 1 0 0 2h5v5a1 1 0 1 0 2 0V9a1 1 0 0 0-1-1ZM15 40h-5v-5a1 1 0 1 0-2 0v6a1 1 0 0 0 1 1h6a1 1 0 1 0 0-2ZM41 34a1 1 0 0 0-1 1v5h-5a1 1 0 1 0 0 2h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1Z",
  ],
  map: ["M43.09 6.88a2.2 2.2 0 0 0-1.98-.3l-10.1 3.37-11.66-3.89a1.38 1.38 0 0 0-.34-.06c-.12 0-.23.02-.33.06L7.52 9.78A2.2 2.2 0 0 0 6.02 11.87v29.47a2.2 2.2 0 0 0 2.89 2.09l10.1-3.37 11.66 3.89c.11.04.22.06.34.06s.23-.02.33-.06l11.16-3.72A2.2 2.2 0 0 0 44 38.14V8.67c0-.71-.34-1.37-.91-1.79ZM18 38.28l-9.74 3.25a.2.2 0 0 1-.26-.19V11.87c0-.09.05-.16.14-.19L18 8.39v29.89Zm12 3.33-10-3.33V8.39l10 3.33v29.89Zm12-3.48c0 .09-.05.16-.14.19L32 41.61V11.72l9.74-3.25A.2.2 0 0 1 42 8.66v29.47Z"],
  portCall: ["M46.56 39.4c-.68 0-.96-.26-1.47-.75-.61-.58-1.37-1.29-2.85-1.29s-2.24.72-2.87 1.31c-.47.49-.95.74-1.43.74-.5 0-1.02-.28-1.57-.81l3.69-11.75a2.98 2.98 0 0 0-1.75-3.66l-1.06-.42-1.35-8.21a1.64 1.64 0 0 0-1.62-1.38h-2.04v-2.14c0-.56-.45-1.01-1.01-1.01h-3.71V7.89c0-.56-.45-1.01-1.01-1.01h-3.9c-.56 0-1.01.45-1.01 1.01v2.14h-3.71c-.56 0-1.01.45-1.01 1.01v2.14h-1.82c-.81 0-1.49.58-1.62 1.38l-1.35 8.22-1.05.41a2.98 2.98 0 0 0-1.76 3.67l3.84 12.2c-.32.26-.69.38-1.06.36-.53-.01-1.05-.27-1.42-.71a3.83 3.83 0 0 0-2.88-1.32c-1.09 0-2.12.46-2.85 1.29-.49.46-.78.74-1.46.74-.64 0-.99.53-1 1.01 0 .49.34 1 1 1.01 1.48 0 2.24-.72 2.85-1.3.49-.46.78-.74 1.46-.74s.96.26 1.46.74c.61.58 1.37 1.29 2.85 1.29s2.23-.71 2.89-1.34c.46-.43.75-.7 1.42-.7s.97.28 1.46.74c.61.58 1.37 1.29 2.85 1.29s2.23-.72 2.85-1.29c.49-.46.79-.74 1.47-.74s.97.28 1.46.74c.61.58 1.37 1.29 2.85 1.29s2.24-.72 2.85-1.29c.51-.48.78-.74 1.45-.74.72.02 1.09.36 1.61.84.6.56 1.29 1.2 2.6 1.2h.11c1.48 0 2.25-.72 2.86-1.3.5-.47.78-.74 1.45-.74s.98.28 1.47.74c.61.58 1.37 1.29 2.86 1.29.65 0 1-.53 1-1.01 0-.49-.34-1-.99-1.01ZM23.63 10.02V8.88h1.89v1.14h-1.89Zm1.05 11.28c-.13 0-.25.02-.37.07l-13.02 5.11-.07-.23a.95.95 0 0 1 .57-1.18l12.9-5.07 12.9 5.06c.47.18.71.7.56 1.18l-.07.23-13.02-5.11a1.05 1.05 0 0 0-.38-.06Zm.37-3.32c-.24-.09-.5-.09-.74 0l-10.03 3.94 1.11-6.72h18.58l1.11 6.72-10.03-3.94Zm12.41 10.43-2.85 9.08c-1.57-.45-3.1.3-3.88 1.21-.4.46-.91.71-1.43.71s-1.03-.25-1.43-.71a3.83 3.83 0 0 0-2.88-1.32c-1.1 0-2.12.46-2.86 1.3-.5.47-.78.73-1.45.73s-.97-.28-1.42-.7a4.12 4.12 0 0 0-4.45-1l-2.93-9.29 12.79-5.02 12.79 5.02ZM18.91 13.18v-1.13h11.31v1.13H18.91Z"],
  search: ["M43.71 42.29l-8-8-.02-.01A16.93 16.93 0 0 0 40 23c0-9.37-7.63-17-17-17S6 13.63 6 23s7.63 17 17 17c4.21 0 8.17-1.53 11.28-4.31l.01.02 8 8a1 1 0 0 0 1.42-1.42ZM23 38c-8.27 0-15-6.73-15-15S14.73 8 23 8s15 6.73 15 15c0 4-1.55 7.76-4.38 10.59A14.94 14.94 0 0 1 23 38Z"],
  security: [
    "M25 26.45a1 1 0 0 0 1-1v-10a1 1 0 1 0-2 0v10a1 1 0 0 0 1 1Z",
    "M24.28 32.78a1 1 0 0 0 .05 1.42c.19.17.43.26.67.26.28 0 .55-.11.75-.33a1 1 0 0 0-.06-1.41 1 1 0 0 0-1.41.06Z",
    "M41.41 8.07 26.09 4.66a5.06 5.06 0 0 0-2.17 0L8.6 8.07a3 3 0 0 0-2.32 3.34l3.74 26.17c.34 2.36 2.48 7.86 14.99 7.86s14.65-5.5 14.99-7.86l3.74-26.18a3 3 0 0 0-2.32-3.34Zm-3.4 29.24c-.26 1.85-2.06 6.14-13.01 6.14s-12.75-4.29-13.01-6.14L8.25 11.14a1 1 0 0 1 .77-1.11l15.32-3.41c.43-.1.87-.1 1.3 0l15.32 3.41a1 1 0 0 1 .77 1.11l-3.74 26.17Z",
  ],
};

function StrokeIcon({ name }: { name: Exclude<BrandIconName, keyof typeof filledPaths> | BrandIconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 1.8 };
  switch (name) {
    case "arrowDown": return <path {...common} d="M6 9.5 12 15.5l6-6" />;
    case "arrowLeft": return <path {...common} d="m10 6-6 6 6 6M4 12h16" />;
    case "arrowRight": return <path {...common} d="m14 6 6 6-6 6M20 12H4" />;
    case "arrowUp": return <path {...common} d="m6 14.5 6-6 6 6" />;
    case "attention": return <><path {...common} d="M12 3.5 21 20H3L12 3.5Z" /><path {...common} d="M12 9v5.2M12 17.2h.01" /></>;
    case "calendar": return <><rect {...common} x="4" y="5.5" width="16" height="14" rx="2" /><path {...common} d="M8 3.5v4M16 3.5v4M4 10h16" /></>;
    case "check": return <path {...common} d="m5 12.5 4.2 4.2L19 7" />;
    case "columns": return <><rect {...common} x="3.5" y="5" width="17" height="14" rx="2" /><path {...common} d="M9.2 5v14M14.8 5v14" /></>;
    case "density": return <><path {...common} d="M5 7h14M5 12h14M5 17h14" /><path {...common} d="m3 5-1.5 2L3 9M21 15l1.5 2L21 19" /></>;
    case "expand": return <><path {...common} d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" /><path {...common} d="m4 9 5-5M20 9l-5-5M4 15l5 5M20 15l-5 5" /></>;
    case "filter": return <path {...common} d="M3.5 5h17l-6.6 7.2v5.6l-3.8 1.8v-7.4L3.5 5Z" />;
    case "settings": return <><path {...common} d="M4 7h5m4 0h7M4 17h9m4 0h3" /><circle {...common} cx="11" cy="7" r="2" /><circle {...common} cx="15" cy="17" r="2" /></>;
    case "followUp": return <><path {...common} d="M19 8a8 8 0 0 0-14.5-1M5 4.5V8h3.5M5 16a8 8 0 0 0 14.5 1M19 19.5V16h-3.5" /></>;
    case "grip": return <><circle cx="8" cy="7" r="1" fill="currentColor" /><circle cx="16" cy="7" r="1" fill="currentColor" /><circle cx="8" cy="12" r="1" fill="currentColor" /><circle cx="16" cy="12" r="1" fill="currentColor" /><circle cx="8" cy="17" r="1" fill="currentColor" /><circle cx="16" cy="17" r="1" fill="currentColor" /></>;
    case "key": return <><circle {...common} cx="8" cy="12" r="4" /><path {...common} d="M12 12h8M17 12v3M20 12v2" /></>;
    case "mail": return <><rect {...common} x="3" y="5.5" width="18" height="13" rx="2" /><path {...common} d="m4 7 8 6 8-6" /></>;
    case "note": return <><path {...common} d="M6 3.5h9l3 3v14H6Z" /><path {...common} d="M15 3.5v3h3M9 11h6M9 14.5h6M9 18h4" /></>;
    case "operations": return <><circle {...common} cx="4.5" cy="6" r="1.5" /><circle {...common} cx="4.5" cy="12" r="1.5" /><circle {...common} cx="4.5" cy="18" r="1.5" /><path {...common} d="M8.5 6H20M8.5 12H20M8.5 18H20" /></>;
    case "overview": return <><path {...common} d="M4 4v16h16" /><path {...common} d="m7 15 4-4 3 2 5-6" /></>;
    case "pin": return <><path {...common} d="m14.5 4.1 5.4 5.4-2.8 1.1-3.5 3.5.9 3.1-1.5 1.5-3.9-3.9-4.5 4.5-.9-.9 4.5-4.5-3.9-3.9 1.5-1.5 3.1.9 3.5-3.5 1.1-2.8Z" /><path {...common} d="m9.3 14.7 4.9-4.9" /></>;
    case "route": return <><path {...common} d="M5 18c1.5-8 5-12 10-12h4" /><path {...common} d="m16 3 3 3-3 3" /><circle {...common} cx="5" cy="18" r="2" /></>;
    default: return null;
  }
}

export function BrandIcon({ name, className }: BrandIconProps) {
  const paths = filledPaths[name];
  if (paths) {
    return <svg data-brand-icon aria-hidden="true" className={`${styles.icon} ${className ?? ""}`} viewBox="0 0 50 50" focusable="false">{paths.map((path) => <path key={path} fill="currentColor" d={path} />)}</svg>;
  }
  return <svg data-brand-icon aria-hidden="true" className={`${styles.icon} ${className ?? ""}`} viewBox="0 0 24 24" focusable="false"><StrokeIcon name={name} /></svg>;
}
