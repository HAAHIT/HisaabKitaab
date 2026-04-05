"use client";

import { useState, useEffect, use } from "react";
import Image from "next/image";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Chip,
  Divider,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Skeleton,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { BillActionBar } from "@/components/bills/BillActionBar";
import type { ColumnDef } from "@/lib/formula";
import { shareBill } from "@/lib/share";

interface BillDetail {
  id: string;
  billNumber: string;
  partyId: string | null;
  party: {
    id: string;
    name: string;
    type: "CUSTOMER" | "VENDOR";
    phone: string | null;
    address: string | null;
    gstin: string | null;
  } | null;
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

interface CompanySettings {
  companyName: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  companyGstin: string | null;
  companyLogo: string | null;
  upiId?: string | null;
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

function formatColumnValue(colName: string, value: number): string {
  const lower = colName.toLowerCase();
  const isCurrency =
    lower.includes("rate") ||
    lower.includes("price") ||
    lower.includes("amount") ||
    lower.includes("total") ||
    lower.includes("₹") ||
    lower.includes("rs");

  if (isCurrency) return formatCurrency(value);
  
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(value);
}


export default function BillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const [bill, setBill] = useState<BillDetail | null>(null);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [confirmAction, setConfirmAction] = useState<"FINAL" | "CANCELLED" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    async function loadData() {
      try {
        const [billRes, settingsRes] = await Promise.all([
          fetch(`/api/bills/${id}`),
          fetch("/api/settings"),
        ]);

        if (billRes.ok) {
          const { bill: serverBill } = await billRes.json();
          setBill(serverBill);
        }

        if (settingsRes.ok) {
          const { settings: serverSettings } = await settingsRes.json();
          setSettings(serverSettings);
        }
      } catch {
        // non-critical — loading state handles the empty case
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  async function executeStatusChange(status: "FINAL" | "CANCELLED") {
    if (!bill) return;
    const currentBill = bill;
    setActionLoading(true);
    try {
      const method = status === "CANCELLED" ? "DELETE" : "PATCH";
      const body =
        status === "CANCELLED"
          ? undefined
          : JSON.stringify({
              partyId: currentBill.partyId,
              customerName: currentBill.customerName,
              customerPhone: currentBill.customerPhone,
              customerAddress: currentBill.customerAddress,
              gstin: currentBill.gstin,
              rows: currentBill.rows,
              notes: currentBill.notes,
              terms: currentBill.terms,
              taxPercent: currentBill.taxPercent,
              subtotal: currentBill.subtotal,
              taxAmount: currentBill.taxAmount,
              grandTotal: currentBill.grandTotal,
              status,
            });
      const headers: Record<string, string> = {};
      if (body) headers["Content-Type"] = "application/json";

      const res = await fetch(`/api/bills/${id}`, { method, headers, body });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      showToast(status === "FINAL" ? "Bill finalized!" : "Bill cancelled", "success");
      const updated = await fetch(`/api/bills/${id}`).then((r) => r.json());
      setBill(updated.bill);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Action failed", "error");
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  }

  async function handleShare() {
    if (!bill || bill.status !== "FINAL") {
      return;
    }

    const didShare = await shareBill({
      billNumber: bill.billNumber,
      customerName: bill.customerName,
      grandTotal: bill.grandTotal,
      customerPhone: bill.customerPhone,
      companyName: settings?.companyName || "My Business",
      companyUpiId: settings?.upiId || null,
      billUrl: `${window.location.origin}/api/bills/${bill.id}/public`,
    });

    if (didShare) {
      showToast("Share flow opened", "success");
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
      <style jsx global>{`
        @media print {
          @page { margin: 15mm; size: auto; }
          body { background: white !important; font-size: 12pt; }
          .no-print { display: none !important; }
        }
      `}</style>

      {toast && (
        <div
          className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg animate-slide-up no-print ${
            toast.type === "success"
              ? "bg-success text-white"
              : "bg-danger text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Screen UI: Hidden on Print */}
      <div className="no-print">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              isIconOnly
              variant="light"
              aria-label="Back to bills"
              onPress={() => router.push("/bills")}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold font-mono">{bill.billNumber}</h1>
                <Chip size="sm" variant="flat" color={statusColorMap[bill.status]} className="capitalize">{bill.status.toLowerCase()}</Chip>
              </div>
              <p className="text-default-500 text-sm">
                {new Date(bill.createdAt).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric" })} • by {bill.creator.name}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="flat" size="sm" onPress={() => window.print()}>🖨️ Print</Button>
            {bill.status === "DRAFT" && (
              <>
                <Button variant="bordered" size="sm" onPress={() => router.push(`/bills/${id}/edit`)}>✏️ Edit</Button>
                <Button color="success" size="sm" variant="flat" onPress={() => setConfirmAction("FINAL")}>✅ Finalize</Button>
              </>
            )}
            {bill.status !== "CANCELLED" && (
              <Button color="danger" size="sm" variant="flat" onPress={() => setConfirmAction("CANCELLED")}>Cancel</Button>
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
              <div><span className="text-default-400">Name</span><p className="font-medium">{bill.customerName}</p></div>
              {bill.customerPhone && (<div><span className="text-default-400">Phone</span><p className="font-medium">{bill.customerPhone}</p></div>)}
              {bill.customerAddress && (<div><span className="text-default-400">Address</span><p className="font-medium">{bill.customerAddress}</p></div>)}
              {bill.gstin && (<div><span className="text-default-400">GSTIN</span><p className="font-medium font-mono">{bill.gstin}</p></div>)}
            </div>
            {bill.party && (
              <div className="mt-4 border-t border-divider pt-4">
                <span className="text-default-400 text-sm">Linked Party Record</span>
                <div className="mt-2 flex items-center justify-between rounded-xl border border-divider bg-default-50 px-4 py-3">
                  <div>
                    <p className="font-medium">{bill.party.name}</p>
                    <p className="text-xs capitalize text-default-400">{bill.party.type.toLowerCase()}</p>
                  </div>
                  <Button size="sm" variant="flat" color="secondary" onPress={() => router.push(`/parties/${bill.party?.id}`)}>
                    View Party
                  </Button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Items Table */}
        <Card shadow="sm" className="mb-6">
          <CardHeader className="px-6 pt-6 pb-0">
            <h2 className="font-semibold">
              Line Items
              {bill.template.name !== "__QUICK_BILL__" && (
                <span className="ml-2 text-sm font-normal text-default-400">
                  ({bill.template.name})
                </span>
              )}
            </h2>
          </CardHeader>
          <CardBody className="p-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-divider">
                  <th className="text-left py-3 px-2 text-default-500 font-semibold w-10">#</th>
                  {columns.map((col) => (
                    <th key={col.name} className={`py-3 px-2 text-default-500 font-semibold ${col.type === "number" || col.type === "formula" ? "text-right" : "text-left"}`}>{col.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(bill.rows as Record<string, string | number>[]).map((row, i) => (
                  <tr key={i} className="border-b border-divider/30">
                    <td className="py-3 px-2 text-default-400">{i + 1}</td>
                    {columns.map((col) => (
                      <td key={col.name} className={`py-3 px-2 ${col.type === "number" || col.type === "formula" ? "text-right font-mono" : ""} ${col.type === "formula" ? "text-success font-medium" : ""}`}>
                        {col.type === "number" || col.type === "formula" ? typeof row[col.id] === "number" ? formatColumnValue(col.name, row[col.id] as number) : row[col.id] || "—" : row[col.id] || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>

        {/* Totals & Notes */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <div className="space-y-4">
            {bill.notes && (<Card shadow="sm"><CardBody className="p-5"><h3 className="font-semibold text-sm mb-2">Notes</h3><p className="text-sm text-default-600 whitespace-pre-line">{bill.notes}</p></CardBody></Card>)}
            {bill.terms && (<Card shadow="sm"><CardBody className="p-5"><h3 className="font-semibold text-sm mb-2">Terms & Conditions</h3><p className="text-sm text-default-600 whitespace-pre-line">{bill.terms}</p></CardBody></Card>)}
          </div>
          <Card shadow="sm" className="bg-gradient-to-br from-blue-500/5 to-indigo-500/5">
            <CardBody className="p-6">
              <h3 className="text-lg font-semibold mb-4">Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-default-500">Subtotal</span><span className="font-medium">{formatCurrency(bill.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-default-500">Tax ({bill.taxPercent}%)</span><span className="font-medium">{formatCurrency(bill.taxAmount)}</span></div>
                <Divider />
                <div className="flex justify-between"><span className="text-xl font-bold">Grand Total</span><span className="text-xl font-bold text-primary">{formatCurrency(bill.grandTotal)}</span></div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <BillActionBar bill={{
        id: bill.id,
        billNumber: bill.billNumber,
        customerName: bill.customerName,
        grandTotal: bill.grandTotal,
        status: bill.status,
        customerPhone: bill.customerPhone,
        partyId: bill.partyId,
      }} onShare={handleShare} />

      {/* Confirm action modal */}
      <Modal
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        size="sm"
      >
        <ModalContent>
          <ModalHeader>
            {confirmAction === "FINAL" ? "Finalize Bill" : "Cancel Bill"}
          </ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-600">
              {confirmAction === "FINAL"
                ? "This will lock the bill and record it in your books. It cannot be edited after finalization."
                : "This will permanently cancel the bill and reverse any balance changes."}
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setConfirmAction(null)}>
              Go back
            </Button>
            <Button
              color={confirmAction === "FINAL" ? "success" : "danger"}
              isLoading={actionLoading}
              onPress={() => confirmAction && executeStatusChange(confirmAction)}
            >
              {confirmAction === "FINAL" ? "Yes, Finalize" : "Yes, Cancel Bill"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Print-Only Professional Layout */}
      <div className="hidden print:block p-0 text-black">
        {/* Invoice Header */}
        <div className="flex justify-between items-start border-b-2 border-black pb-8 mb-8">
          <div className="flex gap-6 items-center">
            {settings?.companyLogo && (
              <Image
                src={settings.companyLogo}
                alt="Logo"
                width={96}
                height={96}
                unoptimized
                className="h-24 w-24 object-contain"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold tracking-tight uppercase">{settings?.companyName || "INVOICE"}</h1>
              <div className="text-sm mt-2 whitespace-pre-line leading-relaxed opacity-80">
                {settings?.companyAddress}
                {settings?.companyPhone && `\nPhone: ${settings.companyPhone}`}
                {settings?.companyEmail && `\nEmail: ${settings.companyEmail}`}
                {settings?.companyGstin && `\nGSTIN: ${settings.companyGstin}`}
              </div>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-4xl font-black text-gray-200 uppercase mb-2">Invoice</h2>
            <div className="space-y-1">
              <p className="text-lg font-bold font-mono">{bill.billNumber}</p>
              <p className="text-sm text-gray-600">
                Date: {new Date(bill.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })}
              </p>
            </div>
          </div>
        </div>

        {/* Client Section */}
        <div className="grid grid-cols-2 gap-12 mb-10">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Bill To</h3>
            <div className="space-y-1">
              <p className="text-xl font-bold">{bill.customerName}</p>
              <div className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                {bill.customerAddress}
                {bill.customerPhone && `\nPhone: ${bill.customerPhone}`}
                {bill.gstin && `\nGSTIN: ${bill.gstin}`}
              </div>
            </div>
          </div>
          <div className="text-right">
            {/* Optional extra info like Due Date could go here */}
          </div>
        </div>

        {/* Line Items Table */}
        <table className="w-full mb-10 border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-700">
              <th className="py-3 px-4 text-left font-bold text-xs uppercase border border-gray-200">#</th>
              {columns.map(col => (
                <th key={col.id} className={`py-3 px-4 font-bold text-xs uppercase border border-gray-200 ${col.type === "number" || col.type === "formula" ? "text-right" : "text-left"}`}>
                  {col.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bill.rows.map((row, i) => (
              <tr key={i}>
                <td className="py-3 px-4 border border-gray-100 text-sm text-gray-500">{i + 1}</td>
                {columns.map(col => (
                  <td key={col.id} className={`py-3 px-4 border border-gray-100 text-sm ${col.type === "number" || col.type === "formula" ? "text-right font-mono" : ""}`}>
                    {col.type === "number" || col.type === "formula" 
                      ? typeof row[col.id] === "number" ? formatColumnValue(col.name, row[col.id] as number) : row[col.id] || "—"
                      : row[col.id] || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals & Notes */}
        <div className="grid grid-cols-2 gap-12 pt-4">
          <div className="space-y-6">
            {bill.notes && (
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 font-mono">Invoice Notes</h4>
                <p className="text-sm text-gray-600 italic whitespace-pre-line">{bill.notes}</p>
              </div>
            )}
            {bill.terms && (
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Terms & Conditions</h4>
                <p className="text-[10px] text-gray-500 leading-relaxed whitespace-pre-line">{bill.terms}</p>
              </div>
            )}
          </div>
          <div>
            <div className="space-y-3">
              <div className="flex justify-between items-center px-4 py-2 border-b border-gray-100 italic">
                <span className="text-sm text-gray-600">Subtotal</span>
                <span className="text-sm font-medium">{formatCurrency(bill.subtotal)}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Tax ({bill.taxPercent}%)</span>
                <span className="text-sm font-medium">{formatCurrency(bill.taxAmount)}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-4 bg-gray-900 text-white rounded-lg shadow-xl translate-x-1 shadow-gray-200">
                <span className="text-lg font-bold tracking-tight px-2">Grand Total</span>
                <span className="text-2xl font-black px-2">{formatCurrency(bill.grandTotal)}</span>
              </div>
            </div>
            
            <div className="mt-12 text-center border-t border-gray-100 pt-8">
              <div className="w-32 h-12 border-b border-gray-300 mx-auto mb-2 opacity-30"></div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Authorized Signature</p>
            </div>
          </div>
        </div>

        {/* Print Footer */}
        <div className="fixed bottom-0 left-0 right-0 border-t border-gray-100 pt-4 flex justify-between items-center text-[8px] text-gray-400 uppercase tracking-widest font-mono">
          <div>Generated by HisaabKitaab CMS</div>
          <div>Page 1 of 1</div>
        </div>
      </div>
    </div>
  );
}
