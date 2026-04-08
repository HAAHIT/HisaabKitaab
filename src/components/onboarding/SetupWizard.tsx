"use client";

import { useMemo, useState } from "react";
import { Button, Card, CardBody, Input } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";

export const ONBOARDING_DISMISSED_KEY = "doorcraft-onboarding-dismissed";

type WizardStep = 0 | 1 | 2 | 3;
type TemplatePreset = "simple" | "detailed";

const SIMPLE_TEMPLATE_COLUMNS = [
  { id: "item", name: "Item", type: "text", position: 0 },
  { id: "amount", name: "Amount", type: "number", position: 1 },
] as const;

const DETAILED_TEMPLATE_COLUMNS = [
  { id: "item", name: "Item", type: "text", position: 0 },
  { id: "qty", name: "Qty", type: "number", position: 1 },
  { id: "rate", name: "Rate", type: "number", position: 2 },
  {
    id: "amount",
    name: "Amount",
    type: "formula",
    formula: "{qty} * {rate}",
    position: 3,
  },
] as const;

/**
 * Extracts an error message from an HTTP Response's JSON payload.
 *
 * @returns The value of the `error` field from the parsed JSON if present; otherwise `"Request failed"`.
 */
async function readError(response: Response) {
  const payload = await response.json().catch(() => null);
  return payload?.error || "Request failed";
}

interface SetupWizardProps {
  onComplete: () => void;
}

/**
 * Render a four-step onboarding wizard that collects optional business info,
 * lets the user choose a template preset, optionally creates a default customer,
 * and completes the initial setup flow.
 *
 * The component persists an onboarding-dismissed flag to localStorage when the
 * user skips or completes the wizard, and it performs API requests to save
 * provided settings, create the selected template, and optionally create a
 * customer when finishing setup.
 *
 * @param onComplete - Callback invoked when the wizard is dismissed or finished
 * @returns The onboarding wizard React element
 */
