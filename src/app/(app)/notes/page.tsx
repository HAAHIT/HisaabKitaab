"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Pagination,
  Select,
  SelectItem,
  Skeleton,
} from "@heroui/react";
import { useRouter } from "next/navigation";

interface Note {
  id: string;
  entryDate: string;
  narration: string;
  voucherType: "CREDIT_NOTE" | "DEBIT_NOTE";
  grandTotal: number;
  partyName: string | null;
  partyId: string | null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

async function readError(response: Response) {
  const data = await response.json().catch(() => null);
  return data?.error || "Request failed";
}

export default function NotesListPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const monthlyGroups = useMemo(() => {
    const monthFormatter = new Intl.DateTimeFormat("en-IN", {
      month: "long",
      year: "numeric",
    });
    const groups = new Map<string, { label: string; notes: Note[]; total: number }>();

    for (const note of notes) {
      const date = new Date(note.entryDate);
      const groupKey = `${date.getFullYear()}-${date.getMonth()}`;
      const existing = groups.get(groupKey);
      if (existing) {
        existing.notes.push(note);
        existing.total += Number(note.grandTotal);
        continue;
      }
      groups.set(groupKey, { label: monthFormatter.format(date), notes: [note], total: Number(note.grandTotal) });
    }

    return Array.from(groups.entries()).map(([key, group]) => ({ key, ...group }));
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

  const typeOptions = [
    { key: "ALL", label: "All Notes" },
    { key: "CREDIT_NOTE", label: "Credit Notes" },
    { key: "DEBIT_NOTE", label: "Debit Notes" },
  ];

  return (
    <div className="animate-fade-in p-4 lg:p-8">
      {toast && (
        <div
          className={`fixed right-4 top-4 z-[100] rounded-xl px-4 py-3 shadow-lg animate-slide-up ${
            toast.type === "success" ? "bg-success text-white" : "bg-danger text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Credit &amp; Debit Notes</h1>
          <p className="mt-1 text-sm text-default-500">
            Manage sales returns (credit notes) and purchase returns (debit notes).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            color="primary"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold shadow-lg shadow-blue-500/25"
            onPress={() => router.push("/notes/new?type=CREDIT_NOTE")}
            startContent={
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
            }
          >
            Credit Note
          </Button>
          <Button
            color="primary"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold shadow-lg shadow-blue-500/25"
            onPress={() => router.push("/notes/new?type=DEBIT_NOTE")}
            startContent={
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
            }
          >
            Debit Note
          </Button>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <Input
          aria-label="Search notes"
          placeholder="Search by narration or party…"
          value={search}
          onValueChange={setSearch}
          variant="bordered"
          className="flex-1"
          startContent={
            <svg className="h-4 w-4 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
            </svg>
          }
        />
        <Select
          aria-label="Filter by type"
          placeholder="All Notes"
          selectedKeys={new Set([typeFilter])}
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0] as string;
            if (value) { setTypeFilter(value); setPage(1); }
          }}
          variant="bordered"
          className="w-44"
        >
          {typeOptions.map((opt) => (
            <SelectItem key={opt.key} textValue={opt.label}>{opt.label}</SelectItem>
          ))}
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <Card shadow="sm">
          <CardBody className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <svg className="h-10 w-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
              </svg>
            </div>
            <p className="text-lg font-medium text-default-600">
              {search || typeFilter !== "ALL" ? "No notes found matching your filters" : "No notes recorded yet"}
            </p>
            <p className="mt-1 text-sm text-default-400">
              {search || typeFilter !== "ALL"
                ? "Try adjusting your search or filters"
                : "Create a credit or debit note using the buttons above"}
            </p>
            {!search && typeFilter === "ALL" && (
              <Button
                color="primary"
                variant="flat"
                size="sm"
                className="mt-4"
                onPress={() => router.push("/notes/new?type=CREDIT_NOTE")}
              >
                Create Note
              </Button>
            )}
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="space-y-6">
            {monthlyGroups.map((group) => {
              const isCollapsed = collapsedMonths[group.key] === true;
              return (
                <section key={group.key} className="space-y-3">
                  <button
                    type="button"
                    aria-expanded={!isCollapsed}
                    aria-controls={`notes-month-${group.key}`}
                    className="w-full rounded-xl border border-default-200 bg-content2/40 px-4 py-2 text-left transition hover:bg-content2/60"
                    onClick={() => toggleMonth(group.key)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-default-700">{group.label}</p>
                        <Chip size="sm" variant="flat" color="default">
                          {group.notes.length} {group.notes.length === 1 ? "note" : "notes"}
                        </Chip>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-semibold text-default-700">
                          {formatCurrency(group.total)}
                        </p>
                        <svg
                          className={`h-4 w-4 text-default-500 transition-transform ${isCollapsed ? "" : "rotate-180"}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="m19 9-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
                        </svg>
                      </div>
                    </div>
                  </button>

                  {!isCollapsed && (
                    <div
                      id={`notes-month-${group.key}`}
                      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
                    >
                      {group.notes.map((note) => {
                        const isCredit = note.voucherType === "CREDIT_NOTE";
                        return (
                          <Card key={note.id} shadow="sm" className="transition hover:shadow-md">
                            <CardBody className="p-4">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex flex-col gap-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Chip
                                      size="sm"
                                      variant="flat"
                                      color={isCredit ? "success" : "warning"}
                                      className="flex-shrink-0"
                                    >
                                      {isCredit ? "Credit" : "Debit"}
                                    </Chip>
                                    {note.partyName && (
                                      <span className="text-sm font-medium truncate">{note.partyName}</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-default-500 line-clamp-2">{note.narration}</p>
                                  <p className="text-xs text-default-400">
                                    {new Date(note.entryDate).toLocaleDateString("en-IN", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-lg font-bold">{formatCurrency(note.grandTotal)}</p>
                                </div>
                              </div>
                            </CardBody>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <Pagination total={totalPages} page={page} onChange={setPage} showControls />
            </div>
          )}
        </>
      )}

    </div>
  );
}
