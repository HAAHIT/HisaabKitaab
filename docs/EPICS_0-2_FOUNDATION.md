# MSME Bookkeeping Platform — Epic Breakdown (Part 1/2)

> **Audience**: Starter-level developer. Every instruction is exact.  
> **Codebase**: `d:\Sadhguru Door\doorcraft-pro` (Next.js 16 + HeroUI + Prisma + PostgreSQL)  
> **Naming**: The product is referred to as **"HisaabKitaab"** internally. The existing branding ("DoorCraft Pro") stays in code until Epic 2 completes.

---

## Epic Overview (MVP Phase 1)

| Epic | Name | Depends On | Est. Days |
|------|------|-----------|-----------|
| 0 | Tenant-Ready Architecture | — | 3-4 |
| 1 | PWA Foundation | — | 2 |
| 2 | Mobile-First UI Shell | — | 3-4 |
| 3 | Fast Billing Engine | 0, 2 | 4-5 |
| 4 | Udhar Khata (Party Ledger Chat) | 0, 2 | 3-4 |
| 5 | WhatsApp Sharing + UPI Links | 3 | 1-2 |

Epics 0, 1, 2 have no dependencies on each other and **can be developed in parallel** by different developers.

---

# Epic 0: Tenant-Ready Architecture

**Goal**: Add `tenantId` to every data table. Wrap every query in a tenant-scoping helper. Do NOT implement tenant signup, onboarding, RLS, or multi-tenant auth. We set a hardcoded default tenant for now.

## Task 0.1 — Add `Tenant` model and `tenantId` column

### File: `prisma/schema.prisma`

Add this model at the TOP of the file, right after the `datasource` block:

```prisma
model Tenant {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  phone     String?
  email     String?
  address   String?
  gstin     String?
  logoUrl   String?
  plan      TenantPlan @default(FREE)
  settings  Json     @default("{}")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users     User[]
  bills     Bill[]
  parties   Party[]
  payments  Payment[]
  templates BillTemplate[]
  measurements MeasurementUpload[]
}

enum TenantPlan {
  FREE
  PRO
}
```

Add `tenantId` to EVERY existing data model. The exact changes:

```diff
model User {
  id            String   @id @default(cuid())
+ tenantId      String
+ tenant        Tenant   @relation(fields: [tenantId], references: [id])
  ...existing fields...
+
+ @@index([tenantId])
}

model BillTemplate {
  ...existing fields...
+ tenantId  String
+ tenant    Tenant @relation(fields: [tenantId], references: [id])
+
+ @@index([tenantId])
}

model Bill {
  ...existing fields...
+ tenantId  String
+ tenant    Tenant @relation(fields: [tenantId], references: [id])
  // Change billNumber unique to compound unique:
- @unique on billNumber (remove the @unique from the field)
+
+ @@unique([tenantId, billNumber])
+ @@index([tenantId])
}

model Party {
  ...existing fields...
+ tenantId  String
+ tenant    Tenant @relation(fields: [tenantId], references: [id])
+
+ @@index([tenantId])
}

model Payment {
  ...existing fields...
+ tenantId  String
+ tenant    Tenant @relation(fields: [tenantId], references: [id])
+
+ @@index([tenantId])
}

model MeasurementUpload {
  ...existing fields...
+ tenantId  String
+ tenant    Tenant @relation(fields: [tenantId], references: [id])
+
+ @@index([tenantId])
}
```

**Remove** the `CompanySettings` model entirely. Its data moves into `Tenant.settings` JSON field.

### Tenant `settings` JSON shape (for reference, not a Prisma model):

```typescript
interface TenantSettings {
  billPrefix: string;       // default: "BILL"
  defaultTaxPercent: number; // default: 18
  defaultTerms: string;     // default: ""
}
```

### ⛔ DO NOT:
- Add tenantId to `AuthThrottle` — it's a global security table
- Add tenantId to `MediaAsset` — assets are referenced by other tenant-scoped tables
- Add tenantId to `MeasurementPhoto` — it's a join table, scoped via MeasurementUpload
- Create any tenant signup or onboarding UI
- Implement Row-Level Security (RLS) in PostgreSQL

---

## Task 0.2 — Create migration seed script

