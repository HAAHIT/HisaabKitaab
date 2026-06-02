

## Summary

| Priority | Count |
|----------|-------|
| 🔴 P0 | 15 |
| 🟠 P1 | 47 |
| 🟡 P2 | 65 |
| 🟢 P3 | 43 |
| *Total* | *170* |

---

## 🔴 P0 — Production-Breaking

*#1 — Plan feature gates are NOT enforced on API routes*
Every PRO/PRO_PLUS feature — Tally export, GSTR-1/3B, credit notes, bank reconciliation, purchase OCR, Excel reports — is freely callable by FREE-plan tenants. ⁠ hasFeature() ⁠ and ⁠ PLAN_LIMITS ⁠ exist in ⁠ src/lib/plan-limits.ts ⁠ but zero API routes import or call them. The paywall is entirely browser-side. Direct revenue leak.

*#2 — User seat limit never enforced*
⁠ POST /api/users ⁠ never checks ⁠ PLAN_LIMITS[plan].users ⁠. A FREE tenant (limit: 1 user) can create unlimited users. No quota check, no upgrade prompt, no error.

*#3 — Forgot-password logs reset URL to stdout — no email ever sent*
⁠ forgot-password ⁠ logs the reset URL to server stdout. In production, users who lose their password have no recovery path unless an operator reads server logs. No email is sent by this app for any reason.

*#4 — Post-registration redirects to ⁠ /login ⁠ — user must re-type their password immediately*
After successful signup, ⁠ router.push("/login") ⁠ fires. No session is created, no redirect to onboarding. The new user re-types their password right after registering. First impression is broken.

*#5 — New tenant never reaches the setup wizard*
⁠ onboardingComplete: false ⁠ is set in the DB on register, but no middleware or post-login hook redirects a new tenant to the setup wizard. They land on an empty ⁠ /dashboard ⁠ with no guidance.

*#6 — FINAL bill cancellation doesn't reverse linked payment balance*
If a FINAL bill has a payment recorded against it and is then cancelled, ⁠ DELETE /api/bills/[id] ⁠ reverses the bill's balance change but not the payment's party balance delta. The party balance becomes permanently wrong.

*#7 — Purchase OCR callable without PRO plan*
⁠ POST /api/ocr/purchase-bill ⁠ has no ⁠ hasFeature("purchaseOcr") ⁠ check. Any FREE user can OCR vendor bills — a PRO_PLUS-only feature is open to everyone.

*#8 — Double-tap on Duplicate button creates two bills*
No loading/disabled state while the duplicate API call is in-flight. On slow connections, a second tap creates two identical draft bills.

*#9 — FINAL bill edit page is reachable by direct URL*
The Edit button is gated to DRAFTs in the UI, but navigating directly to ⁠ /bills/[id]/edit ⁠ on a FINAL bill renders a fully editable form. Saving it overwrites a finalized accounting record.

*#10 — ⁠ useState ⁠ called inside ⁠ Array.map() ⁠ in dashboard ⁠ QuickLinks ⁠ component*
⁠ src/app/(app)/dashboard/page.tsx ⁠ line 329: ⁠ const [hovered, setHovered] = useState(false) ⁠ is called inside ⁠ .map() ⁠. React's Rules of Hooks forbid hooks inside loops. This throws "Invalid hook call" on every dashboard render. The dashboard — the first page after login — is broken for every user.

*#11 — ⁠ window.print() ⁠ in Server Component on the public invoice page*
⁠ /bill/[id] ⁠ has ⁠ onClick={() => window.print()} ⁠ on a button inside a Server Component. Next.js throws at runtime for browser event handlers in server components. The Print button on every shared bill is non-functional.

*#12 — ⁠ /api/jobs/process-import ⁠ is unauthenticated*
⁠ src/middleware.ts ⁠ places ⁠ /api/jobs/process-import ⁠ in ⁠ PUBLIC_PATHS ⁠. Any anonymous HTTP request can trigger the background import job processor. An attacker can cause denial-of-service or partial re-runs.

*#13 — Purchase finalize/cancel calls the wrong API endpoint*
⁠ src/app/(app)/purchases/[id]/page.tsx ⁠ ⁠ execStatus ⁠ calls ⁠ fetch(\ ⁠/api/bills/${id}\⁠ , ...) ⁠. A purchase ID does not exist in the bills table. Every "Finalize" and "Cancel" action on any purchase silently returns a 404. Purchase status management is completely broken.

*#14 — ⁠ DEFAULT_TENANT_ID ⁠ env fallback silently assigns failed JWT requests to a real tenant*
If JWT resolution fails and ⁠ DEFAULT_TENANT_ID ⁠ is set, middleware assigns the request to that tenant instead of returning 401. In a misconfigured production deployment this bypasses multi-tenant isolation for unauthenticated requests.

*#15 — Reconcile commit sends wrong field to categorize endpoint*
⁠ ReconcilePage.handleCommit ⁠ posts ⁠ rowId: matchedPaymentId ⁠ — a payment ID — to ⁠ /api/reconcile/categorize ⁠ which expects a ⁠ BankStatementRow ⁠ ID. Every manual match action silently fails. The reconciliation feature's core matching is broken.

---

## 🟠 P1 — Significant Holes

### Authentication & Security

*#16 — ⁠ resolveSession ⁠ used in duplicate route instead of ⁠ resolveWriteSession ⁠*
⁠ /api/bills/[id]/duplicate/route.ts ⁠ uses ⁠ resolveSession ⁠. AGENTS.md mandates ⁠ resolveWriteSession ⁠ for all write operations. Security consistency gap.

*#17 — STAFF role can manually match bank rows — no role check on categorize API*
⁠ /api/reconcile/categorize ⁠ has tenant scoping but no role check. Any logged-in user including STAFF can manually match or ignore bank statement rows. The commit endpoint correctly requires ADMIN/ACCOUNTANT; categorize does not.

