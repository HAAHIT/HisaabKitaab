import { prisma } from "@/lib/prisma";
import { GST_STATE_CODES } from "@/lib/gst-states";
import { getIstCalendar, istMidnightUtc, roundTo2 } from "@/lib/journal-reporting";

const MAX_BILLS = 50_000;

interface BillRow {
  [key: string]: unknown;
}

interface BillData {
  id: string;
  billNumber: string;
  date: Date;
  createdAt: Date;
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  grandTotal: number;
  isInterState: boolean;
  placeOfSupply: string | null;
  hsnCode: string | null;
  gstin: string | null;
  customerName: string;
  rows: BillRow[];
  partyGstin: string | null;
  partyName: string | null;
}

async function fetchSalesBills(
  tenantId: string,
  from: Date,
  to: Date
): Promise<{ bills: BillData[]; truncated: boolean }> {
  const rows = await prisma.bill.findMany({
    where: {
      tenantId,
      isDeleted: false,
      status: "FINAL",
      date: { gte: from, lte: to },
    },
    select: {
      id: true,
      billNumber: true,
      date: true,
      createdAt: true,
      subtotal: true,
      taxPercent: true,
      taxAmount: true,
      grandTotal: true,
      isInterState: true,
      placeOfSupply: true,
      hsnCode: true,
      gstin: true,
      customerName: true,
      rows: true,
      party: { select: { name: true, gstin: true, type: true } },
    },
    orderBy: { date: "asc" },
    take: MAX_BILLS + 1,
  });
  const truncated = rows.length > MAX_BILLS;
  if (truncated) rows.length = MAX_BILLS;

  const bills: BillData[] = rows
    .filter((b) => !b.party || b.party.type !== "VENDOR")
    .map((b) => ({
      id: b.id,
      billNumber: b.billNumber,
      date: b.date,
      createdAt: b.createdAt,
      subtotal: Number(b.subtotal),
      taxPercent: Number(b.taxPercent),
      taxAmount: Number(b.taxAmount),
      grandTotal: Number(b.grandTotal),
      isInterState: b.isInterState === true,
      placeOfSupply: b.placeOfSupply,
      hsnCode: b.hsnCode,
      gstin: b.gstin,
      customerName: b.customerName,
      rows: Array.isArray(b.rows) ? (b.rows as BillRow[]) : [],
      partyGstin: b.party?.gstin ?? null,
      partyName: b.party?.name ?? null,
    }));

  return { bills, truncated };
}

// ── GSTR-1 (Outward supplies) ────────────────────────────────────────────────

export interface Gstr1Json {
  gstin: string;
  fp: string;
  gt: number;
  cur_gt: number;
  b2b: Array<{
    ctin: string;
    inv: Array<{
      inum: string;
      idt: string;
      val: number;
      pos: string;
      rchrg: "Y" | "N";
      inv_typ: string;
      itms: Array<{
        num: number;
        itm_det: {
          txval: number;
          rt: number;
          iamt: number;
          camt: number;
          samt: number;
          csamt: number;
        };
      }>;
    }>;
  }>;
  b2cs: Array<{
    sply_ty: "INTRA" | "INTER";
    rt: number;
    typ: "OE";
    pos: string;
    txval: number;
    iamt: number;
    camt: number;
    samt: number;
    csamt: number;
  }>;
  hsn: {
    data: Array<{
      num: number;
      hsn_sc: string;
      uqc: string;
      qty: number;
      /** Tax rate percentage (required by GSTN portal) */
      rt: number;
      txval: number;
      iamt: number;
      camt: number;
      samt: number;
      csamt: number;
    }>;
  };
}

export interface Gstr1PeriodInput {
  tenantId: string;
  fyStartYear: number;
  fpMonth: number; // 1-12
}

function periodBounds(fyStartYear: number, fpMonth: number): { from: Date; to: Date; fpString: string } {
  const calendarYear = fpMonth >= 4 ? fyStartYear : fyStartYear + 1;
  const from = istMidnightUtc(calendarYear, fpMonth - 1, 1);
  const to = istMidnightUtc(
    fpMonth === 12 ? calendarYear + 1 : calendarYear,
    fpMonth === 12 ? 0 : fpMonth,
    1
  );
  const fpString = `${String(fpMonth).padStart(2, "0")}${calendarYear}`;
  return { from, to, fpString };
}

function fmtIdt(d: Date): string {
  const ist = getIstCalendar(d);
  return `${String(ist.day).padStart(2, "0")}-${String(ist.month + 1).padStart(2, "0")}-${ist.year}`;
}

function placeOfSupplyCode(state: string | null): string {
  if (!state) return "97";
  if (/^\d{2}$/.test(state)) return state;
  const upper = state.toUpperCase();
  for (const [code, name] of Object.entries(GST_STATE_CODES)) {
    if (name.toUpperCase() === upper) return code;
  }
  return "97";
}