export function SetupWizard({ onComplete }: SetupWizardProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [step, setStep] = useState<WizardStep>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessGstin, setBusinessGstin] = useState("");
  const [templatePreset, setTemplatePreset] =
    useState<TemplatePreset>("simple");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const steps = useMemo(
    () => [
      t("onboarding.stepBusiness"),
      t("onboarding.stepTemplate"),
      t("onboarding.stepCustomer"),
      t("onboarding.stepDone"),
    ],
    [t]
  );

  function dismiss() {
    window.localStorage.setItem(ONBOARDING_DISMISSED_KEY, "1");
    onComplete();
  }

  async function finalizeSetup() {
    setSaving(true);
    setError(null);

    try {
      if (businessName.trim() || businessPhone.trim() || businessGstin.trim()) {
        const settingsResponse = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName: businessName.trim() || undefined,
            companyPhone: businessPhone.trim() || undefined,
            companyGstin: businessGstin.trim() || undefined,
          }),
        });

        if (!settingsResponse.ok) {
          throw new Error(await readError(settingsResponse));
        }
      }

      const templateResponse = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:
            templatePreset === "simple"
              ? t("onboarding.template.simple")
              : t("onboarding.template.detailed"),
          columns:
            templatePreset === "simple"
              ? SIMPLE_TEMPLATE_COLUMNS
              : DETAILED_TEMPLATE_COLUMNS,
        }),
      });

      if (!templateResponse.ok) {
        throw new Error(await readError(templateResponse));
      }

      if (customerName.trim()) {
        const partyResponse = await fetch("/api/parties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: customerName.trim(),
            phone: customerPhone.trim() || null,
            type: "CUSTOMER",
            openingBalance: 0,
          }),
        });

        if (!partyResponse.ok) {
          throw new Error(await readError(partyResponse));
        }
      }

      setStep(3);
      window.localStorage.setItem(ONBOARDING_DISMISSED_KEY, "1");
    } catch (setupError) {
      setError(
        setupError instanceof Error
          ? setupError.message
          : "Failed to finish setup"
      );
    } finally {
      setSaving(false);
    }
  }

  function goToBills() {
    onComplete();
    router.push("/bills/new");
  }

  return (
    <div className="mx-auto max-w-4xl animate-fade-in p-4 lg:p-8">
      <Card shadow="sm" className="overflow-hidden">
        <CardBody className="gap-6 p-0">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-6 text-white">
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-white/70">
              DoorCraft Pro
            </p>
            <h1 className="mt-2 text-3xl font-bold">{t("onboarding.title")}</h1>
            <p className="mt-2 text-sm text-white/80">{t("onboarding.subtitle")}</p>
          </div>

          <div className="px-6">
            <div className="grid gap-3 md:grid-cols-4">
              {steps.map((label, index) => (
                <div
                  key={label}
                  className={`rounded-2xl border px-4 py-3 text-sm transition ${
                    index === step
                      ? "border-primary bg-primary/10 text-primary"
                      : index < step
                        ? "border-success/30 bg-success/10 text-success-700"
                        : "border-divider bg-default-50 text-default-500"
                  }`}
                >
                  <p className="font-semibold">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="px-6 pb-6">
            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">{steps[0]}</h2>
                  <p className="mt-1 text-sm text-default-500">
                    {t("onboarding.businessPrompt")}
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label={t("company.businessName")}
                    value={businessName}
                    onValueChange={setBusinessName}
                    variant="bordered"
                  />
                  <Input
                    label={t("company.companyPhone")}
                    value={businessPhone}
                    onValueChange={setBusinessPhone}
                    variant="bordered"
                  />
                </div>
                <Input
                  label={t("company.gstin")}
                  value={businessGstin}
                  onValueChange={setBusinessGstin}
                  variant="bordered"
                />
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">{steps[1]}</h2>
                  <p className="mt-1 text-sm text-default-500">
                    {t("onboarding.templatePrompt")}
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {(["simple", "detailed"] as TemplatePreset[]).map((preset) => {
                    const isSelected = preset === templatePreset;
                    const hintKey =
                      preset === "simple"
                        ? "onboarding.template.simpleHint"
                        : "onboarding.template.detailedHint";
                    const titleKey =
                      preset === "simple"
                        ? "onboarding.template.simple"
                        : "onboarding.template.detailed";

                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setTemplatePreset(preset)}
                        className={`rounded-3xl border p-5 text-left transition ${
                          isSelected
                            ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                            : "border-divider hover:border-primary/40 hover:bg-default-50"
                        }`}
                      >
                        <p className="text-lg font-semibold">{t(titleKey as never)}</p>
                        <p className="mt-2 text-sm text-default-500">
                          {t(hintKey as never)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">{steps[2]}</h2>
                  <p className="mt-1 text-sm text-default-500">
                    {t("onboarding.customerPrompt")}
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label={t("onboarding.customerName")}
                    value={customerName}
                    onValueChange={setCustomerName}
                    variant="bordered"
                  />
                  <Input
                    label={t("onboarding.customerPhone")}
                    value={customerPhone}
                    onValueChange={setCustomerPhone}
                    variant="bordered"
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
                  <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M5 13l4 4L19 7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold">
                    {t("onboarding.completeTitle")}
                  </h2>
                  <p className="mt-2 text-sm text-default-500">
                    {t("onboarding.completeSubtitle")}
                  </p>
                </div>
              </div>
            )}

            {error && (
              <p className="mt-4 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </p>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="light" onPress={dismiss}>
                {t("onboarding.skip")}
              </Button>

              <div className="flex gap-3">
                {step > 0 && step < 3 && (
                  <Button variant="flat" onPress={() => setStep((current) => (current - 1) as WizardStep)}>
                    {t("onboarding.back")}
                  </Button>
                )}

                {step < 2 && (
                  <Button
                    color="primary"
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold"
                    onPress={() => setStep((current) => (current + 1) as WizardStep)}
                  >
                    {t("onboarding.next")}
                  </Button>
                )}

                {step === 2 && (
                  <Button
                    color="primary"
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold"
                    onPress={finalizeSetup}
                    isLoading={saving}
                  >
                    {t("onboarding.next")}
                  </Button>
                )}

                {step === 3 && (
                  <>
                    <Button variant="flat" onPress={onComplete}>
                      {t("onboarding.finish")}
                    </Button>
                    <Button
                      color="primary"
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold"
                      onPress={goToBills}
                    >
                      {t("onboarding.createBill")}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
