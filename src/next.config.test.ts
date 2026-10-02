import { describe, expect, it } from "vitest";

import nextConfig, {
  CONTENT_SECURITY_POLICY,
  SECURITY_HEADERS,
} from "../next.config";

describe("HTTP security headers", () => {
  it("applies a restrictive policy to every app and API route", async () => {
    const rules = await nextConfig.headers?.();
    const rule = rules?.[0];

    expect(rule?.source).toBe("/(.*)");
    expect(rule?.headers).toEqual(SECURITY_HEADERS);

    const headerValues = Object.fromEntries(
      (rule?.headers ?? []).map(({ key, value }) => [key, value]),
    );

    expect(headerValues["Content-Security-Policy"]).toBe(
      CONTENT_SECURITY_POLICY,
    );
    expect(headerValues["Referrer-Policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headerValues["X-Content-Type-Options"]).toBe("nosniff");
    expect(headerValues["X-Frame-Options"]).toBe("DENY");
    expect(headerValues["Permissions-Policy"]).toContain("camera=()");
    expect(headerValues["Cross-Origin-Opener-Policy"]).toBe(
      "same-origin",
    );
  });

  it("allows only the exact OSM tile hosts needed by Leaflet", () => {
    expect(CONTENT_SECURITY_POLICY).toContain(
      "img-src 'self' data: https://a.tile.openstreetmap.org https://b.tile.openstreetmap.org https://c.tile.openstreetmap.org",
    );
    expect(CONTENT_SECURITY_POLICY).toContain(
      "connect-src 'self' https://a.tile.openstreetmap.org https://b.tile.openstreetmap.org https://c.tile.openstreetmap.org",
    );
    expect(CONTENT_SECURITY_POLICY).not.toContain("*");
    expect(CONTENT_SECURITY_POLICY).not.toContain("'unsafe-eval'");
  });
});
