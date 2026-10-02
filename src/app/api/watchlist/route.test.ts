import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { DEMO_ACCESS_COOKIE } from "@/lib/access";
import { GET } from "./route";

async function responseFor(cookie?: string) {
  const request = new Request("https://example.test/api/watchlist", cookie ? { headers: { cookie } } : undefined);
  return GET(request);
}

describe("watchlist API demo boundary", () => {
  it("returns 76 public calls by default and keeps the response private", async () => {
    const response = await responseFor();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.calls).toHaveLength(76);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
  });

  it("keeps Havnevagt on the public dataset", async () => {
    const response = await responseFor(`${DEMO_ACCESS_COOKIE}=harbor`);
    expect((await response.json()).calls).toHaveLength(76);
  });

  it("returns exactly four interleaved protected fixtures for Sikret drift", async () => {
    const response = await responseFor(`${DEMO_ACCESS_COOKIE}=secure`);
    const body = await response.json();
    expect(body.calls).toHaveLength(80);
    expect(body.calls.filter((call: { visibility?: string }) => call.visibility === "restricted")).toHaveLength(4);
    const restrictedIndexes = body.calls.map((call: { visibility?: string }, index: number) => call.visibility === "restricted" ? index : -1).filter((index: number) => index >= 0);
    expect(restrictedIndexes.some((index: number) => index > 0 && index < body.calls.length - 1)).toBe(true);
  });

  it("falls back to the public dataset for unknown cookie values", async () => {
    const response = await responseFor(`${DEMO_ACCESS_COOKIE}=secure.fake`);
    const body = await response.json();
    expect(body.calls).toHaveLength(76);
    expect(JSON.stringify(body)).not.toContain("restricted-call-001");
  });
});
