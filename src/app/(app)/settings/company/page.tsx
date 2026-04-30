"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  Input,
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

async function readError(response: Response) {
  const data = await response.json().catch(() => null);
  return data?.error || "Request failed";
}

export default function CompanySettingsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

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
  const [taxRegistrationType, setTaxRegistrationType] =
    useState("REGISTERED");

  const revokeObjectUrl = useCallback((url: string | null) => {
    if (url?.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
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
    setPendingLogoFile(null);
    setLogoRemoved(false);
    setPendingLogoPreviewUrl((currentUrl) => {
      revokeObjectUrl(currentUrl);
      return null;
    });
  }, [revokeObjectUrl]);

  useEffect(() => {
    loadSettings()
      .catch(() =>
        setToast({ message: t("company.loadFailed"), type: "error" })
      )
      .finally(() => setLoading(false));
  }, [loadSettings, t]);

  useEffect(() => {
    return () => revokeObjectUrl(pendingLogoPreviewUrl);
  }, [pendingLogoPreviewUrl, revokeObjectUrl]);

  const businessTypeOptions = useMemo(
    () =>
      BUSINESS_TYPES.map((value) => ({
        value,
        label: t(`company.businessType.${value}` as never),
      })),
    [t]
  );

  const taxRegistrationOptions = useMemo(
    () =>
      TAX_REGISTRATION_TYPES.map((value) => ({
        value,
        label: t(`company.taxRegistration.${value}` as never),
      })),
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
        const deleteResponse = await fetch("/api/settings/logo", {
          method: "DELETE",
        });
        if (!deleteResponse.ok) {
          throw new Error(await readError(deleteResponse));
        }
      } else if (pendingLogoFile) {
        const formData = new FormData();
        formData.set("file", pendingLogoFile);

        const uploadResponse = await fetch("/api/settings/logo", {
          method: "POST",
          body: formData,
        });
        if (!uploadResponse.ok) {
          throw new Error(await readError(uploadResponse));
        }
      }

      const payload = {
        companyName,
        companyAddress,
        companyPhone,
        companyEmail,
        companyGstin,
        defaultTaxPercent,
        defaultTerms,
        billPrefix,
        upiId,
        businessType,
        taxRegistrationType,
      };

      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      await loadSettings();
      showToast(t("company.updated"), "success");
    } catch (error) {
      await loadSettings().catch(() => undefined);
      showToast(
        error instanceof Error ? error.message : t("company.saveFailed"),
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      showToast(t("company.logoMustImage"), "error");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast(t("company.logoMustSmall"), "error");
      return;
    }

    setPendingLogoFile(file);
    setLogoRemoved(false);
    setPendingLogoPreviewUrl((currentUrl) => {
      revokeObjectUrl(currentUrl);
      return URL.createObjectURL(file);
    });
  }

  function handleRemoveLogo() {
    setPendingLogoFile(null);
    setCompanyLogoUrl(null);
    setLogoRemoved(true);
    setPendingLogoPreviewUrl((currentUrl) => {
      revokeObjectUrl(currentUrl);
      return null;
    });
  }

  async function handleResetLocalData() {
    if (!confirm(t("company.resetConfirm"))) {
      return;
    }

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

  const displayedCompanyLogo = pendingLogoPreviewUrl || companyLogoUrl;

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-4 lg:p-8">
        <Skeleton className="mb-6 h-12 w-56 rounded-lg" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl animate-fade-in p-4 lg:p-8">
      {toast && (
        <div
          className={`fixed right-4 top-4 z-[100] rounded-xl px-4 py-3 shadow-lg animate-slide-up ${
            toast.type === "success" ? "bg-success text-white" : "bg-danger text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="mb-6 flex items-center gap-3">
        <Button
          isIconOnly
          variant="light"
          aria-label="Back to dashboard"
          onPress={() => router.push("/dashboard")}
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
          <h1 className="text-2xl font-bold">{t("settings.businessProfile")}</h1>
          <p className="mt-1 text-sm text-default-500">{t("company.subtitle")}</p>
        </div>
      </div>

      <Card shadow="sm" className="mb-6">
        <CardBody className="space-y-8 p-6 md:p-8">
          <section>
            <h2 className="mb-6 border-b border-divider pb-2 text-lg font-semibold">
              {t("company.businessDetails")}
            </h2>

            <div className="flex flex-col items-start gap-8 md:flex-row">
              <div className="flex flex-col items-center gap-3">
                <div
                  className={`flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-all ${
                    displayedCompanyLogo
                      ? "border-primary/50 bg-primary/5"
                      : "border-default-300 bg-default-50"
                  }`}
                >
                  {displayedCompanyLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={displayedCompanyLogo}
                      alt="Logo Preview"
                      className="h-full w-full object-contain p-2"
                    />
                  ) : (
                    <div className="p-4 text-center">
                      <svg
                        className="mx-auto h-8 w-8 text-default-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                        />
                      </svg>
                      <p className="mt-2 text-[10px] font-medium uppercase tracking-tighter text-default-400">
                        {t("company.businessLogo")}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    color="primary"
                    className="font-semibold"
                    onPress={() => document.getElementById("logo-input")?.click()}
                  >
                    {displayedCompanyLogo ? t("common.change") : t("common.upload")}
                  </Button>
                  {displayedCompanyLogo && (
                    <Button
                      size="sm"
                      variant="light"
                      color="danger"
                      isIconOnly
                      aria-label="Remove logo"
                      onPress={handleRemoveLogo}
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                        />
                      </svg>
                    </Button>
                  )}
                  <input
                    id="logo-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                </div>
              </div>

              <div className="w-full flex-1 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label={t("company.businessName")}
                    placeholder={t("company.companyNamePlaceholder")}
                    value={companyName}
                    onValueChange={setCompanyName}
                    variant="bordered"
                  />
                  <Select
                    label={t("company.businessType")}
                    selectedKeys={[businessType]}
                    onSelectionChange={(keys) => {
                      const nextValue = Array.from(keys)[0];
                      if (typeof nextValue === "string") {
                        setBusinessType(nextValue);
                      }
                    }}
                    variant="bordered"
                  >
                    {businessTypeOptions.map((option) => (
                      <SelectItem key={option.value}>{option.label}</SelectItem>
                    ))}
                  </Select>
                  <Input
                    label={t("company.companyPhone")}
                    placeholder={t("company.companyPhonePlaceholder")}
                    value={companyPhone}
                    onValueChange={setCompanyPhone}
                    variant="bordered"
                  />
                  <Input
                    label={t("company.companyEmail")}
                    placeholder={t("company.companyEmailPlaceholder")}
                    value={companyEmail}
                    onValueChange={setCompanyEmail}
                    variant="bordered"
                  />
                  <Input
                    label={t("company.gstin")}
                    placeholder="e.g. 29ABCDE1234F1Z5"
                    value={companyGstin}
                    onValueChange={setCompanyGstin}
                    variant="bordered"
                    className="font-mono uppercase"
                  />
                  <Select
                    label={t("company.taxRegistrationType")}
                    selectedKeys={[taxRegistrationType]}
                    onSelectionChange={(keys) => {
                      const nextValue = Array.from(keys)[0];
                      if (typeof nextValue === "string") {
                        setTaxRegistrationType(nextValue);
                      }
                    }}
                    variant="bordered"
                  >
                    {taxRegistrationOptions.map((option) => (
                      <SelectItem key={option.value}>{option.label}</SelectItem>
                    ))}
                  </Select>
                </div>

                <Textarea
                  label={t("company.registeredAddress")}
                  placeholder={t("company.registeredAddressPlaceholder")}
                  value={companyAddress}
                  onValueChange={setCompanyAddress}
                  variant="bordered"
                  minRows={3}
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-4 border-b border-divider pb-2 text-lg font-semibold">
              {t("settings.billingConfig")}
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label={t("company.billPrefix")}
                placeholder={t("company.billPrefixPlaceholder")}
                value={billPrefix}
                onValueChange={setBillPrefix}
                variant="bordered"
                description={t("company.billPrefixDescription")}
              />
              <Input
                label={t("company.defaultTax")}
                placeholder="0"
                type="number"
                value={defaultTaxPercent}
                onValueChange={setDefaultTaxPercent}
                variant="bordered"
                endContent={<span className="text-default-400">%</span>}
                description={t("bills.autoTaxNote")}
              />
              <Input
                label={t("company.upiId")}
                placeholder={t("company.upiIdPlaceholder")}
                description={t("company.upiIdDescription")}
                value={upiId}
                onValueChange={setUpiId}
                variant="bordered"
              />
              <div className="rounded-2xl border border-divider bg-default-50/80 p-4 text-sm text-default-500">
                <p className="font-medium text-default-700">
                  {t("company.taxRegistrationType")}
                </p>
                <p className="mt-1">
                  {taxRegistrationType === "REGISTERED"
                    ? t("company.taxRegistrationHelp.registered")
                    : t("company.taxRegistrationHelp.unregistered")}
                </p>
              </div>
            </div>

            <Textarea
              className="mt-4"
              label={t("company.defaultTerms")}
              placeholder={t("company.defaultTermsPlaceholder")}
              value={defaultTerms}
              onValueChange={setDefaultTerms}
              variant="bordered"
              minRows={3}
            />
          </section>

          <section>
            <h2 className="mb-4 border-b border-divider pb-2 text-lg font-semibold">
              Tally Integration
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-divider p-4 flex flex-col justify-between items-start gap-4">
                <div>
                  <h3 className="font-semibold">Tally ko Bhejo</h3>
                  <p className="text-sm text-default-500">Export vouchers and party balances to a Tally XML file for your CA.</p>
                </div>
                <Button variant="flat" color="primary" onPress={() => router.push("/settings/tally-export")}>
                  Start Export
                </Button>
              </div>
              <div className="rounded-2xl border border-divider p-4 flex flex-col justify-between items-start gap-4">
                <div>
                  <h3 className="font-semibold">Tally se Laao</h3>
                  <p className="text-sm text-default-500">Import historical vouchers and party balances from Tally into HisaabKitaab.</p>
                </div>
                <Button variant="flat" onPress={() => router.push("/settings/tally-import")}>
                  Start Import
                </Button>
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-3 border-t border-divider pt-4">
            <Button
              color="primary"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 font-semibold"
              onPress={handleSave}
              isLoading={saving}
            >
              {t("common.saveChanges")}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card shadow="sm" className="border-1 border-danger/20 bg-danger/5">
        <CardBody className="p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-danger">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
                {t("company.dangerZone")}
              </h3>
              <p className="mt-1 text-sm text-default-500">
                {t("company.dangerSubtitle")}
              </p>
            </div>
            <Button color="danger" variant="flat" onPress={handleResetLocalData}>
              {t("company.resetOfflineStorage")}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
