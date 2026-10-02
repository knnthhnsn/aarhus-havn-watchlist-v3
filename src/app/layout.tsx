import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Space_Grotesk } from "next/font/google";

import { AARHUS_HAVN_MARK, PRODUCT_NAME } from "@/lib/brand";

import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: PRODUCT_NAME,
    template: "%s · Aarhus Havn",
  },
  description: `${PRODUCT_NAME} for Aarhus Havn's port-call operations.`,
  robots: { index: false, follow: false },
  icons: { icon: { url: AARHUS_HAVN_MARK, type: "image/png", sizes: "32x32" } },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="da" suppressHydrationWarning>
      <body className={spaceGrotesk.variable}>{children}</body>
    </html>
  );
}
