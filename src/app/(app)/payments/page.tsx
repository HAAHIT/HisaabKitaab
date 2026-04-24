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
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { EditPaymentModal, type EditablePayment } from "./EditPaymentModal";

interface Payment {
  id: string;
  partyId: string | null;
  accountId: string | null;
  destinationAccountId: string | null;
  amount: number;
  direction: string;
  mode: string;
  status: string;
  date: string;
  notes: string | null;
  party: { name: string; type: string } | null;
  linkedBill: { id: string; billNumber: string } | null;
}

const PencilIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
);

const TrashIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
  const [collapsedMonths, setCollapsedMonths] = useState<
    Record<string, boolean>
  >({});
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [paymentToEdit, setPaymentToEdit] = useState<Payment | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const monthlyPaymentGroups = useMemo(() => {
    const monthFormatter = new Intl.DateTimeFormat("en-IN", {
      month: "long",
      year: "numeric",
    });
    const groups = new Map<
      string,
      {
        label: string;
        payments: Payment[];
        incomingTotal: number;
        outgoingTotal: number;
      }
    >();

    for (const payment of payments) {
      const paymentDate = new Date(payment.date);
      const groupKey = `${paymentDate.getFullYear()}-${paymentDate.getMonth()}`;
      const existing = groups.get(groupKey);
      const isIncoming = payment.direction === "INCOMING";

      if (existing) {
        existing.payments.push(payment);
        if (isIncoming) {
          existing.incomingTotal += Number(payment.amount);
        } else {
          existing.outgoingTotal += Number(payment.amount);
        }
        continue;
      }

      groups.set(groupKey, {
        label: monthFormatter.format(paymentDate),
        payments: [payment],
        incomingTotal: isIncoming ? Number(payment.amount) : 0,
        outgoingTotal: isIncoming ? 0 : Number(payment.amount),
      });
    }

    return Array.from(groups.entries()).map(([key, group]) => ({
      key,
      ...group,
    }));
  }, [payments]);

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

  function toggleMonth(key: string) {
    setCollapsedMonths((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
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

  async function handleDeletePayment() {
    if (!paymentToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/payments/${paymentToDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw res;
      showToast(t("payments.deletedSuccess") || "Payment deleted", "success");
      await fetchPayments();
      setIsDeleteModalOpen(false);
      setPaymentToDelete(null);
    } catch (error) {
      showToast(
        error instanceof Error ? (error as any).message || "Delete failed" : t("payments.deleteFailed"),
        "error"
      );
    } finally {
      setIsDeleting(false);
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
          className={`fixed right-4 top-4 z-[100] rounded-xl px-4 py-3 shadow-lg animate-slide-up ${toast.type === "success" ? "bg-success text-white" : "bg-danger text-white"
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
          placeholder={t("payments.filter.allTypes")}
          selectedKeys={new Set([typeFilter])}
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
          placeholder={t("payments.filter.allStatus")}
          selectedKeys={new Set([statusFilter])}
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
          <div className="space-y-6">
            {monthlyPaymentGroups.map((group) => {
              const isCollapsed = collapsedMonths[group.key] === true;
              return (
                <section key={group.key} className="space-y-3">
                  <button
                    type="button"
                    aria-expanded={!isCollapsed}
                    aria-controls={`payment-month-${group.key}`}
                    className="w-full rounded-xl border border-default-200 bg-content2/40 px-4 py-2 text-left transition hover:bg-content2/60"
                    onClick={() => toggleMonth(group.key)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-default-700">{group.label}</p>
                        <Chip size="sm" variant="flat" color="default">
                          {group.payments.length} payments
                        </Chip>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-3 text-sm font-semibold">
                          <span className="text-success">+{formatCurrency(group.incomingTotal)}</span>
                          <span className="text-warning">-{formatCurrency(group.outgoingTotal)}</span>
                        </div>
                        <svg
                          className={`h-4 w-4 text-default-500 transition-transform ${isCollapsed ? "" : "rotate-180"
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
                    <div id={`payment-month-${group.key}`} className="space-y-3">
                      {group.payments.map((payment) => (
                        <Card
                          key={payment.id}
                          shadow="sm"
                          className={`transition hover:shadow-md ${payment.status === "EXPECTED" ? "border-l-4 border-l-warning" : ""
                            }`}
                        >
                          <CardBody className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col gap-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold">
                                    {payment.party ? payment.party.name : "Bank/Cash Transfer"}
                                  </span>
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
                                  className={`text-lg font-bold ${payment.direction === "INCOMING" ? "text-success" : "text-warning"
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
                                <Button
                                  isIconOnly
                                  variant="light"
                                  size="sm"
                                  onPress={() => {
                                    setPaymentToEdit(payment);
                                    setIsEditModalOpen(true);
                                  }}
                                >
                                  <PencilIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                  isIconOnly
                                  variant="light"
                                  color="danger"
                                  size="sm"
                                  onPress={() => {
                                    setPaymentToDelete(payment);
                                    setIsDeleteModalOpen(true);
                                  }}
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </Button>
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

      <EditPaymentModal
        payment={paymentToEdit as EditablePayment | null}
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setPaymentToEdit(null); }}
        onSuccess={() => { showToast("Payment updated", "success"); fetchPayments(); }}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onOpenChange={(open) => setIsDeleteModalOpen(open)}
        backdrop="blur"
        placement="center"
        classNames={{
          backdrop: "bg-black/60",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-full bg-danger/10">
                    <TrashIcon className="w-5 h-5 text-danger" />
                  </div>
                  <span className="text-xl font-bold">Delete Transaction</span>
                </div>
              </ModalHeader>
              <ModalBody>
                <p className="text-default-500">
                  Are you sure you want to delete this transaction for <span className="font-semibold text-foreground">{formatCurrency(paymentToDelete?.amount || 0)}</span>?
                  This will reverse the balances and this action cannot be undone.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose} disabled={isDeleting}>
                  Cancel
                </Button>
                <Button
                  color="danger"
                  onPress={handleDeletePayment}
                  isLoading={isDeleting}
                  className="font-semibold shadow-lg shadow-danger/20"
                >
                  Delete Transaction
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
