import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SoloBooks — Money In, Money Out. The books take care of themselves.",
  description:
    "Bookkeeping built for Indian Dukandaars. Fast billing, Udhar Khata, Tally-ready exports, bank reconciliation and GST returns — without a single mention of 'debit' or 'credit'.",
  keywords: [
    "MSME bookkeeping",
    "Udhar Khata",
    "Tally export",
    "GST billing India",
    "Vyapar alternative",
    "Khatabook alternative",
    "small business accounting India",
    "WhatsApp invoice",
  ],
  openGraph: {
    title: "SoloBooks — Bookkeeping for the way India does business",
    description:
      "Money In. Money Out. Your books are ready before chai. Tally-ready, WhatsApp-native, built for shop owners.",
    type: "website",
  },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600;9..144,700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
