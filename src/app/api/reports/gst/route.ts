import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";

interface RowRecord { [key: string]: unknown }

interface MonthBucket {
  month: string;        // "Apr 25"
  sortKey: string;      // "2025-04" for ordering
  b2bCount: number;
  b2cCount: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  grandTotal: number;
}

interface HsnBucket {
  hsnCode: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  grandTotal: number;
  invoiceCount: number;
}

interface B2bParty {
  partyName: string;
  gstin: string;
  placeOfSupply: string | null;
  invoiceCount: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  grandTotal: number;
}

// GET /api/reports/gst?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    // Default: current financial year
    const now = new Date();
    const fyStart = now.getMonth() >= 3
      ? new Date(now.getFullYear(), 3, 1)
      : new Date(now.getFullYear() - 1, 3, 1);
    const fyEnd = new Date(fyStart.getFullYear() + 1, 3, 1);

    const from = fromParam ? new Date(fromParam) : fyStart;
    const to   = toParam   ? new Date(toParam)   : fyEnd;

    // Fetch all FINAL bills in range with relevant fields
    const bills = await prisma.bill.findMany({
      where: {
        tenantId,
        isDeleted: false,
        status: "FINAL",
        createdAt: { gte: from, lt: to },
      },
      select: {
        id: true,
        createdAt: true,
        subtotal: true,
        taxPercent: true,
        taxAmount: true,
        grandTotal: true,
        isInterState: true,
        placeOfSupply: true,
        hsnCode: true,
        gstin: true,           // buyer GSTIN (snapshot)
        customerName: true,
        rows: true,
        party: { select: { name: true, gstin: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // ── Aggregate buckets ─────────────────────────────────────────────────────
    const monthMap = new Map<string, MonthBucket>();
    const hsnMap   = new Map<string, HsnBucket>();
    const b2bMap   = new Map<string, B2bParty>();

    let totalTaxable = 0;
    let totalCgst    = 0;
    let totalSgst    = 0;
    let totalIgst    = 0;
    let totalGrand   = 0;

    for (const bill of bills) {
      const subtotal   = bill.subtotal.toNumber();
      const taxAmount  = bill.taxAmount.toNumber();
      const grandTotal = bill.grandTotal.toNumber();
      const isIS       = bill.isInterState === true;
      const halfTax    = Math.round((taxAmount / 2) * 100) / 100;
      const cgst       = isIS ? 0 : halfTax;
      const sgst       = isIS ? 0 : Math.round((taxAmount - halfTax) * 100) / 100;
      const igst       = isIS ? taxAmount : 0;

      totalTaxable += subtotal;
      totalCgst    += cgst;
      totalSgst    += sgst;
      totalIgst    += igst;
      totalGrand   += grandTotal;

      // ── Month bucket ──────────────────────────────────────────────────────
      const d       = new Date(bill.createdAt);
      const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
      const isB2B   = Boolean(bill.gstin || bill.party?.gstin);

      const mb = monthMap.get(sortKey) ?? {
        month: monthLabel, sortKey,
        b2bCount: 0, b2cCount: 0,
        taxableValue: 0, cgst: 0, sgst: 0, igst: 0, grandTotal: 0,
      };
      mb.taxableValue += subtotal;
      mb.cgst         += cgst;
      mb.sgst         += sgst;
      mb.igst         += igst;
      mb.grandTotal   += grandTotal;
      if (isB2B) mb.b2bCount++; else mb.b2cCount++;
      monthMap.set(sortKey, mb);

      // ── HSN bucket ────────────────────────────────────────────────────────
      // Collect unique HSN codes referenced by this bill
      const hsnSet = new Set<string>();
      if (bill.hsnCode?.trim()) hsnSet.add(bill.hsnCode.trim());

      // Also scan row-level _hsnCode
      if (Array.isArray(bill.rows)) {
        for (const row of bill.rows as RowRecord[]) {
          if (typeof row._hsnCode === "string" && row._hsnCode.trim()) {
            hsnSet.add(row._hsnCode.trim());
          }
        }
      }

      // If no HSN at all, bucket under "Unknown"
      const hsnKeys = hsnSet.size > 0 ? [...hsnSet] : ["(Not specified)"];

      for (const hsn of hsnKeys) {
        const hb = hsnMap.get(hsn) ?? {
          hsnCode: hsn,
          taxableValue: 0, cgst: 0, sgst: 0, igst: 0, grandTotal: 0,
          invoiceCount: 0,
        };
        // Split amounts proportionally when multiple HSN per bill (rare edge case)
        const factor = 1 / hsnKeys.length;
        hb.taxableValue += subtotal * factor;
        hb.cgst         += cgst    * factor;
        hb.sgst         += sgst    * factor;
        hb.igst         += igst    * factor;
        hb.grandTotal   += grandTotal * factor;
        hb.invoiceCount += 1;
        hsnMap.set(hsn, hb);
      }

      // ── B2B bucket ────────────────────────────────────────────────────────
      const buyerGstin = bill.gstin || bill.party?.gstin || null;
      if (buyerGstin) {
        const partyName = bill.party?.name || bill.customerName;
        const key = buyerGstin;
        const pb = b2bMap.get(key) ?? {
          partyName,
          gstin: buyerGstin,
          placeOfSupply: bill.placeOfSupply,
          invoiceCount: 0,
          taxableValue: 0, cgst: 0, sgst: 0, igst: 0, grandTotal: 0,
        };
        pb.invoiceCount  += 1;
        pb.taxableValue  += subtotal;
        pb.cgst          += cgst;
        pb.sgst          += sgst;
        pb.igst          += igst;
        pb.grandTotal    += grandTotal;
        b2bMap.set(key, pb);
      }
    }

    // ── Sort & round ──────────────────────────────────────────────────────────
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const monthWise = [...monthMap.values()]
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(m => ({
        ...m,
        taxableValue: round2(m.taxableValue),
        cgst: round2(m.cgst), sgst: round2(m.sgst), igst: round2(m.igst),
        grandTotal: round2(m.grandTotal),
      }));

    const hsnSummary = [...hsnMap.values()]
      .sort((a, b) => b.taxableValue - a.taxableValue)
      .map(h => ({
        ...h,
        taxableValue: round2(h.taxableValue),
        cgst: round2(h.cgst), sgst: round2(h.sgst), igst: round2(h.igst),
        grandTotal: round2(h.grandTotal),
      }));

    const b2bParties = [...b2bMap.values()]
      .sort((a, b) => b.taxableValue - a.taxableValue)
      .map(p => ({
        ...p,
        taxableValue: round2(p.taxableValue),
        cgst: round2(p.cgst), sgst: round2(p.sgst), igst: round2(p.igst),
        grandTotal: round2(p.grandTotal),
      }));

    return NextResponse.json({
      from: from.toISOString(),
      to:   to.toISOString(),
      totalBills: bills.length,
      totals: {
        taxableValue: round2(totalTaxable),
        cgst: round2(totalCgst),
        sgst: round2(totalSgst),
        igst: round2(totalIgst),
        grandTotal: round2(totalGrand),
      },
      monthWise,
      hsnSummary,
      b2bParties,
    });
  } catch (error) {
    logError("reports.gst.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
