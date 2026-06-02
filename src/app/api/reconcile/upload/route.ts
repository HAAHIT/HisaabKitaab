/**
 * POST /api/reconcile/upload
 *
 * Accepts a multipart/form-data upload with fields:
 *   - file: CSV text of the bank statement
 *   - bankAccountId: string
 *   - bankSlug: BankSlug (e.g. "HDFC", "SBI", ...)
 *   - periodFrom: ISO date string
 *   - periodTo: ISO date string
 *
 * Parses the CSV, auto-matches rows against recent payments, persists
 * BankStatement + BankStatementRow records, and returns the statement id
 * plus a preview of matched/unmatched rows.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
import { checkFeatureAccess } from "@/lib/quota";
import { logError, getRequestId } from "@/lib/observability";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { parseStatement } from "@/lib/bank-reconciliation/parsers/index";
import { extractStatementText } from "@/lib/bank-reconciliation/extract-text";
import { matchRows } from "@/lib/bank-reconciliation/match";
import type { MatchablePayment } from "@/lib/bank-reconciliation/match";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId } = sessionResolution.session;

  // [Phase 1 — Plan gate] Bank reconciliation is a PRO feature; enforce server-side.
  const feature = await checkFeatureAccess(tenantId, "bankReconciliation");
  if (!feature.allowed) {
    return NextResponse.json(
      { error: feature.reason ?? "Feature locked", code: "FEATURE_LOCKED", feature: "bankReconciliation" },
      { status: 402 }
    );
  }

  const rl = await checkRateLimit(request, `reconcile:upload:${tenantId}`, 10);
  if (rl) return rl;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const fileField = formData.get("file");
  const bankAccountId = formData.get("bankAccountId");
  const bankSlug = formData.get("bankSlug");
  const periodFrom = formData.get("periodFrom");
  const periodTo = formData.get("periodTo");

  if (typeof bankAccountId !== "string" || !bankAccountId) {
    return NextResponse.json({ error: "bankAccountId is required" }, { status: 400 });
  }
  if (typeof bankSlug !== "string" || !bankSlug) {
    return NextResponse.json({ error: "bankSlug is required" }, { status: 400 });
  }
  if (typeof periodFrom !== "string" || typeof periodTo !== "string") {
    return NextResponse.json({ error: "periodFrom and periodTo are required" }, { status: 400 });
  }

  const fromDate = new Date(periodFrom);
  const toDate = new Date(periodTo);
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return NextResponse.json({ error: "Invalid periodFrom or periodTo" }, { status: 400 });
  }

  // Read text from CSV / XLSX / PDF
  let csvText: string;
  let sourceKind: "csv" | "xlsx" | "xls" | "pdf" = "csv";
  if (fileField instanceof File) {
    try {
      const extracted = await extractStatementText(fileField);
      csvText = extracted.text;
      sourceKind = extracted.kind;
    } catch (error) {
      // Some banks export "Excel" files that are actually HTML/XML masquerading
      // as .xlsx — JSZip throws "Can't find end of central directory" for these.
      // Surface a hint rather than a stack-trace string.
      const msg = error instanceof Error ? error.message : "";
      if (msg.includes("end of central directory")) {
        logError("reconcile.upload.malformed_xlsx", { requestId: getRequestId(request), fileName: fileField.name });
        return NextResponse.json(
          {
            error:
              "This file is named .xlsx but isn't a valid Excel file. " +
              "Open it in Excel/LibreOffice and re-save as .xlsx or .csv, then try again.",
          },
          { status: 400 }
        );
      }
      logError("reconcile.upload.extract_failed", { requestId: getRequestId(request), error });
      return NextResponse.json(
        { error: "Could not read statement file. Supported formats: CSV, XLSX, XLS, PDF." },
        { status: 400 }
      );
    }
    if (!csvText.trim()) {
      return NextResponse.json(
        {
          error:
            sourceKind === "pdf"
              ? "No readable text in PDF. Image-based / scanned PDFs are not supported — export from your bank's portal as text-PDF, CSV, or XLSX."
              : "File is empty.",
        },
        { status: 422 }
      );
    }
  } else if (typeof fileField === "string") {
    csvText = fileField;
  } else {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  // Verify bank account belongs to this tenant
  const bankAccount = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, tenantId, isDeleted: false },
    select: { id: true, name: true },
  });
  if (!bankAccount) {
    return NextResponse.json({ error: "Bank account not found" }, { status: 404 });
  }

  // Parse the CSV
  const { rows: parsedRows, parseErrors } = parseStatement(bankSlug, csvText);

  if (parsedRows.length === 0) {
    return NextResponse.json(
      { error: "No valid rows found in CSV", parseErrors },
      { status: 422 }
    );
  }

  // Load candidate payments in the window (±3 days of statement period)
  const windowFrom = new Date(fromDate);
  windowFrom.setDate(windowFrom.getDate() - 3);
  const windowTo = new Date(toDate);
  windowTo.setDate(windowTo.getDate() + 3);

  const payments = await prisma.payment.findMany({
    where: {
      tenantId,
      isDeleted: false,
      status: { in: ["COMPLETED", "EXPECTED"] },
      date: { gte: windowFrom, lte: windowTo },
    },
    select: {
      id: true,
      amount: true,
      direction: true,
      date: true,
      party: { select: { name: true } },
    },
  });

  const matchablePayments: MatchablePayment[] = payments.map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    direction: p.direction as "INCOMING" | "OUTGOING",
    date: p.date,
    partyName: p.party?.name ?? null,
  }));

  const matchResults = matchRows(parsedRows, matchablePayments);

  // Persist inside a transaction. rowIds is populated in matchResults order so
  // the returned preview can carry each persisted BankStatementRow id — the
  // categorize endpoint keys on that id, not on a payment id.
  const rowIds: string[] = [];
  try {
    const statement = await prisma.$transaction(async (tx) => {
      // Create the BankStatement header
      const stmt = await tx.bankStatement.create({
        data: {
          tenantId,
          bankAccountId,
          periodFrom: fromDate,
          periodTo: toDate,
          rowCount: parsedRows.length,
          matchedCount: 0,
          unmatchedCount: parsedRows.length,
        },
      });

      // Bulk-create rows (skip duplicates via upsert on unique constraint)
      let matchedCount = 0;
      for (const result of matchResults) {
        const row = result.bankRow;
        const isMatched =
          result.payment !== null && result.confidence >= 60;
        if (isMatched) matchedCount++;

        const upserted = await tx.bankStatementRow.upsert({
          where: {
            statementId_date_amount_description: {
              statementId: stmt.id,
              date: row.date,
              amount: new Prisma.Decimal(row.amount),
              description: row.description,
            },
          },
          update: {},
          create: {
            tenantId,
            statementId: stmt.id,
            date: row.date,
            description: row.description,
            amount: new Prisma.Decimal(row.amount),
            direction: row.direction,
            rawLine: row.rawLine,
            matchedPaymentId: isMatched ? result.payment!.id : null,
            status: isMatched ? "AUTO_MATCHED" : "PENDING",
          },
          select: { id: true },
        });
        rowIds.push(upserted.id);
      }

      // Update counts on the statement
      await tx.bankStatement.update({
        where: { id: stmt.id },
        data: {
          matchedCount,
          unmatchedCount: parsedRows.length - matchedCount,
        },
      });

      return stmt;
    });

    // Return statement summary + row previews
    const preview = matchResults.map((r, i) => ({
      id: rowIds[i],
      date: r.bankRow.date,
      description: r.bankRow.description,
      amount: r.bankRow.amount,
      direction: r.bankRow.direction,
      matchedPaymentId: r.payment?.id ?? null,
      confidence: r.confidence,
      reason: r.reason,
    }));

    return NextResponse.json(
      {
        statementId: statement.id,
        rowCount: parsedRows.length,
        matchedCount: matchResults.filter((r) => r.payment && r.confidence >= 60).length,
        parseErrors,
        preview,
      },
      { status: 201 }
    );
  } catch (error) {
    logError("reconcile.upload.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