*#18 — ⁠ pathname.includes(".") ⁠ auth fast-path bypasses all authentication*
Any route whose path contains a dot character skips all JWT verification and tenant checks in middleware. A URL like ⁠ /api/v2.0/bills ⁠ or any path with a file-extension-like segment would bypass auth entirely.

### Accounting & Compliance

*#19 — Reconciliation commit creates no journal entries or reconciled flags*
Committing bank reconciliation marks rows "matched" visually but does NOT create a journal entry, set ⁠ reconciledAt ⁠ on payments, or produce any audit trail. Bank reconciliation is a compliance document — the current implementation has zero accounting impact.

*#20 — Reconciliation commit silently marks unmatched rows as AMBIGUOUS with no preview*
All remaining PENDING rows are bulk-marked AMBIGUOUS on commit with no "17 rows will be left unmatched — proceed?" confirmation. AMBIGUOUS rows have no recovery path. This is permanently destructive without warning.

*#21 — No delete/un-reconcile flow for committed bank statements*
Once ⁠ isReconciled: true ⁠, statements are read-only with no actions. If a user uploaded the wrong CSV (wrong bank, wrong period), the only fix is a direct DB intervention. Should support "Re-open" and "Delete Statement" actions with ADMIN role gating.

*#22 — Party profile "Fix Balances" button is tenant-wide, not party-scoped*
⁠ handleFixBalances ⁠ on ⁠ /parties/[id] ⁠ calls ⁠ POST /api/parties/reconcile ⁠ which recomputes and rewrites balances for *all parties in the entire tenant*. There is no indication the action affects every party — an accountant clicking it to fix one vendor silently rewrites all 500+ party balances.

*#23 — Per-row GST rates corrupted on bill edit*
The edit page's ⁠ subtotal/taxAmount/grandTotal ⁠ memo doesn't implement the ⁠ taxRateColId ⁠ branch. Saving a bill originally created with per-row tax rates recalculates totals incorrectly and overwrites the journal entry with wrong amounts.

*#24 — CGST/SGST rounding mismatch on printed public invoice*
⁠ /bill/[id] ⁠ (public share page) computes CGST/SGST split with ⁠ Math.round((tax / 2) * 100) / 100 ⁠ — the old pre-fix pattern. The journal was created with ⁠ roundTo2() ⁠. For odd-penny tax amounts the numbers printed on the customer's invoice don't match the books. A GST auditor will flag this.

*#25 — Tally export permanently blocked by any single unbalanced entry*
One bad ⁠ JournalEntry.isBalanced === false ⁠ blocks all Tally exports with no repair path in the UI. There is no "view unbalanced entries" list, no per-entry fix tool, no export-anyway override for admins.

*#26 — FINAL bill "Record Payment" CTA is visible for DRAFT bills*
⁠ BillActionBar ⁠ shows the payment CTA for any ⁠ status !== "CANCELLED" ⁠, including DRAFTs. Recording payment against a DRAFT bill is accounting-invalid — a DRAFT has no journal entry yet.

*#27 — No "what happens to balance sheet" explanation on year-end close*
Year-end close likely archives income/expense entries but doesn't generate a B/S carryforward journal entry. After a close, the new year's trial balance may start from zero rather than carrying forward asset/liability positions. No documentation or preview in the UI.

*#28 — GST inter-state flag not enforceable on purchase entry*
The purchase creation form has no "Inter-State" toggle. Purchases from vendors in other states must use IGST; without the flag, the wrong tax accounts are debited. This produces incorrect ITC in GSTR-3B.

*#29 — No Place of Supply field on purchase entry*
Bills have Place of Supply (required for B2B GST) but purchases do not. Place of Supply on a purchase bill determines intra vs. inter-state ITC classification. Missing field means inter-state purchases are incorrectly journaled.

*#30 — Tally import: ledger groups mapped to AccountCodes absent from chart-of-accounts*
⁠ tally-xml-import.ts ⁠ references ⁠ DIRECT_EXPENSE ⁠, ⁠ INDIRECT_EXPENSE ⁠, ⁠ FIXED_ASSETS ⁠, ⁠ LOANS_ADVANCES ⁠, ⁠ CURRENT_ASSETS ⁠, ⁠ CURRENT_LIABILITIES ⁠ as AccountCode values. These are absent from ⁠ chart-of-accounts.ts ⁠. Any real Tally file with Fixed Assets, Loans, or Expense ledgers will either throw at runtime or silently corrupt imported journal entries.

*#31 — Tally import duplicate-detection breaks if narration was edited in Tally*
Duplicate detection matches ⁠ (voucherType, entryDate, narration, totalDebit) ⁠. If a user exports → edits narration in Tally → re-exports and re-imports, the changed narration breaks the check and creates duplicate journal entries.

### Features & Data Integrity

*#32 — Offline sync: failed uploads retry silently forever with no user feedback*
⁠ useSync.ts ⁠ catches upload failures and leaves the draft in the queue indefinitely ("retry next sync"). A draft that fails for a non-transient reason retries every 30 seconds forever with no notification to the user, no max retry count, no way to inspect or clear stuck items.

*#33 — WhatsApp balance reminder doubles country code for numbers stored with prefix*
⁠ \`https://wa.me/91${party.phone.replace(/\D/g, "")}\ ⁠` — if the stored number is ⁠ 919876543210 ⁠, the link becomes ⁠ wa.me/91919876543210 ⁠ — invalid. Breaks silently for every party whose phone was stored with country code.

*#34 — No ADMIN role option when creating users*
User creation panel offers STAFF, ACCOUNTANT, CUSTOMER — no ADMIN. Creating an additional admin requires direct DB access. Multi-location PRO_PLUS businesses need multiple admins.

*#35 — Template editor: "Dropdown" column type has no options editor*
⁠ COLUMN_TYPES ⁠ includes ⁠ dropdown ⁠ as a valid option, but there is no UI to define dropdown values. Selecting "Dropdown" saves an empty options array silently. The feature is visually present but functionally incomplete.

