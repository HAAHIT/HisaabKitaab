"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Input,
  Select,
  SelectItem,
  Textarea,
} from "@heroui/react";
import { useRouter, useSearchParams } from "next/navigation";
import { PartySearch, type PartyOption } from "@/components/ui/PartySearch";
import { StateSearch } from "@/components/ui/StateSearch";
import { GST_STATE_CODES } from "@/lib/gst-states";
import { extractGstinStateCode } from "@/lib/gst-helpers";

type NoteType = "CREDIT_NOTE" | "DEBIT_NOTE";

const REASONS_CREDIT = [
  "Sales Return",
  "Post Sale Discount",
  "Deficiency in Services",
  "Correction in Invoice",
  "Change in POS",
  "Other",
];

const REASONS_DEBIT = [
  "Purchase Return",
  "Post Purchase Discount",
  "Correction in Purchase Invoice",
  "Other",
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

async function readError(response: Response) {
  const data = await response.json().catch(() => null);
  return data?.error || "Request failed";
}

export default function NewNotePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawType = searchParams.get("type");
  const noteType: NoteType =
    rawType === "DEBIT_NOTE" ? "DEBIT_NOTE" : "CREDIT_NOTE";
  const isCredit = noteType === "CREDIT_NOTE";

  const [selectedParty, setSelectedParty] = useState<PartyOption | null>(null);
  const [originalInvoiceNo, setOriginalInvoiceNo] = useState("");
  const [reason, setReason] = useState(isCredit ? REASONS_CREDIT[0] : REASONS_DEBIT[0]);
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [subtotal, setSubtotal] = useState<number>(0);
  const [taxPercent, setTaxPercent] = useState<number>(18);
  const [isInterState, setIsInterState] = useState(false);
  const [tenantGstin, setTenantGstin] = useState<string | null>(null);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const taxAmount = Math.round(((subtotal * taxPercent) / 100) * 100) / 100;
  const grandTotal = Math.round((subtotal + taxAmount) * 100) / 100;

  const reasons = isCredit ? REASONS_CREDIT : REASONS_DEBIT;

  // Fetch company GSTIN from settings on mount
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings?.companyGstin) {
          setTenantGstin(data.settings.companyGstin);
        }
      })
      .catch(() => {/* silently ignore */});
  }, []);

  // Reset reason when note type changes (shouldn't happen mid-session, but safe)
  useEffect(() => {
    setReason(isCredit ? REASONS_CREDIT[0] : REASONS_DEBIT[0]);
  }, [isCredit]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  async function handleCreate() {
    const formErrors: Record<string, boolean> = {};

    if (!selectedParty) formErrors.party = true;
    if (!originalInvoiceNo.trim()) formErrors.invoiceNo = true;
    if (!placeOfSupply) formErrors.placeOfSupply = true;
    if (grandTotal <= 0) formErrors.grandTotal = true;

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      showToast("Please fill in all required fields", "error");
      document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
      window.setTimeout(() => setErrors({}), 3000);
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/credit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyId: selectedParty!.id,
          originalInvoiceNo: originalInvoiceNo.trim(),
          reasonForIssuance: reason,
          placeOfSupply,
          noteType,
          subtotal,
          taxAmount,
          grandTotal,
          isInterState,
        }),
      });

      if (!response.ok) throw new Error(await readError(response));

      showToast(
        isCredit ? "Credit note created" : "Debit note created",
        "success"
      );
      window.setTimeout(() => router.push("/notes"), 700);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to create note",
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  }


  return (
    <>
      {toast && (
        <div
          className={`fixed right-4 top-4 z-[100] rounded-xl px-4 py-3 shadow-lg animate-slide-up ${
            toast.type === "success" ? "bg-success text-white" : "bg-danger text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="animate-fade-in p-4 lg:p-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Button
            isIconOnly
            variant="light"
            aria-label="Back to notes"
            onPress={() => router.push("/notes")}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
              />
            </svg>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isCredit ? "New Credit Note" : "New Debit Note"}
            </h1>
            <p className="mt-1 text-sm text-default-500">
              {isCredit
                ? "Record a sales return or discount given to a customer."
                : "Record a purchase return or discount received from a vendor."}
            </p>
          </div>
        </div>

        {/* Party Card */}
        <Card shadow="sm" className="mb-6">
          <CardHeader className="px-6 pt-6 pb-0">
            <h2 className="text-lg font-semibold">
              {isCredit ? "Bill To (Customer)" : "Bill From (Vendor)"}
            </h2>
          </CardHeader>
          <CardBody className="p-6">
            <PartySearch
              value={selectedParty?.id || null}
              partyType={isCredit ? "CUSTOMER" : "VENDOR"}
              placeholder={isCredit ? "Search customer…" : "Search vendor…"}
              autoFocus={!selectedParty}
              isInvalid={Boolean(errors.party)}
              onChange={(party) => {
                setSelectedParty(party);
                if (party) {
                  setErrors((prev) => ({ ...prev, party: false }));
                  // Auto-fill place of supply from first 2 digits of party GSTIN
                  if (party.gstin && party.gstin.length >= 2) {
                    const code = party.gstin.substring(0, 2);
                    if (GST_STATE_CODES[code]) setPlaceOfSupply(code);
                  }
                  // Auto-derive interstate from GSTIN comparison
                  const partyState = extractGstinStateCode(party.gstin);
                  const tenantState = extractGstinStateCode(tenantGstin);
                  if (partyState && tenantState) {
                    setIsInterState(partyState !== tenantState);
                  }
                }
              }}
            />

            {selectedParty && (
              <div className="mt-4 rounded-xl bg-default-50 dark:bg-default-100/5 p-4 border border-default-200 animate-slide-up">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-lg">{selectedParty.name}</h3>
                  <Button size="sm" variant="light" onPress={() => setSelectedParty(null)}>
                    Change
                  </Button>
                </div>
                <div className="space-y-1 text-sm text-default-500">
                  {selectedParty.phone && (
                    <p className="flex items-center gap-2">
                      <span>📱</span> {selectedParty.phone}
                    </p>
                  )}
                  {selectedParty.address && (
                    <p className="flex items-center gap-2">
                      <span>📍</span> {selectedParty.address}
                    </p>
                  )}
                  {selectedParty.gstin && (
                    <p className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold tracking-widest text-default-400">GST</span>{" "}
                      {selectedParty.gstin}
                    </p>
                  )}
                </div>
                {selectedParty.currentBalance !== 0 && (
                  <div
                    className={`mt-3 pt-3 border-t border-default-200 text-sm font-medium flex items-center gap-2 ${
                      selectedParty.currentBalance < 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${
                        selectedParty.currentBalance < 0 ? "bg-success" : "bg-danger"
                      }`}
                    />
                    {selectedParty.currentBalance < 0
                      ? `To Get: ₹${Math.abs(selectedParty.currentBalance).toLocaleString("en-IN")}`
                      : `To Pay: ₹${selectedParty.currentBalance.toLocaleString("en-IN")}`}
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Note Details Card */}
        <Card shadow="sm" className="mb-6">
          <CardHeader className="px-6 pt-6 pb-0">
            <h2 className="text-lg font-semibold">Note Details</h2>
          </CardHeader>
          <CardBody className="p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Original Invoice / Bill Reference *"
                placeholder="e.g. INV-2024-001"
                value={originalInvoiceNo}
                onValueChange={(v) => {
                  setOriginalInvoiceNo(v);
                  setErrors((prev) => ({ ...prev, invoiceNo: false }));
                }}
                variant="bordered"
                isInvalid={Boolean(errors.invoiceNo)}
                errorMessage={errors.invoiceNo ? "Required" : undefined}
              />

              <Select
                label="Reason for Issuance *"
                variant="bordered"
                selectedKeys={[reason]}
                onSelectionChange={(keys) => setReason(Array.from(keys)[0] as string)}
              >
                {reasons.map((r) => (
                  <SelectItem key={r} textValue={r}>{r}</SelectItem>
                ))}
              </Select>
            </div>
          </CardBody>
        </Card>

        {/* Summary row — matches bill page layout */}
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Card shadow="sm">
            <CardBody className="space-y-4 p-6">
              <Textarea
                label="Additional Notes"
                placeholder="Any additional information about this note…"
                value={additionalNotes}
                onValueChange={setAdditionalNotes}
                variant="bordered"
                minRows={4}
              />
            </CardBody>
          </Card>

          <Card shadow="sm" className="bg-gradient-to-br from-blue-500/5 to-indigo-500/5">
            <CardBody className="p-6">
              <h3 className="mb-4 text-lg font-semibold">Summary</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-default-500">Subtotal (Taxable)</span>
                  <Input
                    type="number"
                    aria-label="Subtotal"
                    value={String(subtotal || "")}
                    onValueChange={(v) => setSubtotal(Number(v) || 0)}
                    variant="bordered"
                    size="sm"
                    className="w-36"
                    startContent={<span className="text-sm text-default-400">₹</span>}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-default-500">Tax</span>
                    <Input
                      type="number"
                      aria-label="Tax percentage"
                      value={String(taxPercent)}
                      onValueChange={(v) => setTaxPercent(Number.parseFloat(v) || 0)}
                      variant="bordered"
                      size="sm"
                      className="w-20"
                      endContent={<span className="text-sm text-default-400">%</span>}
                    />
                  </div>
                  <span className="font-medium">{formatCurrency(taxAmount)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-default-400">Tax type</p>
                  {(() => {
                    const isAutoDetected = !!selectedParty?.gstin;
                    return (
                      <div className="flex flex-col items-end gap-0.5">
                        <label className={`flex items-center gap-1.5 select-none ${isAutoDetected ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}>
                          <input
                            type="checkbox"
                            checked={isInterState}
                            onChange={(e) => setIsInterState(e.target.checked)}
                            className="accent-primary"
                            disabled={isAutoDetected}
                          />
                          <span className="text-xs text-default-500">Inter-state (IGST)</span>
                        </label>
                        {isAutoDetected && (
                          <span className="text-[10px] text-default-400">Auto-detected from GST Numbers</span>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="shrink-0 text-sm text-default-500">Place of Supply</span>
                  <StateSearch
                    value={placeOfSupply}
                    onChange={(code) => {
                      setPlaceOfSupply(code);
                      setErrors((prev) => ({ ...prev, placeOfSupply: false }));
                    }}
                    isInvalid={Boolean(errors.placeOfSupply)}
                    className="max-w-[200px]"
                  />
                </div>

                <Divider />

                <div className="flex justify-between">
                  <span className="text-lg font-bold">Grand Total</span>
                  <span
                    className={`text-lg font-bold ${
                      grandTotal > 0 ? "text-primary" : "text-default-400"
                    }`}
                  >
                    {formatCurrency(grandTotal)}
                  </span>
                </div>

                {errors.grandTotal && (
                  <p className="text-xs text-danger">Total must be greater than zero</p>
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-3">
          <Button variant="flat" onPress={() => router.push("/notes")}>
            Cancel
          </Button>
          <Button
            className="bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold shadow-lg shadow-blue-500/25"
            onPress={handleCreate}
            isLoading={isSaving}
          >
            {isCredit ? "Create Credit Note" : "Create Debit Note"}
          </Button>
        </div>
      </div>
    </>
  );
}
