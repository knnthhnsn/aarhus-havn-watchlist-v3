export type MobileCallSwipeAxis = "horizontal" | "vertical" | null;
export type MobileCallSwipeIntent = "open" | "close" | null;
export const MOBILE_CALL_SWIPE_THRESHOLD = 40;
export const MOBILE_CALL_SWIPE_SLOP = 8;

/** Lock ordinary vertical/diagonal scrolling before considering a row swipe. */
export function mobileCallSwipeAxis(deltaX: number, deltaY: number): MobileCallSwipeAxis {
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return null;
  const x = Math.abs(deltaX), y = Math.abs(deltaY);
  if (x < MOBILE_CALL_SWIPE_SLOP && y < MOBILE_CALL_SWIPE_SLOP) return null;
  if (x >= MOBILE_CALL_SWIPE_SLOP && x > y * 1.1) return "horizontal";
  if (y >= 12 && y > x * 1.1) return "vertical";
  return null;
}

/** Swiping opens the registration editor; saving always requires confirmation. */
export function mobileCallSwipeIntent(deltaX: number, deltaY: number, axis: MobileCallSwipeAxis): MobileCallSwipeIntent {
  if (axis !== "horizontal" || !Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return null;
  if (Math.abs(deltaX) < MOBILE_CALL_SWIPE_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY) * 1.1) return null;
  return deltaX > 0 ? "open" : "close";
}

export function mobileCallSwipeAction(intent: MobileCallSwipeIntent, canRegister: boolean, hasOperation: boolean, editorOpen: boolean): "register" | "close" | null {
  if (intent === "close") return "close";
  if (editorOpen) return null;
  if (intent === "open" && canRegister && hasOperation) return "register";
  return null;
}
