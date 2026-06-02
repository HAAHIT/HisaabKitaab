"use client";

import { useEffect, useState } from "react";
import { HKButton } from "@/components/ui/HKButton";
import { HKSelect, HKSelectItem } from "@/components/ui/HKSelect";
import { HKCheckbox } from "@/components/ui/HKCheckbox";
import { HKSkeleton } from "@/components/ui/HKSkeleton";

interface FinancialReportsSectionProps {
  from: string;
  to: string;
  exportBlocked: boolean;
  accountOptions: { code: string; name: string; tallyGroup: string; businessFacing: boolean }[];
}

type FinTab =
  | "profitLoss"
  | "balanceSheet"
  | "trialBalance"
  | "dayBook"
  | "generalLedger"
  | "aging";

interface GroupNode {
  name: string;
  total: number;
  accounts: {
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
    net: number;
  }[];
}

interface ProfitLossData {
  income: { groups: GroupNode[]; total: number };
  expense: { groups: GroupNode[]; total: number };
  netProfit: number;
  warnings: string[];
}

interface BalanceSheetData {
  assets: { groups: GroupNode[]; total: number };
  liabilities: { groups: GroupNode[]; total: number };
  equity: { groups: GroupNode[]; total: number };
  retainedEarnings: number;
  liabilitiesAndEquityTotal: number;
  warnings: string[];
}

interface TrialBalanceData {
  rows: {
    accountCode: string;
    accountName: string;
    tallyGroup: string;
    type: string;
    totalDebit: number;
    totalCredit: number;
    closingDebit: number;
    closingCredit: number;
  }[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

interface DayBookData {
  days: {
    date: string;
    totalDebit: number;
    totalCredit: number;
    vouchers: {
      journalId: string;
      voucherType: string;
      narration: string;
      totalDebit: number;
      totalCredit: number;
      lines: {
        accountName: string;
        partyName: string | null;
        debit: number;
        credit: number;
      }[];
    }[];
  }[];
  totalDebit: number;
  totalCredit: number;
}

interface AgingPartyRow {
  partyId: string;
  partyName: string;
  current: number;
  days_31_60: number;
  days_61_90: number;
  days_90_plus: number;
  total: number;
}

interface AgingSide {
  buckets: {
    current: number;
    days_31_60: number;
    days_61_90: number;
    days_90_plus: number;
    total: number;
  };
  parties: AgingPartyRow[];
}

interface AgingData {
  asOf: string;
  receivable: AgingSide;
  payable: AgingSide;
}

interface GeneralLedgerData {
  accountCode: string;
  accountName: string;
  tallyGroup: string;
  openingBalance: number;
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
  lines: {
    date: string;
    journalId: string;
    voucherType: string;
    narration: string;
    partyName: string | null;
    debit: number;
    credit: number;
    balance: number;
  }[];
}

function inr(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatIstDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export default function FinancialReportsSection({
  from,
  to,
  exportBlocked,
  accountOptions,
}: FinancialReportsSectionProps) {
  const [tab, setTab] = useState<FinTab>("profitLoss");

  const [pnl, setPnl] = useState<ProfitLossData | null>(null);
  const [bs, setBs] = useState<BalanceSheetData | null>(null);
  const [tb, setTb] = useState<TrialBalanceData | null>(null);
  const [db, setDb] = useState<DayBookData | null>(null);
  const [gl, setGl] = useState<GeneralLedgerData | null>(null);
  const [aging, setAging] = useState<AgingData | null>(null);
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const visibleAccountOptions = showAllAccounts
    ? accountOptions
    : accountOptions.filter((a) => a.businessFacing);
  const [glAccount, setGlAccount] = useState<string>(
    accountOptions.find((a) => a.businessFacing)?.code ?? accountOptions[0]?.code ?? ""
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (exportBlocked || !from || !to) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    let url = "";
    if (tab === "profitLoss") url = `/api/reports/profit-loss?from=${from}&to=${to}`;
    else if (tab === "balanceSheet") url = `/api/reports/balance-sheet?asOf=${to}`;
    else if (tab === "trialBalance") url = `/api/reports/trial-balance?from=${from}&to=${to}`;
    else if (tab === "dayBook") url = `/api/reports/day-book?from=${from}&to=${to}`;
    else if (tab === "generalLedger") {
      if (!glAccount) {
        setLoading(false);
        return;
      }
      url = `/api/reports/general-ledger?from=${from}&to=${to}&accountCode=${glAccount}`;
    } else if (tab === "aging") url = `/api/reports/aging?asOf=${to}`;

    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load report");
        return json.data;
      })
      .then((data) => {
        if (tab === "profitLoss") setPnl(data);
        else if (tab === "balanceSheet") setBs(data);
        else if (tab === "trialBalance") setTb(data);
        else if (tab === "dayBook") setDb(data);
        else if (tab === "generalLedger") setGl(data);
        else if (tab === "aging") setAging(data);
        setLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load report");
        setLoading(false);
      });

    return () => controller.abort();
  }, [tab, from, to, glAccount, exportBlocked]);

