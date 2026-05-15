"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectItem,
  Textarea,
} from "@heroui/react";
import { useRouter, useSearchParams } from "next/navigation";
import { PartySearch, type PartyOption } from "@/components/ui/PartySearch";
import { GST_STATE_CODES } from "@/lib/gst-states";
import {
  GR, AM, PU, SG, IN, TYPE,
  fmtFull,
  HKCard, HKToast, PageHeader, useIsMobile,
} from "@/components/ui/hk-design";
import { HKButton } from "@/components/ui/HKButton";
import { HKInput } from "@/components/ui/HKInput";

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

async function readError(response: Response) {
  const data = await response.json().catch(() => null);
  return data?.error || "Request failed";
}

export default function NewNotePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();

  const rawType = searchParams.get("type");
  const noteType: NoteType = rawType === "DEBIT_NOTE" ? "DEBIT_NOTE" : "CREDIT_NOTE";
  const isCredit = noteType === "CREDIT_NOTE";

  const [selectedParty, setSelectedParty] = useState<PartyOption | null>(null);
  const [originalInvoiceNo, setOriginalInvoiceNo] = useState("");
  const [reason, setReason] = useState(isCredit ? REASONS_CREDIT[0] : REASONS_DEBIT[0]);
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [subtotal, setSubtotal] = useState<number>(0);
  const [taxPercent, setTaxPercent] = useState<number>(18);
  const [isInterState, setIsInterState] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const taxAmount = Math.round(((subtotal * taxPercent) / 100) * 100) / 100;
  const grandTotal = Math.round((subtotal + taxAmount) * 100) / 100;

  const reasons = isCredit ? REASONS_CREDIT : REASONS_DEBIT;

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

      showToast(isCredit ? "Credit note created" : "Debit note created", "success");
      window.setTimeout(() => router.push("/notes"), 700);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create note", "error");
    } finally {
      setIsSaving(false);
    }
  }

  const accentColor = isCredit ? GR : AM;

  return (
    <div style={{ background: "var(--hk-bg)", minHeight: "100%", fontFamily: SG }}>
      {toast && <HKToast message={toast.message} type={toast.type} />}

      <PageHeader
        title={isCredit ? "Naya Credit Note" : "Naya Debit Note"}
        subtitle={isCredit ? "Sales return ya discount jo diya" : "Purchase return ya discount jo mila"}
        isMobile={isMobile}
        action={
          <button
            onClick={() => router.push("/notes")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "none", border: "none", color: "var(--hk-sub)",
              fontSize: TYPE.body, fontFamily: SG, fontWeight: 600, cursor: "pointer",
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round">
              <path d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Wapas
          </button>
        }
      />

      <div style={{ padding: isMobile ? "0 14px 120px" : "0 28px 80px", maxWidth: 800, margin: "0 auto" }}>
        {/* Party Section */}
        <HKCard style={{ marginBottom: 16 }}>
          <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG, marginBottom: 16 }}>
            {isCredit ? "Bill To (Customer)" : "Bill From (Vendor)"}
          </p>
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
                if (party.gstin && party.gstin.length >= 2) {
                  const code = party.gstin.substring(0, 2);
                  if (GST_STATE_CODES[code]) setPlaceOfSupply(code);
                }
              }
            }}
          />

          {selectedParty && (
            <div
              style={{
                marginTop: 16, padding: "14px 16px", borderRadius: 12,
                background: "var(--hk-bg)", border: "1px solid var(--hk-border)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <p style={{ fontSize: TYPE.bodyLarge, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG, margin: 0 }}>
                  {selectedParty.name}
                </p>
                <button
                  onClick={() => setSelectedParty(null)}
                  style={{ fontSize: TYPE.bodySmall, color: PU, background: "none", border: "none", cursor: "pointer", fontFamily: SG, fontWeight: 600 }}
                >
                  Change
                </button>
              </div>
              {selectedParty.phone && (
                <p style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: SG, margin: "2px 0" }}>📱 {selectedParty.phone}</p>
              )}
              {selectedParty.gstin && (
                <p style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: SG, margin: "2px 0" }}>GST: {selectedParty.gstin}</p>
              )}
              {selectedParty.currentBalance !== 0 && (
                <p
                  style={{
                    marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--hk-border)",
                    fontSize: TYPE.bodySmall, fontWeight: 700,
                    color: selectedParty.currentBalance < 0 ? GR : AM,
                    fontFamily: SG,
                  }}
                >
                  {selectedParty.currentBalance < 0
                    ? `To Get: ₹${Math.abs(selectedParty.currentBalance).toLocaleString("en-IN")}`
                    : `To Pay: ₹${selectedParty.currentBalance.toLocaleString("en-IN")}`}
                </p>
              )}
            </div>
          )}
        </HKCard>

        {/* Note Details */}
        <HKCard style={{ marginBottom: 16 }}>
          <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG, marginBottom: 16 }}>Note Details</p>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
            <HKInput
              label="Original Invoice / Bill Reference *"
              placeholder="e.g. INV-2024-001"
              value={originalInvoiceNo}
              onValueChange={(v) => {
                setOriginalInvoiceNo(v);
                setErrors((prev) => ({ ...prev, invoiceNo: false }));
              }}
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
        </HKCard>

        {/* Summary + Notes */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <HKCard>
            <Textarea
              label="Additional Notes"
              placeholder="Any additional information about this note…"
              value={additionalNotes}
              onValueChange={setAdditionalNotes}
              variant="bordered"
              minRows={4}
            />
          </HKCard>

          <HKCard style={{ background: accentColor + "08", borderColor: accentColor + "33" }}>
            <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG, marginBottom: 16 }}>Summary</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: TYPE.body, color: "var(--hk-sub)", fontFamily: SG }}>Subtotal (Taxable)</span>
                <HKInput
                  type="number"
                  aria-label="Subtotal"
                  value={String(subtotal || "")}
                  onValueChange={(v) => setSubtotal(Number(v) || 0)}
                  size="sm"
                  className="w-36"
                  startContent={<span style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)" }}>₹</span>}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: TYPE.body, color: "var(--hk-sub)", fontFamily: SG }}>Tax</span>
                  <HKInput
                    type="number"
                    aria-label="Tax percentage"
                    value={String(taxPercent)}
                    onValueChange={(v) => setTaxPercent(parseFloat(v) || 0)}
                    size="sm"
                    className="w-20"
                    endContent={<span style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)" }}>%</span>}
                  />
                </div>
                <span style={{ fontSize: TYPE.body, fontWeight: 600, color: "var(--hk-text)", fontFamily: IN }}>
                  {fmtFull(taxAmount)}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={isInterState}
                    onChange={(e) => setIsInterState(e.target.checked)}
                    style={{ accentColor: PU, width: 16, height: 16 }}
                  />
                  <span style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: SG }}>Inter-state (IGST)</span>
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: SG, flexShrink: 0 }}>Place of Supply</span>
                <Select
                  aria-label="Place of supply"
                  placeholder="Select state"
                  size="sm"
                  variant="bordered"
                  className="max-w-[200px]"
                  isInvalid={Boolean(errors.placeOfSupply)}
                  selectedKeys={placeOfSupply ? new Set([placeOfSupply]) : new Set([])}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as string | undefined;
                    setPlaceOfSupply(value ?? "");
                    setErrors((prev) => ({ ...prev, placeOfSupply: false }));
                  }}
                >
                  {Object.entries(GST_STATE_CODES).map(([code, name]) => (
                    <SelectItem key={code} textValue={`${code} - ${name}`}>{code} — {name}</SelectItem>
                  ))}
                </Select>
              </div>

              <div style={{ height: 1, background: "var(--hk-border)", margin: "4px 0" }} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: TYPE.bodyLarge, fontWeight: 800, color: "var(--hk-text)", fontFamily: SG }}>Grand Total</span>
                <span style={{ fontSize: TYPE.numMedium, fontWeight: 800, color: accentColor, fontFamily: IN }}>
                  {fmtFull(grandTotal)}
                </span>
              </div>

              {errors.grandTotal && (
                <p style={{ fontSize: TYPE.bodySmall, color: "#e53e3e", fontFamily: SG }}>Total must be greater than zero</p>
              )}
            </div>
          </HKCard>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <HKButton variant="secondary" onClick={() => router.push("/notes")}>
            Cancel
          </HKButton>
          <HKButton onClick={handleCreate} isLoading={isSaving}>
            {isCredit ? "Create Credit Note" : "Create Debit Note"}
          </HKButton>
        </div>
      </div>
    </div>
  );
}
