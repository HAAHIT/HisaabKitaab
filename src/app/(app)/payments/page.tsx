"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardBody,
  Button,
  Input,
  Select,
  SelectItem,
  Chip,
  Skeleton,
  Pagination,
} from "@heroui/react";
import { useRouter } from "next/navigation";

interface Payment {
  id: string;
  amount: number;
  direction: string;
  mode: string;
  status: string;
  date: string;
  notes: string | null;
  party: { name: string; type: string };
}

const TYPE_OPTS = [
  { key: "ALL", label: "All Types" },
  { key: "INCOMING", label: "Received" },
  { key: "OUTGOING", label: "Paid" },
];

const STATUS_OPTS = [
  { key: "ALL", label: "All Status" },
  { key: "COMPLETED", label: "✅ Completed" },
  { key: "EXPECTED", label: "🕐 Expected" },
];

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default function PaymentsListPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      params.set("page", String(page));
      const res = await fetch(`/api/payments?${params}`);
      const data = await res.json();
      setPayments(data.payments || []);
      setTotalPages(data.totalPages || 1);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [search, typeFilter, statusFilter, page]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  async function markAsCompleted(paymentId: string) {
    setMarkingId(paymentId);
    try {
      const res = await fetch("/api/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to mark as completed");
        return;
      }
      // Refresh the list
      fetchPayments();
    } catch {
      alert("Failed to mark as completed");
    } finally {
      setMarkingId(null);
    }
  }

  return (
    <div className="p-4 lg:p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Payments</h1>
          <p className="text-default-500 text-sm mt-1">Track incoming and outgoing payments</p>
        </div>
        <Button color="primary" className="font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/25"
          onPress={() => router.push("/payments/new")}
          startContent={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}>
          Record Payment
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Input placeholder="Search by party name..." value={search} onValueChange={setSearch} variant="bordered" className="flex-1"
          startContent={<svg className="w-4 h-4 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>} />
        <Select selectedKeys={[typeFilter]} onSelectionChange={(keys) => { const v = Array.from(keys)[0] as string; if (v) { setTypeFilter(v); setPage(1); } }} variant="bordered" className="w-40">
          {TYPE_OPTS.map((o) => <SelectItem key={o.key}>{o.label}</SelectItem>)}
        </Select>
        <Select selectedKeys={[statusFilter]} onSelectionChange={(keys) => { const v = Array.from(keys)[0] as string; if (v) { setStatusFilter(v); setPage(1); } }} variant="bordered" className="w-44">
          {STATUS_OPTS.map((o) => <SelectItem key={o.key}>{o.label}</SelectItem>)}
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : payments.length === 0 ? (
        <Card shadow="sm"><CardBody className="flex flex-col items-center justify-center py-16">
          <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="text-lg font-medium text-default-600">{search || typeFilter !== "ALL" || statusFilter !== "ALL" ? "No matching payments" : "No payments recorded"}</p>
          <Button color="primary" variant="flat" size="sm" className="mt-3" onPress={() => router.push("/payments/new")}>Record Payment</Button>
        </CardBody></Card>
      ) : (
        <>
          <div className="space-y-3">
            {payments.map((p) => (
              <Card key={p.id} shadow="sm" className={`hover:shadow-md transition ${p.status === "EXPECTED" ? "border-l-4 border-l-warning" : ""}`}>
                <CardBody className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{p.party.name}</span>
                        <Chip size="sm" variant="flat" color={
                          p.status === "EXPECTED"
                            ? "warning"
                            : p.direction === "INCOMING" ? "success" : "warning"
                        }>
                          {p.status === "EXPECTED"
                            ? (p.direction === "INCOMING" ? "🕐 To Receive" : "🕐 To Pay")
                            : (p.direction === "INCOMING" ? "✅ Received" : "✅ Paid")}
                        </Chip>
                        <Chip size="sm" variant="flat" color="default" className="capitalize">
                          {p.mode.toLowerCase().replace("_", " ")}
                        </Chip>
                      </div>
                      <div className="flex gap-3 text-xs text-default-400">
                        <span>{new Date(p.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                        {p.notes && <span className="truncate max-w-[200px]">📝 {p.notes}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className={`text-lg font-bold ${p.direction === "INCOMING" ? "text-success" : "text-warning"}`}>
                        {p.direction === "INCOMING" ? "+" : "-"}{formatCurrency(p.amount)}
                      </p>
                      {p.status === "EXPECTED" && (
                        <Button
                          size="sm"
                          color="success"
                          variant="flat"
                          isLoading={markingId === p.id}
                          onPress={() => markAsCompleted(p.id)}
                        >
                          Mark Completed
                        </Button>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <Pagination total={totalPages} page={page} onChange={setPage} showControls />
            </div>
          )}
        </>
      )}
    </div>
  );
}
