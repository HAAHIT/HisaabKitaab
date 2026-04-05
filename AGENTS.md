<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# HisaabKitaab — Coding Rules for AI Agents

## Stack

- **Next.js 16** (App Router, `src/` layout) — read `node_modules/next/dist/docs/` before touching routing or middleware
- **Prisma 6** with PostgreSQL (Supabase) — always use ORM methods, never `$executeRaw` or `$queryRaw` unless there is no ORM equivalent (e.g. `pg_advisory_xact_lock`)
- **TypeScript strict mode** — no `any` casts, no `// @ts-ignore`
- **HeroUI + Tailwind 4** for UI components

---

## Tenant Isolation (Non-negotiable)

Every DB query must be scoped to `tenantId`. There are two resolution strategies — use the correct one:

| Operation | Function | Why |
|-----------|----------|-----|
| GET (read-only) | `resolveTenantIdFromRequest(request)` from `@/lib/tenant` | Fast, header-based |
| POST / PATCH / PUT / DELETE | `await resolveVerifiedTenantId(request)` from `@/lib/session-server` | JWT-verified, spoofing-safe |

Never use header-based resolution for writes. Never use `getTenantId()` (server-component helper) in API routes.

---

## API Route Conventions

- Import `logError, getRequestId` from `@/lib/observability` in every route file — never use `console.error`
- Structured log events follow dot-notation: `"bills.create.error"`, `"payments.complete.error"`, etc.
- Role checks come before tenant checks, always
- Return shapes: `{ data }` on success, `{ error: string }` on failure
- Status codes: 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 500 unexpected
- Rate-limit mutations with `await checkRateLimit(request, "key", limit)` from `@/lib/api-rate-limit`

---

## Accounting & Journal Rules

This app implements **double-entry bookkeeping** compatible with Tally ERP 9 / Tally Prime.

### Chart of Accounts

All account codes are defined in `src/lib/chart-of-accounts.ts`. Every `AccountCode` maps to a `tallyGroup` — this group name must match Tally's exact group hierarchy exactly (e.g. `"Sundry Debtors"`, `"Duties & Taxes"`, `"Bank Accounts"`). Do not rename groups.

Current accounts:
- `SALES`, `PURCHASE` — income/expense
- `SUNDRY_DEBTORS`, `SUNDRY_CREDITORS` — party balances
- `CASH`, `BANK`, `UPI` — payment instruments
- `CGST_OUTPUT`, `SGST_OUTPUT`, `IGST_OUTPUT` — output tax liabilities
- `CGST_INPUT`, `SGST_INPUT`, `IGST_INPUT` — input tax assets
- `OWNER_EQUITY`, `OPENING_BALANCE` — equity

### Journal Entry Rules

- Every entry must be balanced (total debit = total credit) — enforced in `src/lib/journal.ts`
- Use `CGST + SGST` (50/50 split) for **intra-state** transactions
- Use `IGST` (full amount) for **inter-state** transactions — the `isInterState` flag must be passed when building tax lines; defaulting to intra-state is wrong
- Never create journal entries outside a Prisma transaction
- `VoucherType` must match the operation: `SALES` for bills, `RECEIPT`/`PAYMENT` for payments, `JOURNAL` for adjustments

### Party Balance

- `currentBalance` is a denormalized running total — update it atomically inside the same transaction as the triggering record
- Negative balance = party owes us (customer) or we owe them (vendor), depending on `PartyType`
- Use `getPostedBillBalanceDelta`, `getPaymentBalanceDelta`, `getBillBalanceDeltaForTransition` from `src/lib/accounting.ts` — do not compute deltas inline
- Use `recomputePartyBalance` (same file) to verify or repair a balance — it is safe inside and outside transactions

---

## Tally Export / Import Support

HisaabKitaab maintains first-class compatibility with **Tally ERP 9** and **Tally Prime**. All accounting data must be structured so it can be exported to and imported from Tally without data loss.

### Tally XML (TDL) Export

- The export format is Tally's native XML — `<ENVELOPE>` → `<TALLYMESSAGE>` → `<VOUCHER>` structure
- Each `JournalEntry` in the DB maps to one Tally voucher
- `JournalLine.tallyGroup` must always be populated — it drives Tally's ledger classification
- `JournalLine.accountName` must match the ledger name as it will appear in Tally exactly
- Date format for Tally XML: `YYYYMMDD` (e.g. `20240401`) — use IST timezone always
- Amount format: plain decimal, no currency symbol, 2 decimal places
- Voucher types map as: `SALES` → `"Sales"`, `PURCHASE` → `"Purchase"`, `RECEIPT` → `"Receipt"`, `PAYMENT` → `"Payment"`, `JOURNAL` → `"Journal"`

### Tally Import Rules

- When importing from Tally XML, resolve party names to existing `Party` records by exact name match first, then phone
- Vouchers without a matching party should create a new `Party` record, not fail silently
- Duplicate voucher detection: match on `(voucherType, entryDate, narration, totalDebit)` — if all four match an existing `JournalEntry`, skip with a warning, do not duplicate
- All imported entries must pass the balance check before being committed
- GST ledger names from Tally (`"CGST"`, `"SGST"`, `"IGST"`) must be mapped to the corresponding `AccountCode`

### Financial Year

- Indian financial year runs **April 1 → March 31**
- Use `getCurrentFinancialYearRange()` from `src/lib/journal-reporting.ts` for all FY-scoped queries
- Quarter boundaries: Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar

### Export Endpoints

Export routes live under `src/app/api/export/`:
- `GET /api/export/transactions` — journal entries as CSV (ADMIN + ACCOUNTANT only)
- `GET /api/export/party-ledger` — party ledger as CSV
- `GET /api/export/trial-balance` — trial balance as CSV
- Future: `GET /api/export/tally-xml` — full Tally-compatible XML voucher dump

Exports are blocked if any `JournalEntry.isBalanced === false` exists for the tenant.

---

## Schema Conventions

- All models have `tenantId` — always include it in `where` clauses
- Soft deletes via `isDeleted: Boolean @default(false)` — never hard-delete billing records
- Use `cuid()` for all IDs
- Timestamps always in UTC in the DB; convert to IST only at display layer
- Run `npx prisma db pull` before adding new models to sync with Supabase, then add the model and run `npx prisma db push`

---

## Do Not

- Do not write raw SQL (`$executeRaw`, `$queryRaw`) except for `pg_advisory_xact_lock`
- Do not use `console.error/log/warn` — use `logError/logInfo/logWarn` from `@/lib/observability`
- Do not compute party balance deltas inline — use the functions in `src/lib/accounting.ts`
- Do not add new `AccountCode` values without a corresponding `tallyGroup` mapping
- Do not create journal entries that are unbalanced — the journal lib will throw
- Do not use intra-state tax split for inter-state transactions
- Do not bypass tenant scoping for any reason
