"use client";

import { useCallback, useEffect, useState } from "react";
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

interface Payment {
  id: string;
  amount: number;
  direction: string;
  mode: string;
  status: string;
  date: string;
  notes: string | null;
  party: { name: string; type: string };
  linkedBill: { id: string; billNumber: string } | null;
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

export default function PaymentsListPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) {
        params.set("search", search);
      }
      if (typeFilter !== "ALL") {
        params.set("type", typeFilter);
      }
      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }
      params.set("page", String(page));

      const response = await fetch(`/api/payments?${params.toString()}`);
      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const data = await response.json();
      setPayments((data.payments || []) as Payment[]);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      setPayments([]);
      setTotalPages(1);
      showToast(
        error instanceof Error ? error.message : t("payments.loadFailed"),
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, t, typeFilter]);

  const typeOptions = [
    { key: "ALL", label: t("payments.filter.allTypes") },
    { key: "INCOMING", label: t("payments.filter.received") },
    { key: "OUTGOING", label: t("payments.filter.paid") },
  ];

  const statusOptions = [
    { key: "ALL", label: t("payments.filter.allStatus") },
    { key: "COMPLETED", label: t("payments.filter.completed") },
    { key: "EXPECTED", label: t("payments.filter.expected") },
  ];

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  async function markAsCompleted(paymentId: string) {
    setMarkingId(paymentId);
    try {
      const response = await fetch("/api/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      showToast(t("payments.markCompletedSuccess"), "success");
      await fetchPayments();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t("payments.markCompletedFailed"),
        "error"
      );
    } finally {
      setMarkingId(null);
    }
  }

  return (
    <div className="animate-fade-in p-4 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("payments.title")}</h1>
          <p className="mt-1 text-sm text-default-500">
            {t("payments.subtitle")}
          </p>
        </div>
        <Button
          color="primary"
          className="bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold shadow-lg shadow-blue-500/25"
          onPress={() => router.push("/payments/new")}
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
          {t("payments.record")}
        </Button>
      </div>

      {toast && (
        <div
          className={`fixed right-4 top-4 z-[100] rounded-xl px-4 py-3 shadow-lg animate-slide-up ${
            toast.type === "success" ? "bg-success text-white" : "bg-danger text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <Input
          aria-label={t("payments.searchPlaceholder")}
          placeholder={t("payments.searchPlaceholder")}
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
          aria-label={t("payments.filter.allTypes")}
          selectedKeys={[typeFilter]}
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0] as string;
            if (value) {
              setTypeFilter(value);
              setPage(1);
            }
          }}
          variant="bordered"
          className="w-40"
        >
          {typeOptions.map((option) => (
            <SelectItem key={option.key}>{option.label}</SelectItem>
          ))}
        </Select>
        <Select
          aria-label={t("payments.filter.allStatus")}
          selectedKeys={[statusFilter]}
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0] as string;
            if (value) {
              setStatusFilter(value);
              setPage(1);
            }
          }}
          variant="bordered"
          className="w-44"
        >
          {statusOptions.map((option) => (
            <SelectItem key={option.key}>{option.label}</SelectItem>
          ))}
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : payments.length === 0 ? (
        <Card shadow="sm">
          <CardBody className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
              <svg className="h-10 w-10 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                />
              </svg>
            </div>
            <p className="text-lg font-medium text-default-600">
              {search || typeFilter !== "ALL" || statusFilter !== "ALL"
                ? t("payments.emptyFiltered")
                : t("payments.empty")}
            </p>
            <Button
              color="primary"
              variant="flat"
              size="sm"
              className="mt-3"
              onPress={() => router.push("/payments/new")}
            >
              {t("payments.record")}
            </Button>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {payments.map((payment) => (
              <Card
                key={payment.id}
                shadow="sm"
                className={`transition hover:shadow-md ${
                  payment.status === "EXPECTED" ? "border-l-4 border-l-warning" : ""
                }`}
              >
                <CardBody className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{payment.party.name}</span>
                        <Chip
                          size="sm"
                          variant="flat"
                          color={
                            payment.status === "EXPECTED"
                              ? "warning"
                              : payment.direction === "INCOMING"
                                ? "success"
                                : "warning"
                          }
                        >
                          {payment.status === "EXPECTED"
                            ? payment.direction === "INCOMING"
                              ? t("payments.toReceive")
                              : t("payments.toPay")
                            : payment.direction === "INCOMING"
                              ? t("payments.filter.received")
                              : t("payments.filter.paid")}
                        </Chip>
                        <Chip size="sm" variant="flat" color="default" className="capitalize">
                          {payment.mode.toLowerCase().replace("_", " ")}
                        </Chip>
                      </div>
                      <div className="flex gap-3 text-xs text-default-400">
                        <span>
                          {new Date(payment.date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        {payment.notes && (
                          <span className="max-w-[200px] truncate">{payment.notes}</span>
                        )}
                        {payment.linkedBill && (
                          <span className="max-w-[200px] truncate">
                            {t("payments.billPrefix")}: {payment.linkedBill.billNumber}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <p
                        className={`text-lg font-bold ${
                          payment.direction === "INCOMING" ? "text-success" : "text-warning"
                        }`}
                      >
                        {payment.direction === "INCOMING" ? "+" : "-"}
                        {formatCurrency(payment.amount)}
                      </p>
                      {payment.status === "EXPECTED" && (
                        <Button
                          size="sm"
                          color="success"
                          variant="flat"
                          isLoading={markingId === payment.id}
                          onPress={() => markAsCompleted(payment.id)}
                        >
                          {t("payments.markCompleted")}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
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