function splitTax(taxAmount: number, isInterState: boolean): {
  cgst: number;
  sgst: number;
  igst: number;
} {
  if (isInterState) return { cgst: 0, sgst: 0, igst: roundTo2(taxAmount) };
  const half = Math.round((taxAmount / 2) * 100) / 100;
  return {
    cgst: half,
    sgst: roundTo2(taxAmount - half),
    igst: 0,
  };
}

export async function buildGstr1Json(input: Gstr1PeriodInput): Promise<Gstr1Json> {
  const { from, to, fpString } = periodBounds(input.fyStartYear, input.fpMonth);
  const { bills } = await fetchSalesBills(input.tenantId, from, to);

  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: { gstin: true },
  });
  const sellerGstin = tenant?.gstin ?? "";

  const b2bByCtin = new Map<string, Gstr1Json["b2b"][number]>();
  const b2csByKey = new Map<string, Gstr1Json["b2cs"][number]>();
  const hsnByCode = new Map<string, Gstr1Json["hsn"]["data"][number]>();

  let totalTurnover = 0;
  let currentGt = 0;

  for (const bill of bills) {
    const { cgst, sgst, igst } = splitTax(bill.taxAmount, bill.isInterState);
    const pos = placeOfSupplyCode(bill.placeOfSupply);
    const rate = bill.taxPercent;
    const buyerGstin = bill.gstin || bill.partyGstin;

    totalTurnover += bill.grandTotal;
    currentGt += bill.grandTotal;

    if (buyerGstin) {
      let ctinEntry = b2bByCtin.get(buyerGstin);
      if (!ctinEntry) {
        ctinEntry = { ctin: buyerGstin, inv: [] };
        b2bByCtin.set(buyerGstin, ctinEntry);
      }
      ctinEntry.inv.push({
        inum: bill.billNumber,
        idt: fmtIdt(bill.date),
        val: roundTo2(bill.grandTotal),
        pos,
        rchrg: "N",
        inv_typ: "R",
        itms: [
          {
            num: 1,
            itm_det: {
              txval: roundTo2(bill.subtotal),
              rt: rate,
              iamt: igst,
              camt: cgst,
              samt: sgst,
              csamt: 0,
            },
          },
        ],
      });
    } else {
      const key = `${bill.isInterState ? "INTER" : "INTRA"}|${pos}|${rate}`;
      let entry = b2csByKey.get(key);
      if (!entry) {
        entry = {
          sply_ty: bill.isInterState ? "INTER" : "INTRA",
          rt: rate,
          typ: "OE",
          pos,
          txval: 0,
          iamt: 0,
          camt: 0,
          samt: 0,
          csamt: 0,
        };
        b2csByKey.set(key, entry);
      }
      entry.txval = roundTo2(entry.txval + bill.subtotal);
      entry.iamt = roundTo2(entry.iamt + igst);
      entry.camt = roundTo2(entry.camt + cgst);
      entry.samt = roundTo2(entry.samt + sgst);
    }

    // HSN: prefer bill-level hsnCode; else collect from rows.
    // Key by (hsn_sc, rate) so different tax rates produce separate GSTN rows.
    const hsnSet = new Set<string>();
    if (bill.hsnCode?.trim()) hsnSet.add(bill.hsnCode.trim());
    for (const row of bill.rows) {
      const rowHsn = row._hsnCode;
      if (typeof rowHsn === "string" && rowHsn.trim()) hsnSet.add(rowHsn.trim());
    }
    const hsnKeys = hsnSet.size > 0 ? [...hsnSet] : ["UNCLASSIFIED"];
    const factor = 1 / hsnKeys.length;
    for (const hsn of hsnKeys) {
      const hsnRateKey = `${hsn}|${rate}`;
      let h = hsnByCode.get(hsnRateKey);
      if (!h) {
        h = {
          num: hsnByCode.size + 1,
          hsn_sc: hsn,
          uqc: "NOS",
          qty: 0,
          rt: rate,
          txval: 0,
          iamt: 0,
          camt: 0,
          samt: 0,
          csamt: 0,
        };
        hsnByCode.set(hsnRateKey, h);
      }
      h.txval = roundTo2(h.txval + bill.subtotal * factor);
      h.iamt = roundTo2(h.iamt + igst * factor);
      h.camt = roundTo2(h.camt + cgst * factor);
      h.samt = roundTo2(h.samt + sgst * factor);
    }
  }

  return {
    gstin: sellerGstin,
    fp: fpString,
    gt: roundTo2(totalTurnover),
    cur_gt: roundTo2(currentGt),
    b2b: [...b2bByCtin.values()],
    b2cs: [...b2csByKey.values()],
    hsn: { data: [...hsnByCode.values()] },
  };
}

