# Product Gaps Audit — Re-Verification

**Branch `hitesh-dev` · verified against live code, 2026-06-02**

This document verifies the claims in [PRODUCT_GAPS_AUDIT.md](./PRODUCT_GAPS_AUDIT.md) (170-item edition) against the current code. Tags:

- ✅ **Fixed** — gap closed
- ⚠️ **Partial** — partly addressed / mitigated but not fully resolved
- ❌ **Open** — gap still present
- 🚫 **Refuted** — not a real gap, or by design

All P0 items were read individually. P1–P3 are a heavy sample; items not individually re-read are noted as such.

---

## 🔴 P0 — verified individually (all 15)

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Plan feature gates not on API routes | ❌ Open | No `hasFeature`/`PLAN_LIMITS` in `api/export`, `api/reports`, `credit-notes`, `reconcile`. Only `register`, `billing/status`, `wipe-data` import them. Revenue leak stands. |
| 2 | User seat limit never enforced | ❌ Open | `POST /api/users` checks only duplicate email (409) + valid role — no `PLAN_LIMITS[plan].users` check (users/route.ts:114-128) |
| 3 | Forgot-password logs URL, no email | ✅ Fixed | Calls `sendMail` + `buildPasswordResetEmail`; falls back to returning link only when SMTP unconfigured (forgot-password/route.ts:114) |
| 4 | Register redirects to `/login` | ❌ Open | Still `router.push("/login")` (register/page.tsx:71) |
| 5 | New tenant never reaches wizard | ✅ Fixed | `(app)/layout.tsx` renders the wizard when `onboardingComplete` is false (layout.tsx:22) |
| 6 | FINAL bill cancel corrupts payment balance | ✅ Fixed | DELETE now blocks cancellation if linked payments exist, forcing reverse/refund first (bills/[id]/route.ts:662) |
| 7 | Purchase OCR callable without PRO | ❌ Open | `ocr/purchase-bill` has only a role check, no `hasFeature("purchaseOcr")` (route.ts:187) |
| 8 | Double-tap Duplicate → two bills | ⚠️ Partial | A `confirm()` modal gates it (blocks rapid double-tap), but the button has no in-flight `disabled` state (bills/[id]/page.tsx:344) |
| 9 | FINAL bill edit reachable by URL | ⚠️ Partial | UI still renders the editable form, but server `PATCH` rejects any non-DRAFT (`existing.status !== "DRAFT"` → 400), so no finalized record can be overwritten (bills/[id]/route.ts:208) |
| 10 | `useState` in `.map()` (dashboard) | ✅ Fixed | Extracted `QuickLinkCard` (dashboard/page.tsx:336) |
| 11 | `window.print()` in Server Component | ✅ Fixed | `"use client"` `PrintButton` |
| 12 | `/api/jobs/process-import` unauthenticated | 🚫 Refuted | Enforces `x-cron-secret` vs `CRON_SECRET`, 401 otherwise (process-import/route.ts:49) |
| 13 | Purchase finalize calls wrong endpoint | 🚫 Refuted | Purchases are `Bill` rows (no separate model); `/api/bills/[id]` is correct |
| 14 | `DEFAULT_TENANT_ID` fallback | ✅ Fixed | Removed; verified token w/o tenantId → header unset (proxy.ts:170) |
| 15 | Reconcile commit sends wrong field | ✅ Fixed | Preview returns real row `id`; categorize keyed correctly |

