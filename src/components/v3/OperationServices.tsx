import type { Locale, PortOperation } from "@/lib/watchlist";
import { operationStateLabel } from "@/components/watchlist/lifecycleData";
import s from "./OperationServices.module.css";

export function OperationServices({ operation, locale, compact = false, inline = false, showWorkLocation = true }: { operation: PortOperation; locale: Locale; compact?: boolean; inline?: boolean; showWorkLocation?: boolean }) {
  const names = locale === "da" ? { H: "Trosseføring", L: "Lods", B: "Bugserbåd" } : { H: "Linesmen", L: "Pilot", B: "Tug" };
  if (!operation.serviceCodes.length && (!showWorkLocation || operation.workLocation !== "stud")) return null;
  return <span className={s.services} data-services="true" data-compact={compact} data-inline={inline}>
    {showWorkLocation && operation.workLocation === "stud" && <span className={s.stud}>STUD</span>}
    {operation.serviceCodes.map(code => {
      const state = operation.serviceStates?.[code] ?? operation.state;
      return <span key={code} className={s.service} data-state={state}><b title={`${names[code]} · ${operationStateLabel(state, locale)}${code === "B" ? ` · ${operation.tugQuantity ?? 1}` : ""}`} aria-label={`${names[code]} · ${operationStateLabel(state, locale)}${code === "B" ? ` · ${operation.tugQuantity ?? 1}` : ""}`}>{compact ? `${code}${code === "B" ? operation.tugQuantity ?? 1 : ""}` : `${names[code]}${code === "B" ? ` × ${operation.tugQuantity ?? 1}` : ""}`}</b></span>;
    })}
  </span>;
}
