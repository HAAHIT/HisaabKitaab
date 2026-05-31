"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { HKButton } from "@/components/ui/HKButton";
import { HKChip } from "@/components/ui/HKChip";
import { HKPagination } from "@/components/ui/HKPagination";
import { EmptyState } from "@/components/ui/empty-state";
import { Activity } from "@/components/ui/icons";
import { useLanguage } from "@/contexts/LanguageContext";
import { TranslationKey } from "@/lib/i18n/translations";

interface TransactionsClientProps {
  initialTransactions: any[];
  page: number;
  totalPages: number;
  total: number;
}

export default function TransactionsClient({ initialTransactions, page, totalPages, total }: TransactionsClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const type = searchParams.get("type");
  const { t } = useLanguage();

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.push(`/transactions?${params.toString()}`);
  };

  const getVoucherColor = (type: string): "primary" | "secondary" | "success" | "warning" | "danger" | "default" => {
    switch (type) {
      case "SALES": return "primary";
      case "PURCHASE": return "secondary";
      case "PAYMENT": return "success";
      case "RECEIPT": return "success";
      case "CREDIT_NOTE": return "warning";
      case "DEBIT_NOTE": return "danger";
      default: return "default";
    }
  };

  const formatDate = (date: Date | string) => {
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }).format(new Date(date));
  };

  const voucherTypes = [
    "SALES", "PURCHASE", "PAYMENT", "RECEIPT", "CREDIT_NOTE", "DEBIT_NOTE", "JOURNAL"
  ];

  const handleTypeFilter = (vt: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (vt) {
      params.set("type", vt);
    } else {
      params.delete("type");
    }
    // Reset to first page when filter changes so user doesn't sit on an empty page.
    params.delete("page");
    router.push(`/transactions?${params.toString()}`);
  };

  const exportExcel = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = "HisaabKitaab";
    wb.created = new Date();
    const ws = wb.addWorksheet("Transactions");

    ws.columns = [
      { header: t("transactions.header.date"), width: 14 },
      { header: t("transactions.header.voucher"), width: 16 },
      { header: "Reference", width: 24 },
      { header: t("transactions.header.particulars"), width: 32 },
      { header: t("transactions.header.debit"), width: 14 },
      { header: t("transactions.header.credit"), width: 14 },
    ];
    ws.getRow(1).font = { bold: true };

    for (const tx of initialTransactions) {
      for (const line of tx.lines) {
        const row = ws.addRow([
          formatDate(tx.entryDate),
          t(`voucher.type.${tx.voucherType}` as TranslationKey),
          tx.id,
          line.partyName || line.accountName || "Unknown",
          Number(line.debit) || 0,
          Number(line.credit) || 0,
        ]);
        row.getCell(5).numFmt = '#,##0.00;[Red]-#,##0.00';
        row.getCell(6).numFmt = '#,##0.00;[Red]-#,##0.00';
      }
    }

    const arr = await wb.xlsx.writeBuffer();
    const blob = new Blob([arr], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Transactions_${new Date().toISOString().split("T")[0]}.xlsx`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-3 sm:p-4 lg:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6 pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">
            {t("transactions.title")}
          </h1>
          <p className="text-default-500 text-xs sm:text-sm">{t("transactions.subtitle")}</p>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <HKButton size="sm" variant="secondary" onClick={exportExcel} className="flex-1 md:flex-none">
            {t("transactions.exportCSV")}
          </HKButton>
          <HKButton size="sm" onClick={() => router.push("/reports")} className="flex-1 md:flex-none">
            {t("transactions.goToReports")}
          </HKButton>
        </div>
      </div>

      <div className="flex md:flex-wrap gap-2 items-center overflow-x-auto md:overflow-visible -mx-3 px-3 md:mx-0 md:px-0 pb-1 md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="text-xs font-semibold text-default-400 uppercase tracking-wider mr-2 shrink-0">{t("transactions.filterBy")}</span>
        <button
          onClick={() => handleTypeFilter(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
            !type ? "bg-[var(--sb-orange)] text-white" : "bg-default-100 text-default-600 hover:bg-default-200"
          }`}
        >
          {t("transactions.all")}
        </button>
        {voucherTypes.map((vt) => (
          <button
            key={vt}
            onClick={() => handleTypeFilter(vt)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors shrink-0 ${
              type === vt ? "bg-[var(--sb-orange)] text-white" : "bg-default-100 text-default-600 hover:bg-default-200"
            }`}
          >
            {t(`voucher.type.${vt}` as TranslationKey)}
          </button>
        ))}
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {initialTransactions.length === 0 ? (
          <div className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-card)]">
            <EmptyState
              icon={Activity}
              title={t("transactions.noTransactions")}
              description={t("transactions.noTransactionsDesc")}
              className="py-10 flex items-center justify-center mx-auto"
            />
          </div>
        ) : (
          initialTransactions.map((tx: any) => (
            <div key={tx.id} className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-card)] shadow-sm overflow-hidden">
              <div className="flex items-start justify-between gap-2 p-3 border-b border-[var(--sb-border)] bg-[var(--sb-badge)]">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <HKChip size="sm" variant="flat" color={getVoucherColor(tx.voucherType)}>
                    {t(`voucher.type.${tx.voucherType}` as TranslationKey)}
                  </HKChip>
                  <span className="text-[10px] font-mono text-default-400 bg-default-100 px-1.5 py-0.5 rounded">
                    #{tx.id.substring(tx.id.length - 6).toUpperCase()}
                  </span>
                </div>
                <span className="text-xs text-default-500 whitespace-nowrap">{formatDate(tx.entryDate)}</span>
              </div>
              <div className="divide-y divide-[var(--sb-border)]">
                {tx.lines.map((line: any, idx: number) => {
                  const debit = Number(line.debit) || 0;
                  const credit = Number(line.credit) || 0;
                  return (
                    <div key={idx} className="flex items-center justify-between gap-2 px-3 py-2.5">
                      <span className="text-sm font-medium truncate flex-1 min-w-0">
                        {line.partyName || line.accountName || "Unknown"}
                      </span>
                      {debit > 0 && (
                        <span className="text-danger font-mono text-sm font-medium whitespace-nowrap">
                          Dr {debit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                      {credit > 0 && (
                        <span className="text-success font-mono text-sm font-medium whitespace-nowrap">
                          Cr {credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {tx.narration && (
                <div className="px-3 py-2 text-[11px] text-default-500 border-t border-[var(--sb-border)] bg-default-50/40 flex items-start gap-1.5">
                  <svg className="w-3 h-3 mt-0.5 text-default-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  <span>{tx.narration}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-card)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[var(--sb-border)] bg-[var(--sb-badge)]">
                <th className="py-3 px-4 text-left text-xs font-bold text-default-500 uppercase tracking-wider w-24">{t("transactions.header.date")}</th>
                <th className="py-3 px-4 text-left text-xs font-bold text-default-500 uppercase tracking-wider w-40">{t("transactions.header.voucher")}</th>
                <th className="py-3 px-4 text-left text-xs font-bold text-default-500 uppercase tracking-wider">{t("transactions.header.particulars")}</th>
                <th className="py-3 px-4 text-right text-xs font-bold text-default-500 uppercase tracking-wider">{t("transactions.header.debit")}</th>
                <th className="py-3 px-4 text-right text-xs font-bold text-default-500 uppercase tracking-wider">{t("transactions.header.credit")}</th>
              </tr>
            </thead>
            <tbody>
              {initialTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      icon={Activity}
                      title={t("transactions.noTransactions")}
                      description={t("transactions.noTransactionsDesc")}
                      className="py-10 flex items-center justify-center mx-auto"
                    />
                  </td>
                </tr>
              ) : (
                initialTransactions.flatMap((tx: any) =>
                  tx.lines.map((line: any, idx: number) => (
                    <tr key={`${tx.id}-${idx}`} className="border-b border-[var(--sb-border)] hover:bg-default-50/50 transition-colors">
                      <td className="py-3 px-4 text-default-600 text-sm w-24">
                        {idx === 0 ? formatDate(tx.entryDate) : ""}
                      </td>
                      <td className="py-3 px-4 w-40">
                        {idx === 0 ? (
                          <div className="flex flex-col gap-1">
                            <HKChip size="sm" variant="flat" color={getVoucherColor(tx.voucherType)}>
                              {t(`voucher.type.${tx.voucherType}` as TranslationKey)}
                            </HKChip>
                            <span className="text-[10px] font-mono text-default-400 bg-default-100 px-1.5 py-0.5 rounded w-fit">
                              #{tx.id.substring(tx.id.length - 6).toUpperCase()}
                            </span>
                          </div>
                        ) : ""}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">
                            {line.partyName || line.accountName || "Unknown"}
                          </span>
                          {idx === 0 && tx.narration && (
                            <div className="mt-1 flex items-center gap-1.5">
                              <svg className="w-3 h-3 text-default-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                              </svg>
                              <span className="text-[10px] text-default-400">{tx.narration}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm">
                        {Number(line.debit) > 0 ? (
                          <span className="text-danger font-medium">{Number(line.debit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        ) : ""}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm">
                        {Number(line.credit) > 0 ? (
                          <span className="text-success font-medium">{Number(line.credit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        ) : ""}
                      </td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center mt-4">
          <HKPagination total={totalPages} page={page} onChange={handlePageChange} showControls />
        </div>
      )}

      <p className="text-center text-[10px] text-default-400">
        {t("transactions.footer")
          .replace("{page}", String(page))
          .replace("{totalPages}", String(totalPages))
          .replace("{total}", total.toLocaleString("en-IN"))}
      </p>
    </div>
  );
}
