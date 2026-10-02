import type { ReactNode } from "react";
import type { PortCallStatus, TimeKind } from "@/lib/watchlist";
import s from "./StateSurface.module.css";

/** The label and its whole surface carry the state together, never a colour-only dot. */
export function StateLabel({ state, children }: { state: PortCallStatus | TimeKind; children: ReactNode }) {
  return <span className={`${s.surface} ${s.badge}`} data-state={state}>{children}</span>;
}
