import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";

import { VesselSchedule } from "@/components/v3/VesselSchedule";
import { DEMO_ACCESS_COOKIE, demoViewer } from "@/lib/access";
import { getWatchlistSnapshotForViewer } from "@/services/watchlistServer";
import { PRODUCT_NAME } from "@/lib/brand";
import { getDemoProfile } from "@/lib/demoProfiles";

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description:
    `${PRODUCT_NAME} is a mobile-first, role-based overview of Aarhus Havn's port calls.`,
  robots: {
    index: false,
    follow: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: PRODUCT_NAME,
  },
};

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eeeee7" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function WatchlistPage() {
  const cookieStore = await cookies();
  const demoProfile = getDemoProfile(cookieStore.get(DEMO_ACCESS_COOKIE)?.value);
  const snapshot = await getWatchlistSnapshotForViewer(demoViewer(demoProfile.id));
  return <VesselSchedule initialSnapshot={snapshot} profile={demoProfile} />;
}