### File: `prisma/seed-tenant.ts` (NEW)

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Read existing CompanySettings (if any)
  // NOTE: CompanySettings model will be deleted from schema,
  // so run this BEFORE removing it, or use raw SQL
  const settings = await prisma.$queryRaw`
    SELECT * FROM "CompanySettings" WHERE id = 'default' LIMIT 1
  `.catch(() => []);

  const s = (settings as any[])[0] || {};

  // 2. Create default tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      name: s.companyName || "My Business",
      slug: "default",
      phone: s.companyPhone || null,
      email: s.companyEmail || null,
      address: s.companyAddress || null,
      gstin: s.companyGstin || null,
      settings: {
        billPrefix: s.billPrefix || "BILL",
        defaultTaxPercent: s.defaultTaxPercent ?? 18,
        defaultTerms: s.defaultTerms || "",
      },
    },
  });

  console.log("Default tenant created:", tenant.id);

  // 3. Backfill tenantId on all existing rows
  const tables = ["User", "BillTemplate", "Bill", "Party", "Payment", "MeasurementUpload"];
  for (const table of tables) {
    const result = await prisma.$executeRawUnsafe(
      `UPDATE "${table}" SET "tenantId" = '${tenant.id}' WHERE "tenantId" IS NULL`
    );
    console.log(`${table}: updated ${result} rows`);
  }

  // 4. Drop CompanySettings table
  await prisma.$executeRaw`DROP TABLE IF EXISTS "CompanySettings" CASCADE`;
  console.log("CompanySettings table dropped");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
```

### Run order:
1. First: `npx prisma db push` (adds new columns as nullable)
2. Then: `npx tsx prisma/seed-tenant.ts` (backfills data)
3. Then: Change `tenantId` fields from `String?` to `String` in schema
4. Finally: `npx prisma db push` again (enforces NOT NULL)

---

## Task 0.3 — Create tenant-scoping helper

### File: `src/lib/tenant.ts` (NEW)

```typescript
import { headers } from "next/headers";

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || "";

/**
 * Reads tenantId from request headers (set by middleware).
 * Falls back to DEFAULT_TENANT_ID for the single-tenant phase.
 * 
 * Use in API routes: const tenantId = await getTenantId();
 */
export async function getTenantId(): Promise<string> {
  const headerList = await headers();
  return headerList.get("x-tenant-id") || DEFAULT_TENANT_ID;
}

/**
 * Returns a Prisma `where` clause fragment for tenant scoping.
 * Usage: prisma.bill.findMany({ where: { ...tenantScope(), status: "FINAL" } })
 */
export async function tenantScope() {
  return { tenantId: await getTenantId() };
}

/**
 * Returns data fields for creating records with tenant context.
 * Usage: prisma.bill.create({ data: { ...tenantData(), billNumber: "..." } })
 */
