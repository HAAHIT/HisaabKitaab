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
function extractHsnCodes(rows: unknown): string[] {
  if (!Array.isArray(rows)) return [];
  const codes = new Set<string>();
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
              taxPercent: true,
              isInterState: true,
              placeOfSupply: true,
              rows: true,
              gstin: true, // [P1] Used to emit SOURCEOFDETAILS=Autofill for registered parties
            },
          },
        },
      });

      const vouchers: TallyVoucher[] = entries.map((entry: (typeof entries)[number]) => ({
        date: entry.entryDate,
        // [A4] resolveExportVoucherType handles CREDIT_NOTE / DEBIT_NOTE (primary paths) and
        //      legacy JOURNAL entries with "Reversal of Sales Bill" narration.
        voucherType: resolveExportVoucherType(entry.voucherType, entry.narration),
        reference:
          entry.billId ?? entry.purchaseId ?? entry.paymentId ?? entry.id,
        narration: entry.narration,
        ledgerEntries: entry.lines.map(journalLineToTallyEntry),
        // [A2] Stable GUID prevents duplicate entries on Tally re-import.
        guid: entry.id,
        // GST fields — populated from linked Bill when available.
        // Absent for RECEIPT / PAYMENT / JOURNAL entries (no billId).
        placeOfSupply: entry.bill?.placeOfSupply ?? null,
        taxPercent: entry.bill?.taxPercent.toNumber() ?? null,
        isInterState: entry.bill?.isInterState ?? false,
        hsnCodes: extractHsnCodes(entry.bill?.rows),
        // [P1] gstin flows into SOURCEOFDETAILS: Autofill (registered) vs NotApplicable (B2C/unregistered)
        gstin: entry.bill?.gstin ?? null,
        // [P1] RCM flag — emits <ISREVERSECHARGE>Yes</ISREVERSECHARGE> for GSTR-3B ITC
        isReverseCharge: entry.isReverseCharge,
      }));

      // [FIX-P2] Count vouchers with tax > 0% but no HSN code.
      // These will produce incomplete GSTR-1 Table 12 entries in Tally.
      const hsnMissingCount = vouchers.filter(
        (v) => (v.taxPercent ?? 0) > 0 && (v.hsnCodes ?? []).length === 0
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