  function downloadExcel(path: string, filename: string) {
    const params = new URLSearchParams({ from, to });
    if (tab === "balanceSheet" || tab === "aging") {
      params.delete("from");
      params.set("asOf", to);
    }
    if (tab === "generalLedger") {
      params.set("accountCode", glAccount);
    }
    const url = `${path}?${params.toString()}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const TAB_LABELS: Record<FinTab, string> = {
    profitLoss: "Profit & Loss",
    balanceSheet: "Balance Sheet",
    trialBalance: "Trial Balance",
    dayBook: "Day Book",
    generalLedger: "General Ledger",
    aging: "Aging",
  };

  const EXPORT_PATH: Record<FinTab, string> = {
    profitLoss: "/api/export/profit-loss",
    balanceSheet: "/api/export/balance-sheet",
    trialBalance: "/api/export/trial-balance",
    dayBook: "/api/export/day-book",
    generalLedger: "/api/export/general-ledger",
    aging: "/api/export/aging",
  };

  return (
    <div className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-card)] shadow-sm">
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">Financial Statements</h2>
            <p className="text-sm text-default-500 mt-0.5">
              Standard accounting reports computed from posted journal entries.
            </p>
          </div>
          <HKButton
            size="sm"
            variant="secondary"
            isDisabled={exportBlocked || loading}
            onClick={() => downloadExcel(EXPORT_PATH[tab], `${tab}_${from}_to_${to}.xlsx`)}
          >
            Download Excel
          </HKButton>
        </div>

        <div className="flex gap-2 border-b border-divider pb-1 overflow-x-auto">
          {(Object.keys(TAB_LABELS) as FinTab[]).map((key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-t transition-colors whitespace-nowrap ${
                tab === key
                  ? "border-b-2 border-primary text-primary bg-primary/5"
                  : "text-default-500 hover:text-foreground"
              }`}
            >
              {TAB_LABELS[key]}
            </button>
          ))}
        </div>

        {exportBlocked ? (
          <p className="text-sm text-danger py-4">
            Reports are unavailable while unbalanced journal entries exist.
          </p>
        ) : tab === "generalLedger" ? (
          <div className="grid gap-3 md:grid-cols-[320px,1fr] items-end">
            <div className="flex flex-col gap-2">
              <HKSelect
                label="Account"
                value={glAccount}
                onValueChange={(v) => setGlAccount(v)}
              >
                {visibleAccountOptions.map((a) => (
                  <HKSelectItem key={a.code} value={a.code}>
                    {a.name}
                  </HKSelectItem>
                ))}
              </HKSelect>
              <HKCheckbox
                isSelected={showAllAccounts}
                onValueChange={(v) => {
                  setShowAllAccounts(v);
                  // If hiding advanced accounts while one is selected, fall back
                  // to the first business-facing account.
                  if (!v && !accountOptions.find((a) => a.code === glAccount)?.businessFacing) {
                    setGlAccount(accountOptions.find((a) => a.businessFacing)?.code ?? "");
                  }
                }}
              >
                <span className="text-xs text-default-500">Show all accounts (incl. tax &amp; round-off)</span>
              </HKCheckbox>
            </div>
          </div>
        ) : null}

        {!exportBlocked && (
          <div className="min-h-[200px]">
            {loading ? (
              <div className="grid gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <HKSkeleton key={i} className="h-10 rounded-xl" />
                ))}
              </div>
            ) : error ? (
              <p className="text-sm text-danger">{error}</p>
            ) : tab === "profitLoss" && pnl ? (
              <ProfitLossView data={pnl} />
            ) : tab === "balanceSheet" && bs ? (
              <BalanceSheetView data={bs} />
            ) : tab === "trialBalance" && tb ? (
              <TrialBalanceView data={tb} />
            ) : tab === "dayBook" && db ? (
              <DayBookView data={db} />
            ) : tab === "generalLedger" && gl ? (
              <GeneralLedgerView data={gl} />
            ) : tab === "aging" && aging ? (
              <AgingView data={aging} />
            ) : (
              <p className="text-sm text-default-500 py-4 text-center">
                No data for this period.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GroupTable({
  title,
  groups,
  total,
  sign,
}: {
  title: string;
  groups: GroupNode[];
  total: number;
  sign: "DEBIT" | "CREDIT";
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-default-500 mb-2">
        {title}
      </h3>
      <table className="w-full text-sm">
        <tbody>
          {groups.length === 0 && (
            <tr>
              <td className="py-2 text-default-400 italic">No accounts</td>
              <td className="py-2 text-right text-default-400">—</td>
            </tr>
          )}
          {groups.map((g) => (
            <GroupRow key={g.name} group={g} sign={sign} />
          ))}
          <tr className="border-t-2 border-divider font-bold">
            <td className="py-2">Total {title}</td>
            <td className="py-2 text-right">{inr(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function GroupRow({ group, sign }: { group: GroupNode; sign: "DEBIT" | "CREDIT" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        className="cursor-pointer hover:bg-default-50 border-b border-divider/40"
        onClick={() => setOpen((v) => !v)}
      >
        <td className="py-2 font-medium">
          <span className="inline-block w-4 text-default-400">{open ? "▾" : "▸"}</span>
          {group.name}
        </td>
        <td className="py-2 text-right font-semibold">{inr(group.total)}</td>
      </tr>
      {open &&
        group.accounts.map((a) => {
          const amount = sign === "DEBIT" ? a.net : -a.net;
          return (
            <tr key={a.accountCode} className="bg-default-50/40">
              <td className="py-1.5 pl-8 text-default-600">{a.accountName}</td>
              <td className="py-1.5 text-right text-default-600">{inr(amount)}</td>
            </tr>
          );
        })}
    </>
  );
}

function ProfitLossView({ data }: { data: ProfitLossData }) {
  return (
    <div className="space-y-6">
      {data.warnings.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm text-warning-700">
          {data.warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <GroupTable title="Income" groups={data.income.groups} total={data.income.total} sign="CREDIT" />
        <GroupTable title="Expenses" groups={data.expense.groups} total={data.expense.total} sign="DEBIT" />
      </div>
      <div
        className={`rounded-xl border p-4 flex justify-between items-center ${
          data.netProfit >= 0
            ? "border-success/30 bg-success/5 text-success-700"
            : "border-danger/30 bg-danger/5 text-danger-700"
        }`}
      >
        <span className="font-bold text-base">
          {data.netProfit >= 0 ? "Net Profit" : "Net Loss"}
        </span>
        <span className="font-bold text-lg">{inr(Math.abs(data.netProfit))}</span>
      </div>
    </div>
  );
}

function BalanceSheetView({ data }: { data: BalanceSheetData }) {
  const equityWithRetained = [
    ...data.equity.groups,
    {
      name: "Profit & Loss A/c",
      total: data.retainedEarnings,
      accounts: [],
    } as GroupNode,
  ];
  const equityTotal = data.equity.total + data.retainedEarnings;

  return (
    <div className="space-y-6">
      {data.warnings.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm text-warning-700">
          {data.warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <GroupTable
          title="Liabilities & Equity"
          groups={[...data.liabilities.groups, ...equityWithRetained]}
          total={data.liabilities.total + equityTotal}
          sign="CREDIT"
        />
        <GroupTable
          title="Assets"
          groups={data.assets.groups}
          total={data.assets.total}
          sign="DEBIT"
        />
      </div>
    </div>
  );
}

function TrialBalanceView({ data }: { data: TrialBalanceData }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-divider text-xs text-default-500 uppercase tracking-wide">
            <th className="py-2 pr-4 text-left font-semibold">Account</th>
            <th className="py-2 pr-4 text-left font-semibold">Group</th>
            <th className="py-2 pr-4 text-right font-semibold">Debit</th>
            <th className="py-2 pr-4 text-right font-semibold">Credit</th>
            <th className="py-2 pr-4 text-right font-semibold">Closing Dr</th>
            <th className="py-2 text-right font-semibold">Closing Cr</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.accountCode} className="border-b border-divider/40 hover:bg-default-50">
              <td className="py-2 pr-4 font-medium">{row.accountName}</td>
              <td className="py-2 pr-4 text-default-500">{row.tallyGroup}</td>
              <td className="py-2 pr-4 text-right">{inr(row.totalDebit)}</td>
              <td className="py-2 pr-4 text-right">{inr(row.totalCredit)}</td>
              <td className="py-2 pr-4 text-right font-semibold">{row.closingDebit > 0 ? inr(row.closingDebit) : "—"}</td>
              <td className="py-2 text-right font-semibold">{row.closingCredit > 0 ? inr(row.closingCredit) : "—"}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-divider bg-default-50 font-bold">
            <td colSpan={2} className="py-2.5">
              Total {data.isBalanced ? "(Balanced)" : "(Unbalanced)"}
            </td>
            <td className="py-2.5 pr-4 text-right">{inr(data.totalDebit)}</td>
            <td className="py-2.5 pr-4 text-right">{inr(data.totalCredit)}</td>
            <td className="py-2.5 pr-4 text-right">—</td>
            <td className="py-2.5 text-right">—</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function DayBookView({ data }: { data: DayBookData }) {
  if (data.days.length === 0) {
    return <p className="text-sm text-default-500 py-4 text-center">No vouchers in this period.</p>;
  }
  return (
    <div className="space-y-4">
      {data.days.map((day) => (
        <div key={day.date} className="rounded-xl border border-divider">
          <div className="flex justify-between items-center bg-default-50 px-4 py-2 rounded-t-xl">
            <span className="font-semibold">{formatIstDate(day.date)}</span>
            <span className="text-sm text-default-600">
              Dr {inr(day.totalDebit)} · Cr {inr(day.totalCredit)}
            </span>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {day.vouchers.map((v) => (
                <tr key={v.journalId} className="border-b border-divider/40 last:border-b-0">
                  <td className="py-2 px-4 align-top w-24">
                    <span className="text-xs font-semibold uppercase tracking-wide text-default-500">
                      {v.voucherType.toLowerCase().replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-2 px-2 align-top">
                    <div className="text-default-700">{v.narration}</div>
                    <div className="text-xs text-default-500 mt-0.5">
                      {v.lines
                        .map((l) =>
                          l.partyName
                            ? `${l.accountName} (${l.partyName})`
                            : l.accountName
                        )
                        .join(" · ")}
                    </div>
                  </td>
                  <td className="py-2 px-2 align-top text-right font-semibold whitespace-nowrap">
                    {inr(v.totalDebit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <div className="flex justify-end gap-6 text-sm font-bold pt-2 border-t-2 border-divider">
        <span>Period Total Debit: {inr(data.totalDebit)}</span>
        <span>Period Total Credit: {inr(data.totalCredit)}</span>
      </div>
    </div>
  );
}

function AgingSideTable({ title, side }: { title: string; side: AgingSide }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-default-500 mb-2">
        {title}
      </h3>
      {side.parties.length === 0 ? (
        <p className="text-sm text-default-500 py-4 text-center">No outstanding balances.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-divider text-xs text-default-500 uppercase tracking-wide">
                <th className="py-2 pr-3 text-left font-semibold">Party</th>
                <th className="py-2 pr-3 text-right font-semibold">0-30</th>
                <th className="py-2 pr-3 text-right font-semibold">31-60</th>
                <th className="py-2 pr-3 text-right font-semibold">61-90</th>
                <th className="py-2 pr-3 text-right font-semibold">90+</th>
                <th className="py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {side.parties.map((p) => (
                <tr key={p.partyId} className="border-b border-divider/40 hover:bg-default-50">
                  <td className="py-2 pr-3 font-medium">{p.partyName}</td>
                  <td className="py-2 pr-3 text-right">{p.current > 0 ? inr(p.current) : "—"}</td>
                  <td className="py-2 pr-3 text-right">{p.days_31_60 > 0 ? inr(p.days_31_60) : "—"}</td>
                  <td className="py-2 pr-3 text-right">{p.days_61_90 > 0 ? inr(p.days_61_90) : "—"}</td>
                  <td className="py-2 pr-3 text-right text-danger">{p.days_90_plus > 0 ? inr(p.days_90_plus) : "—"}</td>
                  <td className="py-2 text-right font-bold">{inr(p.total)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-divider bg-default-50 font-bold">
                <td className="py-2.5 pr-3">Total</td>
                <td className="py-2.5 pr-3 text-right">{inr(side.buckets.current)}</td>
                <td className="py-2.5 pr-3 text-right">{inr(side.buckets.days_31_60)}</td>
                <td className="py-2.5 pr-3 text-right">{inr(side.buckets.days_61_90)}</td>
                <td className="py-2.5 pr-3 text-right text-danger">{inr(side.buckets.days_90_plus)}</td>
                <td className="py-2.5 text-right">{inr(side.buckets.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AgingView({ data }: { data: AgingData }) {
  return (
    <div className="space-y-8">
      <AgingSideTable title="Receivable (A/R)" side={data.receivable} />
      <AgingSideTable title="Payable (A/P)" side={data.payable} />
    </div>
  );
}

function GeneralLedgerView({ data }: { data: GeneralLedgerData }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-sm">
        <span className="text-default-500">
          Account: <span className="font-semibold text-foreground">{data.accountName}</span>
        </span>
        <span className="text-default-500">
          Opening: <span className="font-semibold">{inr(data.openingBalance)}</span>
        </span>
        <span className="text-default-500">
          Closing: <span className="font-semibold">{inr(data.closingBalance)}</span>
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-divider text-xs text-default-500 uppercase tracking-wide">
              <th className="py-2 pr-3 text-left font-semibold">Date</th>
              <th className="py-2 pr-3 text-left font-semibold">Voucher</th>
              <th className="py-2 pr-3 text-left font-semibold">Particulars</th>
              <th className="py-2 pr-3 text-right font-semibold">Debit</th>
              <th className="py-2 pr-3 text-right font-semibold">Credit</th>
              <th className="py-2 text-right font-semibold">Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-divider/40 bg-default-50/60 font-medium italic">
              <td className="py-2 pr-3" colSpan={5}>
                Opening Balance
              </td>
              <td className="py-2 text-right">{inr(data.openingBalance)}</td>
            </tr>
            {data.lines.map((line, idx) => (
              <tr key={`${line.journalId}-${idx}`} className="border-b border-divider/40 hover:bg-default-50">
                <td className="py-2 pr-3 whitespace-nowrap">{formatIstDate(line.date)}</td>
                <td className="py-2 pr-3 text-xs text-default-500 uppercase">
                  {line.voucherType.toLowerCase().replace("_", " ")}
                </td>
                <td className="py-2 pr-3">
                  <div className="text-default-700">{line.narration}</div>
                  {line.partyName && (
                    <div className="text-xs text-default-500">{line.partyName}</div>
                  )}
                </td>
                <td className="py-2 pr-3 text-right">{line.debit > 0 ? inr(line.debit) : "—"}</td>
                <td className="py-2 pr-3 text-right">{line.credit > 0 ? inr(line.credit) : "—"}</td>
                <td className="py-2 text-right font-semibold">{inr(line.balance)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-divider bg-default-50 font-bold">
              <td className="py-2 pr-3" colSpan={3}>Closing Balance</td>
              <td className="py-2 pr-3 text-right">{inr(data.totalDebit)}</td>
              <td className="py-2 pr-3 text-right">{inr(data.totalCredit)}</td>
              <td className="py-2 text-right">{inr(data.closingBalance)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
