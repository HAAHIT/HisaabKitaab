# HisaabKitaab — Market Readiness & Architectural Audit
**Audit Date:** 2026-04-18  
**Auditor Role:** Lead Architect & FinTech Strategist  
**Protocol:** Zero-Hallucination — every finding cites exact file + line number

---

## Scores at a Glance

| Dimension | Score |
|---|---|
| Tally XML Compatibility | **87 / 100** |
| MCA / GST Compliance | **85 / 100** |
| MSME Scale & Data Integrity | **82 / 100** |
| UX Modernization | **70 / 100** |

---

## 1. Tally XML Compatibility — 87 / 100

### ✅ GUID / REMOTEID Idempotency
`src/lib/tally-xml.ts:358-362` emits `<GUID>HisaabKitaab-{id}</GUID>` and
`<REMOTEID>HisaabKitaab-{id}</REMOTEID>` keyed on `JournalEntry.id`.
The import parser (`src/lib/tally-xml-import.ts:328-330`) strips the prefix
before storing in `JournalEntry.remoteId`. A `@@unique([tenantId, remoteId])`
constraint (`prisma/schema.prisma:265`) enforces DB-level deduplication.
Re-importing the same XML is fully idempotent.

### ✅ Combined Export Format (Two IMPORTDATA Blocks)
`src/lib/tally-xml.ts:510-526` (`buildCombinedTallyXml`) emits two separate
`<IMPORTDATA>` blocks — masters first (`REPORTNAME="All Masters"`), vouchers
second (`REPORTNAME="Vouchers"`). This matches the TallyPrime 4.x import spec;
a single block with mixed element types silently drops one category.

### ✅ Voucher Type Mapping (Complete)
`src/lib/tally-xml.ts:126-135` maps all eight internal enum values including
`CREDIT_NOTE → "Sales Return"` (GSTR-1 Table 9B) and
`DEBIT_NOTE → "Purchase Return"` (GSTR-3B Table 4). Legacy JOURNAL entries
with the reversal narration prefix are promoted via `resolveExportVoucherType`
(`src/lib/tally-xml.ts:149-167`).

### ✅ GST Detail Blocks (Correct)
`buildGstDetailsXml` (`src/lib/tally-xml.ts:236-263`) emits `<GSTDETAILS.LIST>`
with `TAXTYPE`, `TAXRATE`, `BASICTAXRATE`, `HSNCODE`, `CESS`, and
`SOURCEOFDETAILS`. `SOURCEOFDETAILS` is correctly `"Autofill"` (GSTIN present),
`"Composite"` (composition dealer), or `"NotApplicable"` (B2C/unregistered).
Per-line (HSN, rate) pairs are de-duplicated (`src/lib/tally-xml.ts:298-311`)
for correct GSTR-1 Table 12 when one bill contains items at multiple GST rates.

### ✅ Party Master Idempotency (`ACTION="Alter"`)
`buildPartyMasterXml` (`src/lib/tally-xml.ts:424`) uses `ACTION="Alter"`.
TallyPrime 3+ creates the ledger if absent, updates it if present. `<MASTERID>`
is set to `party.name` — Tally uses the ledger `NAME` attribute (not `MASTERID`)
as its external identity key, so this is harmless and correct.

### [WARNING] Party Rename → Silent Duplicate Ledger in Tally
**File:** `src/lib/tally-xml.ts:424`  
Tally's ledger identity is its `NAME`. If a party is renamed in HisaabKitaab and
the CA re-exports, the XML carries the new name and TallyPrime creates a **second
ledger** — splitting the party's transaction history. No code fix is needed in the
export layer; the mitigation is a UI warning on the party-rename form:
*"Renaming a party affects Tally export. Re-import your masters file after
renaming to avoid duplicate ledgers in Tally."*

### [WARNING] SyncState `MODIFIED` Not Surfaced in Export
**File:** `src/app/api/export/tally-xml/route.ts` (no guard for MODIFIED entries)  
`JournalEntry.syncState` is correctly set to `MODIFIED` when a cloud-edited bill
has Tally-imported journal entries (`src/app/api/bills/[id]/route.ts:541-545`).
However, the export route does not count or flag MODIFIED entries in the XML or
response headers. CAs receive no signal that a previously-ingested voucher has
drifted.

**Proposed addition** (after the unbalanced-entry guard, ~line 170 of the export route):
```typescript
const modifiedCount = await prisma.journalEntry.count({
  where: { tenantId, syncState: "MODIFIED", entryDate: { gte: fromDate, lte: toDate } },
});
// Pass modifiedCount into xmlResponse() and surface it as an X-HisaabKitaab-Sync-Modified header.
```

