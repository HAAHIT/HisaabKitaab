"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardBody,
  Button,
  Input,
  Chip,
  Select,
  SelectItem,
  Skeleton,
  Pagination,
} from "@heroui/react";
import { useRouter } from "next/navigation";

interface Bill {
  id: string;
  billNumber: string;
  customerName: string;
  grandTotal: number;
  status: string;
  createdAt: string;
}

const STATUS_OPTIONS = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "FINAL", label: "Final" },
  { key: "CANCELLED", label: "Cancelled" },
];

const statusColorMap: Record<string, "default" | "primary" | "success" | "danger"> = {
  DRAFT: "default",
  FINAL: "success",
  CANCELLED: "danger",
};

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function BillsListPage() {
  const router = useRouter();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      params.set("page", String(page));

      const res = await fetch(`/api/bills?${params}`);
      const data = await res.json();
      setBills(data.bills || []);
      setTotalPages(data.totalPages || 1);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  return (
    <div className="p-4 lg:p-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Bills</h1>
          <p className="text-default-500 text-sm mt-1">
            Create and manage invoices
          </p>
        </div>
        <Button
          color="primary"
          className="font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/25"
          onPress={() => router.push("/bills/new")}
          startContent={
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          }
        >
          Create Bill
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Input
          placeholder="Search by bill # or customer..."
          value={search}
          onValueChange={setSearch}
          variant="bordered"
          className="flex-1"
          startContent={
            <svg
              className="w-4 h-4 text-default-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          }
        />
        <Select
          selectedKeys={[statusFilter]}
          onSelectionChange={(keys) => {
            const val = Array.from(keys)[0] as string;
            if (val) {
              setStatusFilter(val);
              setPage(1);
            }
          }}
          variant="bordered"
          className="w-40"
        >
          {STATUS_OPTIONS.map((s) => (
            <SelectItem key={s.key}>{s.label}</SelectItem>
          ))}
        </Select>
      </div>

      {/* Bills List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : bills.length === 0 ? (
        <Card shadow="sm">
          <CardBody className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <svg
                className="w-10 h-10 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-lg font-medium text-default-600">
              {search || statusFilter !== "ALL"
                ? "No matching bills found"
                : "No bills yet"}
            </p>
            <p className="text-sm text-default-400 mt-1">
              {search || statusFilter !== "ALL"
                ? "Try changing your filters"
                : "Create your first bill to get started!"}
            </p>
            {!search && statusFilter === "ALL" && (
              <Button
                color="primary"
                variant="flat"
                size="sm"
                className="mt-4"
                onPress={() => router.push("/bills/new")}
              >
                Create Bill
              </Button>
            )}
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {bills.map((bill) => (
              <Card
                key={bill.id}
                isPressable
                shadow="sm"
                className="hover:shadow-md transition"
                onPress={() => router.push(`/bills/${bill.id}`)}
              >
                <CardBody className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-sm">
                          {bill.billNumber}
                        </span>
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
                      <p className="text-xs text-default-400">
                        {new Date(bill.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">
                        {formatCurrency(bill.grandTotal)}
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <Pagination
                total={totalPages}
                page={page}
                onChange={setPage}
                showControls
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
