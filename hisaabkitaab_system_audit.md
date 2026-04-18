# HisaabKitaab — Comprehensive System Audit Report

**Audit Date:** 2026-04-18
**Auditor Role:** Staff FinTech Architect & Principal Auditor
**Protocol:** Zero-Hallucination — every finding cites exact file + line number
**Scope:** System Readiness, Market Readiness, Legal Compliance, Tally Interoperability

---

## Scores at a Glance

| Dimension | Score | Verdict |
|---|---|---|
| **System Architecture Readiness** | **91 / 100** | Production-ready |
| **Tally Interoperability** | **85 / 100** | Strong, 2 gaps |
| **Legal Compliance (MCA / GST)** | **78 / 100** | 1 Critical gap |
| **Market Readiness & UX** | **82 / 100** | Modern, minor polish needed |

**Composite Score: 84 / 100** — Conditionally market-ready. Must close the 3 Critical findings before GA launch.

---

## 1. SYSTEM ARCHITECTURE READINESS — 91 / 100

### 1.1 Double-Entry Atomicity — PASS

Every financial mutation is wrapped in a Prisma `$transaction` with a hard balance check.

| Route | Transaction | Balance Check | Advisory Lock |
|---|---|---|---|
| `POST /api/bills` | `bills/route.ts:505` | `journal.ts:127` | `bills/route.ts:508` |
| `PATCH /api/bills/[id]` | `bills/[id]/route.ts:489` | `journal.ts:127` | Implicit (no concurrent bill numbering) |
| `DELETE /api/bills/[id]` | `bills/[id]/route.ts:656` | `journal.ts:127` | Implicit |
| `POST /api/payments` | `payments/route.ts:182` | `journal.ts:127` | `payments/route.ts:185` |
| `PATCH /api/payments` | `payments/route.ts:351` | `journal.ts:127` | `payments/route.ts:354` |
| Tally Import | `process-import/route.ts:260` | `journal.ts:127` | `process-import/route.ts:202` |

**Balance enforcement** (`journal.ts:127-132`): Tolerance of 0.001 on `Decimal(19,4)` fields. Any residual above this threshold throws `UNBALANCED JOURNAL ENTRY` — a hard error that rolls back the transaction. No unbalanced entry can reach the database.

**Line validation** (`journal.ts:134-146`): Each journal line is checked for mutual exclusivity (debit XOR credit) and non-zero amount. Zero-amount lines are rejected.

### 1.2 Bulk Upload Resilience — PASS (with advisory)

**Serializable isolation** (`process-import/route.ts:300`): Each voucher import uses `Prisma.TransactionIsolationLevel.Serializable`, preventing dirty reads and phantom inserts during concurrent imports.

**Sequential batching** (`process-import/route.ts:316-338`): Vouchers are processed sequentially within batches of 50 (replaced earlier `Promise.allSettled` that caused deadlocks). Party pre-resolution uses batches of 25 (`process-import/route.ts:183-188`).

**Tenant-scoped locking** (`process-import/route.ts:202`): Session-level `pg_advisory_lock` scoped to tenant via SHA-256 hash. Lock release is handled in both success (`line 341`) and error (`line 381`) paths.

**[WARNING] Session-level vs transaction-level lock**: `process-import/route.ts:202` uses `pg_advisory_lock` (session-level) instead of `pg_advisory_xact_lock` (transaction-level). Session-level locks persist beyond transaction boundaries and require explicit `pg_advisory_unlock`. While the code handles this correctly in both paths, a Node.js process crash between lock acquisition and release would leak the lock until the database connection is recycled. In serverless/pooled environments (Supabase), this can block subsequent imports for the tenant.

> **Recommendation**: Consider wrapping the entire import loop in a single transaction with `pg_advisory_xact_lock`, or implementing a lock timeout (`SET LOCAL lock_timeout`) as a safety net.

### 1.3 Schema Protection — PASS

**Constrained Customization pattern enforced:**
- `BillTemplate.columns` (`schema.prisma:112`) stores UI column definitions (id, name, type, position) — presentation metadata only.
- All financial totals live in typed `Decimal(19,4)` columns on `Bill` (`schema.prisma:152-156`).
- Bill `rows` JSON stores line-item display data; financial aggregation is computed server-side and stored in typed columns.
- HSN codes follow a standardized `_hsnCode` convention within rows — an additive key, not unstructured data.

No path exists for unstructured "custom template" data to corrupt the core financial ledger.

### 1.4 Tenant Isolation — PASS

