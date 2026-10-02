import { PRODUCT_NAME } from "@/lib/brand";

/**
 * Access levels available in the watchlist view selector.
 *
 * These labels describe the operational context shown for each view. Keep
 * this module free of server-only imports so the active label can be passed to
 * the client watchlist shell.
 */
export const DEMO_PROFILE_IDS = ["public", "harbor", "secure"] as const;

export type DemoProfileId = (typeof DEMO_PROFILE_IDS)[number];
export type DemoAccessKind = "public" | "internal" | "restricted";

export interface DemoProfile {
  id: DemoProfileId;
  name: { da: string; en: string };
  shortName: { da: string; en: string };
  kicker: { da: string; en: string };
  description: { da: string; en: string };
  access: DemoAccessKind;
  recordCount: number;
  accessSummary: { da: string; en: string };
  initials: string;
}
export const DEMO_PROFILES: readonly DemoProfile[] = [
  {
    id: "public",
    name: { da: "Kenneth Hansen", en: "Kenneth Hansen" },
    shortName: { da: "Offentlig", en: "Public" },
    kicker: { da: "PUBLIC", en: "PUBLIC" },
    description: { da: `Se de åbne anløb i ${PRODUCT_NAME}.`, en: `See open port calls in ${PRODUCT_NAME}.` },
    access: "public",
    recordCount: 76,
    accessSummary: { da: "76 offentlige anløb", en: "76 public port calls" },
    initials: "KH",
  },
  {
    id: "harbor",
    name: { da: "Havnevagt", en: "Harbour watch" },
    shortName: { da: "Havnevagt", en: "Harbour watch" },
    kicker: { da: "INTERN", en: "INTERNAL" },
    description: { da: "Arbejdskontekst for vagten med samme åbne datasæt.", en: "A watch-desk context with the same open dataset." },
    access: "internal",
    recordCount: 76,
    accessSummary: { da: "76 offentlige anløb · intern arbejdskontekst", en: "76 public calls · internal work context" },
    initials: "HV",
  },
  {
    id: "secure",
    name: { da: "Sikret drift", en: "Protected operations" },
    shortName: { da: "Sikret drift", en: "Protected ops" },
    kicker: { da: "BESKYTTET", en: "RESTRICTED" },
    description: { da: `Se alle anløb i ${PRODUCT_NAME}, også de beskyttede.`, en: `See all port calls in ${PRODUCT_NAME}, including protected calls.` },
    access: "restricted",
    recordCount: 80,
    accessSummary: { da: "80 anløb · 4 beskyttede anløb", en: "80 calls · 4 protected port calls" },
    initials: "SD",
  },
] as const;

export const DEFAULT_DEMO_PROFILE_ID: DemoProfileId = "public";

export function getDemoProfile(id: string | null | undefined): DemoProfile {
  return DEMO_PROFILES.find((profile) => profile.id === id) ?? DEMO_PROFILES[0];
}
