"use client";

import { useEffect, useState } from "react";
import { HKSelect, HKSelectItem } from "@/components/ui/HKSelect";
import { HKTextarea } from "@/components/ui/HKTextarea";
import { useRouter, useSearchParams } from "next/navigation";
import { PartySearch, type PartyOption } from "@/components/ui/PartySearch";
import { GST_STATE_CODES } from "@/lib/gst-states";
import {
  GR, AM, PU, SG, IN, TYPE, DISPLAY,
  fmtFull,
  HKCard, HKToast, useIsMobile,
} from "@/components/ui/hk-design";
import { HKButton } from "@/components/ui/HKButton";
import { HKInput } from "@/components/ui/HKInput";
import { useLanguage } from "@/contexts/LanguageContext";

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

const getReasonTranslationKey = (r: string) => {
  switch (r) {
    case "Sales Return": return "notes.reason.salesReturn";
    case "Post Sale Discount": return "notes.reason.postSaleDiscount";
    case "Deficiency in Services": return "notes.reason.deficiencyInServices";
    case "Correction in Invoice": return "notes.reason.correctionInInvoice";
    case "Change in POS": return "notes.reason.changeInPOS";
    case "Purchase Return": return "notes.reason.purchaseReturn";
    case "Post Purchase Discount": return "notes.reason.postPurchaseDiscount";
    case "Correction in Purchase Invoice": return "notes.reason.correctionInPurchaseInvoice";
    default: return "notes.reason.other";
  }
};

async function readError(response: Response) {
  const data = await response.json().catch(() => null);
  return data?.error || "Request failed";
}

