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
import { Printer, Pencil, CheckCircle, XCircle } from "lucide-react";
import { BillActionBar } from "@/components/bills/BillActionBar";
import { BillHeader } from "@/components/bills/BillHeader";
import { BillSummary, type TaxSlab } from "@/components/bills/BillSummary";
import { BillFooter } from "@/components/bills/BillFooter";
import type { ColumnDef } from "@/lib/formula";
import { shareBill } from "@/lib/share";
import { numberToIndianWords } from "@/lib/number-to-words";
import { aggregateTaxByRate } from "@/lib/tax-summary";

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
  roundOff: number;
  placeOfSupply: string | null;
  hsnCode: string | null;
  shippingAddress: string | null;
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
            roundOff: currentBill.roundOff || 0,
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
        <BillHeader
          documentNumber={bill.billNumber}
          documentLabel={bill.party?.type === "VENDOR" ? "Purchase Bill" : "Tax Invoice"}
          date={new Date(bill.createdAt).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
          status={bill.status}
          theme="primary"
          createdBy={bill.creator.name}
          backPath={bill.party?.type === "VENDOR" ? "/purchases" : "/bills"}
          actions={
            <>
              <Button variant="flat" size="sm" startContent={<Printer className="h-3.5 w-3.5" />} onPress={() => window.print()}>Print</Button>
              {bill.status === "DRAFT" && (
                <>
                  <Button variant="bordered" size="sm" startContent={<Pencil className="h-3.5 w-3.5" />} onPress={() => router.push(`/bills/${id}/edit`)}>Edit</Button>
                  <Button color="success" size="sm" variant="flat" startContent={<CheckCircle className="h-3.5 w-3.5" />} onPress={() => setConfirmAction("FINAL")}>Finalize</Button>
                </>
              )}
              {bill.status !== "CANCELLED" && (
                <Button color="danger" size="sm" variant="flat" startContent={<XCircle className="h-3.5 w-3.5" />} onPress={() => setConfirmAction("CANCELLED")}>Cancel</Button>
              )}
            </>
          }
        />

        {/* Customer / Invoice Details */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Party Card */}
          <Card shadow="sm" className="border-l-4 border-primary">
            <CardHeader className="px-6 pt-5 pb-0">
              <h2 className="font-semibold text-sm text-default-500 uppercase tracking-wider">
                {bill.party?.type === "VENDOR" ? "Vendor" : "Customer"}
              </h2>
            </CardHeader>
            <CardBody className="p-6 pt-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">
                    {(bill.customerName || "?")[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-lg">{bill.customerName}</p>
                  {bill.customerPhone && (
                    <p className="text-sm text-default-500">{bill.customerPhone}</p>
                  )}
                </div>
              </div>
              {bill.customerAddress && (
                <p className="text-sm text-default-500 mt-3">{bill.customerAddress}</p>
              )}
              {bill.party && (
                <Button
                  size="sm"
                  variant="light"
                  color="primary"
                  className="mt-2 -ml-2"
                  onPress={() => router.push(`/parties/${bill.party?.id}`)}
                >
                  View Party →
                </Button>
              )}
            </CardBody>
          </Card>

          {/* Invoice Details Card */}
          <Card shadow="sm" className="border-l-4 border-primary">
            <CardHeader className="px-6 pt-5 pb-0">
              <h2 className="font-semibold text-sm text-default-500 uppercase tracking-wider">
                Invoice Details
              </h2>
            </CardHeader>
            <CardBody className="p-6 pt-3 space-y-3">
              {bill.gstin && (
                <div>
                  <p className="text-xs text-default-400">GSTIN</p>
                  <p className="font-mono font-semibold text-base">{bill.gstin}</p>
                </div>
              )}
              {bill.placeOfSupply && (
                <div>
                  <p className="text-xs text-default-400">Place of Supply</p>
                  <div className="font-medium">
                    {bill.placeOfSupply}
                    {bill.isInterState && (
                      <Chip size="sm" variant="flat" color="warning" className="ml-2">Inter-State</Chip>
                    )}
                  </div>
                </div>
              )}
              {bill.hsnCode && (
                <div>
                  <p className="text-xs text-default-400">HSN/SAC</p>
                  <p className="font-mono font-semibold">{bill.hsnCode}</p>
                </div>
              )}
              {!bill.gstin && !bill.placeOfSupply && !bill.hsnCode && (
                <div>
                  <p className="text-xs text-default-400">Narration</p>
                  <p className="text-sm text-default-600">Tax Invoice #{bill.billNumber}</p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Items Table */}
        <Card shadow="sm" className="mb-6">
          <CardHeader className="px-6 pt-5 pb-0">
            <h2 className="font-semibold text-sm text-default-500 uppercase tracking-wider">
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
                  <th className="text-left py-3 px-2 text-default-500 font-semibold uppercase tracking-wider text-xs w-10">#</th>
                  {columns.map((col) => (
                    <th key={col.name} className={`py-3 px-2 text-default-500 font-semibold uppercase tracking-wider text-xs ${col.type === "number" || col.type === "formula" ? "text-right" : "text-left"}`}>{col.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(bill.rows as Record<string, string | number>[]).map((row, i) => (
                  <tr key={i} className="border-b border-divider/30 hover:bg-default-50 dark:hover:bg-default-100/5 transition-colors">
                    <td className="py-3 px-2 text-default-400">{i + 1}</td>
                    {columns.map((col) => (
                      <td key={col.name} className={`py-3 px-2 ${col.type === "number" || col.type === "formula" ? "text-right font-mono" : ""} ${col.type === "formula" ? "text-primary font-medium" : ""}`}>
                        {(col.type === "number" || col.type === "formula")
                          ? (() => {
                            const raw = row[col.id];
                            const num = typeof raw === "number" ? raw : parseFloat(String(raw));
                            return !isNaN(num) ? formatColumnValue(col.name, num) : raw || "—";
                          })()
                          : row[col.id] || "—"}
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
          <BillFooter
            notes={bill.notes}
            terms={bill.terms}
            showActions={false}
          />
          <BillSummary
            subtotal={bill.subtotal}
            taxPercent={bill.taxPercent}
            taxAmount={bill.taxAmount}
            roundOff={bill.roundOff}
            grandTotal={bill.grandTotal}
            theme="primary"
            showAmountInWords
          />
        </div>
        {/* Spacer for fixed action bar */}
        <div className="h-24" />
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

        {/* Bill To / Supply Details / Ship To */}
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
          {bill.shippingAddress && (
            <div style={{ border: '1px solid #ccc', padding: '12px', borderRadius: '4px', gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '8pt', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '6px' }}>
                Ship To
              </div>
              <div style={{ color: '#444', whiteSpace: 'pre-line' }}>{bill.shippingAddress}</div>
            </div>
          )}
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
                      ? (() => {
                        const raw = row[col.id];
                        const num = typeof raw === "number" ? raw : parseFloat(String(raw));
                        return !isNaN(num) ? formatColumnValue(col.name, num) : raw || "—";
                      })()
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
                {(() => {
                  const slabs = aggregateTaxByRate(
                    bill.rows,
                    columns,
                    bill.isInterState === true,
                    { subtotal: bill.subtotal, taxAmount: bill.taxAmount, taxPercent: bill.taxPercent, hsnCode: bill.hsnCode }
                  );
                  if (bill.taxAmount === 0) {
                    return (
                      <tr>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee', color: '#444' }}>Tax</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', borderBottom: '1px solid #eee' }}>{formatCurrency(0)}</td>
                      </tr>
                    );
                  }
                  if (slabs.length === 1) {
                    // Single-slab: show traditional CGST/SGST or IGST rows
                    const slab = slabs[0];
                    if (bill.isInterState) {
                      return (
                        <tr>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee', color: '#444' }}>
                            IGST ({slab.rate}%)
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', borderBottom: '1px solid #eee' }}>
                            {formatCurrency(slab.igst)}
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <>
                        <tr>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee', color: '#444' }}>
                            CGST ({(slab.rate / 2).toFixed(1)}%)
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', borderBottom: '1px solid #eee' }}>
                            {formatCurrency(slab.cgst)}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee', color: '#444' }}>
                            SGST ({(slab.rate / 2).toFixed(1)}%)
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', borderBottom: '1px solid #eee' }}>
                            {formatCurrency(slab.sgst)}
                          </td>
                        </tr>
                      </>
                    );
                  }
                  // Multi-slab: show per-slab breakdown
                  return (
                    <>
                      {slabs.map((slab, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee', color: '#444' }}>
                            {bill.isInterState
                              ? `IGST @${slab.rate}%`
                              : `GST @${slab.rate}% (${(slab.rate / 2).toFixed(1)}+${(slab.rate / 2).toFixed(1)})`}
                            {slab.hsnCode !== '—' && (
                              <span style={{ fontSize: '7pt', color: '#888', marginLeft: '4px' }}>[{slab.hsnCode}]</span>
                            )}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', borderBottom: '1px solid #eee' }}>
                            {formatCurrency(slab.totalTax)}
                          </td>
                        </tr>
                      ))}
                    </>
                  );
                })()}
                {bill.roundOff !== 0 && (
                  <tr>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee', color: '#444' }}>
                      Round Off
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', borderBottom: '1px solid #eee' }}>
                      {bill.roundOff > 0 ? '+' : ''}{formatCurrency(bill.roundOff)}
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
