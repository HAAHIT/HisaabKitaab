"use client";

import { useState, useEffect, use } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Chip,
  Divider,
  Skeleton,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@/lib/formula";

interface BillDetail {
  id: string;
  billNumber: string;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  gstin: string | null;
  rows: Record<string, string | number>[];
  notes: string | null;
  terms: string | null;
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  grandTotal: number;
  status: string;
  createdAt: string;
  template: {
    name: string;
    columns: ColumnDef[];
  };
  creator: { name: string };
}

const statusColorMap: Record<
  string,
  "default" | "primary" | "success" | "danger"
> = {
  DRAFT: "default",
  FINAL: "success",
  CANCELLED: "danger",
};

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

export default function BillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const [bill, setBill] = useState<BillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    fetch(`/api/bills/${id}`)
      .then((res) => res.json())
      .then((data) => setBill(data.bill))
      .catch(() => showToast("Failed to load bill", "error"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleStatusChange(status: "FINAL" | "CANCELLED") {
    const msg =
      status === "FINAL"
        ? "Finalize this bill? It cannot be edited after."
        : "Cancel this bill?";
    if (!confirm(msg)) return;

    try {
      const method = status === "CANCELLED" ? "DELETE" : "PATCH";
      const body = status === "CANCELLED" ? undefined : JSON.stringify({ status });
      const headers: Record<string, string> = {};
      if (body) headers["Content-Type"] = "application/json";

      const res = await fetch(`/api/bills/${id}`, { method, headers, body });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      showToast(
        status === "FINAL" ? "Bill finalized!" : "Bill cancelled",
        "success"
      );
      // Refresh
      const updated = await fetch(`/api/bills/${id}`).then((r) => r.json());
      setBill(updated.bill);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Action failed",
        "error"
      );
    }
  }

  if (loading) {
    return (
      <div className="p-4 lg:p-8 space-y-4">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-60 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="p-4 lg:p-8">
        <Card>
          <CardBody className="text-center py-16">
            <p className="text-lg font-medium">Bill not found</p>
            <Button
              className="mt-3"
              variant="flat"
              onPress={() => router.push("/bills")}
            >
              Back to Bills
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  const columns = bill.template.columns as ColumnDef[];

  return (
    <div className="p-4 lg:p-8 animate-fade-in max-w-5xl mx-auto">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg animate-slide-up ${
            toast.type === "success"
              ? "bg-success text-white"
              : "bg-danger text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button
            isIconOnly
            variant="light"
            onPress={() => router.push("/bills")}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold font-mono">
                {bill.billNumber}
              </h1>
              <Chip
                size="sm"
                variant="flat"
                color={statusColorMap[bill.status]}
                className="capitalize"
              >
                {bill.status.toLowerCase()}
              </Chip>
            </div>
            <p className="text-default-500 text-sm">
              {new Date(bill.createdAt).toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
              • by {bill.creator.name}
            </p>
          </div>
        </div>

        <div className="flex gap-2 print:hidden">
          <Button
            variant="flat"
            size="sm"
            onPress={() => window.print()}
          >
            🖨️ Print
          </Button>
          {bill.status === "DRAFT" && (
            <>
              <Button
                variant="bordered"
                size="sm"
                onPress={() => router.push(`/bills/${id}/edit`)}
              >
                ✏️ Edit
              </Button>
              <Button
                color="success"
                size="sm"
                variant="flat"
                onPress={() => handleStatusChange("FINAL")}
              >
                ✅ Finalize
              </Button>
            </>
          )}
          {bill.status !== "CANCELLED" && (
            <Button
              color="danger"
              size="sm"
              variant="flat"
              onPress={() => handleStatusChange("CANCELLED")}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Customer Details */}
      <Card shadow="sm" className="mb-6">
        <CardHeader className="px-6 pt-6 pb-0">
          <h2 className="font-semibold">Customer</h2>
        </CardHeader>
        <CardBody className="p-6">
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-default-400">Name</span>
              <p className="font-medium">{bill.customerName}</p>
            </div>
            {bill.customerPhone && (
              <div>
                <span className="text-default-400">Phone</span>
                <p className="font-medium">{bill.customerPhone}</p>
              </div>
            )}
            {bill.customerAddress && (
              <div>
                <span className="text-default-400">Address</span>
                <p className="font-medium">{bill.customerAddress}</p>
              </div>
            )}
            {bill.gstin && (
              <div>
                <span className="text-default-400">GSTIN</span>
                <p className="font-medium font-mono">{bill.gstin}</p>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Items Table */}
      <Card shadow="sm" className="mb-6">
        <CardHeader className="px-6 pt-6 pb-0">
          <h2 className="font-semibold">
            Line Items ({bill.template.name})
          </h2>
        </CardHeader>
        <CardBody className="p-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-divider">
                <th className="text-left py-3 px-2 text-default-500 font-semibold w-10">
                  #
                </th>
                {columns.map((col) => (
                  <th
                    key={col.name}
                    className={`py-3 px-2 text-default-500 font-semibold ${
                      col.type === "number" || col.type === "formula"
                        ? "text-right"
                        : "text-left"
                    }`}
                  >
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(bill.rows as Record<string, string | number>[]).map(
                (row, i) => (
                  <tr
                    key={i}
                    className="border-b border-divider/30"
                  >
                    <td className="py-3 px-2 text-default-400">{i + 1}</td>
                    {columns.map((col) => (
                      <td
                        key={col.name}
                        className={`py-3 px-2 ${
                          col.type === "number" || col.type === "formula"
                            ? "text-right font-mono"
                            : ""
                        } ${col.type === "formula" ? "text-success font-medium" : ""}`}
                      >
                        {col.type === "number" || col.type === "formula"
                          ? typeof row[col.name] === "number"
                            ? formatCurrency(row[col.name] as number)
                            : row[col.name]
                          : row[col.name] || "—"}
                      </td>
                    ))}
                  </tr>
                )
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {/* Totals */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Notes & Terms */}
        <div className="space-y-4">
          {bill.notes && (
            <Card shadow="sm">
              <CardBody className="p-5">
                <h3 className="font-semibold text-sm mb-2">Notes</h3>
                <p className="text-sm text-default-600 whitespace-pre-line">
                  {bill.notes}
                </p>
              </CardBody>
            </Card>
          )}
          {bill.terms && (
            <Card shadow="sm">
              <CardBody className="p-5">
                <h3 className="font-semibold text-sm mb-2">
                  Terms & Conditions
                </h3>
                <p className="text-sm text-default-600 whitespace-pre-line">
                  {bill.terms}
                </p>
              </CardBody>
            </Card>
          )}
        </div>

        {/* Summary */}
        <Card
          shadow="sm"
          className="bg-gradient-to-br from-blue-500/5 to-indigo-500/5"
        >
          <CardBody className="p-6">
            <h3 className="text-lg font-semibold mb-4">Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-default-500">Subtotal</span>
                <span className="font-medium">
                  {formatCurrency(bill.subtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-default-500">
                  Tax ({bill.taxPercent}%)
                </span>
                <span className="font-medium">
                  {formatCurrency(bill.taxAmount)}
                </span>
              </div>
              <Divider />
              <div className="flex justify-between">
                <span className="text-xl font-bold">Grand Total</span>
                <span className="text-xl font-bold text-primary">
                  {formatCurrency(bill.grandTotal)}
                </span>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