// ── GSTR-3B (Summary return) ─────────────────────────────────────────────────

export interface Gstr3bSummary {
  fp: string;
  // 3.1 Outward + reverse charge inward
  outward: {
    taxable: { taxableValue: number; igst: number; cgst: number; sgst: number; cess: number };
    zeroRated: { taxableValue: number; igst: number; cgst: number; sgst: number; cess: number };
    nilExempt: { taxableValue: number };
    rcmInward: { taxableValue: number; igst: number; cgst: number; sgst: number; cess: number };
    nonGst: { taxableValue: number };
  };
  // 3.2 Inter-state supplies made to unregistered persons (B2C)
  interStateB2C: Array<{ pos: string; placeName: string; taxableValue: number; igst: number }>;
  // 4 ITC
  itc: {
    available: { igst: number; cgst: number; sgst: number; cess: number };
    reversed: { igst: number; cgst: number; sgst: number; cess: number };
    net: { igst: number; cgst: number; sgst: number; cess: number };
  };
  // 5 Exempt / nil-rated / non-GST inward
  exemptInward: { interState: number; intraState: number };
  // 6.1 Payment of tax
  payment: {
    igstPayable: number;
    cgstPayable: number;
    sgstPayable: number;
    cessPayable: number;
  };
  // Source totals for cross-check
  totals: {
    salesTaxable: number;
    salesIgst: number;
    salesCgst: number;
    salesSgst: number;
    purchaseIgstInput: number;
    purchaseCgstInput: number;
    purchaseSgstInput: number;
  };
}

export interface Gstr3bInput {
  tenantId: string;
  fyStartYear: number;
  fpMonth: number;
}

export async function buildGstr3bSummary(input: Gstr3bInput): Promise<Gstr3bSummary> {
  const { from, to, fpString } = periodBounds(input.fyStartYear, input.fpMonth);

  const { bills } = await fetchSalesBills(input.tenantId, from, to);

  // Aggregate sales-side
  let salesTaxable = 0;
  let salesIgst = 0;
  let salesCgst = 0;
  let salesSgst = 0;

  const interStateB2C = new Map<string, { pos: string; placeName: string; taxableValue: number; igst: number }>();

  for (const bill of bills) {
    const { cgst, sgst, igst } = splitTax(bill.taxAmount, bill.isInterState);
    salesTaxable += bill.subtotal;
    salesIgst += igst;
    salesCgst += cgst;
    salesSgst += sgst;

    const buyerGstin = bill.gstin || bill.partyGstin;
    if (!buyerGstin && bill.isInterState) {
      const pos = placeOfSupplyCode(bill.placeOfSupply);
      const placeName = GST_STATE_CODES[pos] || bill.placeOfSupply || "Unknown";
      const e = interStateB2C.get(pos) ?? {
        pos,
        placeName,
        taxableValue: 0,
        igst: 0,
      };
      e.taxableValue = roundTo2(e.taxableValue + bill.subtotal);
      e.igst = roundTo2(e.igst + igst);
      interStateB2C.set(pos, e);
    }
  }

  // Aggregate input tax from journal lines (purchase ITC).
  const itcAgg = await prisma.journalLine.groupBy({
    by: ["accountCode"],
    where: {
      accountCode: { in: ["CGST_INPUT", "SGST_INPUT", "IGST_INPUT"] },
      journal: {
        tenantId: input.tenantId,
        isDeleted: false,
        entryDate: { gte: from, lt: to },
      },
    },
    _sum: { debit: true, credit: true },
  });

  let purchaseCgstInput = 0;
  let purchaseSgstInput = 0;
  let purchaseIgstInput = 0;
  for (const g of itcAgg) {
    const net = roundTo2(
      (g._sum.debit ? Number(g._sum.debit) : 0) -
        (g._sum.credit ? Number(g._sum.credit) : 0)
    );
    if (g.accountCode === "CGST_INPUT") purchaseCgstInput = net;
    if (g.accountCode === "SGST_INPUT") purchaseSgstInput = net;
    if (g.accountCode === "IGST_INPUT") purchaseIgstInput = net;
  }

  // Reverse-charge purchases (where isReverseCharge=true)
  const rcmLines = await prisma.journalLine.findMany({
    where: {
      accountCode: { in: ["PURCHASE"] },
      journal: {
        tenantId: input.tenantId,
        isDeleted: false,
        isReverseCharge: true,
        entryDate: { gte: from, lt: to },
      },
    },
    select: { debit: true },
  });
  const rcmTaxable = roundTo2(
    rcmLines.reduce((s, l) => s + Number(l.debit), 0)
  );

  const rcmTaxAgg = await prisma.journalLine.groupBy({
    by: ["accountCode"],
    where: {
      accountCode: { in: ["CGST_INPUT", "SGST_INPUT", "IGST_INPUT"] },
      journal: {
        tenantId: input.tenantId,
        isDeleted: false,
        isReverseCharge: true,
        entryDate: { gte: from, lt: to },
      },
    },
    _sum: { debit: true },
  });
  let rcmCgst = 0;
  let rcmSgst = 0;
  let rcmIgst = 0;
  for (const g of rcmTaxAgg) {
    const v = g._sum.debit ? Number(g._sum.debit) : 0;
    if (g.accountCode === "CGST_INPUT") rcmCgst = roundTo2(v);
    if (g.accountCode === "SGST_INPUT") rcmSgst = roundTo2(v);
    if (g.accountCode === "IGST_INPUT") rcmIgst = roundTo2(v);
  }

  const netSalesTaxable = roundTo2(salesTaxable);
  const netSalesIgst = roundTo2(salesIgst);
  const netSalesCgst = roundTo2(salesCgst);
  const netSalesSgst = roundTo2(salesSgst);

  const itcNet = {
    igst: roundTo2(purchaseIgstInput),
    cgst: roundTo2(purchaseCgstInput),
    sgst: roundTo2(purchaseSgstInput),
    cess: 0,
  };

  return {
    fp: fpString,
    outward: {
      taxable: {
        taxableValue: netSalesTaxable,
        igst: netSalesIgst,
        cgst: netSalesCgst,
        sgst: netSalesSgst,
        cess: 0,
      },
      zeroRated: { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 },
      nilExempt: { taxableValue: 0 },
      rcmInward: {
        taxableValue: rcmTaxable,
        igst: rcmIgst,
        cgst: rcmCgst,
        sgst: rcmSgst,
        cess: 0,
      },
      nonGst: { taxableValue: 0 },
    },
    interStateB2C: [...interStateB2C.values()].sort((a, b) => b.taxableValue - a.taxableValue),
    itc: {
      available: { ...itcNet },
      reversed: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
      net: { ...itcNet },
    },
    exemptInward: { interState: 0, intraState: 0 },
    payment: {
      igstPayable: roundTo2(Math.max(0, netSalesIgst - itcNet.igst)),
      cgstPayable: roundTo2(Math.max(0, netSalesCgst - itcNet.cgst)),
      sgstPayable: roundTo2(Math.max(0, netSalesSgst - itcNet.sgst)),
      cessPayable: 0,
    },
    totals: {
      salesTaxable: netSalesTaxable,
      salesIgst: netSalesIgst,
      salesCgst: netSalesCgst,
      salesSgst: netSalesSgst,
      purchaseIgstInput: itcNet.igst,
      purchaseCgstInput: itcNet.cgst,
      purchaseSgstInput: itcNet.sgst,
    },
  };
}

