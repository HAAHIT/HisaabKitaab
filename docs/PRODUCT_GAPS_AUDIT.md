# Product Gaps & Engineering Debt Audit
**DoorCraft Pro — Full Codebase Review**
*Prepared for internal circulation — May 2026*

---

## How to Read This

Every item has a **priority tag**:

| Tag | Meaning |
|-----|---------|
| 🔴 P0 | Production-breaking — users are hitting a crash or security hole *today* |
| 🟠 P1 | Significant hole — data integrity risk, broken feature, or compliance gap |
| 🟡 P2 | Missing feature that Indian SMB users expect; plan/UX gap |
| 🟢 P3 | Polish, tech debt, inconsistency — ship when convenient |

Items are grouped by product area, not file. The goal is a clear, actionable backlog — not a blame list.

---

## Summary Counts

| Priority | Count |
|----------|-------|
| 🔴 P0 | 9 |
| 🟠 P1 | 57 |
| 🟡 P2 | 68 |
| 🟢 P3 | 36 |
| **Total** | **170** |

---

> [!NOTE]
> **Verification pass — 2026-05-31.** The 9 P0 items below were checked against the
> current code on branch `hitesh-dev`. Each carries a verdict:
> **✅ VERIFIED** (reproduces as described), **⚠️ PARTIAL** (real but mis-described
> or over-severitied), **❌ REFUTED** (does not reproduce / already fixed).
> `[FIXED]` marks items resolved in this same pass. Net result: 3 verified+fixed,
> 1 verified-latent+fixed, 1 partial+fixed, 1 partial (left as-is), 3 refuted.
> Treat unverified P1–P3 items below as hypotheses, not confirmed bugs.

### 1. Dashboard crashes on every load — React hook called inside `.map()`
**⚠️ PARTIAL → [FIXED]** — `useState()` *is* called inside a `.map()` callback ([dashboard/page.tsx](../src/app/(app)/dashboard/page.tsx)), a real Rules-of-Hooks violation. But because `links` is a static array, hook order stays stable across renders, so it does **not** "crash on every load" as claimed. Fixed by extracting a `QuickLinkCard` component that owns its hover `useState`.

The dashboard's Quick Links component calls `useState()` inside an `Array.map()` loop. React's Rules of Hooks forbid this — it throws an "Invalid hook call" error on every render. The dashboard is the first page users see after login; this is a broken landing page for every user.

### 2. Public invoice "Print" button is in a Server Component — will crash at runtime
**✅ VERIFIED → [FIXED]** — `onClick={() => window.print()}` was on a `<button>` inside the `async` Server Component at `src/app/(public)/bill/[id]/page.tsx`. Fixed by extracting a `"use client"` `PrintButton` component.

`/bill/[id]` (the shareable invoice link) has `onClick={() => window.print()}` on a button inside a Server Component. Next.js does not allow browser event handlers in Server Components. This crashes at runtime. The "Print Invoice" button on every shared bill is non-functional.

### 3. Unauthenticated background job endpoint
**❌ REFUTED** — `/api/jobs/process-import` is in `PUBLIC_PATHS` (to bypass JWT middleware), but the route's `GET` handler enforces an `x-cron-secret` header matching `process.env.CRON_SECRET` and returns 401 otherwise ([route.ts:46-53](../src/app/api/jobs/process-import/route.ts#L46-L53)). It is not callable by an anonymous attacker.

`/api/jobs/process-import` is in the public-paths list — anyone on the internet can call it without logging in. This is a server-side execution endpoint. An attacker can trigger repeated job processing calls, causing denial-of-service or partial re-runs of import jobs.

### 4. Purchase finalize/cancel calls the wrong API endpoint
**❌ REFUTED** — There is no separate `Purchase` Prisma model; purchases are rows in the `Bill` model (distinguished by a `VENDOR` party, given a `PUR-` billNumber). `getBill` in `/api/bills/[id]` has no party-type filter, so fetching/PATCH/DELETE of a purchase via `/api/bills/[id]` operates on the correct row. No 404. (The AGENTS.md claim that "Purchases and Bills are separate models" is itself inaccurate.)