*#36 — Items can be hard-deleted even if referenced by existing bills*
The item delete action has no check for bill references. Either: (a) silently orphans bill line items if FK is nullable, or (b) returns an unhandled 500 FK constraint error. No archive/soft-delete option.

*#37 — Bill date can corrupt to 1970-01-01 on edit*
⁠ new Date(bill.date).toISOString().slice(0, 10) ⁠ — if ⁠ bill.date ⁠ is null, ⁠ new Date(null) ⁠ is the Unix epoch. The user sees ⁠ 1970-01-01 ⁠ pre-filled and may save it, corrupting the bill date and journal entry date.

*#38 — Yearly subscription plan unreachable in UI*
The subscribe API supports ⁠ cycle: "yearly" ⁠ but the billing page always sends ⁠ "monthly" ⁠. The two-month-free annual discount is invisible and unreachable for users.

*#39 — No dunning flow when subscription is PAST_DUE*
The webhook sets status correctly but nothing notifies the user. The notifications API has no ⁠ SUBSCRIPTION_PAST_DUE ⁠ kind. Users continue unaware that their plan is about to downgrade.

*#40 — New staff user has no credential delivery path*
The generated password is visible once in the form. No "Send via WhatsApp/Email" action. If the admin navigates away before copying, the password is lost and must be reset manually.

*#41 — Purchase edit routes to the sales bill edit page*
The Edit button on ⁠ /purchases/[id] ⁠ links to ⁠ /bills/${id}/edit ⁠ — the sales bill editor with "Customer" labels and customer-type party logic. This is the wrong page for a vendor invoice.

*#42 — Share button fires silently for CANCELLED bills*
⁠ handleShare ⁠ no-ops on ⁠ status !== "FINAL" ⁠ with zero user feedback. The Share button remains visible for cancelled bills because the visibility guard only checks ⁠ !== "DRAFT" ⁠. A user tapping Share on a cancelled bill gets no response, no error, nothing.

*#43 — ⁠ duplicate/route.ts ⁠ ignores Bill Series prefix*
The duplicate generates ⁠ billPrefix ⁠ from the flat settings JSON. Tenants using the Bill Numbering series feature get a hardcoded ⁠ "BILL" ⁠ prefix on duplicated bills instead of their configured series.

*#44 — Finalize from DRAFT doesn't prompt for missing ⁠ placeOfSupply ⁠*
⁠ execStatus("FINAL") ⁠ sends a PATCH without prompting for Place of Supply. If it's missing, the server returns a generic 400 with no field-level feedback. The user is stuck with no indication of what to fix.

*#45 — Wipe-data has no typed-name confirmation*
⁠ POST /api/settings/wipe-data ⁠ is triggered by the settings page. An action that deletes all tenant data uses ⁠ window.confirm() ⁠ — a suppressible browser dialog, broken in PWA mode. Should require typing the company name to confirm.

*#46 — No "Pay Vendor" CTA on purchase bill detail*
⁠ /purchases/[id] ⁠ has Print/Edit/Finalize/Cancel but no payment button. The user must navigate to ⁠ /payments/new ⁠ and re-enter the amount manually. Sales bills have a direct "Record Payment" button — purchases should too.

*#47 — Purchases module reuses the bills API — wrong data model*
⁠ purchases/[id]/page.tsx ⁠ fetches from ⁠ GET /api/bills/${id} ⁠. Purchases and Bills are separate Prisma models. Either the purchase UI is loading bill data (wrong record), or there is an undocumented shared endpoint — either way, purchase-specific fields are absent and the bills API's access controls apply to bills, not purchases.

*#48 — Tally export date range uses JS local time, not IST*
⁠ getDateRange() ⁠ calls ⁠ new Date() ⁠ with local timezone. On UTC-based servers (Vercel, Linux), "April 1" at midnight IST is "March 31 18:30 UTC". Exports near FY boundaries silently include data from the wrong year. Should use ⁠ getCurrentFinancialYearRange() ⁠ from ⁠ @/lib/journal-reporting ⁠.

*#49 — Audit log viewer: no date range filter and no export*
Filters only by entity type, action, and entity ID. No date range, no user filter, no CSV export. Under MCA GSR 247(E), companies must produce period-scoped audit records on demand. Currently impossible without direct DB access.

*#50 — Items list has no pagination or search*
All items fetched with no ⁠ limit ⁠. A tenant with 300+ SKUs loads the entire catalog on every page visit. No search, no filter by tax rate or HSN code.

*#51 — No bulk item import (CSV/Excel)*
Customers migrating from Tally, a spreadsheet, or another tool must add every item manually. Tally exports item masters as XML. A CSV/Excel import path would drastically reduce onboarding friction for customers with 50+ SKUs.

*#52 — ⁠ window.confirm() ⁠ for year-end close — the most irreversible action in the app*
Year-end close gates the permanent closing journal behind ⁠ window.confirm() ⁠ — broken in PWA mode. This is the highest-stakes confirmation in the application. Should require typing the financial year string (e.g. "2024-25") to confirm.

*#53 — No reverse/un-close mechanism for year-end close*
After posting the closing journal entry (described as "irreversible" in the UI), there is no reversal path. If closed against wrong data, the only fix is a manual journal adjustment. Should support "Post Reversal" for the current FY closing entry.

*#54 — Global search misses purchases, payments, credit/debit notes, and journal entries*
Cmd+K covers bills, parties, and items only. Searching a payment reference, a supplier invoice number, or a transaction narration returns nothing.

*#55 — No "Create Bill from Measurement" shortcut*
The measurement workflow ends at "Completed" status with no path to bill creation. Measure → Produce → Bill is the core workflow for a doorcraft/furniture business. Users must re-enter all data manually in the bill form.

*#56 — GSTR yearOptions ternary has identical branches — dead code, likely wrong*
⁠ GstrReturnsSection.tsx ⁠: ⁠ const baseYear = ist.fpMonth >= 4 ? ist.fyStartYear + 1 : ist.fyStartYear + 1 ⁠ — both branches are identical. The year dropdown likely shows incorrect FY labels for Jan–Mar months.

