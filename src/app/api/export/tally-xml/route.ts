import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveReadTenant } from "@/lib/api-tenant";
import { parseIndianDateRange } from "@/lib/journal-reporting";
import { logError, getRequestId } from "@/lib/observability";
import {
  buildTallyVoucherXml,
  buildTallyPartyMasterXml,
  dbVoucherTypeToTally,
  journalLineToTallyEntry,
  type TallyPartyMaster,
  type TallyVoucher,
} from "@/lib/tally-xml";

export const runtime = "nodejs";

/**
 * Generate a Tally-importable XML export for an authenticated tenant for a given date range.
 *
 * Validates the `from` and `to` query parameters and an optional `type` (`vouchers`, `masters`, `all`).
 * Only users with `x-user-role` of `ADMIN` or `ACCOUNTANT` are permitted. The export is blocked if the tenant has unbalanced journal entries.
 *
 * @param request - Incoming request carrying `from`, `to`, and optional `type` query parameters and the `x-user-role` header
 * @returns A NextResponse containing the generated Tally XML as an attachment; the filename reflects the requested date range and requested `type`
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

      const partyMasters: TallyPartyMaster[] = parties.map((p) => ({
        name: p.name,
        group: p.type === "CUSTOMER" ? "Sundry Debtors" : "Sundry Creditors",
        openingBalance: p.openingBalance,
        phone: p.phone,
        email: p.email,
        address: p.address,
        gstin: p.gstin,
      }));

      if (type === "masters") {
        xml = buildTallyPartyMasterXml(partyMasters, companyName);
        return xmlResponse(xml, `tally_masters_${from}_to_${to}.xml`);
      }

      // For "all" — we'll combine below
      const mastersXml = buildTallyPartyMasterXml(partyMasters, companyName);
      xml += mastersXml;
    }

    // ── Vouchers ─────────────────────────────────────────────────────────────
    if (type === "vouchers" || type === "all") {
      const entries = await prisma.journalEntry.findMany({
        where: {
          tenantId,
          entryDate: { gte: fromDate, lte: toDate },
        },
        orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
        include: { lines: true },
      });

      const vouchers: TallyVoucher[] = entries.map((entry) => ({
        date: entry.entryDate,
        voucherType: dbVoucherTypeToTally(entry.voucherType),
        reference:
          entry.billId ?? entry.purchaseId ?? entry.paymentId ?? entry.id,
        narration: entry.narration,
        ledgerEntries: entry.lines.map(journalLineToTallyEntry),
      }));

      const vouchersXml = buildTallyVoucherXml(vouchers, companyName);

      if (type === "vouchers") {
        return xmlResponse(vouchersXml, `tally_vouchers_${from}_to_${to}.xml`);
      }

      // For "all" — append vouchers after masters
      // Strip XML declaration from second doc and wrap both in one envelope
      xml = buildCombinedXml(
        entries,
        await prisma.party.findMany({
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
        }),
        companyName,
        from,
        to
      );
    }

    return xmlResponse(xml, `tally_export_${from}_to_${to}.xml`);
  } catch (error) {
    logError("export.tally-xml.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Create a NextResponse that serves the given XML as a downloadable attachment.
 *
 * @param xml - The XML payload to send in the response body
 * @param filename - The attachment filename used in the `Content-Disposition` header
 * @returns A NextResponse containing `xml` and headers `Content-Type: application/xml; charset=utf-8` and `Content-Disposition: attachment; filename="..."` 
 */
function xmlResponse(xml: string, filename: string) {
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/**
 * Produce a concatenated XML payload containing party masters followed by vouchers.
 *
 * The output contains two separate XML documents (masters first, then vouchers) separated by comment headers so they can be imported to Tally in that order.
 *
 * @returns A single string with the party-masters XML followed by the vouchers XML and comment headers; masters appear before vouchers.
 */
function buildCombinedXml(
  entries: Array<{
    id: string;
    entryDate: Date;
    voucherType: string;
    narration: string;
    billId: string | null;
    purchaseId: string | null;
    paymentId: string | null;
    lines: Array<{
      accountName: string;
      debit: number;
      credit: number;
      partyName: string | null;
    }>;
  }>,
  parties: Array<{
    name: string;
    type: string;
    openingBalance: number;
    phone: string | null;
    email: string | null;
    address: string | null;
    gstin: string | null;
  }>,
  companyName: string,
  from: string,
  to: string
): string {
  const partyMasters: TallyPartyMaster[] = parties.map((p) => ({
    name: p.name,
    group: p.type === "CUSTOMER" ? "Sundry Debtors" : "Sundry Creditors",
    openingBalance: p.openingBalance,
    phone: p.phone,
    email: p.email,
    address: p.address,
    gstin: p.gstin,
  }));

  const vouchers: TallyVoucher[] = entries.map((entry) => ({
    date: entry.entryDate,
    voucherType: dbVoucherTypeToTally(entry.voucherType),
    reference: entry.billId ?? entry.purchaseId ?? entry.paymentId ?? entry.id,
    narration: entry.narration,
    ledgerEntries: entry.lines.map(journalLineToTallyEntry),
  }));

  // Combine: masters XML + vouchers XML as one comment-separated file
  // We return two separate XML documents joined — the user imports them
  // sequentially, or we return them as a zip (future enhancement).
  // For now, return masters followed by vouchers as separate XML declarations.
  const mastersXml = buildTallyPartyMasterXml(partyMasters, companyName);
  const vouchersXml = buildTallyVoucherXml(vouchers, companyName);

  return (
    `<!-- HisaabKitaab Tally Export: ${from} to ${to} -->\n` +
    `<!-- Step 1: Import party masters (ledger definitions) -->\n` +
    mastersXml +
    `\n\n<!-- Step 2: Import vouchers -->\n` +
    vouchersXml
  );
}
