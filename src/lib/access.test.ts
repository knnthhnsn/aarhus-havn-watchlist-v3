import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  DEMO_ACCESS_COOKIE,
  anonymousViewer,
  canViewRestricted,
  demoProfileFromCookie,
  isDemoProfileId,
  readDemoProfileCookie,
  viewerFromDemoRequest,
} from "./access";

describe("prototype demo access", () => {
  it("recognises only the three allowlisted demo profiles", () => {
    expect(isDemoProfileId("public")).toBe(true);
    expect(isDemoProfileId("harbor")).toBe(true);
    expect(isDemoProfileId("secure")).toBe(true);
    expect(isDemoProfileId("admin")).toBe(false);
    expect(isDemoProfileId(undefined)).toBe(false);
  });

  it("reads the demo profile from an HttpOnly-cookie-shaped header", () => {
    expect(readDemoProfileCookie(`theme=dark; ${DEMO_ACCESS_COOKIE}=secure`)).toBe("secure");
    expect(readDemoProfileCookie(`${DEMO_ACCESS_COOKIE}=harbor%20`)).toBe("harbor ");
    expect(readDemoProfileCookie("theme=dark")).toBeUndefined();
  });

  it("falls back to public for missing, unknown and forged values", () => {
    expect(demoProfileFromCookie(undefined)).toBe("public");
    expect(demoProfileFromCookie(`${DEMO_ACCESS_COOKIE}=admin`)).toBe("public");
    expect(demoProfileFromCookie(`${DEMO_ACCESS_COOKIE}=secure.fake`)).toBe("public");
    expect(viewerFromDemoRequest(new Request("https://example.test/api/watchlist"))).toEqual(anonymousViewer());
    expect(viewerFromDemoRequest(new Request("https://example.test/api/watchlist", { headers: { cookie: `${DEMO_ACCESS_COOKIE}=admin` } }))).toEqual(anonymousViewer("unknown-demo-profile"));
  });

  it("only enables protected fixtures for the explicit secure demo profile", () => {
    const publicViewer = viewerFromDemoRequest(new Request("https://example.test", { headers: { cookie: `${DEMO_ACCESS_COOKIE}=public` } }));
    const harborViewer = viewerFromDemoRequest(new Request("https://example.test", { headers: { cookie: `${DEMO_ACCESS_COOKIE}=harbor` } }));
    const secureViewer = viewerFromDemoRequest(new Request("https://example.test", { headers: { cookie: `${DEMO_ACCESS_COOKIE}=secure` } }));
    expect(canViewRestricted(publicViewer)).toBe(false);
    expect(canViewRestricted(harborViewer)).toBe(false);
    expect(canViewRestricted(secureViewer)).toBe(true);
  });
});
