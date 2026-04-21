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
import { useLanguage } from "@/contexts/LanguageContext";
import { EmptyState } from "@/components/ui/empty-state";
import { Receipt } from "@/components/ui/icons";

interface Bill {
  id: string;
  billNumber: string;
  party: {
    id: string;
    name: string;
    type: string;
  } | null;
  customerName: string;
  grandTotal: number;
  status: string;
  createdAt: string;
}

const statusColorMap: Record<string, "default" | "primary" | "success" | "danger"> = {
  DRAFT: "default",
  FINAL: "success",
  CANCELLED: "danger",
};

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

export default function BillsListPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [collapsedMonths, setCollapsedMonths] = useState<
    Record<string, boolean>
  >({});
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const monthlyBillGroups = useMemo(() => {
    const monthFormatter = new Intl.DateTimeFormat("en-IN", {
      month: "long",
      year: "numeric",
    });
    const groups = new Map<
      string,
      {
        label: string;
        bills: Bill[];
        total: number;
      }
    >();

    for (const bill of bills) {
      const createdDate = new Date(bill.createdAt);
      const groupKey = `${createdDate.getFullYear()}-${createdDate.getMonth()}`;
      const existing = groups.get(groupKey);

      if (existing) {
        existing.bills.push(bill);
        existing.total += Number(bill.grandTotal);
        continue;
      }

      groups.set(groupKey, {
        label: monthFormatter.format(createdDate),
        bills: [bill],
        total: Number(bill.grandTotal),
      });
    }

    return Array.from(groups.entries()).map(([key, group]) => ({
      key,
      ...group,
    }));
  }, [bills]);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("partyType", "CUSTOMER"); // Only show sales
      if (search) {
        params.set("search", search);
      }
      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }
      params.set("page", String(page));

      const response = await fetch(`/api/bills?${params.toString()}`);
      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const data = await response.json();
      setBills((data.bills || []) as Bill[]);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      setBills([]);
      setTotalPages(1);
      showToast(error instanceof Error ? error.message : t("bills.loadFailed"), "error");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, t]);

  const statusOptions = [
    { key: "ALL", label: t("bills.filter.all") },
    { key: "DRAFT", label: t("bills.filter.draft") },
    { key: "FINAL", label: t("bills.filter.final") },
    { key: "CANCELLED", label: t("bills.filter.cancelled") },
  ];

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  function toggleMonth(key: string) {
    setCollapsedMonths((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

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
          <h1 className="text-2xl font-bold">{t("bills.title")}</h1>
          <p className="mt-1 text-sm text-default-500">
            {t("bills.subtitle")}
          </p>
        </div>
        <Button
          color="primary"
          className="bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold shadow-lg shadow-blue-500/25"
          onPress={() => router.push("/bills/new")}
          startContent={
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M12 4v16m8-8H4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          }
        >
          {t("bills.create")}
        </Button>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <Input
          aria-label={t("bills.searchPlaceholder")}
          placeholder={t("bills.searchPlaceholder")}
          value={search}
          onValueChange={setSearch}
          variant="bordered"
          className="flex-1"
          startContent={
            <svg className="h-4 w-4 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
              />
            </svg>
          }
        />
        <Select
          aria-label={t("bills.filter.all")}
          placeholder={t("bills.filter.all")}
          selectedKeys={new Set([statusFilter])}
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0] as string;
            if (value) {
              setStatusFilter(value);
              setPage(1);
            }
          }}
          variant="bordered"
          className="w-40"
        >
          {statusOptions.map((option) => (
            <SelectItem key={option.key} textValue={option.label}>{option.label}</SelectItem>
          ))}

        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : bills.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={search || statusFilter !== "ALL" ? t("bills.emptyFiltered") : t("bills.empty")}
          description={search || statusFilter !== "ALL" ? t("bills.emptyFilteredHint") : t("bills.emptyHint")}
          actionLabel={!search && statusFilter === "ALL" ? t("bills.create") : undefined}
          onAction={!search && statusFilter === "ALL" ? () => router.push("/bills/new") : undefined}
          className="mt-8"
        />
      ) : (
        <>
          <div className="space-y-6">
            {monthlyBillGroups.map((group) => {
              const isCollapsed = collapsedMonths[group.key] === true;
              return (
                <section key={group.key} className="space-y-3">
                  <button
                    type="button"
                    aria-expanded={!isCollapsed}
                    aria-controls={`bill-month-${group.key}`}
                    className="w-full rounded-xl border border-default-200 bg-content2/40 px-4 py-2 text-left transition hover:bg-content2/60"
                    onClick={() => toggleMonth(group.key)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-default-700">{group.label}</p>
                        <Chip size="sm" variant="flat" color="default">
                          {group.bills.length} bills
                        </Chip>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-semibold text-default-700">
                          {formatCurrency(group.total)}
                        </p>
                        <svg
                          className={`h-4 w-4 text-default-500 transition-transform ${
                            isCollapsed ? "" : "rotate-180"
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="m19 9-7 7-7-7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.8}
                          />
                        </svg>
                      </div>
                    </div>
                  </button>
                  {!isCollapsed && (
                    <div
                      id={`bill-month-${group.key}`}
                      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
                    >
                      {group.bills.map((bill) => (
                        <Card
                          key={bill.id}
                          isPressable
                          shadow="sm"
                          className="transition hover:shadow-md"
                          onPress={() => router.push(`/bills/${bill.id}`)}
                        >
                          <CardBody className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm font-semibold">{bill.billNumber}</span>
                                  <Chip
                                    size="sm"
                                    variant="flat"
                                    color={statusColorMap[bill.status] || "default"}
                                    className="capitalize"
                                  >
                                    {bill.status.toLowerCase()}
                                  </Chip>
                                </div>
                                <p className="text-default-600">{bill.customerName}</p>
                                {bill.party && (
                                  <p className="text-xs text-default-400">
                                    {t("bills.partyPrefix")}: {bill.party.name}
                                  </p>
                                )}
                                <p className="text-xs text-default-400">
                                  {new Date(bill.createdAt).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold">{formatCurrency(bill.grandTotal)}</p>
                              </div>
                            </div>
                          </CardBody>
                        </Card>
                      ))}
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
