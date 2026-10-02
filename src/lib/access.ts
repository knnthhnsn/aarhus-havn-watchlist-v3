import "server-only";

import { DEMO_PROFILE_IDS, DEFAULT_DEMO_PROFILE_ID, getDemoProfile, type DemoProfileId } from "@/lib/demoProfiles";

/**
 * Prototype-only access boundary.
 *
 * This is deliberately not authentication. The login screen lets a visitor
 * choose a fictional profile and the server stores that choice in an
 * HttpOnly cookie so the API can demonstrate a server-side visibility rule.
 * Unknown or forged cookie values always fall back to the public dataset.
 */
export const DEMO_ACCESS_COOKIE = "watchlist-demo-profile";
export const DEMO_ACCESS_MAX_AGE_SECONDS = 60 * 60 * 8;

export interface AnonymousViewerContext {
  kind: "anonymous";
  reason: "missing-demo-profile" | "unknown-demo-profile";
}

export interface DemoViewerContext {
  kind: "demo";
  provider: "prototype";
  source: "http-only-cookie";
  profile: DemoProfileId;
}

export type ViewerContext = AnonymousViewerContext | DemoViewerContext;

export function anonymousViewer(reason: AnonymousViewerContext["reason"] = "missing-demo-profile"): AnonymousViewerContext {
  return { kind: "anonymous", reason };
}

export function demoViewer(profile: DemoProfileId): DemoViewerContext {
  return { kind: "demo", provider: "prototype", source: "http-only-cookie", profile };
}

/** Parse one cookie header without trusting any other request value. */
export function readDemoProfileCookie(cookieHeader: string | null | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name !== DEMO_ACCESS_COOKIE) continue;
    const rawValue = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }
  return undefined;
}

export function isDemoProfileId(value: string | undefined): value is DemoProfileId {
  return typeof value === "string" && (DEMO_PROFILE_IDS as readonly string[]).includes(value);
}

/** Unknown values intentionally resolve to the public profile. */
export function demoProfileFromCookie(cookieHeader: string | null | undefined): DemoProfileId {
  const value = readDemoProfileCookie(cookieHeader);
  return isDemoProfileId(value) ? value : DEFAULT_DEMO_PROFILE_ID;
}

export function viewerFromDemoRequest(request: Request): ViewerContext {
  const rawProfile = readDemoProfileCookie(request.headers.get("cookie"));
  if (!rawProfile) return anonymousViewer();
  if (!isDemoProfileId(rawProfile)) return anonymousViewer("unknown-demo-profile");
  return demoViewer(rawProfile);
}

/** Only the explicitly selected restricted demo profile sees protected fixtures. */
export function canViewRestricted(viewer: ViewerContext): boolean {
  return viewer.kind === "demo" && viewer.profile === "secure";
}

export function profileForViewer(viewer: ViewerContext) {
  return getDemoProfile(viewer.kind === "demo" ? viewer.profile : DEFAULT_DEMO_PROFILE_ID);
}