**Write paths**: All mutations use `resolveWriteTenant()` (`api-tenant.ts:41-55`), which calls `resolveVerifiedTenantId()` (`session-server.ts:16-40`) — JWT cookie verification via `jose.jwtVerify()`. No fallback to unverified headers on write paths.

**Read paths**: Use `resolveReadTenant()` (`api-tenant.ts:26-38`), which reads from the `x-tenant-id` header set by middleware. Acceptable for reads; the middleware is the trust boundary.

**Database scoping**: Every query includes `tenantId` in `where` clauses. `Party` has `@@unique([tenantId, name])` (`schema.prisma:201`), `Bill` has `@@unique([tenantId, billNumber])` (`schema.prisma:174`), `JournalEntry` has `@@unique([tenantId, remoteId])` (`schema.prisma:265`).

---

## 2. TALLY INTEROPERABILITY — 85 / 100

### 2.1 GUID / REMOTEID Idempotency — PASS

**Export** (`tally-xml.ts:358-362`): Emits `<GUID>HisaabKitaab-{id}</GUID>` and `<REMOTEID>HisaabKitaab-{id}</REMOTEID>` keyed on `JournalEntry.id`.

**Import** (`tally-xml-import.ts:326-330`): Strips "HisaabKitaab-" prefix before storing in `JournalEntry.remoteId`.

**DB constraint** (`schema.prisma:265`): `@@unique([tenantId, remoteId])` — DB-level deduplication. Unique constraint violations are caught (`process-import/route.ts:304`) and treated as "skipped" (not "failed").

**Fingerprint deduplication** (`process-import/route.ts:211-226`): For vouchers without remoteId, a `(voucherType|dateStr|narration|totalDebit)` fingerprint is checked against existing entries. DB-side concatenation query keeps comparison server-side.

**Verdict**: Re-importing the same XML is fully idempotent. Zero duplicate ledgers.

### 2.2 Bi-Directional Sync Safety — PARTIAL PASS

**SyncState enum** (`schema.prisma:362-366`): `SYNCED | MODIFIED | PENDING` on `JournalEntry`.

**PATCH handler** (`bills/[id]/route.ts:542-545`):
```typescript
await tx.journalEntry.updateMany({
  where: { billId: updatedBill.id, remoteId: { not: null } },
  data: { syncState: "MODIFIED" },
});
```
Correctly marks Tally-imported vouchers as MODIFIED when the linked bill is edited.

**[CRITICAL] DELETE handler missing syncState update** (`bills/[id]/route.ts:614-738`): When a bill is cancelled via DELETE, the handler creates a reversal journal entry (`journalForCancelledSalesBill` at line 715) but does NOT mark the original Tally-imported journal entry as MODIFIED. If a CA re-exports after a cancellation, the original entry will still show `syncState=SYNCED`, creating a false impression that the voucher is unchanged in the cloud. The reversal entry itself will export correctly, but the original will not carry a divergence warning.

**File**: `src/app/api/bills/[id]/route.ts`
**Lines**: 656-728 (DELETE handler, inside `$transaction`)
**Severity**: CRITICAL

### 2.3 Payment Settlement Links — PARTIAL PASS

**BILLALLOCATIONS.LIST** (`tally-xml.ts:280-287`):
```typescript
const isSettlement = (voucherType === "Receipt" || voucherType === "Payment") && entry.reference;
const billAllocations = entry.partyName ? `
  <BILLALLOCATIONS.LIST>
    <NAME>${escapeXml(entry.reference ?? entry.partyName)}</NAME>
    <BILLTYPE>${isSettlement ? "Against Ref" : "New Ref"}</BILLTYPE>
    ...
  </BILLALLOCATIONS.LIST>` : "";
```

**[WARNING] Payment voucher `<NAME>` uses payment ID, not bill number**: In the export route (`tally-xml/route.ts:298-327`), payment journal entries have `reference: entry.paymentId` (since `billId` is null on payment entries). The `journalLineToTallyEntry` function (`tally-xml.ts:208-224`) does not set `reference` on individual ledger entries. The fallback chain in `buildLedgerEntryXml` line 350 resolves to `voucher.reference` which is the payment ID.

In Tally, `<NAME>` in `BILLALLOCATIONS.LIST` on a "Receipt" voucher with `<BILLTYPE>Against Ref</BILLTYPE>` should contain the **bill number** being settled — not the payment ID. Using the payment ID as NAME means Tally cannot auto-match the receipt to the outstanding bill, leaving the bill open in Tally's Outstanding Reports even though it was paid.

**File**: `src/app/api/export/tally-xml/route.ts`
**Lines**: 298-327
**Severity**: WARNING — does not break import but degrades Tally Outstanding Reports.