export default function NewNotePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const { t } = useLanguage();

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
      showToast(t("notes.new.errorFillRequired"), "error");
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

      showToast(isCredit ? t("notes.new.creditCreated") : t("notes.new.debitCreated"), "success");
      window.setTimeout(() => router.push("/notes"), 700);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("notes.new.createFailed"), "error");
    } finally {
      setIsSaving(false);
    }
  }

  const accentColor = isCredit ? GR : AM;

  return (
    <div style={{ background: "var(--sb-bg)", minHeight: "100%", fontFamily: SG }}>
      {toast && <HKToast message={toast.message} type={toast.type} />}

      <div style={{ padding: isMobile ? "18px 14px 120px" : "24px 28px 80px", maxWidth: 800, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <button
            onClick={() => router.push("/notes")}
            style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              border: "1.5px solid var(--sb-border)", background: "var(--sb-card)",
              boxShadow: "var(--sb-shadow-card)", color: "var(--sb-text)",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div>
            <h1 style={{ fontFamily: DISPLAY, fontSize: isMobile ? 24 : 30, fontWeight: 600, color: "var(--sb-text)", margin: 0, letterSpacing: "-0.01em", lineHeight: 1.2 }}>
              {isCredit ? t("notes.new.creditTitle") : t("notes.new.debitTitle")}
            </h1>
            <p style={{ fontSize: 14, fontWeight: 500, color: "var(--sb-sub)", marginTop: 4 }}>
              {isCredit ? t("notes.new.creditSubtitle") : t("notes.new.debitSubtitle")}
            </p>
          </div>
        </div>
        {/* Party Section */}
        <HKCard style={{ marginBottom: 16 }}>
          <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG, marginBottom: 16 }}>
            {isCredit ? t("notes.new.billToCustomer") : t("notes.new.billFromVendor")}
          </p>
          <PartySearch
            value={selectedParty?.id || null}
            partyType={isCredit ? "CUSTOMER" : "VENDOR"}
            placeholder={isCredit ? t("notes.new.searchCustomer") : t("notes.new.searchVendor")}
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
                background: "var(--sb-bg)", border: "1px solid var(--sb-border)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <p style={{ fontSize: TYPE.bodyLarge, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG, margin: 0 }}>
                  {selectedParty.name}
                </p>
                <button
                  onClick={() => setSelectedParty(null)}
                  style={{ fontSize: TYPE.bodySmall, color: PU, background: "none", border: "none", cursor: "pointer", fontFamily: SG, fontWeight: 600 }}
                >
                  {t("common.change")}
                </button>
              </div>
              {selectedParty.phone && (
                <p style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)", fontFamily: SG, margin: "2px 0" }}>📱 {selectedParty.phone}</p>
              )}
              {selectedParty.gstin && (
                <p style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)", fontFamily: SG, margin: "2px 0" }}>GST: {selectedParty.gstin}</p>
              )}
              {selectedParty.currentBalance !== 0 && (
                <p
                  style={{
                    marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--sb-border)",
                    fontSize: TYPE.bodySmall, fontWeight: 700,
                    color: selectedParty.currentBalance < 0 ? GR : AM,
                    fontFamily: SG,
                  }}
                >
                  {selectedParty.currentBalance < 0
                    ? `${t("notes.new.toGet")}: ₹${Math.abs(selectedParty.currentBalance).toLocaleString("en-IN")}`
                    : `${t("notes.new.toPay")}: ₹${selectedParty.currentBalance.toLocaleString("en-IN")}`}
                </p>
              )}
            </div>
          )}
        </HKCard>

        {/* Note Details */}
        <HKCard style={{ marginBottom: 16 }}>
          <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG, marginBottom: 16 }}>{t("notes.new.noteDetails")}</p>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
            <HKInput
              label={t("notes.new.originalInvoice")}
              placeholder="e.g. INV-2024-001"
              value={originalInvoiceNo}
              onValueChange={(v) => {
                setOriginalInvoiceNo(v);
                setErrors((prev) => ({ ...prev, invoiceNo: false }));
              }}
              isInvalid={Boolean(errors.invoiceNo)}
              errorMessage={errors.invoiceNo ? t("notes.new.required") : undefined}
            />
            <HKSelect
              label={t("notes.new.reasonForIssuance")}
              value={reason}
              onValueChange={(v) => { if (v) setReason(v); }}
            >
              {reasons.map((r) => (
                <HKSelectItem key={r} value={r}>{t(getReasonTranslationKey(r))}</HKSelectItem>
              ))}
            </HKSelect>
          </div>
        </HKCard>

        {/* Summary + Notes */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <HKCard>
            <HKTextarea
              label={t("notes.new.additionalNotes")}
              placeholder={t("notes.new.additionalNotesPlaceholder")}
              value={additionalNotes}
              onValueChange={setAdditionalNotes}
              minRows={4}
            />
          </HKCard>

          <HKCard style={{ background: accentColor + "08", borderColor: accentColor + "33" }}>
            <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG, marginBottom: 16 }}>{t("notes.new.summary")}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: TYPE.body, color: "var(--sb-sub)", fontFamily: SG }}>{t("notes.new.subtotal")}</span>
                <HKInput
                  type="number"
                  aria-label="Subtotal"
                  value={String(subtotal || "")}
                  onValueChange={(v) => setSubtotal(Number(v) || 0)}
                  size="sm"
                  className="w-36"
                  startContent={<span style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)" }}>₹</span>}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: TYPE.body, color: "var(--sb-sub)", fontFamily: SG }}>{t("notes.new.tax")}</span>
                  <HKInput
                    type="number"
                    aria-label="Tax percentage"
                    value={String(taxPercent)}
                    onValueChange={(v) => setTaxPercent(parseFloat(v) || 0)}
                    size="sm"
                    className="w-20"
                    endContent={<span style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)" }}>%</span>}
                  />
                </div>
                <span style={{ fontSize: TYPE.body, fontWeight: 600, color: "var(--sb-text)", fontFamily: IN }}>
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
                  <span style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)", fontFamily: SG }}>{t("notes.new.interState")}</span>
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)", fontFamily: SG, flexShrink: 0 }}>{t("notes.new.placeOfSupply")}</span>
                <HKSelect
                  aria-label="Place of supply"
                  placeholder={t("notes.new.selectState")}
                  size="sm"
                  isInvalid={Boolean(errors.placeOfSupply)}
                  value={placeOfSupply}
                  onValueChange={(v) => {
                    setPlaceOfSupply(v ?? "");
                    setErrors((prev) => ({ ...prev, placeOfSupply: false }));
                  }}
                >
                  {Object.entries(GST_STATE_CODES).map(([code, name]) => (
                    <HKSelectItem key={code} value={code}>{code} — {name}</HKSelectItem>
                  ))}
                </HKSelect>
              </div>

              <div style={{ height: 1, background: "var(--sb-border)", margin: "4px 0" }} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: TYPE.bodyLarge, fontWeight: 800, color: "var(--sb-text)", fontFamily: SG }}>{t("notes.new.grandTotal")}</span>
                <span style={{ fontSize: TYPE.numMedium, fontWeight: 800, color: accentColor, fontFamily: IN }}>
                  {fmtFull(grandTotal)}
                </span>
              </div>

              {errors.grandTotal && (
                <p style={{ fontSize: TYPE.bodySmall, color: "#e53e3e", fontFamily: SG }}>{t("notes.new.errorTotalZero")}</p>
              )}
            </div>
          </HKCard>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <HKButton variant="secondary" onClick={() => router.push("/notes")}>
            {t("common.cancel")}
          </HKButton>
          <HKButton onClick={handleCreate} isLoading={isSaving}>
            {isCredit ? t("notes.new.createCreditBtn") : t("notes.new.createDebitBtn")}
          </HKButton>
        </div>
      </div>
    </div>
  );
}