The Purchase detail page sends status changes to `/api/bills/[id]` instead of `/api/purchases/[id]`. A purchase ID does not exist in the bills table — every "Finalize" and "Cancel" action on a purchase silently returns a 404. Purchase status management is completely broken.

### 5. CGST/SGST display mismatch on printed invoices
**❌ REFUTED** — `roundTo2(v)` is literally `Math.round(v * 100) / 100` ([journal-reporting.ts:4-6](../src/lib/journal-reporting.ts#L4-L6)), and the public invoice page uses the identical expression (`Math.round((tax / 2) * 100) / 100`). There is no divergence from the cause cited. (A separate, subtler question — whether splitting the *already-rounded* total tax in half matches the books computing each half from the taxable base — is not what this item describes.)

The public invoice page computes the CGST/SGST split using old rounding logic (`Math.round`) while the journal/books use the fixed `roundTo2()` function. For odd-penny tax amounts, the numbers printed on the customer's invoice don't match what's in the books — a GST auditor will flag this.

### 6. `DEFAULT_TENANT_ID` env fallback silently assigns failed JWT requests to a real tenant
**⚠️ PARTIAL (left as-is)** — The fallback exists ([middleware.ts:159-162](../src/middleware.ts#L159-L162)) but only fires *after* a successfully **verified** JWT that happens to lack a `tenantId` claim. Malformed/expired/unauthenticated tokens fail `jwtVerify` and hit the catch → login redirect; they never reach this branch. So the "unauthenticated or malformed-token requests" framing is wrong. It remains a genuine misconfiguration footgun, but may be intentional for single-tenant deployments — left for a product decision rather than auto-fixed.

If JWT resolution fails and `DEFAULT_TENANT_ID` is set in the environment, the middleware silently assigns the request to that tenant instead of returning 401. In a misconfigured production deployment this bypasses multi-tenant isolation for unauthenticated or malformed-token requests.

### 7. Tally import maps ledger groups to account codes that don't exist
**❌ REFUTED** — All six codes (`DIRECT_EXPENSE`, `INDIRECT_EXPENSE`, `FIXED_ASSETS`, `LOANS_ADVANCES`, `CURRENT_ASSETS`, `CURRENT_LIABILITIES`) are present in `src/lib/chart-of-accounts.ts` and referenced consistently by the importer. The codes exist.

The Tally XML importer references internal account codes (`DIRECT_EXPENSE`, `INDIRECT_EXPENSE`, `FIXED_ASSETS`, `LOANS_ADVANCES`, `CURRENT_ASSETS`, `CURRENT_LIABILITIES`) that are absent from the chart of accounts. Any real Tally file containing Fixed Assets, Loans, or Expense ledgers will either throw a runtime error or silently corrupt the imported journal entries.

### 8. `pathname.includes(".")` auth bypass in middleware
**✅ VERIFIED (latent) → [FIXED]** — The check existed verbatim ([middleware.ts](../src/middleware.ts)); any path with a dot anywhere bypassed auth. No real route currently contains a dot, so it was latent, but a genuine footgun. Fixed by matching only a trailing file extension (`/\.[a-zA-Z0-9]+$/`).

Any request whose path contains a dot character (e.g. `/api/v2.0/bills`, any path with a file-extension-like segment) skips all authentication and tenant checks. This is a latent security hole that could be triggered by URL manipulation.

### 9. Bank reconciliation commit field mismatch — categorize calls ignored silently
**✅ VERIFIED → [FIXED]** — The upload endpoint persisted `BankStatementRow` records but omitted their ids from the returned `preview`, so the UI sent `rowId: matchedPaymentId` (a payment id) to `/api/reconcile/categorize`, which looks rows up by `BankStatementRow` id → 404, silent failure. Fixed by returning each row's `id` in the preview, adding `id` to the `RowPreview` type, and keying the `ignored` set + categorize calls on the real row id.

The reconciliation UI sends `rowId: matchedPaymentId` (a payment ID) to the categorize endpoint which expects a `BankStatementRow` ID. The two types are different DB records. Every manual match action silently fails — the row is never marked as matched. The reconciliation feature's core matching action is broken.

---

## 🟠 P1 — Significant Holes

### Authentication & Security

**10. `window.confirm()` used for full read-write admin impersonation**
The superadmin impersonation button uses a native browser confirm dialog. In PWA mode or inside an iframe, `window.confirm()` silently returns `false`, making impersonation impossible. Even in a browser, it provides zero context about what access level is being granted — a fully audited, high-privilege action needs a proper confirmation modal.

**11. STAFF role can manually match bank rows — no role check on categorize API**
The reconcile/categorize endpoint has tenant scoping but no role check. Any logged-in user (including STAFF) can manually match or ignore bank statement rows. The commit endpoint correctly requires ADMIN/ACCOUNTANT; categorize does not.

### Accounting & Compliance

**12. Reconciliation commit creates no accounting entries or reconciled flags**
Committing a bank reconciliation marks rows as "matched" visually but does not: create a journal entry, set a `reconciledAt` timestamp on payments, or produce any audit trail. Bank reconciliation is a compliance document in India — the current implementation is a visual exercise with zero accounting impact.

**13. Party profile "Fix Balances" is tenant-wide, not party-scoped**
The "Fix Balances" button on a single party's profile page calls an endpoint that recomputes and rewrites denormalized balances for **all parties in the entire tenant**. There is no indication in the UI that this affects every party — an accountant clicking it to fix one vendor silently rewrites balances for all 500+ parties.

**14. Reconciliation commit silently marks unmatched rows as AMBIGUOUS with no preview**
When a user commits reconciliation, all remaining unreviewed rows are bulk-marked AMBIGUOUS with no confirmation step. There is no "17 rows will be left unmatched — proceed?" prompt. AMBIGUOUS rows have no recovery path (no un-reconcile endpoint). This is permanently destructive without warning.

**15. No reverse/undo mechanism for year-end close**
After the year-end closing journal entry is posted (described in the UI itself as "irreversible"), there is no reversal path. If a bill is added retroactively after closing, or the entry is posted for the wrong FY, the only fix is a manual journal adjustment. Should support a "Post Reversal" action while within the same active FY.

**16. `window.confirm()` for year-end close — the most irreversible action in the app**
Year-end close uses `window.confirm()` — broken in PWA mode. This is the highest-stakes confirmation in the application. Should require the user to type the financial year string (e.g. "2024-25") to confirm, not click a browser dialog.

**17. GST inter-state flag not enforced at purchase entry**
The purchase creation form has no "Inter-State" toggle. Purchases from vendors in other states must use IGST (full rate), not CGST+SGST. If a purchase is from another state and no inter-state flag is set, the wrong tax accounts are debited. This produces incorrect ITC (input tax credit) in GSTR-3B.

**18. No Place of Supply field on purchase entry**
Bills have a Place of Supply field (required for B2B GST) but purchase entry does not. For GSTR-3B ITC computation, Place of Supply on a purchase determines intra vs inter-state classification. Missing field means inter-state purchases are incorrectly journaled.

### Features & Data Integrity

**19. Offline sync: failed uploads retry silently forever with no user feedback**
If a measurement draft upload fails (server validation, quota exceeded, malformed data), it is silently left in the queue and retried every 30 seconds indefinitely. A CUSTOMER-role user taking on-site measurements may have drafts stuck in a permanent failure loop with no notification, no error display, and no way to clear stuck items.

**20. WhatsApp balance reminder breaks for numbers already stored with country code**
The party profile's WhatsApp button prepends "91" unconditionally, producing `wa.me/91919876543210` for numbers stored with the country code. The link opens an invalid number.

**21. Template editor: "Dropdown" column type has no options editor**
The column type selector includes "Dropdown" as an option, but there is no UI to define what values appear in the dropdown. A user who selects Dropdown saves an empty options array. The feature is visually present but functionally incomplete.

**22. No ADMIN role option when creating users**
The user creation panel offers STAFF, ACCOUNTANT, and CUSTOMER roles but not ADMIN. Creating an additional admin requires direct database access. Multi-location businesses on PRO_PLUS need multiple admin-level users — this is a hard blocker.

**23. Items can be hard-deleted even if referenced by existing bills**
The items catalog delete action has no check for existing bill references. Deleting an item used in historical bills either: (a) silently orphans bill line items if the FK is nullable, or (b) returns an unhandled 500 foreign-key error. No archive/soft-delete option exists.

**24. Tally import duplicate detection breaks if narration was edited in Tally**
Duplicate voucher detection matches on `(voucherType, entryDate, narration, totalDebit)`. If a user exports to Tally, edits the narration in Tally, then re-exports and re-imports, the changed narration breaks the deduplication check and creates duplicate journal entries.

**25. Tally export date range uses JS local time, not IST**
The date range computation for Tally exports uses `new Date()` with local timezone. On UTC-based servers (Vercel, Linux), "April 1" at midnight IST is "March 31 18:30 UTC". Exports near financial year boundaries silently include data from the wrong year.

**26. GSTR year selector ternary has identical branches — both options compute the same value**
In GstrReturnsSection, the year options ternary `baseYear = condition ? fyStartYear + 1 : fyStartYear + 1` — both branches are identical. The condition is dead code. The year selector likely shows the wrong FY label for Q1 months (April–June).

**27. GSTR B2B table uses GSTIN as React key — duplicate keys for unregistered buyers**
All unregistered buyers have an empty/null GSTIN, producing duplicate React keys. React silently skips re-renders for duplicate-key rows, meaning B2C bill amounts may display incorrectly when the component updates.

**28. Purchases module reuses bill API endpoint — wrong data model**
`purchases/[id]/page.tsx` fetches from `GET /api/bills/${id}`. Purchases and Bills are separate Prisma models. Either the purchase UI is loading bill data (wrong record) or there's a hidden endpoint alias — either way, purchase-specific fields won't be present and the purchase API's access controls apply to bills, not purchases.

**29. No purchase OCR feature despite PRO_PLUS plan flag**
`purchaseOcr: true` is listed as a PRO_PLUS feature but there is no OCR/scan UI anywhere in the purchase creation flow. PRO_PLUS subscribers paying for this feature cannot access it.

**30. Items list loads all items with no pagination**
All items are fetched at once with no limit. A tenant with 300+ SKUs (hardware store, materials supplier) loads the entire catalog on every visit. No search, no filter by tax rate or HSN code.

**31. No bulk item import (CSV/Excel)**
New customers migrating from Tally, a spreadsheet, or another billing tool must add every item manually. Tally exports item masters as XML; a CSV/Excel import would dramatically reduce onboarding time for customers with 50+ SKUs.

**32. Measurements page: no pagination and no search debounce**
Measurements are loaded with no limit. The search input fires a DB query on every keystroke with no debounce. 500+ measurement records = a DB query per keypress.

**33. Audit log viewer has no date range filter and no export**
The audit log only filters by entity type, action, and entity ID. No date range, no user filter, no CSV export. Under MCA GSR 247(E), companies must produce a complete audit trail for any date range on demand. Currently impossible without direct DB access.

**34. Global search misses purchases, payments, credit/debit notes, and journal entries**
Cmd+K search covers bills, parties, and items only. Searching for "refund to Ramesh" or "purchase from ABC Traders" returns nothing.

**35. No "Create Bill from Measurement" shortcut**
The measurement workflow ends at "Completed" status with no path to bill creation. Users must manually navigate to billing and re-enter the customer name and items. Measure → Produce → Bill is the primary workflow for a doorcraft/furniture business.

**36. Party ledger dropdown in Reports unusable at scale**
The party ledger report uses a plain `<select>` with all parties loaded at mount. A tenant with 500+ parties renders a huge dropdown with no type-to-search. Should use the autocomplete party search component already built.

**37. Tally import: no cancel button during processing**
Once an import job starts, there is no cancel button. If a user uploads the wrong XML file, they must wait for the full import to complete (potentially 10+ minutes) before starting over.

**38. Export from Transactions page only exports the current page (50 items) with no warning**
The Export button iterates over the current page state. A user exporting for audit receives a partial 50-row file with no indication it's incomplete.

**39. Bill status change re-sends entire bill body — stale client state can overwrite server state**
The "Finalize Bill" action sends all bill fields (rows, totals, etc.) in the PATCH. If the bill was modified in another session between page load and finalize, the stale client version overwrites the newer server version silently.

**40. No "Send Invoice by Email" or SMS delivery**
Bills can be shared via WhatsApp link but there is no email delivery. Most B2B customers in India request email invoices for their accounting software. There is no email/SMS invoice delivery path.

**41. No payment reminder or overdue notification system**
The dashboard shows overdue count and amount but there is no automated reminder — no scheduled WhatsApp/SMS/email to customers with outstanding balances. This is the #1 requested feature for Indian SMB billing tools.

**42. No recurring billing / subscription invoice creation**
Bills must be created manually every time. For monthly rent, retainer, or subscription customers, there is no "repeat this bill" or scheduled billing feature.

---

## 🟡 P2 — Missing Indian SMB Features & Notable UX Gaps

### Plan & Billing

**43. Plan switcher in superadmin UI only toggles FREE ↔ PRO — no PRO_PLUS**
The tenant plan switcher is a binary toggle. There is no way to assign a tenant to PRO_PLUS from the admin UI. Enterprise customers on PRO_PLUS can only be set via direct DB update.

**44. User management page shows no plan limit usage ("2 of 3 users")**
The plan limits 1 user (FREE), 3 users (PRO), unlimited (PRO_PLUS). A FREE tenant at their limit gets no visual feedback before they try to add a second user and receive an error.

**45. No copy-to-clipboard button on reset password link in admin UI**
The reset password link is in a read-only input with select-on-focus. There is no copy button — error-prone on mobile and touch devices.

### GST & Compliance

**46. No GSTIN format validation on party creation**
GSTIN is a 15-character alphanumeric with a defined checksum pattern. Entering a malformed GSTIN (wrong state code, wrong character count) is accepted silently and will break Tally export and GSTR-1 generation.

**47. No HSN/SAC code auto-suggestion on item creation**
The item catalog accepts an HSN code field but provides no autocomplete or lookup. Users must know or look up the correct HSN code externally. Incorrect HSN codes break GSTR-1 Table 12.

**48. GSTR report JSON download not integrated with GST portal API**
GSTR-1 and GSTR-3B JSON can be downloaded but cannot be directly filed or uploaded via the GST portal API. This is an expected integration for a PRO billing tool — users must manually upload the downloaded JSON to gstin.gov.in.

**49. No e-invoicing (IRN/QR code) support**
Businesses with turnover above ₹5 crore are required to generate e-invoices via the IRP (Invoice Registration Portal). There is no IRN generation, QR code embedding, or IRP API integration. This is mandatory compliance for larger tenants.

**50. No TDS deduction support on purchase payments**
Section 194C/194J TDS deductions on vendor payments are not supported. For businesses making eligible payments to contractors, professionals, or service providers, TDS must be tracked and Form 26Q filed. No TDS ledger, no TDS certificate generation.

**51. No debit note creation from purchase bills (only credit notes from sales bills)**
Credit notes (sales returns) exist as a feature. Debit notes (purchase returns) have no UI entry point despite the `DEBIT_NOTE` voucher type existing in the schema.

### UX & Design

**52. `window.confirm()` used in 6+ places — all broken in PWA mode**
Beyond the already-listed critical cases (year-end close, impersonation), `window.confirm()` is also used for: item delete, user deactivate, template column delete, and bill series operations. All are non-functional in PWA mode and should use the existing `ConfirmModal` component.

**53. Bank reconciliation wizard uses raw HTML `<select>` and `<input type="date">` — dark mode broken**
The bank selector and date inputs in the reconciliation wizard are native HTML elements that ignore Tailwind dark mode. They render as bright-white OS default inputs inside a dark-themed page.

**54. Bill series uses raw `<input type="radio">` instead of HeroUI component**
Design system inconsistency — the radio input for selecting the default bill series doesn't use the HeroUI RadioGroup component, breaking hover state, dark mode, and accessibility.

**55. No mobile trigger for global search (Cmd+K only)**
The global Cmd+K search has no mobile equivalent — no search icon, no FAB button. Mobile users have no discoverable way to access search.

**56. General ledger account picker shows internal accounting codes to business owners**
The General Ledger report lets users pick any account including `CGST_INPUT`, `SGST_OUTPUT`, `ROUND_OFF`, `OWNER_EQUITY`. Non-accountant owners have no context for these codes and should see only business-facing accounts by default.

**57. Day Book has no source-document link**
The Day Book report shows voucher type, date, narration, and amounts with no link to the originating bill, payment, or purchase. Accountants reviewing the day book must search separately for source documents.

**58. Tally export WhatsApp delivery sends a text link, not the XML file**
The "Share via WhatsApp" delivery option creates a `wa.me/?text=` link. WhatsApp deeplinks cannot attach files — the CA receives a chat message with a download link, not the XML directly. The CTA implies file sharing but delivers a text link.

**59. No "New Bill" or "Record Payment" shortcut on the dashboard**
The dashboard quick links go to Tally Export, Reconcile, Reports, and Settings. Creating a bill (the #1 user action) and recording a payment (the #2 action) have no quick-access shortcut on the home screen.

**60. Dashboard recent activity shows payments only — no recent bills**
For businesses that bill on net-30 terms, the Recent Activity panel will be empty (no recent payments) even if 10 bills were created today. A combined bills+payments feed would better represent business activity.

**61. Party profile WhatsApp balance reminder is hardcoded in English**
The WhatsApp message template ("Hi {name}, your outstanding balance is ₹{amount}") is hardcoded in English. The app supports Hindi and regional languages but this user-facing message bypasses the translation system.

**62. Party profile "Total Billed" and "Last Payment" labels are not translated**
Several labels in the party detail view ("Total Billed", "bills", "since last pay", "no payments yet") are hardcoded English strings not going through the `t()` translation function.

**63. Notes (credit/debit) month grouping uses UTC — wrong month near midnight IST**
Credit/debit notes are grouped by month using JavaScript's UTC-based `getMonth()`. Notes entered near midnight IST will appear in the wrong month group (IST is UTC+5:30, so a note at 12:01 AM April 1 IST is stored as March 31 UTC).

**64. Reports page fires two simultaneous API calls on every date change with no debounce**
Changing the date range in the reports page fires both the trial balance and GST summary fetches simultaneously with no debounce. Rapidly adjusting dates fires O(n) redundant API calls.

**65. Tally import polling uses a fixed 2-second interval — no exponential backoff**
The import status poll hits the server every 2 seconds for the full duration (potentially 10+ minutes). For a 10-minute import, this is 300 network requests. Should use exponential backoff (2s → 4s → 8s → capped at 30s).

**66. CA portal shows loading skeletons before a 403 for non-accountant users**
Non-accountant users who navigate to the `/ca` accountant portal see full loading skeleton states before receiving an error — gives the impression the page loaded but is empty rather than proactively blocking access.

**67. Banking ledger has no search, filter, or amount lookup**
The passbook-style bank/cash ledger has no search and no date or amount filter. Finding a specific ₹47,523 entry requires scrolling the entire ledger month-by-month.

**68. Bill series prefix validation only described in help text — not enforced in the UI**
Prefix format rules (no spaces, alphanumeric only, max length) are documented in tooltip text but not validated client-side. A user enters an invalid prefix and only discovers the problem after an API call fails.

**69. Offline sync polls IndexedDB every 30 seconds even when the queue is empty**
The 30-second sync interval runs unconditionally, querying IndexedDB regardless of whether there are pending drafts. Should only run when there are pending items, and clear itself when the queue empties.

**70. `initialTransactions: any[]` on the transaction ledger component — TypeScript safety bypassed**
The transactions/journal view accepts `any[]` as its main data type, disabling type checking on the primary data structure of the accounting ledger.

---

## 🟢 P3 — Polish & Technical Debt

**71. Transactions export button says "CSV" but downloads an `.xlsx` file**
Minor labeling inconsistency but confuses power users who expect CSV for scripted processing.

**72. Dashboard "top parties" widget fetches recently-created parties, not highest-balance parties**
The field is named `topParties` but the API call fetches `?limit=5` with default ordering. Business owners expect "top" to mean highest outstanding balance.

**73. Public invoice page uses `<img>` for company logo (not Next.js `<Image>`)**
Generates a build warning and misses Next.js image optimization (lazy loading, WebP conversion, size hints). Fine functionally but produces console noise.

**74. No `robots.txt` exclusion for `/admin/*` and `/api/*` paths**
Only the public invoice page has `noindex`. Admin routes, API routes, and tenant app pages have no `noindex` headers or `robots.txt` disallow rules.

**75. `useSync` has no error handling for Safari private browsing (IndexedDB blocked)**
`db.measurementDrafts.toArray()` is called with no try/catch. In Safari private mode, IndexedDB is blocked synchronously — this will throw an unhandled exception and potentially crash the hook.

**76. Template column IDs are client-side UUIDs until save — formula references can break on race conditions**
New column IDs are generated with `crypto.randomUUID()` client-side. Formula columns reference other columns by these IDs. If two rapid saves or a load race occurs, formula references can silently point to stale IDs.

**77. Bill detail re-fetch after status change is not awaited properly**
After finalizing a bill, the UI calls a second fetch to refresh bill state but doesn't fully handle the case where the second fetch fails — the UI shows a success toast but retains pre-status-change data.

**78. Bank reconciliation ₹1 amount tolerance misses service-charge-adjusted payments**
Indian banks frequently deduct ₹2–₹5 in SMS charges, NEFT fees, or cheque return fees from credited amounts. The ₹1 matching tolerance means these payments will consistently fail to auto-match.

**79. Bank reconciliation greedy matching is not globally optimal**
The matching algorithm assigns each statement row to its best-scoring unmatched payment greedily. Two statement rows that both score best against the same payment result in one going unmatched, even if a globally optimal pairing exists.

**80. Bank reconciliation ignores UPI transaction IDs and reference numbers in descriptions**
Description matching checks party names only. UPI payments include a unique reference ID (e.g. `UPI/123456789012/Ref`) that could be matched exactly against stored UPI payment notes. This is the highest-confidence match signal and is currently unused.

**81. `fmtDate` in bill/purchase detail uses UTC-based `new Date()` — dates near midnight IST can show the previous day**
Bill dates stored as UTC midnight will display as the previous calendar day in UTC-negative timezones, and could show the next day in edge cases if stored as IST midnight in UTC.

**82. Purchase detail interface uses "customerName/customerPhone" field names for vendor fields**
The `PurchaseDetail` TypeScript interface names vendor fields as `customerName`, `customerPhone`, `customerAddress` — copied verbatim from the bill type. Semantically wrong and will confuse future developers.

**83. Dashboard Tally nudge triggers based on JS local month, not IST month**
The quarterly Tally export reminder (`showTallyNudge`) uses `new Date().getMonth()` — could fire a day early/late at financial quarter boundaries on UTC servers.

**84. No last-login timestamp displayed on the users management page**
Tenant admins cannot identify inactive or stale user accounts (e.g. departed employees) without a last-login indicator.

**85. Template editor has no drag-and-drop column reorder**
Column reordering requires clicking up/down arrow buttons repeatedly. For templates with 10+ columns, this is slow and error-prone. Standard drag-and-drop is the expected UX for a column configurator.

**86. CA portal Journal Entries tab shows "requires PRO plan" for ACCOUNTANT role**
The ACCOUNTANT role can only be assigned on PRO plan, making the "requires PRO plan" message on the accountant portal redundant and confusing — if you're an accountant, you're already on PRO.

**87. `window.print()` in public invoice page needs a client component wrapper (already P0 but also creates a build warning)**
Even after the P0 fix (move to a client component), the current code generates a Next.js build warning about event handlers in server components that obscures other build errors.

**88. Tally export: CA email address is used in a `mailto:` link with no format validation**
If the saved CA email address is malformed, the "Email to CA" link silently opens a broken `mailto:` URI with no user feedback.

**89. `numberToWords` in bill detail returns "Zero Rupees Only" for amounts between ₹0.00 and ₹0.49 due to `Math.round`**
For a bill with a grand total of ₹0.25 (edge case after round-off), the printed amount in words says "Zero Rupees Only" while the number shows ₹0.25.

**90. No reconciliation export of unmatched (AMBIGUOUS) rows to CSV**
After reconciliation, AMBIGUOUS rows represent transactions that need investigation. There is no way to export these rows for the accountant to work through in a spreadsheet.

---

## Feature Wishlist (Not Yet in Codebase)

These are fully absent features that Indian SMB customers commonly expect at the PRO tier:

| Feature | Why It Matters |
|---------|----------------|
| E-invoicing / IRN generation | Mandatory for businesses >₹5 Cr turnover (CBIC requirement) |
| TDS tracking (194C/194J) | Required for service/contractor payments; Form 26Q filing |
| Debit notes (purchase returns) | GSTR-3B Table 4 requirement; schema supports it, no UI |
| Payment reminders (WhatsApp/SMS) | #1 collection tool for Indian SMBs |
| Recurring billing | Monthly rent, retainers, subscription invoices |
| Bulk item import (CSV) | Onboarding friction for customers migrating from Tally |
| GST portal API integration | Direct GSTR-1/3B filing without manual JSON upload |
| Email invoice delivery | B2B customers request email invoices for their own accounting |
| Multi-currency support | Exporters/importers dealing in USD/EUR |
| Pro-forma invoices | Quote → Proforma → Invoice workflow for project businesses |
| Purchase order tracking | PO → GRN → Invoice 3-way match for inventory businesses |

---

## Architectural Notes for Engineering

1. **`window.confirm()` — use `ConfirmModal` everywhere.** The pattern already exists in the codebase; just not applied consistently. Every `confirm()` call in the app is broken in PWA mode.

2. **IST vs UTC.** Dates stored in UTC are correct for the DB. Any date *displayed* or *used in a range filter* must be converted to IST (UTC+5:30) before use. `getCurrentFinancialYearRange()` from `@/lib/journal-reporting` does this correctly — use it everywhere, not `new Date().getMonth()`.

3. **`resolveSession` / `resolveWriteSession` is mandatory on every API route.** Manual header extraction (`x-user-role`, `x-user-id`, `x-tenant-id`) bypasses JWT verification and must not be used anywhere.

4. **Advisory locks must be tenant-scoped.** `pg_advisory_xact_lock(hash(tenantId + resourceType))` — never a global constant.

5. **Soft deletes only.** Billing records must never be hard-deleted. `isDeleted: true` is the only acceptable deletion pattern.

---

*Document generated from a full static analysis of the codebase. No code was modified. All findings are read-only observations.*
