"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  DEMO_ACCESS_COOKIE,
  DEMO_ACCESS_MAX_AGE_SECONDS,
  isDemoProfileId,
} from "@/lib/access";

function setDemoCookie(value: string) {
  return cookies().then((cookieStore) => {
    cookieStore.set({
      name: DEMO_ACCESS_COOKIE,
      value,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DEMO_ACCESS_MAX_AGE_SECONDS,
    });
  });
}
export async function chooseDemoProfile(formData: FormData): Promise<never> {
  const value = formData.get("profile");
  const profile = typeof value === "string" && isDemoProfileId(value) ? value : "public";
  await setDemoCookie(profile);
  redirect("/watchlist");
}

export async function resetDemoProfile(): Promise<never> {
  const cookieStore = await cookies();
  cookieStore.set({ name: DEMO_ACCESS_COOKIE, value: "", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  redirect("/watchlist");
}