export function buildGstr3bJson(summary: Gstr3bSummary, gstin: string): object {
  return {
    gstin,
    ret_period: summary.fp,
    sup_details: {
      osup_det: {
        txval: summary.outward.taxable.taxableValue,
        iamt: summary.outward.taxable.igst,
        camt: summary.outward.taxable.cgst,
        samt: summary.outward.taxable.sgst,
        csamt: summary.outward.taxable.cess,
      },
      osup_zero: {
        txval: 0,
        iamt: 0,
        csamt: 0,
      },
      osup_nil_exmp: { txval: 0 },
      isup_rev: {
        txval: summary.outward.rcmInward.taxableValue,
        iamt: summary.outward.rcmInward.igst,
        camt: summary.outward.rcmInward.cgst,
        samt: summary.outward.rcmInward.sgst,
        csamt: 0,
      },
      osup_nongst: { txval: 0 },
    },
    inter_sup: {
      unreg_details: summary.interStateB2C.map((b) => ({
        pos: b.pos,
        txval: b.taxableValue,
        iamt: b.igst,
      })),
      comp_details: [],
      uin_details: [],
    },
    itc_elg: {
      itc_avl: [
        {
          ty: "OTH",
          iamt: summary.itc.available.igst,
          camt: summary.itc.available.cgst,
          samt: summary.itc.available.sgst,
          csamt: 0,
        },
      ],
      itc_rev: [],
      itc_net: {
        iamt: summary.itc.net.igst,
        camt: summary.itc.net.cgst,
        samt: summary.itc.net.sgst,
        csamt: 0,
      },
      itc_inelg: [],
    },
    inward_sup: {
      isup_details: [
        { ty: "GST", inter: 0, intra: 0 },
        { ty: "NONGST", inter: 0, intra: 0 },
      ],
    },
  };
}