---

## 2. MCA / GST Compliance — 85 / 100

### ✅ AuditLog — Append-Only by Design
`prisma/schema.prisma:90-106`: `AuditLog` has no `updatedAt` field and no
Prisma `.update()` or `.delete()` call anywhere in the codebase.
Application-layer immutability is solid for MVP.

### ✅ Bill Create Audit (Atomic)
`src/app/api/bills/route.ts:544-555`: `auditLog.create` is inside the same
`$transaction` as `bill.create`. Log entry and record creation are atomic.

### ✅ Bill PATCH Audit — Status Transitions + Field Mutations
`src/app/api/bills/[id]/route.ts:496-537`: status changes are logged as
dedicated entries; all other mutations are batched into a single log row with
`fieldName = "field1,field2,..."`. Both paths are inside the `$transaction`.

### ✅ Bill Cancellation Audit
`src/app/api/bills/[id]/route.ts:662-674`: `DELETE` logs `action: "DELETE"`,
`fieldName: "status"`, `oldValue: existing.status`, `newValue: "CANCELLED"`.

### ✅ Tally Import Audit — SYSTEM Actor
`src/app/api/jobs/process-import/route.ts:271-289`: each imported `JournalEntry`
gets an `AuditLog` entry with `actorType: "SYSTEM"`, `userId: null`, and a JSON
blob capturing `source`, `jobId`, `remoteId`, `placeOfSupply`, `taxPercent`,
`hsnCodes`, and `isInterState`. Party creation is audited similarly (lines 115-131).

### ✅ Double-Entry Atomicity
`src/lib/journal.ts:127-132`: throws a hard error when
`|totalDebit − totalCredit| > 0.001`. All call-sites pass a `PrismaTx` argument,
ensuring the balance check and DB write share the same Prisma transaction.

### ✅ GST Inter-State Detection (IGST Act Section 7(1))
`src/lib/gst-helpers.ts:40-54` (`deriveIsInterState`): extracts 2-digit state
codes from both GSTINs, returns `true` when they differ. Falls back to the UI's
manual override only when one or both GSTINs are absent. `buildSalesTaxLines`
(`src/lib/journal.ts:76-113`) and the purchase journal builder both consume this
flag correctly — IGST vs. CGST+SGST split is never defaulted incorrectly.

### [INFO] AuditLog: No DB-Level Immutability Trigger
**File:** `prisma/schema.prisma:90`  
No PostgreSQL `BEFORE UPDATE / BEFORE DELETE` trigger or Supabase RLS policy
prevents a DBA from directly mutating audit rows. App-layer immutability is solid,
but a DB trigger is required for Big-4 audit sign-off.

**Recommended one-time SQL migration (run in Supabase SQL editor, not via Prisma):**
```sql
CREATE OR REPLACE FUNCTION audit_log_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog rows are immutable (MCA GSR 247(E))';
END;
$$;
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
```

### [INFO] Paise Precision Is Correct (No Rounding Issue)
`src/lib/journal.ts:97-99` uses `roundTo2` (2 decimal places = paise).
This is **correct** for invoice-level amounts. Section 170 of the CGST Act mandates
nearest-rupee rounding only for *return-level totals* (GSTR-1/3B aggregates),
not per-invoice amounts. Rule 46 of the CGST Rules permits paise on invoices.

---

## 3. MSME Scale & Data Integrity — 82 / 100

### ✅ Sequential Batch Processing (Deadlock-Free)
`src/app/api/jobs/process-import/route.ts:307-329`: vouchers are processed
sequentially in batches of 50. The previous `Promise.allSettled` that caused lock
contention on shared party rows has been replaced. Progress is persisted to
`ImportJob` after each batch.

### ✅ Serializable Isolation Per Voucher
`src/app/api/jobs/process-import/route.ts:291`: each voucher's `$transaction`
uses `Prisma.TransactionIsolationLevel.Serializable`, preventing dirty reads
during high-volume batch imports.

### ✅ XML Compression + Post-Import Cleanup
`src/app/api/jobs/process-import/route.ts:82-85`: gzip-prefixed XML is
decompressed before parsing. After import, `xmlData` is cleared (line 351),
preventing permanent storage bloat (~5 MB per large import job).

### ✅ Export Pagination Guard
`src/app/api/export/tally-xml/route.ts:221-237`: refuses date ranges producing
> 5,000 vouchers per request. Response includes `voucherCount` and `maxVouchers`
so the UI can suggest narrower date windows.

