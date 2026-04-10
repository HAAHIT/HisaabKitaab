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

function xmlResponse(xml: string, filename: string) {
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/**
 * Builds a single XML envelope containing both party masters and vouchers.
 * Masters come first so Tally creates ledgers before processing vouchers.
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

  const messages = [
    ...partyMasters.map(p => `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <LEDGER NAME="${escapeXmlForCombine(p.name)}" ACTION="Create">
        <NAME>${escapeXmlForCombine(p.name)}</NAME>
        <PARENT>${escapeXmlForCombine(p.group)}</PARENT>
        ${p.openingBalance !== 0 ? `<OPENINGBALANCE>${p.openingBalance < 0 ? "-" : ""}${Math.abs(p.openingBalance).toFixed(2)}</OPENINGBALANCE>` : ""}
        ${p.gstin ? `<GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE><PARTYGSTIN>${escapeXmlForCombine(p.gstin)}</PARTYGSTIN>` : ""}
        ${p.address ? `<ADDRESS.LIST TYPE="String"><ADDRESS>${escapeXmlForCombine(p.address)}</ADDRESS></ADDRESS.LIST>` : ""}
      </LEDGER>
    </TALLYMESSAGE>`),
    ...vouchers.map(v => {
      const ledgerLines = v.ledgerEntries.map(entry => {
        const billAllocations = entry.partyName
          ? `
        <BILLALLOCATIONS.LIST>
          <NAME>${escapeXmlForCombine(entry.partyName)}</NAME>
          <BILLTYPE>On Account</BILLTYPE>
          <AMOUNT>${entry.amount >= 0 ? "" : "-"}${Math.abs(entry.amount).toFixed(2)}</AMOUNT>
        </BILLALLOCATIONS.LIST>`
          : "";

        return `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${escapeXmlForCombine(entry.ledgerName)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>${entry.amount >= 0 ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
        <AMOUNT>${entry.amount >= 0 ? "" : "-"}${Math.abs(entry.amount).toFixed(2)}</AMOUNT>${billAllocations}
      </ALLLEDGERENTRIES.LIST>`;
      }).join("");

      return `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <VOUCHER VCHTYPE="${escapeXmlForCombine(v.voucherType)}" ACTION="Create" OBJVIEW="Accounting Voucher View">
        <DATE>${formatTallyDateForCombine(v.date)}</DATE>
        <VOUCHERTYPENAME>${escapeXmlForCombine(v.voucherType)}</VOUCHERTYPENAME>
        <VOUCHERNUMBER>${escapeXmlForCombine(v.reference)}</VOUCHERNUMBER>
        <NARRATION>${escapeXmlForCombine(v.narration)}</NARRATION>${ledgerLines}
      </VOUCHER>
    </TALLYMESSAGE>`;
    })
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- HisaabKitaab Tally Export: ${from} to ${to} -->
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXmlForCombine(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>${messages.join("")}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

function escapeXmlForCombine(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatTallyDateForCombine(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replace(/-/g, ""); // YYYY-MM-DD → YYYYMMDD
}
