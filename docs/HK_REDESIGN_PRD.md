# HisaabKitaab UX Redesign PRD — Phase 2

**Status:** Draft for implementation
**Last updated:** 2026-04-29
**Scope:** Cross-app UX redesign + Tally I/O + first-time setup + bank reconciliation. The Dashboard redesign is already shipped and is the design reference for everything below.
**Audience:** Any engineer or AI agent picking up this work cold. Read top-to-bottom before writing code.

---

## 0. How to use this document

This PRD is the source of truth for the redesign. Every section is self-contained:
- **§1–§4** establish *who* the users are and *why* the current UX fails them. Skip only if you've already internalized them.
- **§5** is the spec, ten features in priority order. Each has a User Story, Visual Spec, Copy, Data Contract, Acceptance Criteria, Edge Cases, and Out of Scope. Build features in the order listed; they're prioritized by user impact.
- **§6–§13** are reference: design tokens, copy guidelines, technical constraints, phasing, and the Tally compatibility appendix.

If a requirement here conflicts with `AGENTS.md`, **AGENTS.md wins** — it encodes hard system invariants (tenant isolation, double-entry, observability). Flag the conflict and ask before deviating from this doc.

**Build order shortcut**: §5.6 → §5.1 → §5.2 → §5.3 → §5.4 → §5.5 → §5.7 → §5.9 → §5.10 → §5.8. See §9 for the rationale.

---

## 1. Context

**HisaabKitaab** is a multi-tenant SaaS bookkeeping app for Indian MSMEs (shop owners, manufacturers, traders). Stack: Next.js 16 (App Router, `src/`), Prisma 6 + Postgres (Supabase), HeroUI + Tailwind 4, TypeScript strict.

The product strategy (`docs/STRATEGY.md`) frames the app as a **"cognitive translator"**: the user sees only **Money In / Money Out** in their language; the backend silently emits Tally-compatible double-entry vouchers. **Every UX decision in this doc must reinforce that thesis.** If a feature exposes accounting jargon to the user, it has failed.

**Tally is not a side feature.** ~95% of Indian MSMEs send their books to a Chartered Accountant (CA) who works in Tally. Without seamless Tally export, the Dukandaar's CA rejects the workflow and the Dukandaar abandons the app. Tally I/O is therefore a **first-class flow**, on par with creating bills.

**Current state (already shipped):**
- Top navbar with pill tabs (Dashboard / Mere Bills / Udhar Khata / Payments) — `src/components/ui/AppShell.tsx`
- Dashboard fully redesigned with 6 chart cards — `src/app/(app)/dashboard/page.tsx`
- Design system extracted to `src/components/ui/hk-design.tsx` (tokens + primitives)
- Bills, Parties, Payments pages **visually** match the dashboard but **the UX still mirrors the old programmer-facing model**

**This PRD ships:**
1. Dukandaar-centric UX rework on Bills, Parties, Payments (§5.1–§5.6)
2. Tally export and import flows (§5.7, §5.8)
3. Comprehensive first-time setup wizard (§5.9)
4. Bank statement reconciliation (§5.10)

---

## 2. Users

### 2.1 Primary user: "Dukandaar"

A real persona, not a fabrication. Internalize this before designing anything.

| Attribute | Value |
|---|---|
| Role | Shop owner / small-business operator |
| Age | 40–60+ (median ~48). **Presbyopia is the norm** — close-up vision degrades from 40. Most users wear or need reading glasses. |
| Tech literacy | Low. WhatsApp + UPI fluent. Has never used Excel. |
| Language | Speaks Hindi/regional, types Hinglish in the Roman alphabet |
| Device | Android phone, often mid-tier (4GB RAM), patchy 3G/4G |
| Lighting | Dim shop interior, sometimes outdoor glare |
| Eyes | Reading glasses sometimes nearby, sometimes not. Must be readable without them. |
| Hands | Often dirty/wet. Touch targets must be generous (48px min for primary actions). |
| Interruptions | Constant. A customer is waiting. The flow must survive being abandoned mid-task. |
| Mental model | "Kisne paisa diya, kisne lena hai, kitna mila aaj." Not "FINAL bills with status=POSTED." |
| Trust | Suspicious of new software. Will abandon at first sign of friction or ambiguity. |

**What they actually do, in priority order:**
1. **Record a payment they just received** ("Ramesh ne 5000 diye") — should take ≤3 taps from anywhere.
2. **Check who owes them money** ("Sunita ne paisa diya kya?") — answer must be visible in <2 seconds of opening the app.
3. **Create a bill for the customer in front of them** — 30-second flow, party + amount + done.
4. **Chase overdue customers** — call/WhatsApp from inside the app, no copy-paste.
5. **End-of-day check** ("Aaj kitna mila?") — a glance at the dashboard.
6. **Send books to CA** — quarterly and annual handoff in one tap.
7. **Reconcile bank statement** — monthly, "yeh sab paisa kahan se aaya?"

**What they do NOT do:**
- Browse bills by month for fun.
- Care that a bill is "DRAFT" vs "FINAL" — they care if it's **paid or unpaid**.
- Distinguish "OUTGOING vs INCOMING" — they think "diya / mila."
- Read English help text.
- Manage taxonomies, archive things, or curate lists.

### 2.2 Secondary user: The Chartered Accountant (CA)

The Dukandaar's CA never logs into HisaabKitaab — but they receive data from it.

| Attribute | Value |
|---|---|
| Tools | Tally ERP 9 / Tally Prime (>90% of Indian SMB accounting) |
| Workflow | Quarterly: collect data from clients → import into Tally → file GST returns. Annually: prepare books for income tax. |
| Pain point | Clients send WhatsApp screenshots, photos of bills, messy Excel. Hours of manual data entry per client. |
| Trust signal | A clean Tally XML file that imports without errors |
| Data they need | All vouchers (Sales, Purchase, Receipt, Payment, Journal), party ledgers, GST breakdowns, opening balances |

**Why this matters for design:** Every feature that produces an accounting record must produce one that round-trips through Tally cleanly. We never ask the CA to "trust us" — we hand them a file Tally accepts.

### 2.3 Tertiary actor: The bank

The Dukandaar's bank statement is the source of truth for cash movements. Every UPI/NEFT/cheque the user records should — ideally — match a line on their bank statement at month-end. When it doesn't, that's a problem to surface, not hide.

---

## 3. The problem (current UX gaps)

Each item is a concrete failure observed against the personas above.

### 3.1 Bills page treats status as the primary axis
The 4 summary stats are `Kul Bills / Pakka / Draft / Raddh`. None answer "How much money is still coming to me?" A draft count is a programmer's metric. The user wants `Kul Billed` vs `Mila` vs `Baaki`.

### 3.2 "Raddh" is jargon
Sanskrit-formal for "cancelled." Dukandaars say "Cancel kiya" or "रद्द." Same with "Pakka" — "Final" is clearer in a billing context.

### 3.3 Parties page primary action is wrong
Edit and Delete are most prominent. The most common task is "Ramesh just paid me" — recording a payment from this party — which currently requires Payments → New Payment → search-and-pick. Wrong defaults.

### 3.4 No call/WhatsApp shortcuts on parties
To remind a party to pay, the user copies the number, leaves the app, pastes into WhatsApp, types a message. 6+ steps. A one-tap deep-link collapses it to one.

### 3.5 Parties default sort is alphabetical
For 50+ parties, alphabetical is useless. Default should be **biggest debtors first**, with overdue flagged.

### 3.6 Pending payments are buried
"Expected" payments are action items. Today they're inline with completed payments in chronological order. They should be **pinned at top** with "needs your action" framing.

### 3.7 FAB only creates a bill
Recording a payment is equally frequent. Single-purpose FAB makes payment-recording a 4-tap journey.

### 3.8 No urgency surfacing
The single most valuable number — "₹X overdue from Y customers" — is not shown anywhere prominent.

### 3.9 Empty states are dead ends
"Pehla bill banakar shuru karo" with a button. No guidance on what's needed first (a party).

### 3.10 No way to send data to the CA
Strategy promises Tally compatibility; product doesn't deliver a UI for it. CAs continue to demand Excel. Cognitive translator promise breaks at the handoff.

### 3.11 Onboarding is sparse and confidence-eroding
A first-time user lands on an empty dashboard with a small wizard prompt. They don't know what to fill in first. They don't know where to put their GSTIN, bank account, or items. They abandon. We have one shot to set up a tenant correctly — current flow wastes it.

### 3.12 No bank statement reconciliation
The user records cash movements manually; their bank shows the same movements. Without reconciliation, errors compound silently. By month-end the books and the bank disagree, and the CA has to clean it up. Khatabook, Vyapar and MoneyView all have reconciliation; we don't.

---

## 4. Goals & non-goals

### Goals
1. **G1** — A new user can record their first payment in ≤3 taps from the dashboard.
2. **G2** — Within 2 seconds of opening any primary screen, the user knows how much is owed to them.
3. **G3** — Calling or WhatsApp-ing an overdue customer is one tap from any party row.
4. **G4** — Pending payments (action items) are visually distinct from historical records.
5. **G5** — All user-facing copy uses words a non-technical Hinglish speaker would say out loud.
6. **G6** — The Dukandaar can generate a Tally XML for any date range and share it with their CA in ≤4 taps.
7. **G7** — The Dukandaar can import a Tally XML and have all historical vouchers, parties, and balances appear in HisaabKitaab without manual entry.
8. **G8** — A first-time user can complete tenant setup (business profile, GSTIN, parties, items, bank, CA) in one continuous flow with auto-save and skip-anywhere.
9. **G9** — The Dukandaar can upload a bank CSV and reconcile ≥80% of lines automatically against existing payments; remaining lines categorize in one tap each.

