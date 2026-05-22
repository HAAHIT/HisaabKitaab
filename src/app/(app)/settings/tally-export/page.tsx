"use client";

import { useEffect, useState } from "react";
import { HKCheckbox } from "@/components/ui/HKCheckbox";
import { HKRadio, HKRadioGroup } from "@/components/ui/HKRadioGroup";
import { HKButton } from "@/components/ui/HKButton";
import { HKInput } from "@/components/ui/HKInput";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { type TranslationKey } from "@/lib/i18n/translations";
import {
  C, GR, AM, OR, SG, IN, TYPE,
  fmtFull,
  HKCard, HKToast, PageHeader, useIsMobile,
} from "@/components/ui/hk-design";

export default function TallyExportPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const isMobile = useIsMobile();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [periodType, setPeriodType] = useState("year");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [include, setInclude] = useState({
    sales: true, purchases: true, receipts: true,
    payments: true, ledgers: true, journals: false,
  });

  const [preview, setPreview] = useState<{
    salesCount: number; salesAmount: number;
    purchasesCount: number; purchasesAmount: number;
    receiptsCount: number; receiptsAmount: number;
    paymentsCount: number; paymentsAmount: number;
    journalsCount: number; partiesCount: number; unbalancedCount: number;
  } | null>(null);

  const [caEmail, setCaEmail] = useState("");

  useEffect(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
    if (!customFrom) setCustomFrom(`${fyStartYear}-04-01`);
    if (!customTo) setCustomTo(`${fyStartYear + 1}-03-31`);
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => { if (data?.settings?.caEmail) setCaEmail(data.settings.caEmail); })
      .catch(() => {});
  }, [customFrom, customTo]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  const getDateRange = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    if (periodType === "month") {
      const from = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;
      const to = new Date(currentYear, currentMonth + 1, 0).toISOString().split("T")[0];
      return { from, to };
    } else if (periodType === "quarter") {
      const q = Math.floor(currentMonth / 3);
      const from = `${currentYear}-${String(q * 3 + 1).padStart(2, "0")}-01`;
      const to = new Date(currentYear, q * 3 + 3, 0).toISOString().split("T")[0];
      return { from, to };
    } else if (periodType === "year") {
      const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
      return { from: `${fyStartYear}-04-01`, to: `${fyStartYear + 1}-03-31` };
    }
    return { from: customFrom, to: customTo };
  };

  const handleFetchPreview = async () => {
    setLoading(true);
    try {
      const { from, to } = getDateRange();
      const res = await fetch("/api/export/tally-xml/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("tally.export.fail" as TranslationKey));
      setPreview(data);
      if (data.unbalancedCount > 0) {
        showToast(t("tally.export.unbalancedError" as TranslationKey).replace("{count}", String(data.unbalancedCount)), "error");
        return;
      }
      setStep(2);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("tally.export.fail" as TranslationKey), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (method: "download" | "email" | "whatsapp") => {
    setExporting(true);
    try {
      const { from, to } = getDateRange();
      const res = await fetch("/api/export/tally-xml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, include }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || t("tally.export.fail" as TranslationKey));
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      if (method === "download") {
        const a = document.createElement("a");
        a.href = url; a.download = `SoloBooks-${from}-to-${to}.xml`;
        document.body.appendChild(a); a.click();
        window.URL.revokeObjectURL(url); document.body.removeChild(a);
        showToast(t("tally.export.successDownload" as TranslationKey), "success");
      } else if (method === "whatsapp") {
        const a = document.createElement("a");
        a.href = url; a.download = `SoloBooks-${from}-to-${to}.xml`; a.click();
        const msg = encodeURIComponent(`Namaste — yeh SoloBooks ka Tally file hai for ${from} to ${to}.`);
        window.open(`https://wa.me/?text=${msg}`, "_blank");
        showToast(t("tally.export.successWhatsapp" as TranslationKey), "success");
      } else if (method === "email") {
        const a = document.createElement("a");
        a.href = url; a.download = `SoloBooks-${from}-to-${to}.xml`; a.click();
        const subject = encodeURIComponent(`SoloBooks Tally file for ${from} to ${to}`);
        const body = encodeURIComponent(`Namaste,\nSoloBooks ka ${from} se ${to} ka Tally file ready hai.\nDownload karke Tally mein import kar lo.\n\n— SoloBooks`);
        window.open(`mailto:${caEmail}?subject=${subject}&body=${body}`);
        showToast(t("tally.export.successEmail" as TranslationKey), "success");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("tally.export.fail" as TranslationKey), "error");
    } finally {
      setExporting(false);
    }
  };

  const navBtnStyle: React.CSSProperties = {
    minHeight: 44, padding: "0 18px", borderRadius: 12,
    background: "var(--sb-badge)", border: "1px solid var(--sb-border)",
    color: "var(--sb-text)", fontFamily: SG, fontSize: TYPE.body, fontWeight: 600, cursor: "pointer",
    display: "flex", alignItems: "center", gap: 6,
  };

  const exportBtnStyle = (color: string): React.CSSProperties => ({
    width: "100%", minHeight: 52, borderRadius: 14,
    display: "flex", alignItems: "center", padding: "0 20px", gap: 10,
    background: color + "12", border: `1px solid ${color}33`, color,
    fontFamily: SG, fontSize: TYPE.body, fontWeight: 700,
    cursor: exporting ? "not-allowed" : "pointer", opacity: exporting ? 0.6 : 1,
  });

  return (
    <>
      {toast && <HKToast message={toast.message} type={toast.type} />}

      <div style={{ fontFamily: SG }}>
        <PageHeader title={t("tally.export.title" as TranslationKey)} subtitle={t("tally.export.subtitle" as TranslationKey)} isMobile={isMobile} />
        <div>
          {/* Step progress */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: 8, flex: 1, borderRadius: 999, background: step >= i ? C.primary : "var(--sb-border)", transition: "background 0.3s" }} />
            ))}
          </div>

          <HKCard>
            {step === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG, margin: 0 }}>
                  {t("tally.export.period" as TranslationKey)}
                </p>

                <HKRadioGroup value={periodType} onValueChange={setPeriodType}>
                  <HKRadio value="month">{t("tally.export.thisMonth" as TranslationKey)}</HKRadio>
                  <HKRadio value="quarter">{t("tally.export.thisQuarter" as TranslationKey)}</HKRadio>
                  <HKRadio value="year">{t("tally.export.thisYear" as TranslationKey)}</HKRadio>
                  <HKRadio value="custom">{t("tally.export.customDates" as TranslationKey)}</HKRadio>
                </HKRadioGroup>

                {periodType === "custom" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <HKInput type="date" label={t("tally.export.fromLabel" as TranslationKey)} value={customFrom} onValueChange={setCustomFrom} />
                    <HKInput type="date" label={t("tally.export.toLabel" as TranslationKey)} value={customTo} onValueChange={setCustomTo} />
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <HKButton onClick={handleFetchPreview} isLoading={loading}>{t("tally.export.next" as TranslationKey)} →</HKButton>
                </div>
              </div>
            )}

            {step === 2 && preview && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG, margin: 0 }}>
                  {t("tally.export.whatToInclude" as TranslationKey)}
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <HKCheckbox isSelected={include.sales} onValueChange={(v) => setInclude({ ...include, sales: v })}>
                    {t("tally.export.sales" as TranslationKey)}{" "}
                    <span style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", fontFamily: SG }}>
                      ({preview.salesCount} bills, {fmtFull(preview.salesAmount)})
                    </span>
                  </HKCheckbox>
                  <HKCheckbox isSelected={include.purchases} onValueChange={(v) => setInclude({ ...include, purchases: v })}>
                    {t("tally.export.purchases" as TranslationKey)}{" "}
                    <span style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", fontFamily: SG }}>
                      ({preview.purchasesCount} bills, {fmtFull(preview.purchasesAmount)})
                    </span>
                  </HKCheckbox>
                  <HKCheckbox isSelected={include.receipts} onValueChange={(v) => setInclude({ ...include, receipts: v })}>
                    {t("tally.export.receipts" as TranslationKey)}{" "}
                    <span style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", fontFamily: SG }}>
                      ({preview.receiptsCount} payments, {fmtFull(preview.receiptsAmount)})
                    </span>
                  </HKCheckbox>
                  <HKCheckbox isSelected={include.payments} onValueChange={(v) => setInclude({ ...include, payments: v })}>
                    {t("tally.export.payments" as TranslationKey)}{" "}
                    <span style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", fontFamily: SG }}>
                      ({preview.paymentsCount} payments, {fmtFull(preview.paymentsAmount)})
                    </span>
                  </HKCheckbox>
                  <HKCheckbox isSelected={include.ledgers} onValueChange={(v) => setInclude({ ...include, ledgers: v })}>
                    {t("tally.export.partyBalances" as TranslationKey)}{" "}
                    <span style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", fontFamily: SG }}>
                      ({preview.partiesCount} parties)
                    </span>
                  </HKCheckbox>
                  <HKCheckbox isSelected={include.journals} onValueChange={(v) => setInclude({ ...include, journals: v })}>
                    {t("tally.export.journals" as TranslationKey)}{" "}
                    <span style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", fontFamily: SG }}>
                      ({preview.journalsCount} entries)
                    </span>
                  </HKCheckbox>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <button onClick={() => setStep(1)} style={navBtnStyle}>← {t("tally.export.back" as TranslationKey)}</button>
                  <HKButton onClick={() => setStep(3)}>{t("tally.export.next" as TranslationKey)} →</HKButton>
                </div>
              </div>
            )}

            {step === 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG, margin: 0 }}>
                  {t("tally.export.howToSend" as TranslationKey)}
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button onClick={() => handleExport("download")} disabled={exporting} style={exportBtnStyle(C.primary)}>
                    📥 {t("tally.export.downloadXml" as TranslationKey)}
                  </button>
                  <button onClick={() => handleExport("email")} disabled={exporting} style={exportBtnStyle(C.primary)}>
                    📧 {t("tally.export.emailToCa" as TranslationKey)}{caEmail && (
                      <span style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)", fontFamily: SG, fontWeight: 400 }}>
                        {" "}({caEmail})
                      </span>
                    )}
                  </button>
                  <button onClick={() => handleExport("whatsapp")} disabled={exporting} style={exportBtnStyle("#25D366")}>
                    💬 {t("tally.export.whatsappShare" as TranslationKey)}
                  </button>
                </div>

                <div>
                  <button onClick={() => setStep(2)} style={navBtnStyle}>← {t("tally.export.back" as TranslationKey)}</button>
                </div>
              </div>
            )}
          </HKCard>
        </div>
      </div>
    </>
  );
}

