import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveReadTenant } from "@/lib/api-tenant";
import { parseIndianDateRange } from "@/lib/journal-reporting";
import { logError, getRequestId } from "@/lib/observability";
import {
  buildTallyVoucherXml,
  buildTallyPartyMasterXml,
  buildCombinedTallyXml,
  resolveExportVoucherType,   // [A4] Sales Return detection for cancellation entries
  journalLineToTallyEntry,
  type TallyPartyMaster,
  type TallyVoucher,
} from "@/lib/tally-xml";

export const runtime = "nodejs";

/**
 * Extracts unique HSN/SAC codes from a bill's JSON rows array.
 *
 * Convention: when a bill row references an ItemCatalog item with a
 * hsnCode, the UI writes `_hsnCode` into the row object alongside the
 * template columns.  This is an optional additive key — absent on
 * existing bills created before the convention was introduced.
 */
function extractHsnCodes(rows: unknown, billLevelHsn?: string | null): string[] {
  if (!Array.isArray(rows)) return billLevelHsn ? [billLevelHsn.trim()] : [];
  const codes = new Set<string>();
  if (billLevelHsn) codes.add(billLevelHsn.trim());
  for (const row of rows) {
    if (row && typeof row === "object") {
      const hsnCode = (row as Record<string, unknown>)["_hsnCode"];
      if (typeof hsnCode === "string" && hsnCode.trim()) {
        codes.add(hsnCode.trim());
      }
    }
  }
  return [...codes];
}

/**
 * Extracts unique (HSN code, tax rate) pairs from bill rows.
 *
 * Used to emit one <GSTDETAILS.LIST> per (HSN, rate) pair so that bills
 * containing items at multiple GST rates produce correct GSTR-1 Table 12
 * entries in TallyPrime.
 *
 * Convention:
 *   _hsnCode     — HSN/SAC code (from ItemCatalog or manually entered)
 *   _taxPercent  — per-line GST rate (optional; absent on pre-migration rows)
 *
 * Returns an empty array when rows lack `_taxPercent`, so the caller falls
 * back to the flat `hsnCodes` list with the bill-level rate.
 */
function extractHsnRatePairs(
  rows: unknown,
  billLevelTaxPercent?: number | null,
  billLevelHsn?: string | null
): Array<{ hsnCode: string; taxPercent: number }> {
  if (!Array.isArray(rows)) {
    if (billLevelHsn && typeof billLevelTaxPercent === "number" && Number.isFinite(billLevelTaxPercent)) {
      return [{ hsnCode: billLevelHsn.trim(), taxPercent: billLevelTaxPercent }];
    }
    return [];
  }
  const pairs: Array<{ hsnCode: string; taxPercent: number }> = [];
  let hasPerLineRate = false;

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;

    let hsnCode =
      typeof r["_hsnCode"] === "string" ? r["_hsnCode"].trim() : null;
    
    if (!hsnCode && billLevelHsn) hsnCode = billLevelHsn.trim();
    if (!hsnCode) continue;

    // Per-line rate is present only when the UI writes _taxPercent per row
    const rawRate = r["_taxPercent"];
    if (typeof rawRate === "number" && Number.isFinite(rawRate)) {
      hasPerLineRate = true;
      pairs.push({ hsnCode, taxPercent: rawRate });
    } else if (typeof billLevelTaxPercent === "number" && Number.isFinite(billLevelTaxPercent)) {
      // Fallback: use the bill-level rate for this HSN
      pairs.push({ hsnCode, taxPercent: billLevelTaxPercent });
    }
  }

  // If no row had an explicit _taxPercent we return empty, which signals the
  // caller to use the simpler extractHsnCodes path (backwards-compatible).
  if (!hasPerLineRate) {
    if (billLevelHsn && typeof billLevelTaxPercent === "number" && Number.isFinite(billLevelTaxPercent) && pairs.length === 0) {
      return [{ hsnCode: billLevelHsn.trim(), taxPercent: billLevelTaxPercent }];
    }
    return [];
  }
  return pairs;
}

/**
 * GET /api/export/tally-xml
 *
 * Query params:
 *   from        YYYY-MM-DD  start of date range (IST)
 *   to          YYYY-MM-DD  end of date range (IST)
 *   type        "vouchers" | "masters" | "all"  (default: "all")
 *
 * Returns a single Tally-importable XML file.
 * Import party masters first, then vouchers — or use type=all to get both
 * in one file (masters first, then vouchers).
 *
 * Access: ADMIN and ACCOUNTANT only.
 */