### Non-goals (out of scope for this phase)
- New screens beyond those listed (Reports rework, Purchases rework, Notes, Measurements).
- Dashboard chart changes.
- Backend schema *destruction* (additive changes only).
- Light/dark theme rework.
- Multi-language UI toggle (Hinglish defaults; existing `i18n` layers on top).
- Voice input or OCR.
- Tally Connect / Tally.NET API (XML file is universal; Tally Connect requires the CA's Tally to be running and reachable).
- Bidirectional sync with Tally — import is one-way at point in time.
- PDF bank statement parsing — CSV only in v1 (each Indian bank has a different PDF format; PDF parsing is its own product).
- Excel/Google Sheets bank statement upload — CSV only in v1.
- Quick Bill flow internals.

---

## 5. Features

Each feature is independently shippable. Build in the order in §9.

---

### 5.1 — Overdue banner

**Priority:** P0

#### User story
> As a Dukandaar, when I open the app I want to see immediately how much money is overdue and from how many customers, so I can decide whether to chase someone today.

#### Where it appears
- Top of `/dashboard` — above "Apna Karobaar" header, below install banner if shown
- Top of `/parties` — above the Lena Baki / Dena Baki summary
- Top of `/bills` — above the summary stats

Single shared component, three mount points.

#### Definition of "overdue"
A **customer party** (`type === "CUSTOMER"`) is overdue if:
- `currentBalance < 0` (they owe us money), AND
- No incoming COMPLETED payment in the last **30 days**

Matches existing `overdueCount` logic in `/api/dashboard/route.ts`. Use that field directly.

#### Visual spec
```
┌─────────────────────────────────────────────────────────┐
│ ⚠   ₹45,000 overdue from 3 parties       [Dekho →]      │
└─────────────────────────────────────────────────────────┘
```

- Container: rounded 14px, 1px border `OR + "33"`, background `OR + "14"`
- Padding: `12px 16px` desktop, `10px 14px` mobile
- Margin-bottom: `16px`
- Icon: warning triangle in `OR`, 20×20
- Text: Space Grotesk, `15/14px` (desktop/mobile), `fontWeight: 700`, `var(--hk-text)`
- Amount: `fmtFull()` — full ₹ with locale grouping
- Right link: "Dekho →", color `OR`, `fontWeight: 600`, navigates to `/parties?filter=overdue`
- Dismiss: NO. Status indicator, not a notification.
- Whole banner is tap target

#### Copy
| Variant | Text |
|---|---|
| 1+ overdue | `₹{amount} overdue from {n} parties` |
| 1 overdue | `₹{amount} overdue from {name}` |
| 0 overdue | **Banner does not render.** |

Hindi (when language=hi): `{amount} रुपए {n} पार्टी से बकाया है`

#### Data contract
Source: `GET /api/dashboard`. Add to `summary`:
- `overdueAmount: number` (NEW)
- `overdueParty?: { id, name }` when `overdueCount === 1` (NEW)

API extension in `src/app/api/dashboard/route.ts`:
```ts
const overdueAggregate = await prisma.party.aggregate({
  where: {
    tenantId, type: "CUSTOMER", currentBalance: { lt: 0 },
    isActive: true, isDeleted: false,
    payments: {
      none: {
        isDeleted: false, direction: "INCOMING", status: "COMPLETED",
        date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    },
  },
  _sum: { currentBalance: true },
});
const overdueAmount = Math.abs(Number(overdueAggregate._sum.currentBalance ?? 0));
```

#### Component
Create `src/components/ui/OverdueBanner.tsx`. Returns `null` when `overdueCount === 0`.

#### Acceptance criteria
- [ ] Renders on `/dashboard`, `/parties`, `/bills` only when `overdueCount > 0`
- [ ] Tap navigates to `/parties?filter=overdue`
- [ ] When `overdueCount === 1`, shows party name instead of count
- [ ] Hidden when `overdueCount === 0` (no "all caught up" placeholder)
- [ ] `?filter=overdue` on parties shows only overdue customers (see §5.3)
- [ ] No layout shift between loaded/unloaded states
- [ ] WCAG AA contrast in both themes

#### Edge cases
- New tenant, zero parties → hidden ✓
- Network error → fail silently, hide
- Amount > ₹1Cr → `fmtFull` handles locale grouping; banner has ~12 char space

#### Out of scope
- Per-party overdue dates ("47 days overdue")
- Reminders (email/SMS)

---

### 5.2 — Reframe Bills summary stats

**Priority:** P0

#### User story
> As a Dukandaar, I want the top of the Bills page to show how much I've billed, how much I've collected, and what's still pending — not how many drafts I have.

#### Change
Replace `[Kul Bills | Pakka | Draft | Raddh]` (status counts) with `[Kul Billed | Mila | Baaki]` (₹ amounts). Status counts move into filter pills below the search box: `Sab (24) / Final (18) / Draft (4) / Cancel (2)`.

#### Visual spec
3 columns on both mobile and desktop. Same card style (rounded 14px, `var(--hk-card)`, 1px border).

| Card | Label | Value | Sub | Color |
|---|---|---|---|---|
| 1 | KUL BILLED | sum `grandTotal` (FINAL only, current month) | "is mahine" | `var(--hk-text)` |
| 2 | MILA | sum INCOMING+COMPLETED payments tied to those bills | "wapas mila" | `GR` |
| 3 | BAAKI | Card 1 minus Card 2 | "abhi tak" | `OR` |

Use `fmt()` (₹1.5L, ₹45K, ₹890).

#### Data contract
Extend `GET /api/bills` response:
```ts
{
  bills: [...],
  totalPages: n,
  summary: {
    kulBilled: number,
    mila: number,
    baaki: number
  }
}
```
Compute via Prisma `aggregate` with current-month bounds. **Do not pull all bills into memory.** Tenant-scoped.

#### Acceptance criteria
- [ ] Bills page top shows 3 ₹-amount cards
- [ ] Status counts appear inline in filter pills as `(n)`
- [ ] Zero bills → all three cards show `₹0`
- [ ] Summary always month-to-date (not affected by filters)
- [ ] Mobile keeps 3-column layout

#### Edge cases
- Cancelled bills excluded from `kulBilled`
- Drafts excluded from `kulBilled`
- Multi-month range → summary always current calendar month

#### Out of scope
- Time-range picker for summary
- Drilling into a card

---

### 5.3 — Parties: sort by debt + Call/WhatsApp + filter=overdue

**Priority:** P0

#### User story
> As a Dukandaar, I want my biggest debtors at the top with one-tap call and WhatsApp shortcuts, so I can chase payment without copying numbers.

#### 5.3a Default sort: largest debt first
Extend `GET /api/parties` to accept `sortBy`:
```ts
const sortBy = searchParams.get("sortBy") || "name";
orderBy: sortBy === "balance"
  ? [{ currentBalance: "asc" }, { name: "asc" }]  // most negative = top
  : { name: "asc" }
```
Parties page calls `/api/parties?sortBy=balance` by default. Header dropdown lets user toggle to `?sortBy=name`. Persisted in URL only.

> Note: `currentBalance < 0` means the party owes us. Verify sign convention against `src/lib/accounting.ts` before shipping.

#### 5.3b Call + WhatsApp buttons
Replace Edit/Delete cluster with a primary action group (Call, WhatsApp) and an overflow menu (Edit, Delete, View Profile).

Layout per party row:
```
[Avatar]  Name + Type chip          ₹Balance
          Phone (small)             status
                                    [📞] [💬] [⋯]
```

- **📞:** `tel:{normalizedPhone}` — opens dialer. Hidden if no phone.
- **💬:** `https://wa.me/{normalizedPhone}?text={prefilledMessage}`
- **⋯:** menu with View Profile / Edit / Delete

Phone normalization: strip spaces/dashes, prepend `91` if not already prefixed. Helper in `src/lib/phone.ts` (create if missing).

Pre-filled WhatsApp (Hinglish):
```
Namaste {firstName} ji, aapse ₹{amount} ka hisaab baaki hai.
Jab convenient ho, please clear kar dein. Dhanyavaad.
— {tenantBusinessName}
```
For parties with `currentBalance >= 0`:
```
Namaste {firstName} ji, aapka hisaab clear hai. Dhanyavaad!
```

#### 5.3c URL filter `?filter=overdue`
Server-side filter, not client-side:
```ts
if (searchParams.get("overdue") === "true") {
  where.AND = [
    { type: "CUSTOMER" },
    { currentBalance: { lt: 0 } },
    { payments: { none: {
      isDeleted: false, direction: "INCOMING", status: "COMPLETED",
      date: { gte: thirtyDaysAgo }
    }}},
  ];
}
```
Render a chip at top: `Showing overdue parties only [✕ clear]`.

#### Visual spec — action buttons
Each: 32×32, `borderRadius: 9`, background `var(--hk-badge)`, hover `var(--hk-pill-active)`, 1px border, 16×16 icon `var(--hk-sub)`, 4px gap.

WhatsApp button gets brand-green tint: background `GR + "18"`, icon `GR`.

#### Acceptance criteria
- [ ] Default load orders by debt (biggest debtors first)
- [ ] Each row with phone shows 📞 and 💬 buttons
- [ ] 📞 opens dialer with party's number
- [ ] 💬 opens WhatsApp with Hinglish reminder including amount
- [ ] Edit/Delete in ⋯ overflow
- [ ] `?filter=overdue` shows only overdue customers with chip
- [ ] `/parties` (no filter) loads all, sorted by debt
- [ ] Sort toggle persists in URL: `?sortBy=name`
- [ ] No-phone parties hide 📞 and 💬 but show ⋯
- [ ] Tenant isolation via `resolveVerifiedTenantId`

#### Edge cases
- Non-Indian phone numbers → use raw value
- Balance exactly zero → "no debt" message branch
- Tenant business name unavailable → omit signature line
- WhatsApp not installed → `wa.me` falls back to web

#### Out of scope
- SMS sending
- Bulk reminder
- Reminder template customization (settings screen)

---

### 5.4 — Pending payments pinned to top

**Priority:** P1

#### User story
> As a Dukandaar, I want my pending payments visually separated from history, so I see at a glance what needs my action.

#### Change
On `/payments`, split into:
1. **"Action Chahiye"** — `status === "EXPECTED"`, both directions, pinned at top, flat (not month-grouped), always expanded
2. **"Hua Hai"** — completed payments, monthly-grouped as today

Action Chahiye section omitted entirely when zero pending — no placeholder.

#### Visual spec
Header for Action Chahiye: amber accent (`border-left: 3px solid AM`), count chip `{n} pending` in `AM + "22"` background, `AM` color.

Each pending row: amber left border, prominent ✓ Done button.

#### Data contract
Two parallel fetches: `?status=EXPECTED` (limit 100, all of them) and `?status=COMPLETED` (paginated). Keeps logical groups intact across pagination.

#### Acceptance criteria
- [ ] "Action Chahiye" above "Hua Hai" when pending exists
- [ ] Amber accent + count chip
- [ ] Zero pending → section omitted (no placeholder)
- [ ] ✓ Done calls existing `PATCH /api/payments`
- [ ] Optimistic UI: row moves immediately, rolls back on error
- [ ] Mobile: action chips wrap on narrow screens
- [ ] Pagination affects only "Hua Hai"

#### Edge cases
- All pending, none completed → only Action Chahiye, no Hua Hai header
- Marking last pending complete → section fade-out (200ms)
- API error → restore pending state, show error toast

#### Out of scope
- Pending-payment notifications
- Editing expected date
- Bulk mark-complete

---

### 5.5 — Smart FAB (Quick Add sheet)

**Priority:** P1

#### User story
> As a Dukandaar, when I tap the floating + I want to choose between recording a payment, creating a bill, or adding a party — all three are common.

#### Change
Replace single-action FAB with a bottom sheet offering 3 choices.

```
┌─────────────────────────────────────┐
│  Kya banana hai?                    │
│                                     │
│  [📥]  Payment Mila / Diya          │
│        Money in or out              │
│  ─────────────────────────────────  │
│  [📋]  Naya Bill                    │
│        Bill banao customer ke liye  │
│  ─────────────────────────────────  │
│  [👤]  Nayi Party                   │
│        Customer ya supplier add karo│
└─────────────────────────────────────┘
```

Each option: icon in colored badge (Payment=green, Bill=orange, Party=purple), label + 1-line subtitle, full-row tap.

Behavior:
- Payment → `/payments/new`
- Bill → existing `QuickBillSheet`
- Party → `/parties?addNew=true` (parties page reads param, auto-opens slide-in)

#### Visual spec
Reuse `BottomSheet` (`src/components/ui/BottomSheet.tsx`). Title: "Kya banana hai?". Auto-height. Same backdrop as new bill modal.

Mobile: full-width sheet, draggable to dismiss.
Desktop: FAB hidden (current behavior). "+ Naya Bill" stays single-purpose for now; future iteration can convert to dropdown.

#### Acceptance criteria
- [ ] Tapping FAB opens 3-option sheet
- [ ] Each option navigates correctly
- [ ] Sheet dismisses on backdrop tap, swipe down, selection
- [ ] FAB icon/styling unchanged
- [ ] Desktop FAB hidden (preserved)
- [ ] `/parties?addNew=true` auto-opens add panel

#### Edge cases
- `canQuickBill === false` (CUSTOMER role) → FAB doesn't render
- Tap while sheet open → no-op

#### Out of scope
- Long-press for favorite
- Drag-to-reorder
- Custom-action config

---

### 5.6 — Plain-language audit

**Priority:** P0 (do first; subsequent features inherit correct copy)

#### Replacements
| Currently | Replace with | Why |
|---|---|---|
| `Raddh` | `Cancel` (English) or `रद्द` (Devanagari, language=hi) | Sanskrit-formal vs spoken |
| `Pakka ✓` | `Final ✓` | Less ambiguous in billing context |
| `Baaki Baki` | `Baaki` | Doubled word is awkward |
| `Wapas Mila` | `Mila` | "Wapas" implies repayment; broader is better |
| Toast "Bill Pakka Karo" | "Final Karo ✓" | Same issue |
| `Cancel kar diya gaya` | `Cancel kiya gaya` | Tighter |
| `Successfully created` | `Ho gaya ✓` | Casual, fast |

Apply to **every user-visible string** in:
- `src/components/ui/hk-design.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/bills/page.tsx`
- `src/app/(app)/parties/page.tsx`
- `src/app/(app)/payments/page.tsx`
- `src/components/ui/AppShell.tsx`
- `src/lib/i18n/translations.ts` (en + hi blocks)

#### Acceptance criteria
- [ ] No "Raddh" in any UI string
- [ ] StatusChip renders "Final ✓ / Draft / Cancel"
- [ ] Toasts use 1–4 word confirmations
- [ ] `t()` keys updated in both `en` and `hi`
- [ ] Existing tests pass

#### Edge cases
- Backend enums (`status: "CANCELLED"`) UNCHANGED — only labels change
- Doc/screenshot images in `docs/` UNCHANGED — they're documentation

#### Out of scope
- Full Devanagari translation
- Voice/audio prompts
- Per-region vocab variants

---

### 5.7 — Tally Export

**Priority:** P1 (precondition for adoption — without this, CAs reject the workflow)

#### User story
> As a Dukandaar, I want to send my CA a Tally file with one tap so they can import all my bills, payments, and party balances directly without re-entering anything.

#### Trigger / entry points
1. **Settings → "Tally ko Bhejo"** (primary, persistent menu item)
2. **Reports page → "Send to CA" prominent button**
3. **Quarterly nudge banner** on dashboard at FY quarter-end (Mar 31, Jun 30, Sep 30, Dec 31): "Quarter end aa raha hai — CA ko file bhejo"

#### The export flow

3-step bottom sheet (mobile) / side panel (desktop):

**Step 1 — Date range**
```
Kaunsa period?
○ Is mahine (April 2026)
○ Is quarter (Q4 FY26: Jan–Mar 2026)
● Is saal (FY 2025–26: Apr 2025 – Mar 2026)  ← default
○ Custom dates
```
FY = Indian financial year (Apr 1 → Mar 31). Use `getCurrentFinancialYearRange()` from `src/lib/journal-reporting.ts`.

**Step 2 — Kya kya include karna hai?**
```
☑ Sales bills (124 bills, ₹12.4L)
☑ Purchase bills (38 bills, ₹4.2L)
☑ Receipts (88 payments, ₹10.1L)
☑ Payments out (42 payments, ₹3.8L)
☑ Party balances (24 parties)
☐ Manual journal entries (2)
```
Each line shows count + ₹ value so user verifies before exporting. Counts come from `POST /api/export/tally-xml/preview` (returns metadata without generating file).

**Step 3 — Kaise bhejna hai?**
```
[📥 Download .xml]   [📧 Email to CA]   [💬 WhatsApp share]
```

If CA email saved (Settings → Business Profile → CA Email), email pre-fills.

Sticky footer: `[← Wapas]` and `[Aage →]` / `[Bhejo ✓]`.

Generation progress: spinner with "Tally file ban raha hai..." (typically <2s for a year).

#### File format

Tally-native XML. Top-level structure:

```xml
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>{tenantBusinessName}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <!-- Master ledgers (parties + accounts) created first -->
        <TALLYMESSAGE>
          <LEDGER NAME="Ramesh Cloth Store" ACTION="Create">
            <PARENT>Sundry Debtors</PARENT>
            <ISBILLWISEON>Yes</ISBILLWISEON>
          </LEDGER>
        </TALLYMESSAGE>
        <!-- Vouchers -->
        <TALLYMESSAGE>
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <DATE>20260415</DATE>
            <NARRATION>Bill B-2604-001</NARRATION>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>B-2604-001</VOUCHERNUMBER>
            <PARTYLEDGERNAME>Ramesh Cloth Store</PARTYLEDGERNAME>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Ramesh Cloth Store</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-52000.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Sales</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>44067.80</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>CGST Output</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>3966.10</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>SGST Output</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>3966.10</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
```

See **§13 Tally Compatibility Reference** for the complete schema.

#### Pre-export validation

Per AGENTS.md: "Exports are blocked if any `JournalEntry.isBalanced === false` exists for the tenant."

```ts
const unbalanced = await prisma.journalEntry.count({
  where: { tenantId, isBalanced: false, isDeleted: false }
});
if (unbalanced > 0) {
  throw new Error("UNBALANCED_ENTRIES");
}
```

If this fires: clear error, "Kuch entries mein gadbad hai. Support se baat karo." with `[Get help]` button opening WhatsApp to support.

#### API contract

**`POST /api/export/tally-xml`**

Request:
```json
{
  "from": "2025-04-01",
  "to": "2026-03-31",
  "include": {
    "sales": true, "purchases": true, "receipts": true,
    "payments": true, "ledgers": true, "journals": false
  }
}
```

Response:
- 200: `application/xml`, `Content-Disposition: attachment; filename="HisaabKitaab-{tenantSlug}-{from}-to-{to}.xml"`
- 400: `{ error: "Some journal entries are unbalanced", count: 2 }`
- 401/403: standard

**`POST /api/export/tally-xml/preview`** — same request body, returns counts only:
```json
{
  "salesCount": 124, "salesAmount": 1240000,
  "purchasesCount": 38, "purchasesAmount": 420000,
  "receiptsCount": 88, "receiptsAmount": 1010000,
  "paymentsCount": 42, "paymentsAmount": 380000,
  "partiesCount": 24,
  "journalsCount": 2,
  "unbalancedCount": 0
}
```

**Implementation:** `src/app/api/export/tally-xml/route.ts` and `.../preview/route.ts`.

**Constraints:**
- Tenant scoped via `resolveVerifiedTenantId`
- Role: ADMIN and ACCOUNTANT only
- Rate-limit: `await checkRateLimit(request, "export.tally", 10)` per hour per user
- Streaming for large exports (>1k vouchers): `ReadableStream`, not full string in memory
- XML library: `xmlbuilder2` (verify in deps; add if missing)

#### Email/WhatsApp delivery
Generate XML once, upload to ephemeral storage (Supabase Storage if available, else S3) with 7-day signed URL. Reuse for both delivery paths.

Email body (Hinglish):
```
Subject: {Business Name} — Tally file for {date range}

Namaste {caName},
{businessName} ka {period} ka Tally file ready hai.
Download karke Tally mein import kar lo.

[Download File]

— HisaabKitaab
```

WhatsApp message:
```
Namaste — yeh {businessName} ka Tally file hai for {period}.
Click karke download karo: {link}
```

#### Acceptance criteria
- [ ] User triggers export from at least Settings (mandatory); Reports + dashboard banner are nice-to-haves
- [ ] 3-step flow renders correctly
- [ ] Generated XML has valid Tally `<ENVELOPE>` structure
- [ ] All non-cancelled, non-deleted vouchers in date range present
- [ ] `<LEDGER>` master records emitted for every party/account encountered
- [ ] Each voucher's `<ALLLEDGERENTRIES.LIST>` blocks balance to zero
- [ ] GST split correct: intra-state CGST+SGST, inter-state IGST
- [ ] Date format `YYYYMMDD`, amount format 2 decimal places
- [ ] Export blocked with clear error if any `isBalanced: false` exists
- [ ] Empty range produces valid empty XML + Hinglish "Is period mein koi data nahi"
- [ ] Filename pattern correct
- [ ] Tenant isolation verified
- [ ] **Tested against real Tally Prime install: imports without errors**

#### Edge cases
- No CA email saved → email button disabled with "CA ka email Settings mein add karo"
- No CA phone → WhatsApp opens generic share
- Cross-FY date range → allowed; Tally handles
- Zero data → empty XML + toast, no error
- Duplicate ledger names → emit `<LEDGER>` once per unique name
- Party renamed in HK → voucher emits current name (per AGENTS.md)
- >10k vouchers → stream response; if generation >30s, return 202 + status polling endpoint (defer to v2 if not encountered)

#### Out of scope
- Selective voucher exclusion ("skip these 3")
- Auto-export schedule (nightly, monthly)
- Tally Connect / Tally.NET API

#### Copy
| Element | Hinglish |
|---|---|
| Settings entry | Tally ko Bhejo |
| Step 1 title | Kaunsa period? |
| Step 2 title | Kya kya include karna hai? |
| Step 3 title | Kaise bhejna hai? |
| Generating | Tally file ban raha hai... |
| Success | Ho gaya ✓ — File CA ko bhej do |
| Empty range | Is period mein koi data nahi. Date range badlo. |
| Validation error | Kuch entries mein gadbad hai. Support se baat karo. |

---

### 5.8 — Tally Import

**Priority:** P2 (one-time migration event for most users; high-value when needed but not blocking daily use)

#### User story
> As a Dukandaar (or my CA on my behalf), I want to upload a Tally XML file so historical vouchers, party balances, and journals appear in HisaabKitaab without manual re-entry.

#### Trigger
1. **Settings → "Tally se Laao"** (primary)
2. **Onboarding wizard step** (§5.9): "Already using Tally? Import your data" — entry point hooks into wizard

#### Flow

```
Step 1: Upload
    [📁 Choose .xml file]  or drag-drop
    Selected: my-tally-export.xml (2.4 MB, 1,234 vouchers)

Step 2: Preview
    Found in this file:
    • 800 sales vouchers (₹15.2L)
    • 420 purchase vouchers (₹8.4L)
    • 380 receipts (₹14.1L)
    • 220 payments (₹6.2L)
    • 124 parties
    • 18 unique ledgers
    
    ⚠ 12 duplicates will be skipped (already imported)
    ⚠ 3 unbalanced entries will be flagged for review
    
    [← Wapas]   [✓ Import sab kuch]

Step 3: Importing... (progress bar)

Step 4: Done
    1,420 vouchers imported.
    12 skipped as duplicates.
    3 flagged — review in Settings → Issues.
    
    [Dashboard pe jao]
```

#### Validation rules (per AGENTS.md)

1. **Party resolution:** For each `<PARTYLEDGERNAME>`, find existing Party by exact name → fallback to phone match → else create new Party with type inferred (Sundry Debtor → CUSTOMER, Sundry Creditor → VENDOR).

2. **Duplicate detection:** Match `(voucherType, entryDate, narration, totalDebit)`. If all 4 match an existing JournalEntry (same tenant), skip with warning.

3. **Balance check:** Each voucher's debit = credit. Unbalanced flagged but not committed; appear in Settings → Issues.

4. **GST ledger mapping:**
   - Tally `CGST Output` → `AccountCode.CGST_OUTPUT`
   - Tally `SGST Output` → `AccountCode.SGST_OUTPUT`
   - Tally `IGST Output` → `AccountCode.IGST_OUTPUT`
   - Same for input. Unrecognized custom names → `OWNER_EQUITY` with flag for review.

5. **Atomicity:** Wrap in `prisma.$transaction`. All-or-nothing. Large files: batch into 500-voucher transactions.

#### API contract

**`POST /api/import/tally-xml`** — multipart with field `file`

Response:
- 200: `{ imported, skipped, flagged, partiesCreated, ledgersCreated }`
- 400: `{ error: "Invalid XML structure", details? }`
- 413: file too large (max 10MB v1)
- 401/403: standard

**`POST /api/import/tally-xml/preview`** — same request, returns counts without committing.

**Implementation:** `src/app/api/import/tally-xml/route.ts`, `.../preview/route.ts`.

**Constraints:**
- Tenant scoped
- Role: ADMIN only
- Rate-limit: 5 imports/hour/user (preview unlimited)
- File size cap: 10MB
- After success: call `recomputePartyBalance` for affected parties (already exists in `src/lib/accounting.ts`)

#### Acceptance criteria
- [ ] User uploads .xml from Settings → Import
- [ ] Preview shows accurate counts and issues before commit
- [ ] On confirm, vouchers imported atomically
- [ ] Duplicate detection prevents double-import (rerun → 0 imported)
- [ ] New parties created with correct type from `<LEDGER>` parent
- [ ] GST ledgers correctly mapped
- [ ] Unbalanced flagged in Settings → Issues, not silently dropped
- [ ] `Party.currentBalance` recomputed via `recomputePartyBalance`
- [ ] All imported entries pass balance check
- [ ] No data destruction — only adds
- [ ] **Round-trip: export from one tenant, import into fresh test tenant, balances match**

#### Edge cases
- Wrong tenant's file uploaded → no auto-detection possible; preview totals + explicit confirm = mitigation
- Custom ledger names not in chart of accounts → map to `OWNER_EQUITY`, flag
- Pre-Tally-Prime formats → document supported variants in `src/lib/tally/import.ts`
- Future-dated vouchers → allowed (post-dated cheques are common)
- Non-INR amounts → reject with clear error (Indian-only product)
- Voucher references ledger not in `<LEDGER>` masters → auto-create with inferred parent, flag

#### Out of scope
- Conflict resolution UI for non-duplicate but suspicious matches
- Bidirectional sync
- Excel import

#### Copy
| Element | Hinglish |
|---|---|
| Settings entry | Tally se Laao |
| Step 1 prompt | Tally file uthao (.xml) |
| Drag-drop hint | XML file yahan drop karo, ya choose karo |
| Step 2 title | Yeh sab milega |
| Step 2 confirm | Import sab kuch |
| Importing | Import ho raha hai... ruko |
| Done | Ho gaya ✓ — {n} vouchers add ho gaye |
| Warnings | {n} duplicates skip kiye / {n} entries flagged |
| File too large | File bahut bada hai (max 10 MB). CA ko split karne ko bolo. |
| Invalid XML | File sahi format mein nahi hai. Tally se dobara export karo. |

---

### 5.9 — First-time Setup Wizard

**Priority:** P1 (every new tenant goes through this; sets the trajectory of the entire account)

#### User story
> As a brand-new Dukandaar signing up, I want a single guided flow that captures my business info, GSTIN, parties, items, bank, and CA contact — with the ability to skip non-essential steps and finish later — so my account is usable from day 1.

#### Why we need this
The current onboarding (`src/components/onboarding/SetupWizard.tsx`) is sparse. The first run experience determines whether the user records their second bill. We invest 5-10 focused minutes upfront to save the user (and us) hours of confusion later.

The wizard must be skippable on every non-essential step. A user who closes the app mid-wizard must be able to resume where they left off, including auto-saved partials.

#### Entry point
- Triggered automatically on first login if `BusinessProfile.isOnboardingComplete !== true`
- Re-accessible from Settings → "Setup Wizard" (so users can finish skipped steps later)
- Route: `/onboarding` (under `(app)` group, layout doesn't show nav until `isOnboardingComplete === true`)

#### Steps

**Step 1 — Welcome + business basics (mandatory)**
```
Apna karobaar shuru karo

Business ka naam *           [_________________]
Business kya karta hai?       [Dropdown: Retail / Wholesale / Manufacturing / Service / Other]
State *                       [Dropdown: 36 Indian states + UTs]
City                          [_________________]

[Aage Badho →]
```

Required: name + state. Both used immediately for GSTIN lookup and bill generation.

**Step 2 — GSTIN (encouraged, skippable)**
```
GSTIN hai? (skip kar sakte ho)

GSTIN                        [22AAAAA0000A1Z5]   [Verify]
PAN                          [auto-filled from GSTIN]
Address (registered)         [auto-filled from GSTIN]

[← Wapas] [Skip] [Aage Badho →]
```

GSTIN format: 15 chars, regex `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z][Z][0-9A-Z]$`. Show inline validation as user types.

If `[Verify]` tapped: call `POST /api/onboarding/verify-gstin` which returns business name + address. **For v1 this is a stub that just validates format.** GSTN API integration is out of scope but the contract is in place for v2.

**Step 3 — Bank account (encouraged, skippable)**
```
Bank account jodo

Bank ka naam                 [Dropdown: SBI, HDFC, ICICI, Axis, Kotak, Punjab National, Bank of Baroda, ... Other]
Account holder name          [_________________]
Account number               [_________________]
IFSC                         [_________________]
Account type                 [Saving / Current]
Opening balance (optional)   [_________________]

Multiple accounts? [+ Aur jodo]

[← Wapas] [Skip] [Aage Badho →]
```

Used for §5.10 reconciliation later. Does NOT initiate any banking integration in v1 — purely metadata for matching.

**Step 4 — Parties (encouraged, can skip; but offer Tally import)**
```
Apne customers aur suppliers add karo

[+ Naya party manually]
[📁 Tally se import karo]   ← deep links to §5.8 import flow
[Skip — baad mein add karunga]

[Manual add panel: same as Parties screen add panel]

[← Wapas] [Aage Badho →]
```

Lets user batch-add multiple parties before continuing. Each manual add is the same form as §5.3 add panel.

**Step 5 — Items / SKUs (encouraged, can skip)**
```
Apne items / saman jodo

[+ Naya item manually]
[📁 CSV upload]                       ← parse a simple CSV: name, hsnCode, unit, rate, taxRate
[Skip — baad mein add karunga]

[Manual list of items added in this step]

[← Wapas] [Aage Badho →]
```

CSV format documented in helper text:
```
name, hsnCode, unit, rate, taxRate
Cotton Fabric, 5208, METRES, 180, 5
Silk Thread, 5403, METRES, 450, 12
```

**Step 6 — CA contact (skippable)**
```
Apne CA ka contact

CA ka naam                   [_________________]
Email                        [_________________]
Phone                        [_________________]

Yeh auto-fill ho jayega jab Tally file bhejna hoga.

[← Wapas] [Skip] [Aage Badho →]
```

Used in §5.7 export delivery.

**Step 7 — Review & finish**
```
Sab kuch sahi hai?

Business name        Sharma Cloth Store
State               Maharashtra
GSTIN               27AAAAA0000A1Z5     ✓
Bank accounts       2 added
Parties             8 added
Items               14 added
CA                  Pradeep Sharma (added)

Settings mein sab kuch baad mein edit kar sakte ho.

[← Wapas] [Karobaar Shuru Karo ✓]
```

On finish: `BusinessProfile.isOnboardingComplete = true`, redirect to `/dashboard` with a success toast "Sab ready hai! Pehla bill banao."

#### Auto-save + resume

Every step on `[Aage Badho]`: POST partial state to `/api/onboarding/state`. On wizard re-entry, load saved state and jump to last unfinished step.

`/api/onboarding/state` GET response:
```json
{
  "currentStep": 4,
  "completed": [1, 2, 3],
  "skipped": [],
  "data": { /* per-step partials */ }
}
```

#### Visual spec

- Full-screen wizard (no nav, no FAB) until step 7 completes
- Progress bar at top: `Step {n} of 7` + filled segments
- Each step content centered, max-width 480px on desktop, full on mobile
- Step navigation buttons at bottom, sticky on mobile
- "Skip" button for non-mandatory steps clearly visible but secondary styled (text button, not gradient)
- Logo + "HisaabKitaab" top-left
- Theme toggle top-right (some users prefer dark from the start)

#### API contracts

**`GET /api/onboarding/state`** — returns saved progress (tenant-scoped).

**`POST /api/onboarding/state`** — body `{ step, data }`. Persists partial state. Idempotent.

**`POST /api/onboarding/business-profile`** — body matches Step 1 + 2 fields. Creates/updates `BusinessProfile`.

**`POST /api/onboarding/bank-accounts`** — body `{ accounts: [...] }`. Bulk create.

**`POST /api/onboarding/parties`** — body `{ parties: [...] }`. Bulk create. Reuses `/api/parties` POST logic.

**`POST /api/onboarding/items`** — body `{ items: [...] }` or multipart with `file` (CSV). Bulk create / parse.

**`POST /api/onboarding/ca-contact`** — body matches Step 6.

**`POST /api/onboarding/complete`** — sets `isOnboardingComplete = true`. Triggers a welcome event (analytics).

**`POST /api/onboarding/verify-gstin`** — body `{ gstin }`. v1: validates format only. Returns `{ valid: bool, businessName?: string, address?: string }`. Stubbed for v2 GSTN integration.

All endpoints tenant-scoped via `resolveVerifiedTenantId`. Role: ADMIN only (the user creating the tenant).

#### Schema additions

May require new Prisma models. Verify against current schema first; create only what's missing.

```prisma
model BankAccount {
  id              String   @id @default(cuid())
  tenantId        String
  bankName        String
  accountHolder   String
  accountNumber   String   // store last-4 in plaintext for display, full encrypted if PII concerns
  ifsc            String
  accountType     BankAccountType
  openingBalance  Decimal  @default(0)
  isActive        Boolean  @default(true)
  isDeleted       Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@index([tenantId])
}

enum BankAccountType { SAVINGS CURRENT }
```

**Item / SKU model:** verify if it exists (Settings → Items implies it does). If yes, reuse. If no, create:
```prisma
model Item {
  id          String   @id @default(cuid())
  tenantId    String
  name        String
  hsnCode     String?
  unit        String   // METRES, KG, NOS, ...
  rate        Decimal
  taxRate     Decimal  // GST %
  isActive    Boolean  @default(true)
  isDeleted   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([tenantId])
}
```

**BusinessProfile additions:**
- `isOnboardingComplete: Boolean @default(false)`
- `caName String?`
- `caEmail String?`
- `caPhone String?`
- `gstin String?`
- `pan String?`

#### Acceptance criteria
- [ ] First login on a fresh tenant routes to `/onboarding` (not dashboard)
- [ ] All 7 steps render correctly mobile + desktop
- [ ] Required fields validated inline; submit disabled until valid
- [ ] Skip works on Steps 2, 3, 4, 5, 6 (not 1 or 7)
- [ ] Auto-save fires on every `[Aage Badho]`
- [ ] User who closes app mid-wizard resumes at last incomplete step
- [ ] GSTIN format validated; v1 doesn't call external API but the endpoint exists
- [ ] Bank accounts can be added multiple
- [ ] Parties can be added manually or via Tally import (deep-link to §5.8)
- [ ] Items can be added manually or via CSV upload
- [ ] CSV upload validates headers, shows error inline if malformed
- [ ] Review step accurately summarizes all entered data
- [ ] On finish: `isOnboardingComplete = true`, redirect to `/dashboard`, success toast
- [ ] User can re-enter wizard from Settings → "Setup Wizard" to fill skipped steps later
- [ ] Tenant isolation enforced on every onboarding endpoint

#### Edge cases
- User signs up but never completes wizard → `isOnboardingComplete = false`, redirected to `/onboarding` on every login until done. After 3 incomplete sessions, allow them to dismiss with "I'll do it later" — sets `onboardingDismissedAt` and shows a persistent banner on dashboard until completed.
- Existing tenant created before this wizard ships → `isOnboardingComplete` defaults `null`. Migration: backfill `true` for tenants with ≥1 bill (they're past onboarding) and `false` for tenants with 0 bills (offer them the wizard).
- CSV upload with malformed rows → parse what's valid, show summary "12 added, 3 skipped (errors)" with download of error CSV.
- User skips bank account in onboarding → bank reconciliation (§5.10) shows a soft prompt "Pehle bank account add karo" with deep link.
- User attempts to navigate to `/dashboard` directly during onboarding → middleware redirects back to current onboarding step.

#### Out of scope
- Importing parties from contacts/Google
- Image upload for business logo
- Multi-business / multi-branch in single tenant
- Real GSTN API integration (v2)
- Stripe/payment-gateway setup
- Team member invites (covered by existing Users settings)
- A/B testing of step order

#### Copy
| Element | Hinglish |
|---|---|
| Welcome | Apna karobaar shuru karo |
| Required marker | * — yeh fill karna zaroori hai |
| Skip | Skip — baad mein |
| Next | Aage Badho → |
| Back | ← Wapas |
| Verify GSTIN | Verify |
| Step 7 finish | Karobaar Shuru Karo ✓ |
| Success toast | Sab ready hai! Pehla bill banao. |
| Resume | Wapas se shuru karo |
| Step header (e.g. step 4) | Step 4 of 7: Customers aur Suppliers |

---

### 5.10 — Bank statement reconciliation

**Priority:** P1 (key competitive feature; without it, end-of-month is manual chaos)

#### User story
> As a Dukandaar, I want to upload my bank statement and have HisaabKitaab match each transaction to a payment I've already recorded, and let me categorize anything unmatched as a sale, purchase, expense, or transfer in one tap.

#### Why this matters
By month-end the books and the bank disagree. Manual reconciliation takes 4-6 hours per month for a small shop. Competitors (Vyapar, Khatabook, MoneyView) all have this. Without it, the Dukandaar cannot trust their own numbers.

#### Entry point
- Settings → "Bank Statement Reconcile" (primary)
- Dashboard banner at end of month (28th–5th of following month): "Bank statement reconcile karo — abhi tak nahi kiya"
- Payments page → header button "Reconcile Bank"

Mandatory prerequisite: **at least one bank account exists** (added during onboarding or Settings). If none, show prompt with deep-link to add bank.

#### The reconciliation flow

**Step 1: Upload**
```
Bank statement upload karo

Choose bank account:        [Dropdown: SBI ****4567 / HDFC ****2341]
Statement period:           [From: 2026-04-01]  [To: 2026-04-30]
Upload CSV file:            [📁 Choose file]    or drag-drop

Format: standard CSV from net banking (Date, Description, Debit, Credit, Balance)
Sample format:              [View sample CSV]
```

Supported banks (v1): SBI, HDFC, ICICI, Axis, Kotak, PNB, BoB. Each has slightly different CSV columns; we ship parsers for all 7 plus a "Generic CSV" fallback that asks the user to map columns.

**Step 2: Parse + auto-match**
Backend parses the CSV, runs the matching algorithm, returns the result.

```
Parsed: 142 transactions

✓ Auto-matched: 118 (83%)
? Need your help: 24

[Aage Badho →]
```

**Step 3: Review unmatched**

Each unmatched row presented with action chips:

```
┌──────────────────────────────────────────────────────┐
│ 15 Apr 2026  ·  CREDIT  ₹12,000                     │
│ "UPI/RAMESH/RAMESHCLOTH@OKICICI/UTR123"              │
│                                                      │
│ Yeh kya tha?                                         │
│ [💰 Sale]  [🛒 Purchase]  [💸 Expense]  [🔄 Transfer] │
│ [👁 Skip — baad mein]                                │
└──────────────────────────────────────────────────────┘
```

Tapping a category opens a small inline form:
- **Sale:** which party? amount auto-filled. Linked bill? Creates a Payment with direction=INCOMING.
- **Purchase:** similar, direction=OUTGOING.
- **Expense:** category dropdown (Rent, Salary, Utilities, Travel, Other) + optional party. Creates a Payment with direction=OUTGOING tagged as expense.
- **Transfer:** "From which account?" dropdown of own bank accounts. Creates a journal entry with internal-transfer voucher type.
- **Skip:** marks the row as `IGNORED` — doesn't create any record but won't reappear in future reconciliations.

Pattern recognition: if user categorizes "RAMESH/RAMESHCLOTH@OKICICI" once as Sale → Ramesh Cloth Store, the next time a similar UPI string appears, it's auto-suggested.

**Step 4: Confirm**
```
Reconcile summary:
✓ 118 auto-matched
✓ 24 categorized (you helped)

[Confirm — sab record karo]
```

On confirm: all categorizations create the corresponding `Payment` / `JournalEntry` records atomically. The bank statement upload is recorded as a `BankStatement` row with all `BankStatementRow`s linked.

**Step 5: Done**
```
Reconcile ho gaya ✓

This month bank ne dikhaya:    +₹4.2L  -₹2.8L
HisaabKitaab mein record:       +₹4.2L  -₹2.8L

Sab match hai!

[Dashboard pe jao]
```

If bank totals don't match HK totals (after reconciliation): clear message + drill-down into the discrepancy.

#### Matching algorithm

**Auto-match a bank row to a payment when ALL true:**
1. Amount matches within ₹1 tolerance (`Math.abs(bankAmount - paymentAmount) <= 1`)
2. Direction matches (bank credit ↔ INCOMING payment; bank debit ↔ OUTGOING)
3. Date proximity: payment date within ±3 calendar days of bank date
4. Bank description contains a substring match against party name or UPI ID (when available)

**If multiple candidates match:** pick the closest by date; if still tied, surface as ambiguous in Step 3.

**If zero candidates match:** unmatched, surface as Step 3 row.

Implementation in `src/lib/bank-reconciliation/match.ts`. Pure functions, easily testable.

#### CSV parsing per bank

Implementations in `src/lib/bank-reconciliation/parsers/`:
- `sbi.ts`, `hdfc.ts`, `icici.ts`, `axis.ts`, `kotak.ts`, `pnb.ts`, `bob.ts`, `generic.ts`

Each exports:
```ts
export function parse(csv: string): BankStatementRow[]
```

Test fixtures in `src/__tests__/fixtures/bank-statements/{bank}-sample.csv`.

#### Schema additions

```prisma
model BankStatement {
  id            String   @id @default(cuid())
  tenantId      String
  bankAccountId String
  bankAccount   BankAccount @relation(fields: [bankAccountId], references: [id])
  periodFrom    DateTime
  periodTo      DateTime
  uploadedAt    DateTime @default(now())
  rowCount      Int
  matchedCount  Int
  unmatchedCount Int
  isReconciled  Boolean  @default(false)
  rows          BankStatementRow[]
  @@index([tenantId])
}

model BankStatementRow {
  id              String   @id @default(cuid())
  tenantId        String
  statementId     String
  statement       BankStatement @relation(fields: [statementId], references: [id])
  date            DateTime
  description     String
  amount          Decimal
  direction       PaymentDirection  // INCOMING / OUTGOING
  rawLine         String   // original CSV line for audit
  matchedPaymentId String?
  matchedPayment  Payment? @relation(fields: [matchedPaymentId], references: [id])
  status          BankRowStatus
  category        String?  // for expenses: Rent / Salary / Utilities / ...
  @@index([tenantId])
  @@index([statementId])
}

enum BankRowStatus {
  PENDING
  AUTO_MATCHED
  MANUALLY_CATEGORIZED
  IGNORED
  AMBIGUOUS
}
```

#### API contracts

**`POST /api/reconcile/upload`** — multipart with `file`, `bankAccountId`, `periodFrom`, `periodTo`

Response:
```json
{
  "statementId": "...",
  "totalRows": 142,
  "autoMatched": 118,
  "unmatched": 24,
  "rows": [ /* full row data for Step 3 review */ ]
}
```

**`POST /api/reconcile/categorize`** — body `{ rowId, action: "SALE" | "PURCHASE" | "EXPENSE" | "TRANSFER" | "SKIP", details: {...} }`

Creates the corresponding Payment / JournalEntry. Updates `BankStatementRow.status`.

**`POST /api/reconcile/commit`** — body `{ statementId }`. Marks the statement as `isReconciled: true`, finalizes all rows.

**`GET /api/reconcile/statements`** — list past reconciliations.

**Constraints:**
- Tenant scoped, ADMIN/ACCOUNTANT only
- Rate-limit: 5 uploads/hour
- File size: 5MB max (CSV is text; this is generous)
- All ledger writes go through `src/lib/journal.ts` — never direct Prisma create on `JournalEntry`
- Atomicity per row: each categorize + commit is one transaction

#### Acceptance criteria
- [ ] User selects bank account, uploads CSV, sees parsed preview
- [ ] Auto-match correctly identifies ≥80% of rows for typical input
- [ ] Each unmatched row has 5 action chips (Sale/Purchase/Expense/Transfer/Skip)
- [ ] Categorizing creates Payment/JournalEntry via existing journal lib (preserves double-entry)
- [ ] Pattern recognition: same UPI string categorized → next occurrence pre-suggests
- [ ] Reconciled statement is read-only afterward (no edit)
- [ ] Discrepancy detection: if bank total ≠ HK total after reconciliation, show diff
- [ ] Past statements browsable via Settings → Reconciliation History
- [ ] CSV parsing works for all 7 supported banks
- [ ] Generic CSV fallback handles unknown bank with column mapper
- [ ] Tenant isolation enforced
- [ ] No data destruction on re-upload (duplicates blocked at row level: `(date, amount, description, statementId)` uniqueness)

#### Edge cases
- User uploads same statement twice → preview shows "All rows already imported in statement #abc"; offer to delete the old and re-import or cancel.
- Bank statement has rows for transactions before the user joined HK → categorize as Opening Balance adjustment via Journal voucher.
- UPI strings in different formats for same merchant → exact substring match fails. Pattern matching uses normalized form (strip @bank, UTR, special chars).
- Round-tripping (transfer A → B): both rows appear; user marks both as Transfer and points to each other.
- Currency in foreign denomination (NRE/NRO accounts) → reject with clear error.
- Cheque bouncing: bank shows credit then reversal. We import both; user marks reversal as expense (bank charges) or links to a "Bounced cheque" category.
- User uploads CSV from an unsupported bank → "Generic CSV" path with column mapper UI.

#### Out of scope
- PDF statement upload (different problem entirely)
- Real-time bank feed integration via Account Aggregator framework
- Auto-import on schedule (nightly fetch)
- Reconciling against credit card statements (different schema needed)
- Forex / multi-currency
- Cheque image upload + OCR

#### Copy
| Element | Hinglish |
|---|---|
| Settings entry | Bank Reconcile |
| Step 1 title | Bank statement upload karo |
| Step 2 result | {n} match ho gaye, {m} need help |
| Step 3 prompt | Yeh kya tha? |
| Step 3 actions | Sale / Purchase / Expense / Transfer / Skip |
| Step 4 confirm | Sab record karo |
| Done | Reconcile ho gaya ✓ |
| All match | Sab match hai! |
| Discrepancy | Kuch nahi mil raha — dekho [link] |
| Re-upload | Yeh statement pehle import ho chuka hai |
| Bank not supported | Apne bank ko CSV format mein export karo, ya Generic CSV use karo |

---

## 6. Design system reference

All new UI must use primitives from `src/components/ui/hk-design.tsx`. Do not introduce new card styles, color values, or font stacks.

### 6.1 Color tokens

| Token | Hex | Use |
|---|---|---|
| `OR` | `#f76000` | Primary action, alerts, "Diya" (money out), "Cancel" status |
| `PU` | `#7b5ef6` | Secondary, "Customer" type, accent |
| `GR` | `#00ca88` | Success, "Mila" (money in), "Final" status |
| `AM` | `#ffb020` | Warning, "Draft" status, "Pending" |

Theme-aware surface variables (in `src/app/globals.css`):

| Variable | Light | Dark |
|---|---|---|
| `--hk-bg` | `#eef0f8` | `#0d0d1b` |
| `--hk-card` | `#ffffff` | `#161628` |
| `--hk-border` | `rgba(0,0,0,0.07)` | `rgba(255,255,255,0.07)` |
| `--hk-text` | `#0d0d1b` | `#e2e4f0` |
| `--hk-sub` | `#666a82` | `#888ea8` |
| `--hk-muted` | `#aab0c8` | `#40445a` |
| `--hk-pill` | `rgba(0,0,0,0.05)` | `rgba(255,255,255,0.07)` |
| `--hk-pill-active` | `#e8eaf5` | `#1e1e3a` |
| `--hk-badge` | `rgba(0,0,0,0.05)` | `rgba(255,255,255,0.06)` |
| `--hk-input` | `rgba(0,0,0,0.04)` | `rgba(255,255,255,0.04)` |
| `--hk-line` | `rgba(0,0,0,0.05)` | `rgba(255,255,255,0.05)` |

**Always reference these via `var(--hk-...)`.** Hard-coding hex breaks dark mode.

### 6.2 Typography

| Family | Variable | Use |
|---|---|---|
| Space Grotesk | `var(--font-space-grotesk)` (alias `SG`) | UI labels, headings, body |
| Inter | `var(--font-inter)` (alias `IN`) | Numerals, currency amounts |

### 6.3 Components (from `@/components/ui/hk-design`)

| Export | Use |
|---|---|
| `HKCard` | Rounded surface card |
| `StatusChip` | Bill status pill |
| `HKToast` | Floating toast |
| `SearchBox` | Search input |
| `PillFilter<T>` | Generic pill filter group |
| `PageHeader` | Standard page title + action |
| `GradientButton` | Primary CTA (orange-purple or green) |
| `fmt(n)` | Currency abbrev |
| `fmtFull(n)` | Full currency |
| `useIsMobile()` | Boolean hook for `< 768px` |

Color/font constants also exported (`OR`, `PU`, `GR`, `AM`, `SG`, `IN`).

### 6.4 Type scale (readability for middle-aged users)

The Dukandaar persona skews 40–60+ with near-universal presbyopia (see §2.1). All sizes here assume **readable without reading glasses in dim shop light**. Use the `TYPE` constant exported from `hk-design.tsx`; do not hard-code px values for text.

| Token | Size | Use |
|---|---|---|
| `TYPE.h1` | 28px (desktop) / 22px (mobile) | Page titles |
| `TYPE.h2` | 18px | Card titles, section headings |
| `TYPE.bodyLarge` | 17px | Primary content blocks, key stats |
| `TYPE.body` | 15px | Standard body text, list items |
| `TYPE.bodySmall` | 14px | Dense lists, secondary descriptions |
| `TYPE.label` | 14px | Form labels, secondary text |
| `TYPE.caption` | 12px | Captions, footnotes — **absolute floor** |
| `TYPE.numLarge` | 28px | Dashboard hero numbers |
| `TYPE.numMedium` | 18px | Amount fields, list amounts |
| `TYPE.numSmall` | 15px | Inline currency/numbers |
| `TYPE.chip` | 12px | Pills, status chips |
| `TYPE.navLabel` | 12px | Bottom nav labels |

Rules that compound the scale:

1. **No text below 12px, ever.** If you need it that small, you don't need it.
2. **Body text font-weight ≥ 500.** 400-weight reads faded. Numbers (Inter) stay 700+ for currency.
3. **Line-height 1.5 for body paragraphs**, 1.3 for headings, 1.0–1.1 for tight numbers.
4. **Avoid uppercase** except very short labels (1–2 words). Uppercase is harder to read with presbyopia. When used, set `letterSpacing: 0.5–0.7px` and never below 12px.
5. **High-contrast pairing.** `var(--hk-text)` on `var(--hk-card)` is fine. `var(--hk-muted)` is for tertiary only — never for anything the user must read to act.
6. **Increase contrast for warnings/errors.** Use full `OR` color, not tinted.

### 6.5 Spacing & sizing

- Card border-radius: 20 (large), 14 (medium), 10 (small/inputs), 8–9 (chips)
- Card padding: 22 (default — bumped from 20 for the older audience), 16 (compact)
- Row padding (list items): 16px vertical (bumped from 13)
- Page padding: `16px 14px` mobile, `24px 28px` desktop
- Mobile bottom-padding: `90px` (clears bottom nav + FAB)
- Icon button: 36–40px (bumped from 32–36)
- **Min touch target: 48×48px for primary actions, 44×44px for secondary.** Was 44 across the board; bumped because dirty/imprecise hands + reduced near vision compound.
- Inter-element spacing: minimum 12px between independent tap targets (to avoid mis-taps).

### 6.6 Motion

- Hover/state: `0.15s`
- Theme switch: `0.25s`
- Section show/hide: `0.2s` ease
- Sheet slide-in: `0.3s` ease-out
- Skeleton: HeroUI default

Avoid spring physics or bouncy easing.

---

## 7. Copy guidelines

### 7.1 Principles
1. **Clarity > vibe.** "Final" beats "Pakka" if either is ambiguous.
2. **Verbs the user says out loud.** Banao, Likho, Dekho, Bhejo. Never Submit, Validate, Process.
3. **Numbers in Indian locale always.** Use `fmt`/`fmtFull`. ₹1,52,345 — never $152,345 or 152345.
4. **Errors are advisories, not accusations.** "Phone sahi nahi lagta" not "Invalid phone number."
5. **Empty states sell the next action.** Always include a button or guidance.
6. **No English jargon imports.** Translate Ledger, Reconcile, Allocate, Aggregate, Posting.

### 7.2 Word list (canonical)

| Concept | Word | Don't use |
|---|---|---|
| Money received | Mila / Wapasi | Receipt, Income |
| Money paid out | Diya | Disbursement, Outgoing |
| Outstanding | Lena Baki / Baaki | Receivable |
| Payable | Dena Baki | Payable, Liability |
| Customer | Grahak | Customer (in body) |
| Vendor | Supplier | Vendor |
| Bill | Bill | Invoice (only formal exports) |
| Final/posted | Final | Pakka |
| Draft | Draft | Adhoora |
| Cancel | Cancel | Raddh |
| Add | Jodo | Add (verb) |
| Make/Create | Banao | Generate, Create |
| Save | Save / Rakho | Submit, Persist |
| Done | Ho gaya ✓ | Successfully completed |
| Reconcile | Reconcile / Match | Reconciliation (noun) |
| Match | Match | Matched (past tense awkward) |
| Send to CA | CA ko Bhejo | Forward to Accountant |
| Tally export | Tally ko Bhejo | Generate Tally File |
| Tally import | Tally se Laao | Import from Tally |
| GSTIN | GSTIN | GST Number (use GSTIN, it's specific) |

### 7.3 Tone
Warm but not familiar (no "bro", "yaar"). Confident, not apologetic. Action-oriented.

---

## 8. Technical constraints

### 8.1 Hard rules (from `AGENTS.md` — read it)

- **Tenant isolation:** Every new query uses `await resolveVerifiedTenantId(request)` from `@/lib/session-server`. Legacy `resolveTenantIdFromRequest` is deprecated.
- **Observability:** No `console.error/log/warn`. Use `logError`, `logInfo`, `logWarn` from `@/lib/observability`.
- **No raw SQL** except `pg_advisory_xact_lock`.
- **No data destruction.** No `prisma migrate reset`, no `DROP`, no unscoped `deleteMany`.
- **TypeScript strict.** No `any`, no `@ts-ignore`.
- **Tally compatibility.** Backend journal-touching changes preserve double-entry balance and `tallyGroup` mapping.
- **No interactive flags** (`-i`) when running CLI.

### 8.2 Routing

App router under `src/app/`. Route groups: `(app)` for authed, `(auth)` for login, `(public)` for landing, `(onboarding)` for the wizard (NEW — sibling to `(app)`).

URL conventions:
- `/parties?filter=overdue&sortBy=balance` — filter + sort
- `/parties?addNew=true` — auto-open add panel
- `/onboarding/{step}` — wizard step
- `/settings/tally-export` and `/settings/tally-import` — Tally screens
- `/settings/reconcile` — bank reconciliation entry

### 8.3 API conventions

- Success: `{ data }` or `{ resource: ... }`. Match the endpoint you're extending.
- Error: `{ error: string }`
- Status codes: 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 413 payload too large, 422 valid but rejected, 500 unexpected.
- Mutations rate-limited via `await checkRateLimit(request, "key", limit)` from `@/lib/api-rate-limit`.
- Long-running operations (>5s): return 202 with a job ID; client polls `/api/jobs/{id}`. Applies to large Tally exports/imports.

### 8.4 Performance budget

Target: Dashboard + first interaction usable on Moto G (4GB RAM) over 4G in <3s.

- No new client-side libs unless replacing something larger.
- API responses for redesigned screens: <500ms p95.
- Tally export (1 year of data, ~1k vouchers): <2s p95.
- Tally import (1k vouchers): <10s p95.
- Bank reconciliation parse + match (200 rows): <3s p95.

### 8.5 Accessibility

- Icon-only buttons must have `aria-label`.
- Color contrast: AA minimum (verified for both themes).
- Touch targets: 44×44px min.
- Status chips: convey by both color AND text.
- Modal/sheet focus-trap, Escape-to-close.

### 8.6 Testing

Stack: `vitest`. Tests in `src/__tests__`.

Per-feature test requirements:
- Unit: pure functions (matching algorithm in §5.10, XML emission in §5.7, parser per bank in §5.10)
- Integration: API endpoints with mocked Prisma
- Round-trip: §5.7 export → §5.8 import into fresh tenant, balances match
- Real-world fixture: Tally Prime sample XML, real bank CSVs (anonymized)

Tests should not assert pixel/style values — assert behavior and structure.

### 8.7 Tally compatibility (mandatory reading for §5.7, §5.8)

This is the canonical reference for AI agents implementing Tally I/O. Most also covered in `AGENTS.md`; restating in PRD context.

**Schema mapping:**

| HK model field | Tally XML element | Notes |
|---|---|---|
| `JournalEntry.voucherType` | `<VOUCHERTYPENAME>` | See voucher mapping below |
| `JournalEntry.entryDate` | `<DATE>YYYYMMDD</DATE>` | IST always |
| `JournalEntry.narration` | `<NARRATION>` | Truncate to 4000 chars (Tally limit) |
| `Bill.billNumber` | `<VOUCHERNUMBER>` | Sales/purchase only |
| `Party.name` | `<PARTYLEDGERNAME>` | Exact match, no transform |
| `JournalLine.accountName` | `<LEDGERNAME>` | Inside `<ALLLEDGERENTRIES.LIST>` |
| `JournalLine.amount` (debit) | `<AMOUNT>{n}</AMOUNT>` + `<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>` | Positive, treated as debit |
| `JournalLine.amount` (credit) | `<AMOUNT>{n}</AMOUNT>` + `<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>` | Positive, treated as credit |

**Voucher type mapping:**

| HK `voucherType` | Tally `VOUCHERTYPENAME` |
|---|---|
| `SALES` | `Sales` |
| `PURCHASE` | `Purchase` |
| `RECEIPT` | `Receipt` |
| `PAYMENT` | `Payment` |
| `JOURNAL` | `Journal` |
| `TRANSFER` (NEW from §5.10) | `Contra` |

**AccountCode → Tally group mapping:**

| `AccountCode` | `tallyGroup` |
|---|---|
| `SALES` | Sales Accounts |
| `PURCHASE` | Purchase Accounts |
| `SUNDRY_DEBTORS` | Sundry Debtors |
| `SUNDRY_CREDITORS` | Sundry Creditors |
| `CASH` | Cash-in-Hand |
| `BANK` | Bank Accounts |
| `UPI` | Bank Accounts |
| `CGST_OUTPUT` | Duties & Taxes |
| `SGST_OUTPUT` | Duties & Taxes |
| `IGST_OUTPUT` | Duties & Taxes |
| `CGST_INPUT` | Duties & Taxes |
| `SGST_INPUT` | Duties & Taxes |
| `IGST_INPUT` | Duties & Taxes |
| `OWNER_EQUITY` | Capital Account |
| `OPENING_BALANCE` | Opening Balance |

**Indian Financial Year:**
- Apr 1 → Mar 31
- Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar
- `getCurrentFinancialYearRange()` from `src/lib/journal-reporting.ts`

**GST treatment:**
- Intra-state: CGST + SGST 50/50
- Inter-state: IGST full
- `JournalEntry.isInterState` is canonical — don't recompute

**Amount precision:**
- Store as Prisma `Decimal`, NOT JavaScript number
- Emit as plain decimal, 2 places, no symbol/separators
- Negative amounts never used; sign via `ISDEEMEDPOSITIVE`

**Reserved Tally ledger names** (cannot be used for parties/custom):
`Cash`, `Sales`, `Purchase`, `CGST`, `SGST`, `IGST`, `CGST Output`, `SGST Output`, `IGST Output`, `CGST Input`, `SGST Input`, `IGST Input`

Conflict resolution: append " (Party)" suffix during export.

**Existing endpoints (do not modify):**
- `GET /api/export/transactions` — CSV
- `GET /api/export/party-ledger` — CSV
- `GET /api/export/trial-balance` — CSV

These coexist with new XML endpoints. CSV stays for ad-hoc analysis.

### 8.8 Migration safety

- Schema changes are additive only (new tables/columns; never drops)
- New columns get sensible defaults so existing rows aren't broken
- API extensions: new params are optional with backward-compatible defaults
- For models added (`BankAccount`, `BankStatement`, `BankStatementRow`, optional `Item`):
  1. Add to `prisma/schema.prisma`
  2. Run `npx prisma db push` (NOT `migrate dev` — agents can't be interactive)
  3. Run `npx prisma generate`
- Verify with `npx prisma db pull` that schema matches what we expect before adding new models

---

## 9. Phasing & rollout

### Order of implementation

Build in this order. Each is independently shippable.

| # | Feature | Why this order | Effort |
|---|---|---|---|
| 1 | §5.6 Plain-language audit | Sets correct copy that subsequent features inherit | ~1h |
| 2 | §5.1 Overdue banner | Smallest high-impact win + warms up API extension pattern | ~3h |
| 3 | §5.2 Bills summary reframe | Medium; another API extension; pairs naturally with §5.1 | ~3h |
| 4 | §5.3 Parties sort + actions | Largest UX feature; defines patterns for §5.10 | ~5h |
| 5 | §5.4 Pending payments pinned | Mostly client-side after §5.3 patterns established | ~3h |
| 6 | §5.5 Smart FAB | Tiny; needs §5.4 in place to wire the Payment option | ~2h |
| 7 | §5.7 Tally Export | Highest strategic value of new features; standalone | ~12h |
| 8 | §5.9 Setup Wizard | Long-tail UX; can ship to new tenants only first | ~16h |
| 9 | §5.10 Bank reconciliation | Needs schema additions + per-bank parsers | ~20h |
| 10 | §5.8 Tally Import | One-time use; less urgent than export | ~14h |

**Total estimate:** ~80 hours of focused work. Real time: ~3 weeks for one engineer.

### Per-feature ship checklist

- [ ] `npx tsc --noEmit` passes with zero new errors
- [ ] `npx eslint --quiet <changed files>` is clean
- [ ] `npx vitest run` passes
- [ ] Manual smoke test on Chrome DevTools mobile emulation (Moto G size, slow 4G)
- [ ] Both light and dark themes verified
- [ ] Empty / loading / error / success states render correctly
- [ ] AGENTS.md rules respected (tenant scoping, observability, no raw SQL)
- [ ] Acceptance criteria checked off in this doc

### Migration safety
None of the §5.1–§5.6 features change schema. §5.7 / §5.8 are read-only from journal's perspective. §5.9 adds optional columns + 2 new tables. §5.10 adds 2 new tables.

API extensions are additive — new params with defaults that match current behavior.

### Feature flags

Use existing `src/lib/feature-flags.ts`. Suggested flags during rollout:
- `tallyExport: true` (ship enabled)
- `tallyImport: false` (ship disabled to first cohort, enable progressively)
- `bankReconciliation: false` (ship disabled until parsers tested across all 7 banks)
- `setupWizardV2: true` (new tenants always)

---

## 10. Success metrics

Measurable post-ship via product analytics. Set up if missing.

| Goal | Metric | Target |
|---|---|---|
| G1 | Time to record first payment after dashboard load | <10s median |
| G2 | % sessions viewing Parties or Bills within 30s of opening | +20% from baseline |
| G3 | Tap rate on Call/WhatsApp buttons (active users, weekly) | ≥30% within 4 weeks of release |
| G4 | Mark-complete rate on pending payments | +50% throughput |
| G5 | Support tickets containing "Raddh", "Pakka" | ↓ to ≈0 |
| G6 | Tally exports per active tenant per month | ≥1 |
| G7 | Tally import completion rate (start → finish) | ≥80% |
| G8 | Onboarding wizard completion rate (signup → finish) | ≥75% |
| G9 | Bank reconciliation auto-match rate | ≥80% |
| G9' | Time to reconcile 100-line statement | <10 min (vs 4h manual) |

Qualitative: 5 Dukandaars in user testing should describe the redesigned screens as "asaan" / "saaf" without prompting. 3 CAs should accept the Tally export with zero manual re-entry.

---

## 11. Open questions

Defaults shown; flag to product if any block you.

1. **Definition of "overdue":** 30 days since last payment vs 30 days since bill date. **Default: since last payment.**
2. **Desktop FAB equivalent:** Quick Add menu on desktop too? **Default: not this iteration.**
3. **WhatsApp template customization:** Settings screen for reminder template? **Default: hard-coded in v1.**
4. **Pending payment urgency tiers:** "expected >7 days" visually distinct? **Default: single state.**
5. **Sort persistence:** localStorage vs URL only? **Default: URL.**
6. **GSTN API integration:** v1 stub or wire it now? **Default: stub; v2 integrates.**
7. **Bank statement PDF support:** include in v1? **Default: no — CSV only.**
8. **Reconciliation auto-match threshold:** ₹1 vs ₹10 amount tolerance? **Default: ₹1 (strict).**
9. **Setup wizard mandatory minimum:** which steps absolutely required? **Default: only Step 1 (business basics) and Step 7 (review).**
10. **Tally export auto-schedule:** weekly/monthly auto-email to CA? **Default: not in v1; manual only.**
11. **Bank account number storage:** plaintext or encrypted? **Default: store last 4 plaintext for display, full number encrypted at rest. Verify with security review before shipping.**

---

## 12. Out of scope (explicit list)

To prevent scope drift, these are *not* part of this PRD even though they may seem related:

- Reports rework (Reports page exists, not redesigned here)
- Purchases rework
- Notes / Measurements
- New Bill flow internals
- Onboarding wizard A/B tests
- Bulk operations (bulk-mark-complete, bulk-reminder, bulk-categorize)
- Email/SMS notifications
- Voice input or OCR
- Multi-language UI (beyond Hinglish defaults)
- Dashboard chart additions
- Native mobile app (responsive web only)
- Custom theme colors per tenant
- Tally Connect / Tally.NET API
- Bidirectional Tally sync
- PDF bank statement parsing
- Account Aggregator framework integration
- Real GSTN API integration
- Stripe / payment-gateway setup
- Multi-business / multi-branch in single tenant
- Excel / Google Sheets import
- Image upload (logos, receipts)
- Cheque image OCR
- Forex / multi-currency
- Credit card statement reconciliation

If a request to add any of the above lands during implementation, **stop and confirm scope** before proceeding.

---

## 13. Tally Compatibility Reference (Appendix)

Deep technical reference for §5.7 and §5.8 implementers. AI agents implementing these features should read this section in full.

### 13.1 Sample voucher: Sales (intra-state, 18% GST)

Bill of ₹52,000 (incl. GST) to Ramesh Cloth Store, both buyer and seller in Maharashtra:
- Subtotal: ₹44,067.80
- CGST 9%: ₹3,966.10
- SGST 9%: ₹3,966.10
- Total: ₹52,000.00

```xml
<TALLYMESSAGE>
  <VOUCHER VCHTYPE="Sales" ACTION="Create">
    <DATE>20260415</DATE>
    <NARRATION>Bill B-2604-001 to Ramesh Cloth Store</NARRATION>
    <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
    <VOUCHERNUMBER>B-2604-001</VOUCHERNUMBER>
    <PARTYLEDGERNAME>Ramesh Cloth Store</PARTYLEDGERNAME>
    <BASICBUYERNAME>Ramesh Cloth Store</BASICBUYERNAME>
    <PLACEOFSUPPLY>Maharashtra</PLACEOFSUPPLY>

    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>Ramesh Cloth Store</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <AMOUNT>-52000.00</AMOUNT>
      <BILLALLOCATIONS.LIST>
        <NAME>B-2604-001</NAME>
        <BILLTYPE>New Ref</BILLTYPE>
        <AMOUNT>-52000.00</AMOUNT>
      </BILLALLOCATIONS.LIST>
    </ALLLEDGERENTRIES.LIST>

    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>Sales</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>44067.80</AMOUNT>
    </ALLLEDGERENTRIES.LIST>

    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>CGST Output</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>3966.10</AMOUNT>
    </ALLLEDGERENTRIES.LIST>

    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>SGST Output</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>3966.10</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
  </VOUCHER>
</TALLYMESSAGE>
```

Sum check: -52000 + 44067.80 + 3966.10 + 3966.10 = 0 ✓

### 13.2 Sample voucher: Receipt (UPI payment)

Receipt of ₹15,000 from Ramesh Cloth Store via UPI:

```xml
<TALLYMESSAGE>
  <VOUCHER VCHTYPE="Receipt" ACTION="Create">
    <DATE>20260420</DATE>
    <NARRATION>UPI payment from Ramesh</NARRATION>
    <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
    <VOUCHERNUMBER>R-2604-005</VOUCHERNUMBER>

    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>UPI</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>15000.00</AMOUNT>
    </ALLLEDGERENTRIES.LIST>

    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>Ramesh Cloth Store</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <AMOUNT>-15000.00</AMOUNT>
      <BILLALLOCATIONS.LIST>
        <NAME>B-2604-001</NAME>
        <BILLTYPE>Agst Ref</BILLTYPE>
        <AMOUNT>-15000.00</AMOUNT>
      </BILLALLOCATIONS.LIST>
    </ALLLEDGERENTRIES.LIST>
  </VOUCHER>
</TALLYMESSAGE>
```

### 13.3 Sample voucher: Inter-state Sales (IGST)

Same bill, but to a Karnataka customer:

```xml
<ALLLEDGERENTRIES.LIST>
  <LEDGERNAME>IGST Output</LEDGERNAME>
  <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
  <AMOUNT>7932.20</AMOUNT>
</ALLLEDGERENTRIES.LIST>
```

(Replaces both CGST and SGST lines. `<PLACEOFSUPPLY>Karnataka</PLACEOFSUPPLY>` flags it as inter-state for Tally.)

### 13.4 Master ledger creation block

Emit BEFORE any voucher referencing the ledger:

```xml
<TALLYMESSAGE>
  <LEDGER NAME="Ramesh Cloth Store" ACTION="Create">
    <PARENT>Sundry Debtors</PARENT>
    <ISBILLWISEON>Yes</ISBILLWISEON>
    <OPENINGBALANCE>0.00</OPENINGBALANCE>
    <PARTYGSTIN>27AAAAA0000A1Z5</PARTYGSTIN>
  </LEDGER>
</TALLYMESSAGE>
```

For non-party ledgers (Sales, CGST Output, etc.):

```xml
<TALLYMESSAGE>
  <LEDGER NAME="Sales" ACTION="Create">
    <PARENT>Sales Accounts</PARENT>
    <ISBILLWISEON>No</ISBILLWISEON>
  </LEDGER>
</TALLYMESSAGE>
```

### 13.5 Tally import quirks

Things that bite during import implementation:

1. **Tally is case-sensitive on ledger names.** "Ramesh Cloth Store" ≠ "RAMESH CLOTH STORE". Preserve casing exactly.
2. **`<DATE>` format MUST be YYYYMMDD with no separators.** `2026-04-15` will silently fail in some Tally versions.
3. **`<ISDEEMEDPOSITIVE>Yes</>` means CREDIT in Tally.** Counterintuitive — Tally's "deemed positive" refers to a ledger's natural sign, which for Sundry Debtors is positive on credit side.
4. **Voucher numbers must be unique within a voucher type.** If the source has duplicates, Tally rejects the second.
5. **`<PLACEOFSUPPLY>` is required for GST vouchers.** Use the buyer's state for Sales, seller's for Purchase.
6. **`<BILLALLOCATIONS.LIST>` is how you link payments to bills.** `New Ref` for new outstanding, `Agst Ref` to settle existing, `On Account` for unallocated.
7. **Tally Prime adds a `<COMPANYNAME>` envelope element** that older Tally ignores — emit it for forward compat.
8. **Unicode in narrations:** Tally supports UTF-8 since Tally Prime; older Tally chokes on Devanagari. Default to ASCII / Hinglish in `<NARRATION>` to maximize compat.

### 13.6 Round-trip test

A round-trip test (export → fresh tenant import) verifies idempotency. Add this as a CI gate:

```ts
// src/__tests__/tally-roundtrip.spec.ts
test("export then import preserves balances", async () => {
  const tenantA = await seedTenant({ bills: 10, payments: 5, parties: 4 });
  const xml = await exportTally(tenantA.id);
  const tenantB = await createEmptyTenant();
  await importTally(tenantB.id, xml);
  expect(await getTrialBalance(tenantB.id))
    .toEqual(await getTrialBalance(tenantA.id));
});
```

---

*End of PRD. When this work ships, archive this file to `docs/archive/` and write the next iteration's PRD as a new file. Don't edit shipped specs in place.*
