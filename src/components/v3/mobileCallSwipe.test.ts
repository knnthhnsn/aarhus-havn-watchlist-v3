import { describe, expect, it } from "vitest";
import { mobileCallSwipeAction, mobileCallSwipeAxis, mobileCallSwipeIntent } from "./mobileCallSwipe";

describe("mobile call swipe disclosure", () => {
  it("routes rightward swipe to registration rather than More", () => {
    expect(mobileCallSwipeAction("open", true, true, false)).toBe("register");
    expect(mobileCallSwipeAction("open", false, true, false)).toBeNull();
    expect(mobileCallSwipeAction("open", true, false, false)).toBeNull();
    expect(mobileCallSwipeAction("open", true, true, true)).toBeNull();
    expect(mobileCallSwipeAction("close", true, true, true)).toBe("close");
    expect(mobileCallSwipeAction("close", true, true, false)).toBe("close");
  });
  it("ignores small movements before axis lock", () => {
    expect(mobileCallSwipeAxis(3, 6)).toBeNull();
    expect(mobileCallSwipeAxis(-7, 2)).toBeNull();
  });
  it("identifies horizontal gestures in both directions", () => {
    expect(mobileCallSwipeAxis(14, 4)).toBe("horizontal");
    expect(mobileCallSwipeAxis(-14, 4)).toBe("horizontal");
  });
  it("locks vertical and diagonal scroll gestures out of swipe", () => {
    expect(mobileCallSwipeAxis(5, 18)).toBe("vertical");
    expect(mobileCallSwipeAxis(10, -12)).toBe("vertical");
    expect(mobileCallSwipeAxis(10, 10)).toBeNull();
    expect(mobileCallSwipeIntent(120, 15, "vertical")).toBeNull();
  });
  it("opens on a rightward swipe and closes on a leftward swipe", () => {
    expect(mobileCallSwipeIntent(40, 6, "horizontal")).toBe("open");
    expect(mobileCallSwipeIntent(-40, 6, "horizontal")).toBe("close");
  });
  it("requires threshold distance and a predominantly horizontal final gesture", () => {
    expect(mobileCallSwipeIntent(39, 0, "horizontal")).toBeNull();
    expect(mobileCallSwipeIntent(-39, 0, "horizontal")).toBeNull();
    expect(mobileCallSwipeIntent(70, 70, "horizontal")).toBeNull();
    expect(mobileCallSwipeIntent(110, 0, null)).toBeNull();
  });
  it("rejects invalid pointer coordinates", () => {
    expect(mobileCallSwipeAxis(Number.NaN, 0)).toBeNull();
    expect(mobileCallSwipeIntent(Number.POSITIVE_INFINITY, 0, "horizontal")).toBeNull();
  });
});
