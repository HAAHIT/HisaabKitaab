# SoloBooks — Landing Page

Marketing landing page for SoloBooks (formerly HisaabKitaab) — the bookkeeping app for Indian Dukandaars. Built with Next.js 16, Tailwind 4, and Framer Motion. Mobile-first, dark theme, jade + amber accent system. All product visuals are hand-coded inline (no external screenshots) so the page is sharp at any zoom.

## Run

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build (verified passing)
npm run start
```

## Structure

```
src/
├── app/
│   ├── layout.tsx        SEO metadata, font preloads (Inter + Fraunces + JetBrains Mono)
│   ├── page.tsx          Assembles all sections in order
│   └── globals.css       Tailwind 4 theme tokens, animations, buttons, card primitives
└── components/
    ├── Nav.tsx           Sticky nav, scroll-aware blur, mobile hamburger
    ├── Hero.tsx          Headline, primary CTA, floating chips, bill mockup
    ├── Footer.tsx
    ├── mockups/
    │   ├── PhoneFrame.tsx     Reusable phone shell with status bar
    │   ├── BillMockup.tsx     "Naya Bill" — line items, GST, Pakka karo + WhatsApp share
    │   ├── UdharMockup.tsx    Udhar Khata — biggest debtors first, WhatsApp/call shortcuts
    │   ├── TallyMockup.tsx    SoloBooks bill → Tally voucher transformation
    │   └── MiniMockups.tsx    Bank reconciliation, OCR scan, GSTR-3B cards
    └── sections/
        ├── TrustStrip.tsx     Animated city marquee
        ├── FastBilling.tsx    "01 — Fast Billing", live bill timer
        ├── Udhar.tsx          "02 — Udhar Khata"
        ├── Tally.tsx          "03 — Tally I/O"
        ├── More.tsx           "04 — Bank · OCR · GST"
        ├── Numbers.tsx        4 stats divided panel
        ├── Testimonials.tsx   Dukandaar + CA quotes
        ├── Pricing.tsx        Chhota / Pakka / Bada tiers
        └── CTA.tsx            Closing call to action
```

## Design system

- **Type:** Fraunces (display, headline soft serif), Inter (UI), JetBrains Mono (numbers, codes)
- **Palette:** Ink (deep blacks), Jade (`#28e0a8` primary), Amber (`#d99656` warm accent), Rose (debt indicator)
- **Tokens:** Defined in `globals.css` `@theme` block for Tailwind 4
- **Primitives:** `.card`, `.shine`, `.btn-primary`, `.btn-ghost`, `.divider-tick`, `.bg-grid`, `.bg-noise`

## Responsive breakpoints

- `< 768px` — single column, hamburger nav, phone mockups full width
- `768–1024px` — 2-column grids start, nav becomes horizontal
- `> 1024px` — full asymmetric layouts, floating chips around hero device

## Tone

Dukandaar-first. Hindi-tinged English where it lands naturally: "Pakka karo", "paisa mila", "Udhar Khata", "Lena baaki hai". The CA-facing Tally section stays in clean English.

## Replacing inline mockups with real screenshots

If you eventually want real product screenshots (e.g. captured from the running solobooks app at `D:\Sadhguru Door\doorcraft-pro`), the natural seam is `src/components/mockups/`. Each mockup is one self-contained file — swap its JSX for a `next/image` with the screenshot and keep the rest of the page unchanged.