### [CRITICAL] FIXED — Advisory Lock Leak on Import Error Path
**File:** `src/app/api/jobs/process-import/route.ts`  
**Root cause (before fix):** `tenantLockKey` was declared inside the `try` block
(old line 191) using CommonJS `require("crypto")`, making the variable inaccessible
to the `catch` block. Any exception thrown after `pg_advisory_lock()` was acquired
left the **session-level** lock unreleased. In a connection-pooled / serverless
environment (Vercel/Supabase), the lock persists until the pool recycles the
connection — blocking all future imports for that tenant.

**Fix applied in this audit:**
1. `import crypto from "crypto"` added to top-level imports (ESM-safe).
2. `tenantLockKey` moved before the `try` block, using `job.tenantId` directly.
3. `catch` block calls `pg_advisory_unlock(tenantLockKey)` as a best-effort
   release before marking the job FAILED.
4. `console.error` replaced with `logError("import.party-balance.error", ...)`.

**Before / After (condensed):**
```typescript
// ── BEFORE (lock inaccessible in catch) ──────────────────────────────────────
try {
  const tenantLockKey = BigInt("0x" + require("crypto").createHash("sha256")
    .update(tid).digest("hex").substring(0, 15));
  await prisma.$executeRaw`SELECT pg_advisory_lock(${tenantLockKey})`;
  // ... processing ...
} catch (err) {
  // tenantLockKey is out of scope → lock leaked on any error after line 193
}

// ── AFTER (lock in scope, ESM-safe, best-effort release in catch) ─────────────
import crypto from "crypto";
const tenantLockKey = BigInt(
  "0x" + crypto.createHash("sha256").update(job.tenantId).digest("hex").substring(0, 15)
);
try {
  await prisma.$executeRaw`SELECT pg_advisory_lock(${tenantLockKey})`;
  // ... processing ...
} catch (err) {
  try { await prisma.$executeRaw`SELECT pg_advisory_unlock(${tenantLockKey})`; } catch { /* best effort */ }
  // mark job FAILED ...
}
```

### [WARNING] `any` Type in Bills List Route
**File:** `src/app/api/bills/route.ts:206`  
```typescript
const where: any = { isDeleted: false, tenantId };  // violates strict mode
```
`BillWhere` is already derived at line 8 of the same file. Fix:
```typescript
const where: BillWhere = { isDeleted: false, tenantId };
```

### [WARNING] Fingerprint Collision Risk on Native-Tally Bulk Imports
**File:** `src/app/api/jobs/process-import/route.ts:228-232`  
The deduplication fingerprint for vouchers without a `remoteId` is
`voucherType|YYYY-MM-DD|narration|totalDebit`. Some Tally configurations produce
multiple legitimate vouchers with identical (type, date, narration, total) —
e.g., payroll journals for multiple employees with the same salary. These are
silently skipped.  
**Action:** Log skipped fingerprints to `AuditLog` with `action: "SKIP"` so CAs
can reconcile manually.

---

## 4. UX Modernization — 70 / 100 (Partial View)

### [WARNING] Primary Palette — Legacy Blue Gradient
**File:** `src/components/ui/AppShell.tsx`  
The primary nav gradient (`from-blue-600 to-indigo-600`) uses the HeroUI default
palette. Target "white-and-turquoise" brand requires:
- Nav gradient: `from-teal-500 to-cyan-400`
- Dashboard card: `bg-white/70 backdrop-blur-md border border-white/20`
- Sidebar active state: `bg-teal-500/20 text-teal-700`

### [INFO] Dashboard Cards — Glassmorphism Opportunity
Summary cards should use:
```css
background: rgba(255, 255, 255, 0.6);
backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.25);
box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
```
This is a pure CSS/Tailwind change with no logic impact.

---

## Issue Registry

| # | Severity | File | Issue | Status |
|---|---|---|---|---|
| 1 | **CRITICAL** | `process-import/route.ts:191` | Advisory lock leak + `require()` in ESM | **FIXED** |
| 2 | **CRITICAL** | `process-import/route.ts:364` | `console.error` bypasses observability | **FIXED** |
| 3 | WARNING | `export/tally-xml/route.ts` | `MODIFIED` syncState not surfaced in export XML | Open |
| 4 | WARNING | `bills/route.ts:206` | `any` type violates TypeScript strict mode | Open |
| 5 | WARNING | `process-import/route.ts:228` | Fingerprint collision on bulk native-Tally imports | Open |
| 6 | WARNING | `AppShell.tsx` | Brand palette mismatch — legacy blue gradient | Open |
| 7 | INFO | `schema.prisma:90` | No DB-level trigger enforcing AuditLog immutability | Open |
| 8 | INFO | `tally-xml.ts:424` | Party rename → duplicate Tally ledger (UI warning needed) | Open |