export async function tenantData() {
  return { tenantId: await getTenantId() };
}
```

### ⛔ DO NOT:
- Make getTenantId synchronous — `headers()` is async in Next.js 16
- Throw errors if tenantId is missing — return default for now
- Add any tenant switching or selection logic

---

## Task 0.4 — Update middleware to inject tenantId

### File: `src/middleware.ts`

Add this after line 64 (after `requestHeaders.set("x-user-name", ...)`):

```typescript
// For now, all users belong to the default tenant.
// When multi-tenant auth is added, read tenantId from JWT payload.
requestHeaders.set("x-tenant-id", process.env.DEFAULT_TENANT_ID || "");
```

### ⛔ DO NOT:
- Read tenantId from JWT yet — the token doesn't contain it
- Add tenant selection UI or tenant switching

---

## Task 0.5 — Add tenantId to every API route

This is the most tedious task. Every API route file must be updated.

### Pattern for GET (list) routes:

**Before:**
```typescript
const where: any = { isDeleted: false };
```

**After:**
```typescript
import { getTenantId } from "@/lib/tenant";
// ... inside handler:
const tenantId = await getTenantId();
const where: any = { tenantId, isDeleted: false };
```

### Pattern for POST (create) routes:

**Before:**
```typescript
const bill = await prisma.bill.create({
  data: { billNumber, templateId, customerName, /* ... */ }
});
```

**After:**
```typescript
import { getTenantId } from "@/lib/tenant";
// ... inside handler:
const tenantId = await getTenantId();
const bill = await prisma.bill.create({
  data: { tenantId, billNumber, templateId, customerName, /* ... */ }
});
```

### Pattern for findUnique/findFirst:

**Before:**
```typescript
const party = await prisma.party.findFirst({ where: { id, isDeleted: false } });
```

**After:**
```typescript
const tenantId = await getTenantId();
const party = await prisma.party.findFirst({ where: { id, tenantId, isDeleted: false } });
```

### Files to update (complete list):

| File | Changes |
|------|---------|
| `src/app/api/bills/route.ts` | GET: add tenantId to where. POST: add tenantId to create data. Replace `CompanySettings` lookup with Tenant lookup. |
| `src/app/api/bills/[id]/route.ts` | GET/PATCH: add tenantId to findUnique where |
| `src/app/api/bills/sync/route.ts` | POST: add tenantId to findUnique and create |
| `src/app/api/parties/route.ts` | GET: add tenantId to where. POST: add tenantId to create data |
| `src/app/api/parties/[id]/route.ts` | GET/PATCH/DELETE: add tenantId to where |
| `src/app/api/payments/route.ts` | GET: add tenantId to where. POST: add tenantId to create data. PATCH: add tenantId to findUnique |
| `src/app/api/payments/sync/route.ts` | POST: add tenantId to findUnique and create |
| `src/app/api/templates/route.ts` | GET/POST: add tenantId |
| `src/app/api/templates/[id]/route.ts` | GET/PATCH/DELETE: add tenantId |
| `src/app/api/measurements/route.ts` | GET/POST: add tenantId |
| `src/app/api/users/route.ts` | GET/POST: add tenantId |
| `src/app/api/settings/route.ts` | Replace CompanySettings queries with Tenant queries |
| `src/app/api/dashboard/route.ts` | Add tenantId to all queries |

### For the settings route specifically:

Replace `prisma.companySettings.findUnique({ where: { id: "default" } })` with:

```typescript
const tenantId = await getTenantId();
const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
// Access settings: (tenant?.settings as any)?.billPrefix || "BILL"
```

### For the Party detail page (Server Component):

**File:** `src/app/(app)/parties/[id]/page.tsx`

```typescript
import { getTenantId } from "@/lib/tenant";

