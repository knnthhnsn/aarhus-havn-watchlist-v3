import type { Metadata } from "next";
import { cookies } from "next/headers";

import { PRODUCT_NAME } from "@/lib/brand";
import { DEMO_ACCESS_COOKIE, isDemoProfileId } from "@/lib/access";

import LoginFlow from "./LoginFlow";

export const metadata: Metadata = {
  title: { absolute: `Vælg arbejdsrum · ${PRODUCT_NAME} · Aarhus Havn` },
};
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const selected = (await cookies()).get(DEMO_ACCESS_COOKIE)?.value;
  return <LoginFlow initialProfile={isDemoProfileId(selected) ? selected : "public"} />;
}
