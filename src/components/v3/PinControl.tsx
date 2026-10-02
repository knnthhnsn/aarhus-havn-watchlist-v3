import { BrandIcon } from "@/components/brand/BrandIcon";
import type { Locale } from "@/lib/watchlist";
import s from "./PinControl.module.css";

type PinProps = { pinned: boolean; locale: Locale; vesselName: string };

export function PinButton({ pinned, locale, vesselName, showLabel = false, onClick }: PinProps & { showLabel?: boolean; onClick: () => void }) {
  const da = locale === "da";
  const action = pinned ? (da ? "Frigør" : "Unpin") : (da ? "Fastgør" : "Pin");
  return <button type="button" className={s.button} data-info-title={`${action} ${vesselName}`} data-info={pinned ? (da ? "Fastgjort i din liste. Tryk for at frigøre." : "Pinned to your list. Select to unpin.") : (da ? "Gem dette call under Fastgjorte, så du hurtigt kan finde det." : "Keep this call in Pinned for quick access.")} data-pin-control data-pinned={pinned} aria-pressed={pinned} aria-label={`${action} ${vesselName}`} onClick={onClick}>
    <span className={s.glyph}><BrandIcon name="pin" />{pinned && <BrandIcon name="check" className={s.check} />}</span>
    {showLabel && <span>{pinned ? (da ? "Fastgjort" : "Pinned") : action}</span>}
  </button>;
}

export function PinIndicator({ locale, vesselName }: Omit<PinProps, "pinned">) {
  return <span className={s.indicator} data-pin-indicator role="img" aria-label={`${vesselName} ${locale === "da" ? "er fastgjort" : "is pinned"}`}><BrandIcon name="pin" /><BrandIcon name="check" /></span>;
}