*#57 — GSTR B2B tab uses GSTIN as React key — duplicate keys for unregistered buyers*
Multiple unregistered buyers have empty GSTIN — ⁠ key="" ⁠ is duplicated. React silently skips re-renders for duplicate-key rows, causing B2C bill amounts to display incorrectly on updates.

*#58 — Purchase OCR feature flag exists in plan-limits but has no UI entry point*
⁠ purchaseOcr: true ⁠ is listed for PRO_PLUS but there is no scan/OCR button in the purchase creation flow. PRO_PLUS subscribers paying for this feature cannot access it.

*#59 — No GSTR-2A/2B reconciliation*
The most-requested GST feature for registered businesses — upload the GSTR-2A JSON from the portal, match against purchase bills, flag ITC discrepancies — is absent with no trace of planned implementation.

*#60 — GSTR-1 missing HSN-wise summary (Table 12)*
⁠ buildGstr1Json ⁠ produces B2B/B2CS but not the HSN-wise summary required for businesses above ₹5Cr. The ⁠ hsnCode ⁠ field exists on bills but is unused in the GSTR builder.

*#61 — No e-Invoice (IRN) generation*
Mandatory for turnover >₹5Cr. No IRP API integration, no IRN field on bills, no QR code embedded on the invoice. Large tenants cannot comply.

*#62 — TDS not tracked anywhere*
No TDS % field on vendor payments, no TDS Payable account in the chart of accounts, no Form 26Q export. Required for service/contractor payments under Section 194C/194J.

---

## 🟡 P2 — Missing Indian SMB Features & UX Gaps

### Plan & Admin

*#63 — Plan switcher in superadmin UI only toggles FREE ↔️ PRO — no PRO_PLUS*
⁠ otherPlan = data.plan === "PRO" ? "FREE" : "PRO" ⁠ — binary toggle only. Assigning PRO_PLUS to a tenant requires direct DB access.

*#64 — User management page shows no plan limit usage ("2 of 3 users")*
Plan limits 1 user (FREE), 3 users (PRO), unlimited (PRO_PLUS). A FREE tenant at their limit has no visual feedback before they try to add a user and get an error.

*#65 — No copy-to-clipboard button on reset password link in admin UI*
The reset link is in a read-only input with select-on-focus. No copy button — error-prone on mobile and touch devices.

*#66 — Yearly plan toggle missing from billing page UI*
The subscribe API supports ⁠ cycle: "yearly" ⁠ but the billing page only sends ⁠ monthly ⁠. The two-month-free discount is never shown to users.

*#67 — No dunning/grace-period notification for PAST_DUE subscriptions*
Webhook sets the status but nothing alerts the user. No email, no in-app banner, no notification. Users lose access unexpectedly.

### GST & Compliance

*#68 — No GSTIN format validation on party creation*
GSTIN is 15 characters with a defined checksum. Entering a malformed GSTIN is accepted silently and breaks Tally export and GSTR-1 generation.

*#69 — No HSN/SAC code autocomplete on item creation*
The item catalog accepts an HSN code field with no lookup or autocomplete. Users must know the correct code externally. Wrong HSN codes break GSTR-1 Table 12.

*#70 — GSTR JSON download not integrated with GST portal API*
GSTR-1 and GSTR-3B JSON can be downloaded but cannot be directly filed. Users must manually upload to gstin.gov.in — an extra manual step on every filing cycle.

*#71 — No debit note (purchase return) creation UI*
⁠ DEBIT_NOTE ⁠ VoucherType exists in the schema and appears in the Transactions ledger, but there is no ⁠ /purchases/return ⁠ or ⁠ /notes/new?type=DEBIT ⁠ flow accessible from any page.

*#72 — No UPI QR code on public bill page*
The public bill has a ⁠ upi:// ⁠ deep link (mobile-only) but no QR image. Desktop users and WhatsApp Web users see dead text. A scannable QR on every invoice is standard in India.

*#73 — Party statement can't be shared*
The party profile shows a ledger but there is no "Export as PDF" or "Send via WhatsApp" action. Sharing an outstanding statement with a debtor is the #1 collections action for dukaan owners.

*#74 — No email verification on registration*
Anyone can claim any email. No OTP or verification link step after signup. Fake accounts can be created against any email address.

*#75 — No password strength policy or strength meter*
Register and admin-create-user accept any string. The 12-character minimum is client-side only with no disclosure until submit fails. No special-character requirement, no strength indicator.

*#76 — No invite link for admin-created users*
Admin sets a password and must tell the user out-of-band. A "Send login link via WhatsApp" button after user creation would eliminate this friction entirely.

### Bill & Payment Workflow

