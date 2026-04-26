/**
 * Dry-run test for Tally XML import parsing.
 *
 * Usage:
 *   npx tsx scripts/test-tally-import.ts Master.xml
 *   npx tsx scripts/test-tally-import.ts DayBook.xml
 *   npx tsx scripts/test-tally-import.ts Master.xml DayBook.xml
 */
import { readFileSync } from "fs";
import { parseTallyXml } from "../src/lib/tally-xml-import";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: npx tsx scripts/test-tally-import.ts <file.xml> [file2.xml ...]");
  process.exit(1);
}

for (const filePath of files) {
  console.log(`\n${"═".repeat(70)}`);
  console.log(`FILE: ${filePath}`);
  console.log("═".repeat(70));

  // ── Read with UTF-16 BOM detection ──────────────────────────────────────
  const raw = readFileSync(filePath);
  let xmlText: string;
  if (raw[0] === 0xFF && raw[1] === 0xFE) {
    xmlText = new TextDecoder("utf-16le").decode(raw);
  } else if (raw[0] === 0xFE && raw[1] === 0xFF) {
    xmlText = new TextDecoder("utf-16be").decode(raw);
  } else {
    xmlText = raw.toString("utf-8");
  }

  const result = parseTallyXml(xmlText);

  // ── Party Masters ───────────────────────────────────────────────────────
  console.log(`\nPARTY MASTERS: ${result.partyMasters.length}`);
  if (result.partyMasters.length > 0) {
    console.log("─".repeat(70));
    console.log(
      "Name".padEnd(40),
      "Group".padEnd(18),
      "Opening Bal".padStart(12)
    );
    console.log("─".repeat(70));
    for (const pm of result.partyMasters) {
      console.log(
        pm.name.slice(0, 39).padEnd(40),
        pm.group.padEnd(18),
        pm.openingBalance.toFixed(2).padStart(12)
      );
    }
  }

  // ── Vouchers ────────────────────────────────────────────────────────────
  console.log(`\nVOUCHERS: ${result.vouchers.length}`);
  if (result.vouchers.length > 0) {
    // Type summary
    const typeCounts = new Map<string, number>();
    for (const v of result.vouchers) {
      typeCounts.set(v.voucherType, (typeCounts.get(v.voucherType) ?? 0) + 1);
    }
    console.log(
      "  Types:",
      [...typeCounts.entries()].map(([t, c]) => `${t}: ${c}`).join(", ")
    );

    // Show each voucher with its ledger lines
    console.log("─".repeat(70));
    for (const v of result.vouchers) {
      const dateStr = v.entryDate.toISOString().slice(0, 10);
      console.log(
        `\n  [${v.voucherType}] ${v.reference || "(no ref)"} — ${dateStr} — ${v.narration.slice(0, 50)}`
      );
      if (v.isInterState !== null) {
        console.log(`    GST: ${v.isInterState ? "Inter-state (IGST)" : "Intra-state (CGST+SGST)"}`);
      }

      console.log(
        "    " + "Ledger Name".padEnd(38),
        "AccountCode".padEnd(20),
        "Debit".padStart(12),
        "Credit".padStart(12),
        "Party".padEnd(20)
      );
      for (const l of v.lines) {
        console.log(
          "    " + l.ledgerName.slice(0, 37).padEnd(38),
          l.accountCode.padEnd(20),
          l.debit.toFixed(2).padStart(12),
          l.credit.toFixed(2).padStart(12),
          (l.partyName ?? "—").slice(0, 19).padEnd(20)
        );
      }

      const totalDebit = v.lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = v.lines.reduce((s, l) => s + l.credit, 0);
      const balanced = Math.abs(totalDebit - totalCredit) < 0.01;
      console.log(
        "    " + "".padEnd(38),
        "TOTAL".padEnd(20),
        totalDebit.toFixed(2).padStart(12),
        totalCredit.toFixed(2).padStart(12),
        balanced ? "✓ balanced" : "✗ UNBALANCED"
      );
    }
  }

  // ── Parse Errors ────────────────────────────────────────────────────────
  if (result.parseErrors.length > 0) {
    console.log(`\nPARSE ERRORS: ${result.parseErrors.length}`);
    for (const err of result.parseErrors) {
      console.log(`  ✗ ${err}`);
    }
  }

  console.log("");
}