// Inside the function:
const tenantId = await getTenantId();
const party = await prisma.party.findFirst({
  where: { id, tenantId, isDeleted: false },
});
```

### ⛔ DO NOT:
- Skip any API route — every single one needs tenantId
- Use `tenantId` from the request body — always read from headers via `getTenantId()`
- Allow records to be queried without tenantId (except AuthThrottle)

---

## Task 0.6 — Add DEFAULT_TENANT_ID to .env

### File: `.env`

```
DEFAULT_TENANT_ID=<paste the cuid from seed-tenant.ts output>
```

### Acceptance Criteria for Epic 0:
- [ ] `npx prisma db push` succeeds
- [ ] Seed script creates default tenant and backfills all rows
- [ ] All existing pages load with no errors
- [ ] All API routes return same data as before
- [ ] New records created via UI have `tenantId` set
- [ ] `CompanySettings` table no longer exists

---

# Epic 1: PWA Foundation

**Goal**: Make the app installable as a PWA. No offline-first yet — just manifest, service worker for asset caching, and install prompt.

## Task 1.1 — Web App Manifest

### File: `public/manifest.json` (NEW)

```json
{
  "name": "HisaabKitaab — Digital Khata",
  "short_name": "HisaabKitaab",
  "description": "Fast billing and payment tracking for your business",
  "start_url": "/dashboard",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0F172A",
  "theme_color": "#6366F1",
  "categories": ["business", "finance"],
  "lang": "hi",
  "dir": "ltr",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

### ⛔ DO NOT:
- Set `start_url` to `/` — it must be `/dashboard` (the authenticated home)
- Use `display: "browser"` — must be `"standalone"` for native feel
- Skip the `maskable` purpose on icons — Android requires it

---

## Task 1.2 — App Icons

Create placeholder icons (will be replaced by designer later):

### Files to create:
- `public/icons/icon-192.png` — 192x192px
- `public/icons/icon-512.png` — 512x512px

For now: Use a solid indigo (#6366F1) square with "HK" in white, bold text centered.

---

## Task 1.3 — Service Worker (basic asset caching)

### File: `public/sw.js` (NEW)

```javascript
const CACHE_NAME = "hk-v1";
const PRECACHE_URLS = [
  "/dashboard",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Install: cache shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // API calls: network only (no caching)
  if (url.pathname.startsWith("/api/")) return;

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Don't cache error responses
        if (!response.ok) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      });
    })
  );
});
```

### ⛔ DO NOT:
- Cache API responses (we're not doing offline-first billing yet)
- Use Workbox or any library — vanilla JS only for now
- Implement background sync yet — that's a separate epic
- Register the service worker on the login page — only on authenticated pages

---

## Task 1.4 — Register service worker + Add manifest link

### File: `src/app/layout.tsx`

Add to the `<head>` section (inside `<html>`):

```tsx
<head>
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#6366F1" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <link rel="apple-touch-icon" href="/icons/icon-192.png" />
</head>
```

### File: `src/app/(app)/AppShellWrapper.tsx`

Add service worker registration on mount:

```typescript
"use client";

import { useEffect } from "react";
import AppShell from "@/components/ui/AppShell";

// ... existing interface ...

export default function AppShellWrapper({ children, user }: { ... }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("SW registration failed:", err);
      });
    }
  }, []);

  return <AppShell user={user}>{children}</AppShell>;
}
```

---

## Task 1.5 — Install Prompt (Add to Home Screen)

### File: `src/hooks/useInstallPrompt.ts` (NEW)

```typescript
"use client";

import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = 
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === "accepted") setIsInstalled(true);
    return outcome === "accepted";
  };

  return {
    canInstall: !!deferredPrompt && !isInstalled,
    isInstalled,
    promptInstall,
  };
}
```

This hook will be consumed by the AppShell in Epic 2 to show an install banner.

### Acceptance Criteria for Epic 1:
- [ ] Lighthouse PWA audit shows manifest detected
- [ ] `manifest.json` is accessible at `/manifest.json`
- [ ] Service worker registers on authenticated pages
- [ ] Static assets are cached after first load
- [ ] `useInstallPrompt` hook detects installability on Android Chrome

---

# Epic 2: Mobile-First UI Shell

**Goal**: Replace the desktop sidebar layout with a mobile-first bottom navigation bar. Add a bottom-sheet modal system. Keep desktop sidebar working via responsive breakpoints.

## Task 2.1 — Bottom Sheet Component

### File: `src/components/ui/BottomSheet.tsx` (NEW)

This component uses the native `<dialog>` element for accessibility and performance.

```tsx
"use client";

import { useEffect, useRef, useCallback } from "react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  /** Height: "half" = 50vh, "full" = 90vh, "auto" = fit content */
  size?: "half" | "full" | "auto";
  children: React.ReactNode;
}

export default function BottomSheet({
  isOpen,
  onClose,
  title,
  size = "auto",
  children,
}: BottomSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) {
        onClose();
      }
    },
    [onClose]
  );

  // Close on Escape
  const handleCancel = useCallback(
    (e: React.SyntheticEvent) => {
      e.preventDefault();
      onClose();
    },
    [onClose]
  );

  const heightClass =
    size === "full"
      ? "max-h-[90vh]"
      : size === "half"
        ? "max-h-[50vh]"
        : "max-h-[85vh]";

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      onCancel={handleCancel}
      className="
        fixed inset-0 m-0 p-0 w-full h-full max-w-full max-h-full
        bg-transparent backdrop:bg-black/40
        open:flex items-end justify-center
      "
    >
      <div
        ref={contentRef}
        className={`
          w-full bg-background rounded-t-2xl shadow-2xl
          ${heightClass} overflow-hidden
          animate-slide-up
        `}
      >
        {/* Drag handle */}
        <div className="flex justify-center py-3">
          <div className="w-10 h-1 rounded-full bg-default-300" />
        </div>

        {/* Title */}
        {title && (
          <div className="px-4 pb-3 border-b border-divider">
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
        )}

        {/* Scrollable content */}
        <div className="overflow-y-auto px-4 py-4 pb-safe-bottom">
          {children}
        </div>
      </div>
    </dialog>
  );
}
```

### ⛔ DO NOT:
- Use Framer Motion for the bottom sheet — too heavy for budget phones
- Add drag-to-dismiss gesture — complex and buggy on Android WebView
- Make it a portal — `<dialog>` already handles stacking context
- Put the bottom sheet inside the bottom nav — it must be a sibling

---

## Task 2.2 — Redesign Bottom Navigation

### File: `src/components/ui/AppShell.tsx`

The bottom nav currently works (lines 425-513). We need to **modify** it to:

1. Change tab labels to be vernacular-friendly
2. Reduce to 4 tabs: Home, Bills, Khata (parties), More
3. Move Payments and Measurements into the "More" bottom sheet
4. Remove the FAB (floating action button) — actions move into page-level buttons

### Updated NAV_ITEMS array (replace lines 33-107):

```typescript
const MAIN_NAV: NavItem[] = [
  {
    icon: (/* home SVG — keep existing */),
    translationKey: "nav.home",
    href: "/dashboard",
    roles: ["ADMIN", "STAFF", "ACCOUNTANT"],
  },
  {
    icon: (/* bills SVG — keep existing */),
    translationKey: "nav.bills",
    href: "/bills",
    roles: ["ADMIN", "STAFF", "ACCOUNTANT"],
  },
  {
    icon: (/* parties SVG — keep existing */),
    translationKey: "nav.parties",  // Will later change to "nav.khata"
    href: "/parties",
    roles: ["ADMIN", "STAFF", "ACCOUNTANT"],
  },
];

// Items shown in the "More" bottom sheet
const MORE_ITEMS: NavItem[] = [
  {
    icon: (/* payments SVG */),
    translationKey: "nav.payments",
    href: "/payments",
    roles: ["ADMIN", "STAFF", "ACCOUNTANT"],
  },
  {
    icon: (/* measurements SVG */),
    translationKey: "nav.measures",
    href: "/measurements",
    roles: ["ADMIN", "STAFF"],
  },
];
```

### Updated mobile bottom nav JSX (replace lines 425-513):

```tsx
{/* ── Mobile Bottom Nav ────────────────────────── */}
<nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 print:hidden">
  <div className="glass border-t border-divider pb-safe-bottom">
    <div className="flex items-center justify-around h-16">
      {/* Main nav tabs */}
      {mainNavItems.map((item) => (
        <button
          key={item.href}
          onClick={() => router.push(item.href)}
          className={`flex flex-col items-center gap-0.5 px-4 py-2 transition-all ${
            isActive(item.href)
              ? "text-primary scale-105"
              : "text-default-400 active:scale-95"
          }`}
        >
          <span className={isActive(item.href) ? "text-primary" : "text-default-400"}>
            {item.icon}
          </span>
          <span className="text-[10px] font-medium leading-tight">
            {t(item.translationKey)}
          </span>
        </button>
      ))}

      {/* More tab */}
      <button
        onClick={() => setMoreSheetOpen(true)}
        className={`flex flex-col items-center gap-0.5 px-4 py-2 transition-all ${
          moreSheetOpen ? "text-primary" : "text-default-400"
        }`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <span className="text-[10px] font-medium leading-tight">
          {t("nav.more")}
        </span>
      </button>
    </div>
  </div>
</nav>
```

### Add state for the More sheet:

```typescript
const [moreSheetOpen, setMoreSheetOpen] = useState(false);
```

### Add the More BottomSheet after the nav:

```tsx
<BottomSheet
  isOpen={moreSheetOpen}
  onClose={() => setMoreSheetOpen(false)}
  title={t("nav.more")}
>
  <div className="space-y-1">
    {moreItems.map((item) => (
      <button
        key={item.href}
        onClick={() => { setMoreSheetOpen(false); router.push(item.href); }}
        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-default-100 transition text-left"
      >
        <span className="text-default-500">{item.icon}</span>
        <span className="font-medium">{t(item.translationKey)}</span>
      </button>
    ))}
    
    <div className="h-px bg-divider my-2" />
    
    {/* Settings links for admin */}
    {user.role === "ADMIN" && (
      <>
        <button onClick={() => { setMoreSheetOpen(false); router.push("/settings/company"); }}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-default-100 transition text-left"
        >
          <svg className="w-5 h-5 text-default-400" ...>...</svg>
          <span>{t("shell.companySettings")}</span>
        </button>
        {/* ... templates, users links ... */}
      </>
    )}
    
    <div className="h-px bg-divider my-2" />
    
    {/* Language + Theme + Logout */}
    <div className="flex items-center gap-2 px-3 py-2">
      <Button size="sm" variant="flat" color="primary"
        onPress={() => setLanguage(language === "en" ? "hi" : "en")}
      >
        {language === "en" ? "हिंदी" : "English"}
      </Button>
      <ThemeSwitcher />
    </div>
    
    <button
      onClick={handleLogout}
      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-danger hover:bg-danger/10 transition text-left"
    >
      <svg className="w-5 h-5" ...>...</svg>
      <span>{t("shell.signOut")}</span>
    </button>
  </div>
</BottomSheet>
```

---

## Task 2.3 — Add new translation keys

### File: `src/lib/i18n/translations.ts`

Add to BOTH `en` and `hi` objects:

```typescript
// English
"nav.more": "More",
"nav.khata": "Khata",
"install.banner": "Install App",
"install.message": "Add to Home Screen for faster access",

// Hindi
"nav.more": "और",
"nav.khata": "खाता",
"install.banner": "ऐप इंस्टॉल करें",
"install.message": "तेज़ एक्सेस के लिए होम स्क्रीन पर जोड़ें",
```

---

## Task 2.4 — Install Banner

Show a dismissible banner at the top of the dashboard when the app is installable.

### File: `src/app/(app)/dashboard/page.tsx`

Add at the top of the returned JSX:

```tsx
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

// Inside the component:
const { canInstall, promptInstall } = useInstallPrompt();
const [bannerDismissed, setBannerDismissed] = useState(false);

// In JSX, before existing content:
{canInstall && !bannerDismissed && (
  <div className="mx-4 mt-4 p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between gap-3">
    <div className="flex items-center gap-2">
      <span className="text-xl">📲</span>
      <div>
        <p className="text-sm font-medium">{t("install.banner")}</p>
        <p className="text-xs text-default-500">{t("install.message")}</p>
      </div>
    </div>
    <div className="flex gap-2">
      <Button size="sm" variant="flat" onPress={() => setBannerDismissed(true)}>
        ✕
      </Button>
      <Button size="sm" color="primary" onPress={promptInstall}>
        Install
      </Button>
    </div>
  </div>
)}
```

### ⛔ DO NOT:
- Show the install banner on every page — only the dashboard
- Auto-dismiss after install — the hook handles the `isInstalled` state
- Show the banner inside the bottom sheet

---

## Task 2.5 — CSS Updates for Mobile-First

### File: `src/app/globals.css`

Add these rules:

```css
/* ── Bottom Sheet Dialog ─────────────────────────────── */
dialog::backdrop {
  background: rgba(0, 0, 0, 0.4);
}

dialog[open] {
  display: flex;
}

/* ── Bottom Nav Glass Effect ─────────────────────────── */
.bottom-nav-glass {
  backdrop-filter: blur(20px) saturate(180%);
  background-color: hsl(0 0% 100% / 0.85);
}

.dark .bottom-nav-glass {
  background-color: hsl(0 0% 6% / 0.85);
}

/* ── Touch Feedback ──────────────────────────────────── */
@media (hover: none) {
  button:active {
    transform: scale(0.97);
  }
}

/* ── Content area padding to account for bottom nav ─── */
@media (max-width: 1023px) {
  .main-content-area {
    padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px) + 1rem);
  }
}
```

### Acceptance Criteria for Epic 2:
- [ ] Mobile view shows 4-tab bottom nav: Home, Bills, Khata, More
- [ ] "More" tab opens bottom sheet with Payments, Measurements, Settings, Logout
- [ ] Desktop view still shows the sidebar (no changes to `lg:` breakpoint behavior)
- [ ] Bottom sheet opens and closes smoothly
- [ ] FAB is removed from bottom nav
- [ ] Install banner appears on dashboard when installable
- [ ] Language switcher works from "More" sheet
- [ ] All existing functionality is preserved — no broken routes

---

*Continued in Part 2: Epics 3-5 (Fast Billing, Udhar Khata, WhatsApp Sharing)*
