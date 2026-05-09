"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pagination, Skeleton } from "@heroui/react";
import { useRouter } from "next/navigation";
import {
  GR, AM, PU, OR, SG, IN, TYPE,
  fmtFull, useIsMobile,
  HKCard, HKToast, SearchBox, PillFilter,
  PageHeader, GradientButton,
} from "@/components/ui/hk-design";

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
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "CREDIT_NOTE" | "DEBIT_NOTE">("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const monthlyGroups = useMemo(() => {
    const monthFormatter = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });
    const groups = new Map<string, { label: string; notes: Note[]; total: number }>();
    for (const note of notes) {
      const d = new Date(note.entryDate);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
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
    { key: "ALL" as const, label: `Sab (${notes.length})` },
    { key: "CREDIT_NOTE" as const, label: `Credit (${totalCredit})` },
    { key: "DEBIT_NOTE" as const, label: `Debit (${totalDebit})` },
  ];

  return (
    <div style={{ background: "var(--hk-bg)", minHeight: "100%", fontFamily: SG }}>
      {toast && <HKToast message={toast.message} type={toast.type} />}

      <PageHeader
        title="Credit & Debit Notes"
        subtitle="Sales returns aur purchase returns"
        isMobile={isMobile}
        action={
          !isMobile && (
            <div style={{ display: "flex", gap: 8 }}>
              <GradientButton onClick={() => router.push("/notes/new?type=CREDIT_NOTE")}>
                + Credit Note
              </GradientButton>
              <button
                onClick={() => router.push("/notes/new?type=DEBIT_NOTE")}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  gap: 8, minHeight: 48, padding: "0 22px", borderRadius: 14,
                  background: AM + "18", border: `1.5px solid ${AM}44`,
                  color: AM, fontFamily: SG, fontSize: TYPE.body, fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                + Debit Note
              </button>
            </div>
          )
        }
      />

      <div style={{ padding: isMobile ? "0 14px" : "0 28px", maxWidth: 1440, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <SearchBox value={search} onChange={setSearch} placeholder="Note dhundho..." />
          <PillFilter
            options={filterOptions}
            value={typeFilter}
            onChange={(v) => { setTypeFilter(v); setPage(1); }}
          />
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
        ) : notes.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--hk-sub)" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>📝</div>
            <p style={{ fontWeight: 700, fontSize: TYPE.h2, color: "var(--hk-text)", marginBottom: 8, fontFamily: SG }}>
              {search || typeFilter !== "ALL" ? "Koi note nahi mila" : "Abhi tak koi note nahi"}
            </p>
            <p style={{ fontSize: TYPE.body, fontWeight: 500, fontFamily: SG, marginBottom: 20 }}>
              {search || typeFilter !== "ALL" ? "Search badlo ya naya note banao" : "Pehla credit ya debit note banao"}
            </p>
            {!search && typeFilter === "ALL" && (
              <GradientButton onClick={() => router.push("/notes/new?type=CREDIT_NOTE")}>
                + Credit Note Banao
              </GradientButton>
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
                      background: "var(--hk-badge)", border: "1px solid var(--hk-border)",
                      marginBottom: 10, cursor: "pointer", fontFamily: SG,
                    }}
                  >
                    <span style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--hk-text)" }}>
                      {group.label}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: TYPE.numSmall, fontWeight: 700, color: "var(--hk-sub)", fontFamily: IN }}>
                        {fmtFull(group.total)}
                      </span>
                      <span style={{ fontSize: TYPE.bodySmall, fontWeight: 500, color: "var(--hk-sub)" }}>
                        · {group.notes.length} notes
                      </span>
                      <svg
                        width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="var(--hk-sub)" strokeWidth="1.8" strokeLinecap="round"
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
                              borderBottom: i < group.notes.length - 1 ? "1px solid var(--hk-border)" : "none",
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
                                    {isCredit ? "Credit" : "Debit"}
                                  </span>
                                  {note.partyName && (
                                    <span style={{ fontSize: TYPE.bodySmall, fontWeight: 700, color: "var(--hk-sub)", fontFamily: SG, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {note.partyName}
                                    </span>
                                  )}
                                </div>
                                <p style={{ fontSize: TYPE.body, fontWeight: 600, color: "var(--hk-text)", marginBottom: 3, fontFamily: SG, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {note.narration || "—"}
                                </p>
                                <p style={{ fontSize: TYPE.bodySmall, fontWeight: 500, color: "var(--hk-sub)", fontFamily: SG }}>
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
                <Pagination total={totalPages} page={page} onChange={setPage} showControls />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
