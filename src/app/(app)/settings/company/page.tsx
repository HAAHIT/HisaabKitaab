"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectItem,
  Skeleton,
  Textarea,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  BUSINESS_TYPES,
  TAX_REGISTRATION_TYPES,
} from "@/lib/tenant-settings";
import {
  OR, PU, GR, SG, TYPE,
  HKCard, HKToast, PageHeader, useIsMobile,
} from "@/components/ui/hk-design";
import { HKButton } from "@/components/ui/HKButton";
import { HKInput } from "@/components/ui/HKInput";

async function readError(response: Response) {
  const data = await response.json().catch(() => null);
  return data?.error || "Request failed";
}

export default function CompanySettingsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyGstin, setCompanyGstin] = useState("");
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [pendingLogoPreviewUrl, setPendingLogoPreviewUrl] = useState<string | null>(null);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const [defaultTaxPercent, setDefaultTaxPercent] = useState("18");
  const [defaultTerms, setDefaultTerms] = useState("");
  const [billPrefix, setBillPrefix] = useState("BILL");
  const [upiId, setUpiId] = useState("");
  const [businessType, setBusinessType] = useState("INDIVIDUAL");
  const [taxRegistrationType, setTaxRegistrationType] = useState("REGISTERED");
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [bankIfscCode, setBankIfscCode] = useState("");

  const revokeObjectUrl = useCallback((url: string | null) => {
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
  }, []);

  const loadSettings = useCallback(async () => {
    const response = await fetch("/api/settings");
    const payload = await response.json().catch(() => ({ settings: null }));
    const settings = payload.settings;

    setCompanyName(settings?.companyName || "");
    setCompanyAddress(settings?.companyAddress || "");
    setCompanyPhone(settings?.companyPhone || "");
    setCompanyEmail(settings?.companyEmail || "");
    setCompanyGstin(settings?.companyGstin || "");
    setCompanyLogoUrl(settings?.companyLogo || settings?.companyLogoUrl || null);
    setDefaultTaxPercent(String(settings?.defaultTaxPercent ?? 18));
    setDefaultTerms(settings?.defaultTerms || "");
    setBillPrefix(settings?.billPrefix || "BILL");
    setUpiId(settings?.upiId || "");
    setBusinessType(settings?.businessType || "INDIVIDUAL");
    setTaxRegistrationType(settings?.taxRegistrationType || "REGISTERED");
    setBankName(settings?.bankName || "");
    setBankAccountNumber(settings?.bankAccountNumber || "");
    setBankBranch(settings?.bankBranch || "");
    setBankIfscCode(settings?.bankIfscCode || "");
    setPendingLogoFile(null);
    setLogoRemoved(false);
    setPendingLogoPreviewUrl((url) => { revokeObjectUrl(url); return null; });
  }, [revokeObjectUrl]);

  useEffect(() => {
    loadSettings()
      .catch(() => setToast({ message: t("company.loadFailed"), type: "error" }))
      .finally(() => setLoading(false));
  }, [loadSettings, t]);

  useEffect(() => {
    return () => revokeObjectUrl(pendingLogoPreviewUrl);
  }, [pendingLogoPreviewUrl, revokeObjectUrl]);

  const businessTypeOptions = useMemo(
    () => BUSINESS_TYPES.map((value) => ({ value, label: t(`company.businessType.${value}` as never) })),
    [t]
  );

  const taxRegistrationOptions = useMemo(
    () => TAX_REGISTRATION_TYPES.map((value) => ({ value, label: t(`company.taxRegistration.${value}` as never) })),
    [t]
  );

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (logoRemoved) {
        const r = await fetch("/api/settings/logo", { method: "DELETE" });
        if (!r.ok) throw new Error(await readError(r));
      } else if (pendingLogoFile) {
        const formData = new FormData();
        formData.set("file", pendingLogoFile);
        const r = await fetch("/api/settings/logo", { method: "POST", body: formData });
        if (!r.ok) throw new Error(await readError(r));
      }

      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, companyAddress, companyPhone, companyEmail, companyGstin, defaultTaxPercent, defaultTerms, billPrefix, upiId, businessType, taxRegistrationType, bankName, bankAccountNumber, bankBranch, bankIfscCode }),
      });
      if (!response.ok) throw new Error(await readError(response));

      await loadSettings();
      showToast(t("company.updated"), "success");
    } catch (error) {
      await loadSettings().catch(() => undefined);
      showToast(error instanceof Error ? error.message : t("company.saveFailed"), "error");
    } finally {
      setSaving(false);
    }
  }

  function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { showToast(t("company.logoMustImage"), "error"); return; }
    if (file.size > 2 * 1024 * 1024) { showToast(t("company.logoMustSmall"), "error"); return; }
    setPendingLogoFile(file);
    setLogoRemoved(false);
    setPendingLogoPreviewUrl((url) => { revokeObjectUrl(url); return URL.createObjectURL(file); });
  }

  function handleRemoveLogo() {
    setPendingLogoFile(null);
    setCompanyLogoUrl(null);
    setLogoRemoved(true);
    setPendingLogoPreviewUrl((url) => { revokeObjectUrl(url); return null; });
  }

  async function handleResetLocalData() {
    if (!confirm(t("company.resetConfirm"))) return;
    try {
      await Promise.all([
        db.measurementDrafts.clear(),
        db.table("measurements").clear(),
        db.table("parties").clear(),
        db.table("bills").clear(),
        db.table("payments").clear(),
        db.table("templates").clear(),
      ]);
      showToast(t("company.localCleared"), "success");
      window.setTimeout(() => window.location.reload(), 1000);
    } catch {
      showToast(t("company.localClearFailed"), "error");
    }
  }

  async function handleWipeCloudData() {
    if (!confirm("SACH MEIN? Yeh sab cloud data delete kar dega — journals, parties, bills, payments, imports. Yeh undo nahi hoga!")) return;
    if (!confirm("Last chance: ALL cloud data will be permanently deleted. Continue?")) return;
    try {
      const res = await fetch("/api/admin/wipe-data", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Wipe failed");
      showToast("All cloud data wiped successfully.", "success");
      window.setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Wipe failed", "error");
    }
  }

  const displayedCompanyLogo = pendingLogoPreviewUrl || companyLogoUrl;

  if (loading) {
    return (
      <div style={{ padding: "20px 28px" }}>
        <Skeleton className="h-12 w-56 rounded-2xl" style={{ marginBottom: 24 }} />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: TYPE.h2, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG,
    marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid var(--hk-border)",
  };

  return (
    <div style={{ background: "var(--hk-bg)", minHeight: "100%", fontFamily: SG }}>
      {toast && <HKToast message={toast.message} type={toast.type} />}

      <PageHeader
        title={t("settings.businessProfile")}
        subtitle={t("company.subtitle")}
        isMobile={isMobile}
      />

      <div style={{ padding: isMobile ? "0 14px 80px" : "0 28px 80px", maxWidth: 900, margin: "0 auto" }}>
        {/* Business Details */}
        <HKCard style={{ marginBottom: 16 }}>
          <p style={sectionTitleStyle}>{t("company.businessDetails")}</p>

          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 32, alignItems: "flex-start" }}>
            {/* Logo upload */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <div
                style={{
                  width: 120, height: 120, borderRadius: 16,
                  border: `2px dashed ${displayedCompanyLogo ? PU + "60" : "var(--hk-border)"}`,
                  background: displayedCompanyLogo ? PU + "05" : "var(--hk-bg)",
                  display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
                }}
              >
                {displayedCompanyLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={displayedCompanyLogo} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8 }} />
                ) : (
                  <div style={{ textAlign: "center", padding: 16 }}>
                    <svg width="32" height="32" fill="none" stroke="var(--hk-border)" viewBox="0 0 24 24">
                      <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
                    </svg>
                    <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--hk-sub)", marginTop: 6, fontFamily: SG }}>
                      {t("company.businessLogo")}
                    </p>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => document.getElementById("logo-input")?.click()}
                  style={{
                    padding: "8px 14px", borderRadius: 10, background: PU + "12", border: `1px solid ${PU}33`,
                    color: PU, fontFamily: SG, fontSize: TYPE.bodySmall, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  {displayedCompanyLogo ? t("common.change") : t("common.upload")}
                </button>
                {displayedCompanyLogo && (
                  <button
                    onClick={handleRemoveLogo}
                    aria-label="Remove logo"
                    style={{
                      width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                      background: OR + "12", border: `1px solid ${OR}33`, cursor: "pointer", color: OR,
                    }}
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                    </svg>
                  </button>
                )}
              </div>
              <input id="logo-input" type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogoUpload} />
            </div>

            {/* Business fields */}
            <div style={{ flex: 1, width: "100%" }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <HKInput label={t("company.businessName")} placeholder={t("company.companyNamePlaceholder")} value={companyName} onValueChange={setCompanyName} />
                <Select label={t("company.businessType")} selectedKeys={[businessType]} onSelectionChange={(keys) => { const v = Array.from(keys)[0]; if (typeof v === "string") setBusinessType(v); }} variant="bordered">
                  {businessTypeOptions.map((o) => <SelectItem key={o.value}>{o.label}</SelectItem>)}
                </Select>
                <HKInput label={t("company.companyPhone")} placeholder={t("company.companyPhonePlaceholder")} value={companyPhone} onValueChange={setCompanyPhone} />
                <HKInput label={t("company.companyEmail")} placeholder={t("company.companyEmailPlaceholder")} value={companyEmail} onValueChange={setCompanyEmail} />
                <HKInput label={t("company.gstin")} placeholder="e.g. 29ABCDE1234F1Z5" value={companyGstin} onValueChange={setCompanyGstin} classNames={{ input: "uppercase" }} />
                <Select label={t("company.taxRegistrationType")} selectedKeys={[taxRegistrationType]} onSelectionChange={(keys) => { const v = Array.from(keys)[0]; if (typeof v === "string") setTaxRegistrationType(v); }} variant="bordered">
                  {taxRegistrationOptions.map((o) => <SelectItem key={o.value}>{o.label}</SelectItem>)}
                </Select>
              </div>
              <Textarea label={t("company.registeredAddress")} placeholder={t("company.registeredAddressPlaceholder")} value={companyAddress} onValueChange={setCompanyAddress} variant="bordered" minRows={3} />
            </div>
          </div>
        </HKCard>

        {/* Billing Config */}
        <HKCard style={{ marginBottom: 16 }}>
          <p style={sectionTitleStyle}>{t("settings.billingConfig")}</p>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <HKInput label={t("company.billPrefix")} placeholder={t("company.billPrefixPlaceholder")} value={billPrefix} onValueChange={setBillPrefix} description={t("company.billPrefixDescription")} />
            <HKInput label={t("company.defaultTax")} placeholder="0" type="number" value={defaultTaxPercent} onValueChange={setDefaultTaxPercent} endContent={<span className="text-default-400">%</span>} description={t("bills.autoTaxNote")} />
            <div
              style={{
                borderRadius: 12, border: "1px solid var(--hk-border)", background: "var(--hk-bg)",
                padding: "14px 16px", fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: SG,
              }}
            >
              <p style={{ fontWeight: 700, color: "var(--hk-text)", marginBottom: 4 }}>{t("company.taxRegistrationType")}</p>
              {taxRegistrationType === "REGISTERED" ? t("company.taxRegistrationHelp.registered") : t("company.taxRegistrationHelp.unregistered")}
            </div>
          </div>
          <Textarea label={t("company.defaultTerms")} placeholder={t("company.defaultTermsPlaceholder")} value={defaultTerms} onValueChange={setDefaultTerms} variant="bordered" minRows={3} />
        </HKCard>

        {/* Bank Account */}
        <HKCard style={{ marginBottom: 16 }}>
          <p style={sectionTitleStyle}>Bank Account Details</p>
          <p style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: SG, marginBottom: 16, marginTop: -12 }}>
            Shown on every invoice footer. Helps customers pay via NEFT / IMPS.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
            <HKInput label="Bank Name" placeholder="e.g. HDFC Bank" value={bankName} onValueChange={setBankName} />
            <HKInput label="Account Number" placeholder="e.g. 50100123456789" value={bankAccountNumber} onValueChange={setBankAccountNumber} classNames={{ input: "font-mono" }} />
            <HKInput label="Branch" placeholder="e.g. Andheri West, Mumbai" value={bankBranch} onValueChange={setBankBranch} />
            <HKInput label="IFSC Code" placeholder="e.g. HDFC0001234" value={bankIfscCode} onValueChange={(v) => setBankIfscCode(v.toUpperCase())} classNames={{ input: "font-mono uppercase" }} />
            <HKInput label={t("company.upiId")} placeholder={t("company.upiIdPlaceholder")} description={t("company.upiIdDescription")} value={upiId} onValueChange={setUpiId} />
          </div>
        </HKCard>

        {/* Tally Integration */}
        <HKCard style={{ marginBottom: 16 }}>
          <p style={sectionTitleStyle}>Tally Integration</p>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
            <div
              style={{
                borderRadius: 14, border: "1px solid var(--hk-border)", padding: "18px 20px",
                display: "flex", flexDirection: "column", gap: 12,
              }}
            >
              <div>
                <p style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG, marginBottom: 6 }}>Tally ko Bhejo</p>
                <p style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: SG }}>Export vouchers and party balances to a Tally XML file for your CA.</p>
              </div>
              <button
                onClick={() => router.push("/settings/tally-export")}
                style={{
                  padding: "10px 18px", borderRadius: 10, background: PU + "12", border: `1px solid ${PU}33`,
                  color: PU, fontFamily: SG, fontSize: TYPE.bodySmall, fontWeight: 700, cursor: "pointer", alignSelf: "flex-start",
                }}
              >
                Start Export
              </button>
            </div>
            <div
              style={{
                borderRadius: 14, border: "1px solid var(--hk-border)", padding: "18px 20px",
                display: "flex", flexDirection: "column", gap: 12,
              }}
            >
              <div>
                <p style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG, marginBottom: 6 }}>Tally se Laao</p>
                <p style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: SG }}>Import historical vouchers and party balances from Tally into HisaabKitaab.</p>
              </div>
              <button
                onClick={() => router.push("/settings/tally-import")}
                style={{
                  padding: "10px 18px", borderRadius: 10, background: "var(--hk-badge)", border: "1px solid var(--hk-border)",
                  color: "var(--hk-text)", fontFamily: SG, fontSize: TYPE.bodySmall, fontWeight: 700, cursor: "pointer", alignSelf: "flex-start",
                }}
              >
                Start Import
              </button>
            </div>
          </div>
        </HKCard>

        {/* Save */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
          <HKButton onClick={handleSave} isLoading={saving}>{t("common.saveChanges")}</HKButton>
        </div>

        {/* Danger Zone */}
        <div
          style={{
            borderRadius: 20, border: `1px solid ${OR}33`, background: OR + "05",
            padding: "20px 24px", display: "flex", flexDirection: isMobile ? "column" : "row",
            justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", gap: 16,
          }}
        >
          <div>
            <p style={{ fontSize: TYPE.body, fontWeight: 700, color: OR, fontFamily: SG, display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
              {t("company.dangerZone")}
            </p>
            <p style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: SG }}>{t("company.dangerSubtitle")}</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button
              onClick={handleResetLocalData}
              style={{
                padding: "10px 18px", borderRadius: 12, background: OR + "12", border: `1px solid ${OR}44`,
                color: OR, fontFamily: SG, fontSize: TYPE.bodySmall, fontWeight: 700, cursor: "pointer",
              }}
            >
              {t("company.resetOfflineStorage")}
            </button>
            {process.env.NEXT_PUBLIC_FEATURE_TESTING_WIPE_DATA === "true" && (
              <button
                onClick={handleWipeCloudData}
                style={{
                  padding: "10px 18px", borderRadius: 12, background: "#ff000020", border: "1px solid #ff000055",
                  color: "#cc0000", fontFamily: SG, fontSize: TYPE.bodySmall, fontWeight: 700, cursor: "pointer",
                }}
              >
                Wipe All Cloud Data (Testing)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