*#77 — No "New Bill" or "Record Payment" quick-action on dashboard*
Quick links go to Tally Export, Reconcile, Reports, Settings. Creating a bill (the #1 action) and recording a payment (the #2 action) have no dashboard shortcut. 3–4 taps to reach the most common action.

*#78 — Dashboard recent activity shows payments only — no recent bills*
For net-30 businesses that bill frequently and collect later, the Recent Activity panel shows empty even if 10 bills were created today. A combined bills+payments feed would better reflect daily activity.

*#79 — No payment reminder / overdue notification system*
The dashboard shows overdue count and amount but there is no automated reminder — no scheduled WhatsApp/SMS/email to customers with outstanding balances. This is the #1 feature request for Indian SMB billing tools.

*#80 — No recurring billing / subscription invoice creation*
Bills must be created manually every time. For monthly rent, retainer, or subscription customers there is no "repeat this bill" or scheduled billing feature.

*#81 — No "Duplicate Purchase" shortcut in purchase detail UI*
⁠ /api/bills/[id]/duplicate ⁠ exists for sales bills. The purchase detail page has no equivalent. Vendors often send recurring monthly invoices — duplication in one click is standard.

*#82 — ⁠ window.confirm() ⁠ on impersonation (full read-write access)*
The superadmin impersonation button uses a native browser confirm dialog — broken in PWA mode and provides zero context about which tenant or access level. An audited, high-privilege action needs a proper confirmation modal.

*#83 — ⁠ window.confirm() ⁠ used for item delete, user deactivate, template column delete, and bill series*
Beyond the already-listed critical cases, ⁠ window.confirm() ⁠ is used in at least 4 more places. All are non-functional in PWA mode and should use the existing ⁠ ConfirmModal ⁠ component.

*#84 — Bill finalize sends full bill body in PATCH — stale client state can overwrite newer server state*
⁠ execStatus("FINAL") ⁠ sends all bill fields (rows, totals, etc.) in the PATCH. If the bill was edited in another session between page load and finalize, the stale client version overwrites silently. Should send only ⁠ { status: "FINAL" } ⁠.

*#85 — Finalize then re-fetch is fire-and-forget — bill can show stale state on success*
After ⁠ execStatus ⁠ succeeds, the second fetch to refresh bill state is not fully awaited. If that fetch fails, the UI shows a success toast but retains pre-status data.

*#86 — Reconcile commit role check not enforced in UI — STAFF sees and clicks Commit*
The commit API requires ADMIN or ACCOUNTANT, but STAFF users see the full wizard including the "Commit" button. Clicking it returns a 403 shown as a generic error toast with no explanation.

### UX & Settings

*#87 — Bill series prefix validation described in help text but not enforced in UI*
Rules are documented in tooltip text but not validated client-side. An invalid prefix only errors after the API call fails.

*#88 — Bill series uses raw ⁠ <input type="radio"> ⁠ instead of HeroUI component*
Design system inconsistency — hover state, dark mode, focus ring, and touch target size all differ from HeroUI inputs.

*#89 — Bank reconciliation wizard uses raw ⁠ <select> ⁠ and ⁠ <input type="date"> ⁠ — dark mode broken*
Bank selector and date inputs are native HTML elements that ignore Tailwind dark mode. They render as bright-white OS-default inputs inside a dark-themed page.

*#90 — No mobile trigger for global search (Cmd+K only)*
The global search opens via Cmd+K or a custom window event. There is no search icon, FAB, or any visible trigger in the mobile layout. Mobile users have no discoverable way to access search.

*#91 — Global search item results navigate to the items list page, not a specific item*
When a search result is an item, the app navigates to ⁠ /settings/items ⁠ — the flat list with no highlighting. There is no item detail/permalink page. Items need a detail page or anchor-scroll to the specific item.

*#92 — CA portal shows loading skeletons before a 403 for non-accountant users*
Non-accountant users who navigate to ⁠ /ca ⁠ see full loading skeleton states before receiving an error — the page appears to have loaded but is empty, rather than proactively blocking access.

*#93 — General ledger account picker exposes internal accounting codes to business owners*
The General Ledger report shows all accounts including ⁠ CGST_INPUT ⁠, ⁠ SGST_OUTPUT ⁠, ⁠ ROUND_OFF ⁠, ⁠ OWNER_EQUITY ⁠. Business owners have no context for these codes. Should filter to business-facing accounts by default with an "Advanced" toggle.

*#94 — Day Book has no source-document link*
The Day Book shows voucher type, narration, and amounts but no link to the originating bill, payment, or purchase. Accountants can't investigate discrepancies.

*#95 — Banking ledger has no search, amount filter, or date filter*
The passbook-style ledger has no way to find a specific entry. A bank account with 500+ transactions has no practical search path.

*#96 — Party ledger dropdown in Reports is unusable at scale*
The party ledger report uses a plain ⁠ <select> ⁠ with all parties loaded at mount. 500+ parties causes slow rendering and no type-to-filter. Should use ⁠ PartySearch ⁠ autocomplete.

*#97 — Tally import has no cancel button during processing*
Once started, there is no cancel. A user who uploaded the wrong XML must wait for the full import (potentially 10+ minutes) before starting over.

*#98 — Reports page fires two simultaneous API calls on every date change with no debounce*
Both the trial balance and GST fetches fire on every date change. Rapid date adjustments produce O(n) redundant requests.

*#99 — Tally import polling uses fixed 2-second interval with no backoff*
A 10-minute import generates 300 network requests. Should use exponential backoff (2s → 4s → 8s → capped at 30s).

*#100 — Tally export WhatsApp delivery sends a text link, not the XML file*
⁠ wa.me/?text= ⁠ cannot attach files. The user gets a WhatsApp compose box with a download link, not the XML. The "Share via WhatsApp" CTA is misleading.

*#101 — Tally export CA email: no validation, confusing blank-recipient mailto*
If ⁠ caEmail ⁠ is empty, the "Email to CA" button opens ⁠ mailto:?subject=... ⁠ with no recipient. Most mail clients open a blank compose window with no obvious error.

*#102 — Measurements page: no pagination, no search debounce*
⁠ fetchMeasurements ⁠ sends the full query string on every keystroke with no debounce, and fetches all results. 200+ measurements = one full-table query per keypress.

*#103 — No last-login timestamp on users management page*
Tenant admins cannot identify inactive or stale user accounts (departed employees, test accounts) without a last-login indicator.

*#104 — Template editor: no drag-and-drop column reorder*
Column reordering requires clicking up/down arrows repeatedly. For templates with 10+ columns, this is tedious. Standard drag-and-drop is the expected UX.

*#105 — Tally export "this quarter" uses calendar-math, not GST quarters*
⁠ getDateRange() ⁠ uses ⁠ Math.floor(currentMonth / 3) ⁠ — calendar quarters (Jan–Mar, Apr–Jun). GST quarters are Apr–Jun (Q1), Jul–Sep (Q2), Oct–Dec (Q3), Jan–Mar (Q4). A user exporting "this quarter" in January expects Q3 (Oct–Dec) data but gets Jan–Mar calendar data.

*#106 — No bulk WhatsApp reminder from the parties list*
The bulk reminder modal exists but cannot be reached from the individual party profile page. The two reminder surfaces are disconnected.

*#107 — Plan limits not shown on user management page*
A FREE tenant at their 1-user limit has no visual feedback ("1 of 1 users used") before they try to add a user and receive an error.

*#108 — Dashboard "top parties" widget fetches recently-created parties, not highest-balance*
⁠ /api/parties?limit=5 ⁠ uses default sort order. The widget is named ⁠ topParties ⁠ implying highest-outstanding balance, but shows newest parties. Disconnect between intent and data.

*#109 — Notes (credit/debit) month grouping uses UTC — wrong month near midnight IST*
⁠ new Date(note.entryDate).getMonth() ⁠ — UTC-based. A note entered near midnight IST appears in the previous month's group.

*#110 — Party profile WhatsApp balance reminder is hardcoded English*
The WhatsApp message template is a hardcoded English string, ignoring the tenant's language preference. The app supports Hindi/regional languages but this user-facing message bypasses the ⁠ t() ⁠ system.

*#111 — Transaction export button says "Export CSV" but downloads ⁠ .xlsx ⁠*
⁠ t("transactions.exportCSV") ⁠ generates an ⁠ .xlsx ⁠ file. The label is wrong.

*#112 — No "Export unmatched rows" from reconciliation*
After reconciliation, AMBIGUOUS rows need investigation. There is no way to export them to a spreadsheet — they must be viewed row-by-row in the UI.

*#113 — ⁠ window.confirm() ⁠ for impersonation in superadmin — breaks in PWA mode*
Same PWA-breakage issue as all other ⁠ confirm() ⁠ usages. Impersonation is an audited, high-privilege action that should use a proper confirmation modal.

*#114 — No "Send Invoice by Email" delivery*
Bills can be shared via WhatsApp link but there is no email delivery. Most B2B customers in India request email invoices for their accounting software.

*#115 — Offline sync polls IndexedDB every 30 seconds even when queue is empty*
The 30-second interval runs unconditionally even when there are no pending drafts — wasteful battery/network usage for users who never use offline upload.

*#116 — Dashboard Tally export nudge uses JS local month, not IST*
⁠ now.getMonth() ⁠ determines the quarterly nudge display. On UTC servers, this could show or hide the nudge a day early/late at financial quarter boundaries.

*#117 — Party profile "Total Billed" and "Last Payment" labels not translated*
"Total Billed", "bills", "Last Payment", "since last pay", "no payments yet" are hardcoded English strings on the party detail page, breaking Hindi/regional language mode.

*#118 — CA portal Journal Entries tab shows "requires PRO plan" for ACCOUNTANT role*
The ACCOUNTANT role can only be assigned on PRO plan. The "requires PRO plan" message on the accountant portal is redundant and confusing.

*#119 — No copy-to-clipboard fallback on bill share (desktop)*
When ⁠ navigator.share ⁠ is unsupported, ⁠ window.open(whatsappUrl) ⁠ opens a new tab. There is no "Copy link" option for users who want to paste the link into email or another app.

*#120 — Public bill has no interactive payment affordance on desktop*
The shared invoice has no "Pay Now" button, no UPI QR, no bank transfer instructions. Payment intent drops to near-zero for desktop recipients.

*#121 — Inter-state checkbox has no mobile tooltip*
⁠ title="Auto-detected from party GSTIN" ⁠ is desktop-only. On mobile, the greyed-out checkbox is unexplained with no indication of why it's disabled.

*#122 — Place of Supply has a hardcoded Hindi placeholder in an otherwise English UI*
⁠ edit/page.tsx ⁠: ⁠ "State select karo" ⁠ — an untranslated string in the middle of an English form.

*#123 — Tour mode after first bill creation leaves user on stale form with no CTA*
When ⁠ tourMode && status === "FINAL" ⁠, navigation is suppressed and a tour overlay shows. Dismissing the tour leaves the user on a submitted form with no "Go to Dashboard" or "Create Another Bill" action.

*#124 — Bottom action bar floats 80px above bottom on flat-screen Android phones*
⁠ bottom: "env(safe-area-inset-bottom, 80px)" ⁠ — the fallback applies on browsers that don't support the CSS env() property, not on devices where the safe area is 0px. On flat-screen Android, the bar hangs mid-air.

*#125 — Bank reconciliation CSV format is undocumented in-app*
The reconcile uploader accepts CSV but there's no sample download, column guide, or which-bank-headers-are-recognized help text. Users must guess the format or read source code.

*#126 — No email verification on registration*
Anyone can register with any email address with no OTP or verification step. Fake accounts can be created freely.

*#127 — ⁠ initialTransactions: any[] ⁠ on transactions ledger component — TypeScript disabled*
The main data type of the journal ledger view is ⁠ any[] ⁠. A silent API shape change renders the ledger blank with no compile-time warning.

---

## 🟢 P3 — Polish & Technical Debt

*#128 — Dashboard bill totals use ⁠ createdAt ⁠, not ⁠ date ⁠*
The "Billed This Month" query is ⁠ createdAt: { gte: monthStart } ⁠. A bill dated last month but created this month counts in the wrong period. GSTR reports correctly use ⁠ date ⁠; the dashboard should too.

*#129 — Overdue calculation uses last-payment date, not due date*
A customer who paid 31 days ago on a 45-day credit term is flagged overdue. There is no ⁠ dueDate ⁠ concept on bills — "overdue" means "no payment in 30 days," which is a rough proxy, not an accurate calculation.

*#130 — Notifications can't be dismissed or snoozed*
The notifications panel regenerates on every load. A user who is aware of their overdue bills but can't resolve them immediately sees the same warning badge permanently with no snooze or dismiss action.

*#131 — "Downgrade plan" CTA is a disabled button with no explanation*
The billing page shows a disabled "Downgrade" button. There's no explanation that downgrade means cancelling the current subscription. The Cancel button is visually separate. Users don't know they're connected.

*#132 — Mobile role column hidden on users table — admin can't see roles without opening Edit*
On mobile, the users table shows only Name + Actions. The admin must open Edit on each row to see a user's role.

*#133 — ⁠ window.confirm ⁠ on Duplicate button blocked on some Android browsers*
Samsung Internet and older Chrome silently suppress ⁠ window.confirm() ⁠ dialogs, meaning the duplicate fires without user confirmation.

*#134 — ⁠ lib/share.ts ⁠ appends a raw ⁠ upi:// ⁠ link to the WhatsApp message*
On desktop WhatsApp Web or iOS without a UPI app, ⁠ upi://pay?... ⁠ is dead unclickable text. No QR fallback, no explanation.

*#135 — i18n coverage is inconsistent across key pages*
The bill edit page, settings/company page, and BillActionBar contain hardcoded English strings not behind translation keys. Hindi/Hinglish UI mode gets a hybrid experience on the most-used pages.

*#136 — ⁠ settings/company/page.tsx ⁠ calls Dexie/IndexedDB at top level without SSR guard*
⁠ handleResetLocalData ⁠ calls ⁠ db.measurementDrafts.clear() ⁠ without checking if IndexedDB is available. Could fail during SSR or in environments without IndexedDB support.

*#137 — ⁠ subscription.created ⁠ SubscriptionEvent missing idempotencyKey*
The subscribe route creates a ⁠ SubscriptionEvent ⁠ without an ⁠ idempotencyKey ⁠. A double-tap on Subscribe before navigation creates a duplicate row.

*#138 — Error messages on billing page render far below the triggering action*
Error state renders below the plan cards table, far from the Cancel button at the top. On a small screen, a user who triggers cancel sees no feedback and may re-tap.

*#139 — Reports page: no client-side validation that date ⁠ from <= to ⁠*
The custom date range accepts ⁠ from > to ⁠. The backend returns empty or incorrect results silently. A simple inline error message would prevent confusing "no data" states.

*#140 — Year-end close: loading preview even when year is already closed*
The component always fetches the preview on mount, even when the year is in ⁠ closedYears ⁠. Should detect this immediately and skip the skeleton, showing "Already closed" directly.

*#141 — BankLedgerClient entry deletion uses ⁠ router.refresh() ⁠ — full-page re-render*
After deleting a payment, ⁠ router.refresh() ⁠ triggers a full server-side re-render. For large ledgers (1000+ entries) this is slow. Should filter the deleted entry from local state optimistically.

*#142 — Bank reconciliation ₹1 amount tolerance misses service-charge-adjusted payments*
Indian banks frequently deduct ₹2–₹5 in SMS charges or NEFT fees. The ₹1 matching tolerance means these adjusted payments consistently fail to auto-match.

*#143 — Bank reconciliation greedy matching is not globally optimal*
Two statement rows that both score best against the same payment result in one going unmatched, even if a globally optimal pairing exists. A stable-match or Hungarian-assignment algorithm would improve reconciliation quality.

*#144 — Bank reconciliation ignores UPI transaction IDs in descriptions*
Description matching checks party names only. UPI payments include a unique reference ID that could be matched exactly against stored UPI payment notes — the highest-confidence match signal, currently unused.

*#145 — Dashboard ⁠ showTallyNudge ⁠ uses JS local month, not IST*
⁠ new Date().getMonth() ⁠ determines the quarterly nudge. On UTC servers, could fire a day early/late at financial quarter boundaries.

*#146 — Party profile "Total Billed" is stale after in-session bill creation*
⁠ totalBilled ⁠ is computed from the initial server-fetched ⁠ billsList ⁠ prop. If a bill is created for this party in another tab, the total remains stale until a hard reload.

*#147 — Party profile hardcoded English strings ("Total Billed", "since last pay", etc.)*
Several labels in the party detail view bypass the ⁠ t() ⁠ translation system, breaking Hindi/regional language mode.

*#148 — Template column ⁠ crypto.randomUUID() ⁠ IDs are client-side temporaries*
New column IDs are generated client-side. Formula columns reference other columns by these IDs. A save race or load-before-IDs-sync can silently break formula references.

*#149 — ⁠ useSync ⁠ has no IndexedDB error handling for private browsing*
⁠ db.measurementDrafts.toArray() ⁠ is called with no try/catch. In Safari private mode, IndexedDB is blocked and throws synchronously — an unhandled exception that can crash the hook.

*#150 — Bill detail re-fetch after status change not fully awaited*
After ⁠ execStatus ⁠ succeeds, the second fetch to refresh bill state can fail silently — success toast shows but bill data remains in old state.

*#151 — ⁠ PurchaseDetail ⁠ TypeScript interface uses "customerName/customerPhone" for vendor fields*
The purchase detail interface copied the bill interface verbatim, naming vendor fields as "customer" fields. Semantically wrong and confusing for future developers.

*#152 — ⁠ numberToWords ⁠ returns "Zero Rupees Only" for amounts ₹0.01–₹0.49*
⁠ Math.round(amount) ⁠ — a grand total of ₹0.25 (e.g. after round-off) prints "Zero Rupees Only" while the number shows ₹0.25. Creates compliance risk on printed invoices.

**#153 — No ⁠ robots.txt ⁠ exclusion for ⁠ /admin/* ⁠ and ⁠ /api/* ⁠ paths**
Only the public invoice page has ⁠ noindex ⁠. Admin routes, API routes, and tenant app pages have no ⁠ noindex ⁠ headers or ⁠ robots.txt ⁠ disallow rules.

*#154 — Public bill page uses ⁠ <img> ⁠ for company logo — not Next.js ⁠ <Image> ⁠*
Generates a build warning and misses lazy loading, WebP conversion, and size hints. Fine functionally but adds build noise.

*#155 — No rate limiting on the public bill endpoint*
⁠ GET /app/(public)/bill/[id] ⁠ has no rate limiting. A bot could enumerate bill IDs and harvest customer data from shared invoice pages.

*#156 — ⁠ BillActionBar ⁠ shows "Record Payment" for DRAFT bills*
Payment against a DRAFT bill is accounting-invalid — the bill has no journal entry yet. The CTA should be hidden until the bill is FINAL.

*#157 — Bill share button visible for CANCELLED bills with no feedback on tap*
The Share button guard checks ⁠ !== "DRAFT" ⁠ — a cancelled bill remains shareable in the UI. Tapping Share on a cancelled bill silently does nothing.

*#158 — No no-results state on global search for zero matches*
When Cmd+K search returns no results, the UX depends on implementation — if not handled gracefully, the user sees an empty list with no "No results found" message.

*#159 — Tally export "this quarter" uses wrong quarter definition*
⁠ Math.floor(currentMonth / 3) ⁠ produces calendar quarters, not Indian GST quarters. A user exporting "this quarter" in January expects Q3 (Oct–Dec) GST data but gets Jan–Mar.

*#160 — WhatsApp party profile reminder language hardcoded to English*
The per-party WhatsApp button generates a hardcoded English message, while the bulk reminder endpoint respects tenant language preference. Inconsistent behavior across the two reminder surfaces.

*#161 — Offline sync polls IndexedDB every 30 seconds even when queue is empty*
The 30-second ⁠ setInterval ⁠ calls ⁠ db.measurementDrafts.toArray() ⁠ unconditionally. Should check queue size first and only poll when there are pending drafts.

*#162 — CA portal "requires PRO plan" message for ACCOUNTANT role is redundant*
The ACCOUNTANT role requires PRO plan — so if you're an accountant, you're already on PRO. The message is always false-positive.

*#163 — ⁠ window.print() ⁠ public bill — also generates a Next.js build warning*
After the P0 fix (move to a client component), the current code also generates a build warning that obscures other real build errors in the output log.

*#164 — Bulk reconciliation commit has no "N rows will be left unmatched" summary screen*
Users commit reconciliation without knowing how many rows were unreviewed. A pre-commit summary showing matched/unmatched/ignored counts would prevent accidental commits.

*#165 — General ledger in reports has no "Show all" vs "Summarized" view toggle*
The general ledger shows individual journal lines. For a high-volume account (SALES with 1000+ entries), there's no summarized/aggregated view — only a flat line-by-line list.

*#166 — Tally import resumes active jobs on mount but shows no indication to the user*
The import page calls ⁠ /api/import/active ⁠ on mount and resumes polling for any in-progress job. If a job is already running from a previous session, the user sees a polling indicator appear with no explanation of why the page "already knows" about a job.

*#167 — ⁠ settings/company ⁠ has a "Reset Local Data" button that calls IndexedDB without an SSR guard*
⁠ handleResetLocalData ⁠ calls ⁠ db.measurementDrafts.clear() ⁠ at render time. Could fail in SSR environments or browsers blocking IndexedDB (private mode, storage quota exceeded).

*#168 — No search in bill series management*
If a business has multiple bill series (e.g. series per shop, per FY), there's no search or filter. They appear as a flat list.

*#169 — Payments list has no "filter by mode" (Cash / UPI / Bank)*
The payments page shows all payment types together. A user reconciling cash-in-hand needs to filter to cash payments only — no filter exists.

*#170 — No export of AMBIGUOUS reconciliation rows to CSV for manual investigation*
After reconciliation, AMBIGUOUS rows represent transactions that need investigation. There is no way to export them — each must be reviewed row-by-row in the UI.

---

## Top 10 to Fix First

| # | Priority | What | Why |
|---|----------|------|-----|
| 1 | 🔴 P0 | Dashboard ⁠ useState ⁠ in ⁠ .map() ⁠ (#10) | Every user sees a broken dashboard |
| 2 | 🔴 P0 | Plan feature gates on API routes (#1) | Direct revenue leak |
| 3 | 🔴 P0 | Purchase finalize calls bills API (#13) | Purchase status mgmt completely broken |
| 4 | 🔴 P0 | ⁠ window.print() ⁠ in Server Component (#11) | Print broken on all shared invoices |
| 5 | 🔴 P0 | Unauthenticated import endpoint (#12) | Security hole |
| 6 | 🔴 P0 | No email delivery for password reset (#3) | Users locked out forever |
| 7 | 🟠 P1 | CGST/SGST rounding on printed invoice (#24) | GST audit risk |
| 8 | 🟠 P1 | Tally import AccountCode gaps (#30) | Import crashes on real Tally files |
| 9 | 🟠 P1 | Per-row GST corruption on edit (#23) | Silent accounting error |
| 10 | 🟠 P1 | Reconciliation commit has no accounting impact (#19) | Compliance gap |

---

## Feature Wishlist (Fully Absent — Not in Codebase)

| Feature | Why It Matters |
|---------|----------------|
| E-invoicing / IRN generation | Mandatory for >₹5Cr turnover (CBIC requirement) |
| TDS tracking (194C/194J) | Required for service/contractor payments; Form 26Q filing |
| GSTR-2A/2B reconciliation | Top GST feature request; ITC discrepancy detection |
| Payment reminders (WhatsApp/SMS scheduled) | #1 collection tool for Indian SMBs |
| Recurring / scheduled billing | Monthly rent, retainers, subscription invoices |
| GST portal API integration | Direct GSTR-1/3B filing without manual JSON upload |
| Email invoice delivery | B2B customers request email invoices for their own accounting |
| UPI QR code on public invoice | Standard on every Indian invoice; desktop users can't pay |
| Party statement PDF share | Outstanding balance PDF → WhatsApp in one tap |
| Pro-forma invoices | Quote → Proforma → Invoice workflow |
| Purchase order tracking | PO → GRN → Invoice 3-way match for inventory businesses |
| Multi-currency support | Exporters/importers dealing in USD/EUR |

---

Full static analysis of the codebase — read-only, no code modified. May 2026.

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