### 2.4 Combined Export Format — PASS

`buildCombinedTallyXml` (`tally-xml.ts:510-526`) correctly emits TWO separate `<IMPORTDATA>` blocks — masters with `REPORTNAME="All Masters"` first, then vouchers with `REPORTNAME="Vouchers"`. This matches the TallyPrime 4.x import spec.

### 2.5 Voucher Type Mapping — PASS

**Export**: `resolveExportVoucherType` (`tally-xml.ts:149-167`) correctly maps `CREDIT_NOTE → "Sales Return"`, `DEBIT_NOTE → "Purchase Return"`, with legacy narration-based fallback.

**Import**: `resolveImportVoucherType` (`process-import/route.ts:29-43`) correctly restores `CREDIT_NOTE` / `DEBIT_NOTE` from Tally's "Sales Return" / "Credit Note" / "Purchase Return" / "Debit Note" strings.

### 2.6 GST XML Tags — PASS

- `<PLACEOFSUPPLY>` (`tally-xml.ts:366-371`): Converts 2-digit code → state name via `gstCodeToStateName`.
- `<GSTDETAILS.LIST>` (`tally-xml.ts:256-263`): Emits TAXRATE, BASICTAXRATE, HSNCODE, CESS, SOURCEOFDETAILS.
- `<ISREVERSECHARGE>` (`tally-xml.ts:375-378`): Emitted for RCM purchases.
- `<PARTYLEDGERNAME>` (`tally-xml.ts:382-388`): Derived from first party ledger entry.
- Per-line HSN/rate pairs (`tally-xml/route.ts:55-99`): One `<GSTDETAILS.LIST>` per (HSN, rate) pair for GSTR-1 Table 12 compliance.

---

## 3. LEGAL COMPLIANCE (MCA / GST) — 78 / 100

### 3.1 MCA GSR 247(E) Audit Trail — PARTIAL PASS

**AuditLog model** (`schema.prisma:84-106`): Comprehensive design — `entityType`, `entityId`, `action`, `fieldName`, `oldValue`, `newValue`, `actorType` (USER/SYSTEM). Indexed for tenant-scoped audit queries.

**Coverage matrix:**

| Entity | CREATE | UPDATE | DELETE | Status |
|---|---|---|---|---|
| **Bill** | `bills/route.ts:546-555` | `bills/[id]/route.ts:498-538` | `bills/[id]/route.ts:662-674` | PASS |
| **Payment** | `payments/route.ts:302-310` | `payments/route.ts:414-425` | N/A (no delete endpoint) | PASS |
| **JournalEntry** (import) | `process-import/route.ts:278-299` | N/A | N/A | PASS |
| **Party** (import) | `process-import/route.ts:125-141` | N/A | N/A | PASS |
| **Party** (PATCH) | N/A | **MISSING** | **MISSING** | **CRITICAL** |

**[CRITICAL] Party PATCH and DELETE have NO audit logging**: `src/app/api/parties/[id]/route.ts` lines 66-172 (PATCH) and 174-214 (DELETE) modify/soft-delete `Party` records without creating any `AuditLog` entry. Under MCA GSR 247(E), every CREATE, UPDATE, and DELETE on accounting-relevant entities must be logged. Party records are accounting-relevant — they carry `currentBalance`, `gstin`, and are referenced by Bills and Payments.

A statutory auditor reviewing the AuditLog would find no trail for party name changes, GSTIN updates, or soft deletions. This is a compliance violation.

**File**: `src/app/api/parties/[id]/route.ts`
**Lines**: 152-162 (PATCH update without audit log), 198-204 (DELETE without audit log)
**Severity**: CRITICAL

**[WARNING] No PostgreSQL trigger enforcing AuditLog immutability**: The AuditLog is append-only by convention (no UPDATE/DELETE endpoints in the API), but there is no database-level `BEFORE UPDATE` or `BEFORE DELETE` trigger on the `AuditLog` table to prevent accidental or malicious modification. A direct SQL connection (e.g., Supabase dashboard, migration script) could silently alter or delete audit records.

> **Recommendation**: Add a PostgreSQL trigger:
> ```sql
> CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
> RETURNS TRIGGER AS $$
> BEGIN
>   RAISE EXCEPTION 'AuditLog rows are immutable (MCA GSR 247(E))';
> END;
> $$ LANGUAGE plpgsql;
>
> CREATE TRIGGER audit_log_immutable
> BEFORE UPDATE OR DELETE ON "AuditLog"
> FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
> ```

### 3.2 GST State Machine — PASS

