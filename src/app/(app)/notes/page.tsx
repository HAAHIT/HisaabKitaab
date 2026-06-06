"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HKSkeleton } from "@/components/ui/HKSkeleton";
import { HKPagination } from "@/components/ui/HKPagination";
import { useRouter } from "next/navigation";
import {
  C, GR, AM, PU, OR, SG, IN, TYPE,
  fmtFull, useIsMobile,
  HKCard, HKToast, SearchBox, PillFilter,
  PageHeader,
} from "@/components/ui/hk-design";
import { HKButton } from "@/components/ui/HKButton";
import { useLanguage } from "@/contexts/LanguageContext";

interface Note {
  id: string;
  entryDate: string;
  narration: string;
  voucherType: "CREDIT_NOTE" | "DEBIT_NOTE";
  grandTotal: number;
  partyName: string | null;
  partyId: string | null;
}

async function readError(response: Response) {
  const data = await response.json().catch(() => null);
  return data?.error || "Request failed";
}

export default function NotesListPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { t, language } = useLanguage();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "CREDIT_NOTE" | "DEBIT_NOTE">("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const monthlyGroups = useMemo(() => {
    const monthFormatter = new Intl.DateTimeFormat(language === "hi" ? "hi-IN" : "en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
    // Group by IST year+month so notes entered near midnight don't fall into the
    // previous/next month bucket when the server returns UTC dates.
    const istKey = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", year: "numeric", month: "numeric" });
    const groups = new Map<string, { label: string; notes: Note[]; total: number }>();
    for (const note of notes) {
      const d = new Date(note.entryDate);
      const parts = istKey.formatToParts(d);
      const year = parts.find((p) => p.type === "year")?.value;
      const month = parts.find((p) => p.type === "month")?.value;
      const key = `${year}-${month}`;
      const existing = groups.get(key);
      if (existing) {
        existing.notes.push(note);
        existing.total += Number(note.grandTotal);
      } else {
        groups.set(key, { label: monthFormatter.format(d), notes: [note], total: Number(note.grandTotal) });
      }
    }
    return Array.from(groups.entries()).map(([key, g]) => ({ key, ...g }));
  }, [notes]);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      params.set("page", String(page));

      const response = await fetch(`/api/credit-notes?${params.toString()}`);
      if (!response.ok) throw new Error(await readError(response));

      const data = await response.json();
      setNotes((data.notes || []) as Note[]);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      setNotes([]);
      setTotalPages(1);
      showToast(error instanceof Error ? error.message : "Failed to load notes", "error");
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  function toggleMonth(key: string) {
    setCollapsedMonths((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const totalCredit = notes.filter((n) => n.voucherType === "CREDIT_NOTE").length;
  const totalDebit = notes.filter((n) => n.voucherType === "DEBIT_NOTE").length;

  const filterOptions = [
    { key: "ALL" as const, label: `${t("notes.filter.all")} (${notes.length})` },
    { key: "CREDIT_NOTE" as const, label: `${t("notes.filter.credit")} (${totalCredit})` },
    { key: "DEBIT_NOTE" as const, label: `${t("notes.filter.debit")} (${totalDebit})` },
  ];

  return (
    <div style={{ background: "var(--sb-bg)", minHeight: "100%", fontFamily: SG }}>
      {toast && <HKToast message={toast.message} type={toast.type} />}

      <div style={{ padding: isMobile ? "18px 14px 100px" : "24px 28px", maxWidth: 1440, margin: "0 auto" }}>
        <PageHeader
          title={t("notes.title")}
          subtitle={t("notes.subtitle")}
          isMobile={isMobile}
          action={
            !isMobile && (
              <div style={{ display: "flex", gap: 8 }}>
                <HKButton onClick={() => router.push("/notes/new?type=CREDIT_NOTE")}>
                  {t("notes.addCreditNote")}
                </HKButton>
                <button
                  onClick={() => router.push("/notes/new?type=DEBIT_NOTE")}
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    gap: 8, minHeight: 48, padding: "0 22px", borderRadius: 14,
                    background: C.warningSoft, border: `1.5px solid ${AM}44`,
                    color: AM, fontFamily: SG, fontSize: TYPE.body, fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {t("notes.addDebitNote")}
                </button>
              </div>
            )
          }
        />
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <SearchBox value={search} onChange={setSearch} placeholder={t("notes.searchPlaceholder")} />
          <PillFilter
            options={filterOptions}
            value={typeFilter}
            onChange={(v) => { setTypeFilter(v); setPage(1); }}
          />
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1, 2, 3, 4].map((i) => <HKSkeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
        ) : notes.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--sb-sub)" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>📝</div>
            <p style={{ fontWeight: 700, fontSize: TYPE.h2, color: "var(--sb-text)", marginBottom: 8, fontFamily: SG }}>
              {search || typeFilter !== "ALL" ? t("notes.emptyFilteredTitle") : t("notes.emptyTitle")}
            </p>
            <p style={{ fontSize: TYPE.body, fontWeight: 500, fontFamily: SG, marginBottom: 20 }}>
              {search || typeFilter !== "ALL" ? t("notes.emptyFilteredHint") : t("notes.emptyHint")}
            </p>
            {!search && typeFilter === "ALL" && (
              <HKButton onClick={() => router.push("/notes/new?type=CREDIT_NOTE")}>
                {t("notes.createCreditNote")}
              </HKButton>
            )}
          </div>
        ) : (
          <>
            {monthlyGroups.map((group) => {
              const isCollapsed = collapsedMonths[group.key] === true;
              return (
                <div key={group.key} style={{ marginBottom: 20 }}>
                  <button
                    onClick={() => toggleMonth(group.key)}
                    aria-expanded={!isCollapsed}
                    style={{
                      width: "100%", minHeight: 48, display: "flex",
                      justifyContent: "space-between", alignItems: "center",
                      padding: "10px 16px", borderRadius: 12,
                      background: "var(--sb-badge)", border: "1px solid var(--sb-border)",
                      marginBottom: 10, cursor: "pointer", fontFamily: SG,
                    }}
                  >
                    <span style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--sb-text)" }}>
                      {group.label}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: TYPE.numSmall, fontWeight: 700, color: "var(--sb-sub)", fontFamily: IN }}>
                        {fmtFull(group.total)}
                      </span>
                      <span style={{ fontSize: TYPE.bodySmall, fontWeight: 500, color: "var(--sb-sub)" }}>
                        · {group.notes.length} {t("notes.countSuffix")}
                      </span>
                      <svg
                        width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="var(--sb-sub)" strokeWidth="1.8" strokeLinecap="round"
                        style={{ transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </div>
                  </button>

                  {!isCollapsed && (
                    <HKCard style={{ padding: "0 16px" }}>
                      {group.notes.map((note, i) => {
                        const isCredit = note.voucherType === "CREDIT_NOTE";
                        return (
                          <div
                            key={note.id}
                            onClick={() => router.push(`/notes/${note.id}`)}
                            style={{
                              display: "flex", justifyContent: "space-between",
                              alignItems: "center", padding: "16px 0",
                              borderBottom: i < group.notes.length - 1 ? "1px solid var(--sb-border)" : "none",
                              minHeight: 64, cursor: "pointer",
                            }}
                          >
                            <div style={{ display: "flex", gap: 14, alignItems: "center", flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  width: 44, height: 44, borderRadius: 11, flexShrink: 0,
                                  background: isCredit ? GR + "18" : AM + "18",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                }}
                              >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                                  stroke={isCredit ? GR : AM} strokeWidth="2" strokeLinecap="round"
                                >
                                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                                </svg>
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                  <span
                                    style={{
                                      fontSize: TYPE.chip, fontWeight: 700,
                                      color: isCredit ? GR : AM,
                                      background: isCredit ? GR + "18" : AM + "18",
                                      padding: "3px 8px", borderRadius: 6, fontFamily: SG,
                                    }}
                                  >
                                    {isCredit ? t("notes.filter.credit") : t("notes.filter.debit")}
                                  </span>
                                  {note.partyName && (
                                    <span style={{ fontSize: TYPE.bodySmall, fontWeight: 700, color: "var(--sb-sub)", fontFamily: SG, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {note.partyName}
                                    </span>
                                  )}
                                </div>
                                <p style={{ fontSize: TYPE.body, fontWeight: 600, color: "var(--sb-text)", marginBottom: 3, fontFamily: SG, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {note.narration || "—"}
                                </p>
                                <p style={{ fontSize: TYPE.bodySmall, fontWeight: 500, color: "var(--sb-sub)", fontFamily: SG }}>
                                  {new Date(note.entryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                </p>
                              </div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <p style={{ fontSize: TYPE.numMedium, fontWeight: 800, color: isCredit ? GR : PU, fontFamily: IN, whiteSpace: "nowrap" }}>
                                {fmtFull(note.grandTotal)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </HKCard>
                  )}
                </div>
              );
            })}

            {totalPages > 1 && (
              <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
                <HKPagination total={totalPages} page={page} onChange={setPage} showControls />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
