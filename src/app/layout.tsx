import type { Metadata } from "next";
import { Inter } from "next/font/google";
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

export const metadata: Metadata = {
  title: "HisaabKitaab — Manufacturing Management",
  description:
    "Manage bills, payments, and measurements for your manufacturing business.",
  icons: { icon: "/favicon.ico" },
};

/**
 * Root layout component that establishes the document HTML and app-level providers.
 *
 * Reads the user's language preference from cookies (falling back via `normalizeLanguage`),
 * applies the Inter font and language to the `<html>` element, injects PWA/meta links into `<head>`,
 * and wraps page content with application providers.
 *
 * @param children - The page content to render inside the app providers.
 * @returns The root HTML structure for the application containing `<head>`, `<body>`, and wrapped children.
 */
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
      className={`${inter.variable} h-full`}
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
