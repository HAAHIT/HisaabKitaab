import type { Metadata } from "next";
import { Inter, Eczar, Tiro_Devanagari_Hindi } from "next/font/google";
import { cookies } from "next/headers";
import { Providers } from "./providers";
import {
  LANGUAGE_COOKIE_NAME,
  normalizeLanguage,
} from "@/lib/i18n/translations";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const eczar = Eczar({
  subsets: ["latin", "devanagari"],
  variable: "--font-eczar",
  weight: ["500", "600", "700"],
});

const tiroDevanagari = Tiro_Devanagari_Hindi({
  subsets: ["devanagari", "latin"],
  variable: "--font-tiro-devanagari",
  weight: "400",
  style: ["normal", "italic"],
});

// Space Grotesk aliased to Inter for backward compat with existing SG refs
const spaceGrotesk = inter;

export const metadata: Metadata = {
  title: "SoloBooks — Business Accounting & Billing",
  description:
    "Cloud billing, payments, and Tally-compatible accounting for Indian businesses. GST-ready invoicing with double-entry bookkeeping.",
  icons: { icon: "/favicon.ico" },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const language = normalizeLanguage(
    cookieStore.get(LANGUAGE_COOKIE_NAME)?.value
  );

  return (
    <html
      lang={language}
      className={`${inter.variable} ${eczar.variable} ${tiroDevanagari.variable} h-full`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#6366F1" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-full bg-background text-foreground antialiased">
        <Providers initialLanguage={language}>{children}</Providers>
      </body>
    </html>
  );
}
