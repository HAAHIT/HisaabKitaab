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
import { numberToIndianWords } from "@/lib/number-to-words";

interface BillDetail {
  id: string;
  billNumber: string;
  partyId: string | null;
  isInterState?: boolean;
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
  placeOfSupply: string | null;
  hsnCode: string | null;
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
            isInterState: currentBill.isInterState === true,
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
              Back to List
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
          className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg animate-slide-up no-print ${toast.type === "success"
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
              aria-label="Back to list"
              onPress={() => router.push(bill.party?.type === "VENDOR" ? "/purchases" : "/bills")}
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
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div><span className="text-default-400">Name</span><p className="font-medium">{bill.customerName}</p></div>
              {bill.customerPhone && (<div><span className="text-default-400">Phone</span><p className="font-medium">{bill.customerPhone}</p></div>)}
              {bill.customerAddress && (<div><span className="text-default-400">Address</span><p className="font-medium">{bill.customerAddress}</p></div>)}
              {bill.gstin && (<div><span className="text-default-400">GSTIN</span><p className="font-medium font-mono">{bill.gstin}</p></div>)}
              {bill.placeOfSupply && (<div><span className="text-default-400">Place of Supply</span><p className="font-medium">{bill.placeOfSupply} {bill.isInterState ? <span className="text-xs text-default-400 ml-1">(Inter-State)</span> : ""}</p></div>)}
              {bill.hsnCode && (<div><span className="text-default-400">HSN/SAC</span><p className="font-medium font-mono">{bill.hsnCode}</p></div>)}
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

      {/* Print-Only Professional Tax Invoice Layout */}
      <div className="hidden print:block p-0 text-black" style={{ fontSize: '11pt', lineHeight: '1.5' }}>
        {/* Tax Invoice Title Band */}
        <div style={{ borderBottom: '3px solid #000', paddingBottom: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {/* Left: Company Info */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              {settings?.companyLogo && (
                <Image
                  src={settings.companyLogo}
                  alt="Logo"
                  width={72}
                  height={72}
                  unoptimized
                  style={{ width: '72px', height: '72px', objectFit: 'contain' }}
                />
              )}
              <div>
                <h1 style={{ fontSize: '20pt', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>
                  {settings?.companyName || "My Business"}
                </h1>
                <div style={{ fontSize: '9pt', color: '#444', marginTop: '4px', lineHeight: '1.6' }}>
                  {settings?.companyAddress && <div>{settings.companyAddress}</div>}
                  {settings?.companyPhone && <div>Phone: {settings.companyPhone}</div>}
                  {settings?.companyEmail && <div>Email: {settings.companyEmail}</div>}
                  {settings?.companyGstin && (
                    <div style={{ fontWeight: 700, marginTop: '2px' }}>GSTIN: {settings.companyGstin}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Invoice Meta */}
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: '14pt',
                fontWeight: 800,
                border: '2px solid #000',
                padding: '4px 16px',
                display: 'inline-block',
                marginBottom: '8px',
                letterSpacing: '2px',
              }}>
                {bill.party?.type === "VENDOR" ? "PURCHASE BILL" : "TAX INVOICE"}
              </div>
              <div style={{ fontSize: '9pt', lineHeight: '1.8' }}>
                <div><strong>Invoice No:</strong> <span style={{ fontFamily: 'monospace' }}>{bill.billNumber}</span></div>
                <div><strong>Date:</strong> {new Date(bill.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
                <div><strong>Status:</strong> <span style={{ textTransform: 'uppercase' }}>{bill.status}</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Bill To / Ship To */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
          marginBottom: '16px',
          fontSize: '9pt',
        }}>
          <div style={{ border: '1px solid #ccc', padding: '12px', borderRadius: '4px' }}>
            <div style={{ fontSize: '8pt', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '6px' }}>
              {bill.party?.type === "VENDOR" ? "Supplier Details" : "Bill To"}
            </div>
            <div style={{ fontSize: '12pt', fontWeight: 700, marginBottom: '4px' }}>{bill.customerName}</div>
            {bill.customerAddress && <div style={{ color: '#444' }}>{bill.customerAddress}</div>}
            {bill.customerPhone && <div style={{ color: '#444' }}>Phone: {bill.customerPhone}</div>}
            {bill.gstin && <div style={{ fontWeight: 600, marginTop: '4px' }}>GSTIN: <span style={{ fontFamily: 'monospace' }}>{bill.gstin}</span></div>}
          </div>
          <div style={{ border: '1px solid #ccc', padding: '12px', borderRadius: '4px' }}>
            <div style={{ fontSize: '8pt', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '6px' }}>
              Supply Details
            </div>
            {bill.placeOfSupply && (
              <div>
                <strong>Place of Supply:</strong> {bill.placeOfSupply}
                {bill.isInterState && <span style={{ color: '#c00', fontWeight: 600, marginLeft: '8px' }}>(Inter-State)</span>}
              </div>
            )}
            {bill.hsnCode && <div><strong>HSN/SAC Code:</strong> <span style={{ fontFamily: 'monospace' }}>{bill.hsnCode}</span></div>}
            <div><strong>Supply Type:</strong> {bill.isInterState ? "Inter-State (IGST)" : "Intra-State (CGST + SGST)"}</div>
          </div>
        </div>

        {/* Line Items Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '9pt' }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={{ border: '1px solid #999', padding: '8px 6px', textAlign: 'center', fontWeight: 700, width: '36px' }}>#</th>
              {columns.map(col => (
                <th key={col.id} style={{
                  border: '1px solid #999',
                  padding: '8px 6px',
                  fontWeight: 700,
                  textAlign: col.type === "number" || col.type === "formula" ? 'right' : 'left',
                }}>
                  {col.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bill.rows.map((row, i) => (
              <tr key={i}>
                <td style={{ border: '1px solid #ccc', padding: '7px 6px', textAlign: 'center', color: '#666' }}>{i + 1}</td>
                {columns.map(col => (
                  <td key={col.id} style={{
                    border: '1px solid #ccc',
                    padding: '7px 6px',
                    textAlign: col.type === "number" || col.type === "formula" ? 'right' : 'left',
                    fontFamily: col.type === "number" || col.type === "formula" ? 'monospace' : 'inherit',
                  }}>
                    {col.type === "number" || col.type === "formula"
                      ? typeof row[col.id] === "number" ? formatColumnValue(col.name, row[col.id] as number) : row[col.id] || "—"
                      : row[col.id] || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals + Notes Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Left: Notes & Terms */}
          <div style={{ fontSize: '8pt' }}>
            {bill.notes && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#888', marginBottom: '4px', fontSize: '7pt' }}>Notes</div>
                <div style={{ color: '#444', whiteSpace: 'pre-line', fontStyle: 'italic' }}>{bill.notes}</div>
              </div>
            )}
            {bill.terms && (
              <div>
                <div style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#888', marginBottom: '4px', fontSize: '7pt' }}>Terms & Conditions</div>
                <div style={{ color: '#555', whiteSpace: 'pre-line' }}>{bill.terms}</div>
              </div>
            )}

            {/* Amount in Words */}
            <div style={{ marginTop: '16px', borderTop: '1px solid #ddd', paddingTop: '8px' }}>
              <div style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#888', marginBottom: '4px', fontSize: '7pt' }}>Amount in Words</div>
              <div style={{ fontWeight: 600, fontStyle: 'italic', fontSize: '9pt' }}>
                {numberToIndianWords(bill.grandTotal)}
              </div>
            </div>
          </div>

          {/* Right: Financial Summary */}
          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee' }}>Subtotal</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', borderBottom: '1px solid #eee' }}>{formatCurrency(bill.subtotal)}</td>
                </tr>
                {bill.taxAmount > 0 && !bill.isInterState && (
                  <>
                    <tr>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee', color: '#444' }}>
                        CGST ({(bill.subtotal > 0 ? (bill.taxAmount / bill.subtotal * 100) / 2 : 0).toFixed(1)}%)
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', borderBottom: '1px solid #eee' }}>
                        {formatCurrency(Math.round((bill.taxAmount / 2) * 100) / 100)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee', color: '#444' }}>
                        SGST ({(bill.subtotal > 0 ? (bill.taxAmount / bill.subtotal * 100) / 2 : 0).toFixed(1)}%)
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', borderBottom: '1px solid #eee' }}>
                        {formatCurrency(Math.round((bill.taxAmount / 2) * 100) / 100)}
                      </td>
                    </tr>
                  </>
                )}
                {bill.taxAmount > 0 && bill.isInterState && (
                  <tr>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee', color: '#444' }}>
                      IGST ({(bill.subtotal > 0 ? (bill.taxAmount / bill.subtotal * 100) : 0).toFixed(1)}%)
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', borderBottom: '1px solid #eee' }}>
                      {formatCurrency(bill.taxAmount)}
                    </td>
                  </tr>
                )}
                {bill.taxAmount === 0 && (
                  <tr>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee', color: '#444' }}>
                      Tax
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', borderBottom: '1px solid #eee' }}>
                      {formatCurrency(0)}
                    </td>
                  </tr>
                )}
                <tr style={{ fontWeight: 800 }}>
                  <td style={{ padding: '10px 8px', borderTop: '2px solid #000', fontSize: '12pt' }}>Grand Total</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace', borderTop: '2px solid #000', fontSize: '12pt' }}>
                    {formatCurrency(bill.grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Authorized Signature */}
            <div style={{ marginTop: '40px', textAlign: 'right', paddingRight: '8px' }}>
              <div style={{ borderBottom: '1px solid #999', width: '180px', marginLeft: 'auto', marginBottom: '6px', height: '40px' }}></div>
              <div style={{ fontSize: '8pt', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Authorized Signatory
              </div>
              <div style={{ fontSize: '7pt', color: '#999', marginTop: '2px' }}>
                {settings?.companyName || ""}
              </div>
            </div>
          </div>
        </div>

        {/* Print Footer */}
        <div style={{
          marginTop: '32px',
          borderTop: '1px solid #ccc',
          paddingTop: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '7pt',
          color: '#aaa',
        }}>
          <div>Generated by HisaabKitaab • This is a computer-generated document</div>
          <div>Page 1 of 1</div>
        </div>
      </div>
    </div>
  );
}