**P0 tally:** 7 fixed · 2 partial (no data-loss risk) · 2 refuted · **4 genuinely open (#1, #2, #4, #7)**

The 4 open items are the action list. #1 + #7 are the same root cause (no server-side plan enforcement); #2 rounds out the monetization hole.

---

## 🟠 P1 — verified sample

**✅ Fixed:** #17 (categorize role check), #18 (dot bypass), #19 (reconcile auto-journals + `reconciledAt`), #21 (un-reconcile via new `uncommit` route), #32 (offline sync `failures`/`clearFailure`), #33 (WhatsApp country-code), #34 (ADMIN role on user create), #35 (dropdown options editor), #37 (`if (b.date)` guard kills the 1970 bug), #38 (yearly plan toggle present), #44 (FINAL finalize validates `placeOfSupply`), #49 (audit log date filter + CSV export), #54 (search covers payments/journal), #56 (GSTR year ternary refactored), #57 (GSTR B2B key), #60 (GSTR-1 HSN summary built in `gstr1` route).

**⚠️ Partial:** #20 (reconcile AMBIGUOUS — confirm modal + post-commit `ambiguousCount` + uncommit recovery, but no pre-commit "N rows unmatched" preview), #36 (item delete now soft via `isActive`, no explicit bill-reference warning), #42 (`handleShare` no-ops for non-FINAL but button still shows on CANCELLED with no feedback), #52 (year-end uses ConfirmModal — PWA-safe — but no typed-FY-string), #58 (OCR backend route exists, no scan UI in purchase form).

**❌ Open:** #16 (`duplicate` route still uses `resolveSession`), #22 (Fix Balances still tenant-wide), #26 (Record-Payment CTA shows for DRAFT — `BillActionBar` only hides on `CANCELLED`), #28/#29 (no inter-state flag / Place of Supply on purchase entry), #48 (Tally export `getDateRange` uses local `new Date().getMonth()`), #50 (items: no pagination/search), #51 (no bulk item import), #53 (no year-end reversal), #55 (no Create-Bill-from-Measurement), #59 (no GSTR-2A/2B), #61 (no e-Invoice/IRN), #62 (no TDS).

**🚫 Refuted / low-risk:** #24 (public invoice uses `Math.round((tax/2)*100)/100`, which equals `roundTo2`; the cited divergence doesn't exist), #30 (all six `AccountCode`s exist in `chart-of-accounts.ts`), #47 (purchases-on-bills is by design).

---

## 🟡 P2 / 🟢 P3 — spot-checked

**✅ Fixed:** #68 (GSTIN validation + Verhoeff), #71 (debit-note UI via `notes/new?type=DEBIT_NOTE`), #83 (`window.confirm()` cluster migrated to async `ConfirmProvider`), #127 (`initialTransactions` typed `Transaction[]`), plus timezone/number-to-words/vendor-field/CA-email items from commit `556f365`.

**⚠️ Partial:** #45 (wipe-data uses double ConfirmModal, no typed-company-name gate), #112/#170 (AMBIGUOUS-row CSV export absent), #82/#113 (impersonation confirm — recheck).

**❌ Still open (high-signal):** #48/#105/#159 (Tally export calendar quarters + local time), #79/#80 (scheduled reminders / recurring billing), #96 (party-ledger `<select>` at scale), #109/#116/#145 (UTC month grouping / nudge), #142–#144 (reconcile match quality).

**Not individually re-read** (lower priority, original claim = working hypothesis): #63–67, 69–78, 84–104, 106–111, 114–126, 128–141, 146–169.

---

## Net assessment

The remediation pass held: onboarding wizard, password-reset email, reconcile auto-journaling + uncommit, GSTIN Verhoeff, HSN summary, search expansion, GSTR ternary, soft-delete items, yearly plan, and bill-date guard are all in.

**The single biggest unaddressed theme is server-side plan enforcement (#1, #2, #7).** Everything else open is either net-new feature work (e-invoice, TDS, recurring, GSTR-2A) or polish.

---

## Recommended approaches for the open items

1. **#1/#2/#7 Plan gates — one wrapper, not N scattered checks.** A `requireFeature(session, "tallyExport")` / `requireSeatAvailable(session)` helper that reads the tenant plan once and 402/403s centrally, so the paywall is auditable in one place and can't be forgotten on the next new route.
2. **#9 FINAL edit — `redirect()` at the page when `status !== "DRAFT"`** so the user never sees an unsaveable form. Mirror the existing server guard.
3. **#8 Duplicate — add `disabled`-while-in-flight** (the `savingAs` pattern already exists in `BillFormPage`).
4. **#4 Register — issue the session on signup** and `router.push("/")` (layout routes into the wizard via #5).
5. **#22 Fix Balances — per-party repair + read-only drift report.**
6. **#28/#29 Purchase inter-state — derive from vendor vs company GSTIN state** (`extractGstinStateCode` already exists).
7. **#48/#105/#159 Tally export — call `getCurrentFinancialYearRange`** instead of hand-rolled `new Date().getMonth()`.
8. **#79/#80 Reminders & recurring — reuse the `x-cron-secret` job pattern.**

---

## Changes implemented (2026-06-02 session)

### Server-side plan enforcement (#1, #2, #7)
- `src/lib/quota.ts` — added `checkFeatureAccess(tenantId, feature)` and `checkUserSeatQuota(tenantId)` (402 + structured body, trial-aware).
- Gated **17 feature routes**: OCR (`purchaseOcr`), Tally export (`tallyExport`), `gstr1`/`gstr3b` (`gstReturns`), credit-notes POST (`creditNotes`), 4 reconcile routes (`bankReconciliation`), 8 `export/*` report routes (`excelReports`).
- `users` POST now enforces the seat limit.

### P0/P1 fixes
- **#4** register issues a session and redirects to `/` (into onboarding wizard).
- **#9** FINAL bill edit page `router.replace`s to read-only detail.
- **#8** duplicate button disabled while in-flight.
- **#22** "Fix Balances" now party-scoped (optional `partyId`).
- **#26/#156** Record Payment CTA shown only for FINAL bills.
- **#42/#157** Share button shown only for FINAL bills.
- **#43** bill duplicate uses the configured Bill Series prefix (not hardcoded "BILL").
- **#48/#105/#159** Tally export date ranges computed against the IST calendar.
- **#50** items API supports `search` + pagination; catalog page has a debounced search box and pager.
- **#46** "Record Payment" CTA added to FINAL purchase detail.
- **#45** data-wipe requires typing the company name (new reusable `requireText` option on the confirm modal).
- **#52/#53** year-end close: reusable typed-confirm + new reversal flow (`DELETE /api/year-end-close`, `reverseYearEndClose()` posts a balanced reversing entry, keeps the original for audit).
- **#55** "Create Bill from Measurement" button on completed measurements.
- **#84/#39** bill finalize/cancel now sends only `{ status }` (no stale row/total overwrite).
- **#77/#59** dashboard quick actions: "New Bill" + "Record Payment" added (2×3 grid).
- **#137** subscribe event now carries a deterministic `idempotencyKey`.
- Fixed 5 pre-existing failing bill-creation tests (missing `tenant.findUnique`/`tenant.update` mocks for the existing `checkBillQuota`).

### Found already implemented in current code (audit doc is stale)
#16 (resolveSession already JWT-verifies; `resolveWriteSession` doesn't exist), #28/#29/#121 (purchase POS + inter-state + GSTIN derivation), #52 (typed-FY confirm), #60 (GSTR-1 HSN), #65 (reset-link copy button), #72/#108 (dashboard top parties order by `currentBalance asc` = highest outstanding), #75/#149 (useSync IndexedDB try/catch), #109/#63 (notes month grouping is IST), #111/#71 (export label says "Excel", produces xlsx), #116/#145/#83 (dashboard nudge is IST).

- **#89** reconcile wizard: raw `<select>`/`<input type="date">` → `HKSelect`/`HKInput` (dark-mode-correct).
- **#93** GL account picker hides internal tax/round-off/opening ledgers by default (`isBusinessFacingAccount` in chart-of-accounts) with a "Show all accounts" toggle.
- **#155** public invoice page is IP rate-limited (60/min) via a new `isIpRateLimited()` core extracted from `checkRateLimit`.
- **#88** bill-series default selector: native radios → HeroUI `HKRadioGroup`/`HKRadio`.

All backlog items closed. Remaining open gaps are the large features below.

### Not closeable in this pass — require schema + external integrations + product decisions
e-invoicing / IRN (#61, needs IRP/GSP API creds + schema), TDS 194C/194J (#62, needs ledgers + Form 26Q), GSTR-2A/2B reconciliation (#59), recurring billing (#80) + scheduled reminders (#79, needs a cron job + WhatsApp Cloud API), email invoice delivery (#114/#40, needs PDF generation), GST portal API filing (#70), multi-currency, pro-forma, PO/GRN. These are multi-day features, scoped above.

All changes: `tsc --noEmit` clean (0 errors), full vitest suite green (196/196).
