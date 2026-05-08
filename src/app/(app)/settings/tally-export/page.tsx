"use client";

import { useEffect, useState } from "react";
import { Checkbox, Input, Radio, RadioGroup } from "@heroui/react";
import { useRouter } from "next/navigation";
import {
  GR, AM, OR, PU, SG, IN, TYPE,
  fmtFull,
  HKCard, HKToast, PageHeader, GradientButton, useIsMobile,
} from "@/components/ui/hk-design";

export default function TallyExportPage() {
  const router = useRouter();
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
  }, []);

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
      if (!res.ok) throw new Error(data.error || "Preview fetch failed");
      setPreview(data);
      if (data.unbalancedCount > 0) {
        showToast(`Kuch entries mein gadbad hai (${data.unbalancedCount}). Support se baat karo.`, "error");
        return;
      }
      setStep(2);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load preview", "error");
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
        throw new Error(errorData?.error || "Export failed");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      if (method === "download") {
        const a = document.createElement("a");
        a.href = url; a.download = `HisaabKitaab-${from}-to-${to}.xml`;
        document.body.appendChild(a); a.click();
        window.URL.revokeObjectURL(url); document.body.removeChild(a);
        showToast("Ho gaya ✓ — File CA ko bhej do", "success");
      } else if (method === "whatsapp") {
        const a = document.createElement("a");
        a.href = url; a.download = `HisaabKitaab-${from}-to-${to}.xml`; a.click();
        const msg = encodeURIComponent(`Namaste — yeh HisaabKitaab ka Tally file hai for ${from} to ${to}.`);
        window.open(`https://wa.me/?text=${msg}`, "_blank");
        showToast("Downloaded for WhatsApp", "success");
      } else if (method === "email") {
        const a = document.createElement("a");
        a.href = url; a.download = `HisaabKitaab-${from}-to-${to}.xml`; a.click();
        const subject = encodeURIComponent(`HisaabKitaab Tally file for ${from} to ${to}`);
        const body = encodeURIComponent(`Namaste,\nHisaabKitaab ka ${from} se ${to} ka Tally file ready hai.\nDownload karke Tally mein import kar lo.\n\n— HisaabKitaab`);
        window.open(`mailto:${caEmail}?subject=${subject}&body=${body}`);
        showToast("Downloaded for Email", "success");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Export failed", "error");
    } finally {
      setExporting(false);
    }
  };

  const navBtnStyle: React.CSSProperties = {
    minHeight: 44, padding: "0 18px", borderRadius: 12,
    background: "var(--hk-badge)", border: "1px solid var(--hk-border)",
    color: "var(--hk-text)", fontFamily: SG, fontSize: TYPE.body, fontWeight: 600, cursor: "pointer",
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

      <div style={{ background: "var(--hk-bg)", minHeight: "100%", fontFamily: SG }}>
        <PageHeader
          title="Tally ko Bhejo"
          subtitle="Send your books directly to your CA in Tally format."
          isMobile={isMobile}
          action={
            <button onClick={() => router.push("/settings/company")} style={navBtnStyle}>
              ← Back
            </button>
          }
        />

        <div style={{ padding: isMobile ? "0 14px 80px" : "0 28px 80px", maxWidth: 760, margin: "0 auto" }}>
          {/* Step progress */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: 8, flex: 1, borderRadius: 999, background: step >= i ? PU : "var(--hk-border)", transition: "background 0.3s" }} />
            ))}
          </div>

          <HKCard>
            {step === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG, margin: 0 }}>
                  Kaunsa period?
                </p>

                <RadioGroup value={periodType} onValueChange={setPeriodType}>
                  <Radio value="month">Is mahine</Radio>
                  <Radio value="quarter">Is quarter</Radio>
                  <Radio value="year">Is saal (Financial Year)</Radio>
                  <Radio value="custom">Custom dates</Radio>
                </RadioGroup>

                {periodType === "custom" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Input type="date" label="From" value={customFrom} onValueChange={setCustomFrom} variant="bordered" />
                    <Input type="date" label="To" value={customTo} onValueChange={setCustomTo} variant="bordered" />
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <GradientButton onClick={handleFetchPreview} disabled={loading}>
                    {loading ? "Loading..." : "Aage Badho →"}
                  </GradientButton>
                </div>
              </div>
            )}

            {step === 2 && preview && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG, margin: 0 }}>
                  Kya kya include karna hai?
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <Checkbox isSelected={include.sales} onValueChange={(v) => setInclude({ ...include, sales: v })}>
                    Sales bills{" "}
                    <span style={{ fontSize: TYPE.caption, color: "var(--hk-sub)", fontFamily: SG }}>
                      ({preview.salesCount} bills, {fmtFull(preview.salesAmount)})
                    </span>
                  </Checkbox>
                  <Checkbox isSelected={include.purchases} onValueChange={(v) => setInclude({ ...include, purchases: v })}>
                    Purchase bills{" "}
                    <span style={{ fontSize: TYPE.caption, color: "var(--hk-sub)", fontFamily: SG }}>
                      ({preview.purchasesCount} bills, {fmtFull(preview.purchasesAmount)})
                    </span>
                  </Checkbox>
                  <Checkbox isSelected={include.receipts} onValueChange={(v) => setInclude({ ...include, receipts: v })}>
                    Receipts (Mila){" "}
                    <span style={{ fontSize: TYPE.caption, color: "var(--hk-sub)", fontFamily: SG }}>
                      ({preview.receiptsCount} payments, {fmtFull(preview.receiptsAmount)})
                    </span>
                  </Checkbox>
                  <Checkbox isSelected={include.payments} onValueChange={(v) => setInclude({ ...include, payments: v })}>
                    Payments out (Diya){" "}
                    <span style={{ fontSize: TYPE.caption, color: "var(--hk-sub)", fontFamily: SG }}>
                      ({preview.paymentsCount} payments, {fmtFull(preview.paymentsAmount)})
                    </span>
                  </Checkbox>
                  <Checkbox isSelected={include.ledgers} onValueChange={(v) => setInclude({ ...include, ledgers: v })}>
                    Party balances{" "}
                    <span style={{ fontSize: TYPE.caption, color: "var(--hk-sub)", fontFamily: SG }}>
                      ({preview.partiesCount} parties)
                    </span>
                  </Checkbox>
                  <Checkbox isSelected={include.journals} onValueChange={(v) => setInclude({ ...include, journals: v })}>
                    Manual journal entries{" "}
                    <span style={{ fontSize: TYPE.caption, color: "var(--hk-sub)", fontFamily: SG }}>
                      ({preview.journalsCount} entries)
                    </span>
                  </Checkbox>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <button onClick={() => setStep(1)} style={navBtnStyle}>← Wapas</button>
                  <GradientButton onClick={() => setStep(3)}>Aage Badho →</GradientButton>
                </div>
              </div>
            )}

            {step === 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG, margin: 0 }}>
                  Kaise bhejna hai?
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button onClick={() => handleExport("download")} disabled={exporting} style={exportBtnStyle(PU)}>
                    📥 Download .xml
                  </button>
                  <button onClick={() => handleExport("email")} disabled={exporting} style={exportBtnStyle(PU)}>
                    📧 Email to CA{caEmail && (
                      <span style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: SG, fontWeight: 400 }}>
                        ({caEmail})
                      </span>
                    )}
                  </button>
                  <button onClick={() => handleExport("whatsapp")} disabled={exporting} style={exportBtnStyle("#25D366")}>
                    💬 WhatsApp share
                  </button>
                </div>

                <div>
                  <button onClick={() => setStep(2)} style={navBtnStyle}>← Wapas</button>
                </div>
              </div>
            )}
          </HKCard>
        </div>
      </div>
    </>
  );
}