**Inter-state detection** (`gst-helpers.ts:40-54`): `deriveIsInterState` compares first 2 digits of party GSTIN against tenant GSTIN. Auto-detection with manual override fallback.

**Tax line routing** (`journal.ts:76-113`): `buildSalesTaxLines` correctly routes:
- Intra-state → CGST_OUTPUT (half) + SGST_OUTPUT (other half) with pre-rounding
- Inter-state → IGST_OUTPUT (full amount)

**GSTIN validation** (`bills/route.ts:82`): Regex validates 15-character format per GSTN specification.

**State code table** (`gst-states.ts:17-62`): Complete coverage of all 37 states/UTs including pre-2020 merger codes (25/26 for Dadra & Nagar Haveli + Daman & Diu) and special codes (97, 99).

### 3.3 Precision & Rounding — PASS

| Layer | Mechanism | File:Line |
|---|---|---|
| Database | `Decimal(19,4)` | `schema.prisma:129,152-156,188-189,210,245-246,282-283` |
| Journal lines | `roundTo2()` | `journal.ts:119-121,174-175` |
| Tax splitting | Pre-round then split | `journal.ts:97-99` |
| GSTR-3B totals | `roundToRupee()` | `journal-reporting.ts:9-11` |
| Payment amounts | `Math.round(v * 100) / 100` | `payments/route.ts:65` |

All financial fields use exact-precision `Decimal(19,4)`. Sub-paise drift is prevented by pre-rounding tax amounts before the CGST/SGST split (`journal.ts:97`).

### 3.4 Financial Year — PASS

`getCurrentFinancialYearRange` (`journal-reporting.ts:55-66`): Correctly implements April 1 → March 31 with FY label.
`getCurrentQuarterRange` (`journal-reporting.ts:68-86`): Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar — all correct.

### 3.5 GSTR-1 Compliance Gates — PASS

- **Place of Supply required for FINAL bills** (`bills/route.ts:121-131`, `bills/[id]/route.ts:448-461`)
- **HSN required when tax > 0** (`bills/route.ts:134-153`, `bills/[id]/route.ts:465-487`)
- **HSN gap warning on export** (`tally-xml/route.ts:331-341`): XML comment + HTTP header `X-HisaabKitaab-HSN-Missing`
- **Unbalanced entry export block** (`tally-xml/route.ts:159-170`): Refuses export if any `isBalanced=false` entry exists

---

## 4. MARKET READINESS & UX MODERNIZATION — 82 / 100

### 4.1 Glassmorphism & Brand Palette — PASS

**Glass card implementation** (`globals.css:51-63`):
```css
.glass-card {
  background: rgba(255, 255, 255, 0.7) !important;
  backdrop-filter: blur(12px) saturate(180%) !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.08) !important;
}
```
Matches the `bg-white/70 backdrop-blur-md border-white/20` specification. Dark mode variant exists at line 59-63.

**Dashboard usage** (`dashboard/page.tsx:206-356`): All summary cards and chart containers use `glass-card` class. The dashboard is free of generic grid patterns.

**[INFO] Brand palette drift**: The primary accent is blue-indigo gradient (`from-blue-600 to-indigo-600` in `AppShell.tsx:267,289`), not white-and-turquoise. Teal-400 appears as a secondary accent in specific places (dashboard total bills icon at `dashboard/page.tsx:245`, "View All" links at line 289, install button at line 192). The Credit Note button uses `from-teal-500 to-emerald-500` (`AppShell.tsx:691`).

> **Recommendation**: To fully align with the turquoise brand standard, consider updating the primary gradient from `blue-600/indigo-600` to `teal-500/cyan-500` across the sidebar, FAB button, and mobile nav.

### 4.2 Constrained Customization UI — PASS

The `BillTemplate.columns` field stores structured column definitions: each column has `id`, `name`, `type`, and `position`. The frontend renders these as form fields while the backend always stores financial data in typed Decimal columns (`subtotal`, `taxAmount`, `grandTotal`).

HSN codes are stored as a standardized `_hsnCode` key within row objects — not as free-form JSON. The `_taxPercent` per-line rate follows the same convention. This is an additive, constrained key pattern, not an unstructured JSON blob.

### 4.3 Mobile UX — PASS

**Bottom navigation** (`AppShell.tsx:574-642`): Native-feeling mobile nav with glassmorphism (`bg-white/60 backdrop-blur-xl`), FAB button with elevated shadow, role-based item filtering.

**Bottom sheets** (`AppShell.tsx:645-805`): More menu, Quick Bill, Credit/Debit Note actions all use `BottomSheet` component instead of desktop-style modals.