export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");

  if (role !== "ADMIN" && role !== "ACCOUNTANT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenantResolution = resolveReadTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const type = searchParams.get("type") || "all";

  if (!from || !to) {
    return NextResponse.json(
      { error: "Date range (from, to) is required" },
      { status: 400 }
    );
  }

  if (!["vouchers", "masters", "all"].includes(type)) {
    return NextResponse.json(
      { error: "type must be one of: vouchers, masters, all" },
      { status: 400 }
    );
  }

  let fromDate: Date;
  let toDate: Date;
  try {
    ({ fromDate, toDate } = parseIndianDateRange(from, to));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid date range" },
      { status: 400 }
    );
  }

  try {
    // Block export if any entries are unbalanced
    const unbalanced = await prisma.journalEntry.count({
      where: { tenantId, isBalanced: false },
    });
    if (unbalanced > 0) {
      return NextResponse.json(
        {
          error: `Export blocked: ${unbalanced} unbalanced journal entries. Contact support.`,
          unbalancedCount: unbalanced,
        },
        { status: 409 }
      );
    }

    // Load tenant name for the Tally company field
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });
    const companyName = tenant?.name ?? "Company";

    let xml = "";

    // ── Party masters ────────────────────────────────────────────────────────
    let fetchedParties: TallyPartyMaster[] = [];

    if (type === "masters" || type === "all") {
      const parties = await prisma.party.findMany({
        where: { tenantId, isDeleted: false },
        select: {
          name: true,
          type: true,
          openingBalance: true,
          phone: true,
          email: true,
          address: true,
          gstin: true,
        },
        orderBy: { name: "asc" },
      });

      fetchedParties = parties.map((p: (typeof parties)[number]) => ({
        name: p.name,
        group: p.type === "CUSTOMER" ? "Sundry Debtors" : "Sundry Creditors",
        openingBalance: p.openingBalance.toNumber(),
        phone: p.phone,
        email: p.email,
        address: p.address,
        gstin: p.gstin,
      }));

      if (type === "masters") {
        xml = buildTallyPartyMasterXml(fetchedParties, companyName);
        return xmlResponse(xml, `tally_masters_${from}_to_${to}.xml`);
      }
    }

    // ── Vouchers ─────────────────────────────────────────────────────────────
    if (type === "vouchers" || type === "all") {
      // [P2] Pagination guard: refuse date ranges that would produce >5000 vouchers
      // in a single request to prevent OOM crashes on large books.
      // Callers should split large ranges by quarter or month.
      const MAX_VOUCHERS = 5_000;
      const voucherCount = await prisma.journalEntry.count({
        where: { tenantId, entryDate: { gte: fromDate, lte: toDate } },
      });

      if (voucherCount > MAX_VOUCHERS) {
        return NextResponse.json(
          {
            error:
              `Date range contains ${voucherCount} vouchers, which exceeds the ` +
              `${MAX_VOUCHERS}-voucher limit per export. ` +
              `Split the range into shorter periods (e.g. by quarter) and export each separately.`,
            voucherCount,
            maxVouchers: MAX_VOUCHERS,
          },
          { status: 400 }
        );
      }

      const entries = await prisma.journalEntry.findMany({
        where: {
          tenantId,
          entryDate: { gte: fromDate, lte: toDate },
        },
        orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          entryDate: true,
          voucherType: true,
          narration: true,
          billId: true,
          purchaseId: true,
          paymentId: true,
          isReverseCharge: true, // [P1] RCM flag — wired to <ISREVERSECHARGE> in Tally XML
          lines: true,
          // Join Bill to get GST fields required for Tally XML compliance.
          // Only SALES and CREDIT_NOTE entries have a billId; others get null.
          bill: {
            select: {
              billNumber: true,
              taxPercent: true,
              isInterState: true,
              placeOfSupply: true,
              hsnCode: true,
              rows: true,
              cessAmount: true,  // [Task 3b] Cess amount for tobacco/luxury goods
              gstin: true, // [P1] Used to emit SOURCEOFDETAILS=Autofill for registered parties
            },
          },
        },
      });

      // [G-W2] Resolve purchase bills for GST metadata.
      // `purchaseId` is a plain string (not a Prisma relation), so we batch-query.
      const purchaseIds = entries
        .filter((e: (typeof entries)[number]) => !e.bill && e.purchaseId)
        .map((e: (typeof entries)[number]) => e.purchaseId as string);
      const purchaseBillMap = new Map<string, (typeof entries)[number]["bill"]>();
      if (purchaseIds.length > 0) {
        const purchaseBills = await prisma.bill.findMany({
          where: { id: { in: purchaseIds }, tenantId },
          select: {
            id: true,
            billNumber: true,
            taxPercent: true,
            isInterState: true,
            placeOfSupply: true,
            hsnCode: true,
            rows: true,
            cessAmount: true,
            gstin: true,
          },
        });
        for (const pb of purchaseBills) {
          purchaseBillMap.set(pb.id, pb);
        }
      }

      const vouchers: TallyVoucher[] = entries.map((entry: (typeof entries)[number]) => {
        // Use direct bill relation for sales, or secondary lookup for purchases
        const billData = entry.bill ?? (entry.purchaseId ? purchaseBillMap.get(entry.purchaseId) : null) ?? null;
        return {
          date: entry.entryDate,
          voucherType: resolveExportVoucherType(entry.voucherType, entry.narration),
          reference:
            billData?.billNumber ?? entry.purchaseId ?? entry.paymentId ?? entry.id,
          narration: entry.narration,
          ledgerEntries: entry.lines.map((line) =>
            journalLineToTallyEntry({
              ...line,
              debit: line.debit.toNumber(),
              credit: line.credit.toNumber(),
            })
          ),
          guid: entry.id,
          placeOfSupply: billData?.placeOfSupply ?? null,
          taxPercent: billData?.taxPercent.toNumber() ?? null,
          isInterState: billData?.isInterState ?? false,
          // [Task 3b] Real cess amount replaces the hardcoded 0
          cessAmount: billData?.cessAmount.toNumber() ?? 0,
          // [Task 3c] Per-line (HSN, rate) pairs for GSTR-1 Table 12 compliance.
          // Falls back to legacy flat hsnCodes when rows lack _taxPercent.
          hsnRatePairs: extractHsnRatePairs(billData?.rows, billData?.taxPercent.toNumber(), billData?.hsnCode),
          hsnCodes: extractHsnCodes(billData?.rows, billData?.hsnCode),
          gstin: billData?.gstin ?? null,
          isReverseCharge: entry.isReverseCharge,
        };
      });

      // [FIX-P2] Count vouchers with tax > 0% but no HSN code (either format).
      // These will produce incomplete GSTR-1 Table 12 entries in Tally.
      const hsnMissingCount = vouchers.filter(
        (v) =>
          (v.taxPercent ?? 0) > 0 &&
          (v.hsnRatePairs ?? []).length === 0 &&
          (v.hsnCodes ?? []).length === 0
      ).length;

      const hsnWarningComment =
        hsnMissingCount > 0
          ? `<!-- WARNING: ${hsnMissingCount} voucher(s) have tax > 0% but no HSN/SAC code. GSTR-1 Table 12 may be incomplete. -->`
          : "";

      if (type === "vouchers") {
        let voucherXml = buildTallyVoucherXml(vouchers, companyName);
        if (hsnWarningComment) {
          voucherXml = voucherXml.replace(
            '<?xml version="1.0" encoding="UTF-8"?>',
            `<?xml version="1.0" encoding="UTF-8"?>\n${hsnWarningComment}`
          );
        }
        return xmlResponse(voucherXml, `tally_vouchers_${from}_to_${to}.xml`, hsnMissingCount);
      }

      // For "all" — append vouchers after masters
      let combinedXml = buildCombinedXml(fetchedParties, vouchers, companyName, from, to);
      if (hsnWarningComment) {
        combinedXml = combinedXml.replace(
          '<?xml version="1.0" encoding="UTF-8"?>',
          `<?xml version="1.0" encoding="UTF-8"?>\n${hsnWarningComment}`
        );
      }
      xml = combinedXml;
    }

    return xmlResponse(xml, `tally_export_${from}_to_${to}.xml`);
  } catch (error) {
    logError("export.tally-xml.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function xmlResponse(xml: string, filename: string, hsnMissingCount = 0) {
  const headers: Record<string, string> = {
    "Content-Type": "application/xml; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
  };
  if (hsnMissingCount > 0) {
    // Surface HSN gap count so the UI / CI pipeline can show a warning banner.
    headers["X-HisaabKitaab-HSN-Missing"] = String(hsnMissingCount);
  }
  return new NextResponse(xml, { headers });
}

function buildCombinedXml(
  parties: TallyPartyMaster[],
  vouchers: TallyVoucher[],
  companyName: string,
  from: string,
  to: string
): string {
  const combinedXml = buildCombinedTallyXml(parties, vouchers, companyName);
  return combinedXml.replace(
    '<?xml version="1.0" encoding="UTF-8"?>\n<ENVELOPE>',
    `<?xml version="1.0" encoding="UTF-8"?>\n<!-- HisaabKitaab Tally Export: ${from} to ${to} -->\n<ENVELOPE>`
  );
}
