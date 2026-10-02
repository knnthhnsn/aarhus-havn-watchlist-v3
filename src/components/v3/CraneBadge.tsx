import type { CraneStatus, Locale } from "@/lib/watchlist";
import s from "./CraneBadge.module.css";

// Legacy modified records remain registered; never infer approval/acceptance.
export function cranePresentation(status: CraneStatus, locale: Locale) {
  const state = status === "modified" ? "requested" : status;
  const labels = locale === "da"
    ? { none: "Ingen kran", requested: "Registreret", approved: "Godkendt", accepted: "Accepteret" }
    : { none: "No crane", requested: "Registered", approved: "Approved", accepted: "Accepted" };
  return { state, code: state === "requested" ? "R" : "V", label: labels[state] };
}
export function CraneBadge({ status, locale, label = false }: { status: CraneStatus; locale: Locale; label?: boolean }) {
  if (status === "none") return null;
  const crane = cranePresentation(status, locale);
  return <span className={s.badge} data-crane={crane.state} title={crane.label} aria-label={`${locale === "da" ? "Kran" : "Crane"}: ${crane.label}`}>{crane.code}{label && ` · ${crane.label}`}</span>;
}