**PWA install prompt** (`dashboard/page.tsx:179-197`): Install banner with teal CTA button.

### 4.4 Internationalization — PASS

**Bilingual support** (`AppShell.tsx:457-461`): EN/HI toggle in sidebar and mobile menu. All UI strings use `useLanguage().t()` with translation keys.

---

## ISSUE REGISTRY

### CRITICAL Issues (3)

| # | Issue | File:Lines | Impact |
|---|---|---|---|
| **C1** | Party PATCH has no AuditLog | `parties/[id]/route.ts:152-162` | MCA GSR 247(E) violation — party updates invisible to auditors |
| **C2** | Party DELETE has no AuditLog | `parties/[id]/route.ts:198-204` | MCA GSR 247(E) violation — party deletions invisible to auditors |
| **C3** | Bill DELETE missing syncState update | `bills/[id]/route.ts:656-728` | Tally sync divergence — cancelled bills show SYNCED |

### WARNING Issues (2)

| # | Issue | File:Lines | Impact |
|---|---|---|---|
| **W1** | Session-level advisory lock in import | `process-import/route.ts:202` | Lock leak risk on process crash in pooled connections |
| **W2** | Payment export uses paymentId as BILLALLOCATIONS NAME | `export/tally-xml/route.ts:304` | Tally Outstanding Reports cannot auto-match receipts to bills |

### INFO Issues (1)

| # | Issue | File:Lines | Impact |
|---|---|---|---|
| **I1** | Brand palette uses blue-indigo, not turquoise | `AppShell.tsx:267,289` | Visual drift from turquoise brand standard |

---

## TOP 3 CRITICAL PATCHES

### Patch 1: Party PATCH — Add MCA-mandated audit logging

**File**: `src/app/api/parties/[id]/route.ts`
**Location**: After line 162 (after `prisma.party.update`)

```typescript
// [MCA GSR 247(E)] Audit trail for party UPDATE — mandatory since April 1 2023.
const changedFields = Object.keys(body);
if (changedFields.length > 0) {
  await prisma.auditLog.create({
    data: {
      tenantId,
      entityType: "Party",
      entityId: party.id,
      userId: request.headers.get("x-user-id") || null,
      action: "UPDATE",
      fieldName: changedFields.join(","),
      oldValue: JSON.stringify(
        Object.fromEntries(
          changedFields.map((f) => [f, (existingParty as Record<string, unknown>)[f]])
        )
      ),
      newValue: JSON.stringify(
        Object.fromEntries(
          changedFields.map((f) => [f, (party as Record<string, unknown>)[f]])
        )
      ),
    },
  });
}
```

### Patch 2: Party DELETE — Add MCA-mandated audit logging

**File**: `src/app/api/parties/[id]/route.ts`
**Location**: After line 203 (after `prisma.party.update` for soft delete)

```typescript
// [MCA GSR 247(E)] Audit trail for party soft-DELETE — mandatory since April 1 2023.
await prisma.auditLog.create({
  data: {
    tenantId,
    entityType: "Party",
    entityId: existingParty.id,
    userId: request.headers.get("x-user-id") || null,
    action: "DELETE",
    fieldName: "isDeleted",
    oldValue: JSON.stringify(false),
    newValue: JSON.stringify(true),
  },
});
```

### Patch 3: Bill DELETE — Add syncState MODIFIED for Tally-imported vouchers

**File**: `src/app/api/bills/[id]/route.ts`
**Location**: Inside the `$transaction` block, after the audit log creation at line 674

```typescript
// [CRITICAL] Tally sync-state — flag original imported vouchers as MODIFIED
// so re-export warns CAs of the cancellation-induced data divergence.
await tx.journalEntry.updateMany({
  where: { billId: existing.id, remoteId: { not: null } },
  data: { syncState: "MODIFIED" },
});
```

---

## ARCHITECTURAL STRENGTHS

1. **Zero-trust tenant isolation**: JWT verification on all write paths, DB-level unique constraints scoped to tenant.
2. **Tally XML round-trip fidelity**: GUID/REMOTEID idempotency, two-IMPORTDATA-block format, ISDEEMEDPOSITIVE-based debit/credit reconstruction.
3. **Exact precision accounting**: `Decimal(19,4)` everywhere, pre-rounded tax splits, `roundToRupee` for GSTR-3B.
4. **Comprehensive GST engine**: Auto-detection from GSTIN state codes, IGST/CGST+SGST routing, RCM flag, per-line HSN/rate pairs, Cess support.
5. **Defensive import pipeline**: Serializable isolation, fingerprint deduplication, batched processing, graceful error handling per voucher.

---

*End of audit report.*
