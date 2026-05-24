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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://solobooks.in";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SoloBooks — GST Billing & Tally-Compatible Accounting for Indian Businesses",
    template: "%s · SoloBooks",
  },
  description:
    "Cloud GST billing, payments, and Tally-compatible double-entry accounting for Indian SMBs. Free invoicing, party ledgers, GSTR reports, and one-click Tally export.",
  keywords: [
    "GST billing software",
    "Tally alternative",
    "accounting software India",
    "double-entry bookkeeping",
    "GST invoice generator",
    "party ledger",
    "GSTR-1",
    "GSTR-3B",
    "cloud accounting",
    "SoloBooks",
    "HisaabKitaab",
  ],
  applicationName: "SoloBooks",
  authors: [{ name: "SoloBooks" }],
  creator: "SoloBooks",
  publisher: "SoloBooks",
  category: "Business",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "SoloBooks",
    title: "SoloBooks — GST Billing & Tally-Compatible Accounting",
    description:
      "Cloud GST billing, payments, and Tally-compatible double-entry accounting for Indian SMBs.",
    images: [
      {
        url: "/dashboard_mockup.png",
        width: 1200,
        height: 630,
        alt: "SoloBooks dashboard",
      },
    ],
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "SoloBooks — GST Billing & Tally-Compatible Accounting",
    description:
      "Cloud GST billing & double-entry accounting for Indian businesses. Free, fast, Tally-compatible.",
    images: ["/dashboard_mockup.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/icon-192.png",
  },
  manifest: "/manifest.json",
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "SoloBooks",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              url: process.env.NEXT_PUBLIC_SITE_URL || "https://solobooks.in",
              description:
                "Cloud GST billing & Tally-compatible double-entry accounting for Indian businesses.",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "INR",
              },
              publisher: {
                "@type": "Organization",
                name: "SoloBooks",
                url: process.env.NEXT_PUBLIC_SITE_URL || "https://solobooks.in",
              },
            }),
          }}
        />
        <Providers initialLanguage={language}>{children}</Providers>
      </body>
    </html>
  );
}
