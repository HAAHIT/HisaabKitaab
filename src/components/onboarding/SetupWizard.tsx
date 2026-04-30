"use client";

import { useMemo, useState } from "react";
import { Button, Card, CardBody, Input, Select, SelectItem } from "@heroui/react";
import { useRouter } from "next/navigation";

// Indian states list
const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka",
  "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

const BUSINESS_TYPES = ["Retail", "Wholesale", "Manufacturing", "Service", "Other"];

type WizardStep = 0 | 1 | 2 | 3;

interface SetupWizardProps {
  onComplete: () => void;
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("Retail");
  const [stateName, setStateName] = useState("");
  const [city, setCity] = useState("");

  // Step 2
  const [gstin, setGstin] = useState("");

  const steps = ["Business", "GSTIN", "Import Data", "Done"];

  async function saveBusinessBasics() {
    if (!businessName.trim() || !stateName.trim()) {
      setError("Business Name aur State zaroori hai.");
      return false;
    }
    setError(null);
    setSaving(true);
    try {
      // Build address roughly from city and state
      const address = [city.trim(), stateName].filter(Boolean).join(", ");
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: businessName.trim(),
          companyAddress: address || undefined,
          businessType: businessType,
        }),
      });
      if (!res.ok) throw new Error("Failed to save business details.");
      setStep(1);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving data");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveGstinAndFinish() {
    setSaving(true);
    setError(null);
    try {
      // First save GSTIN
      if (gstin.trim()) {
        const resGst = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyGstin: gstin.trim(), taxRegistrationType: "REGISTERED" }),
        });
        if (!resGst.ok) throw new Error("Failed to save GSTIN.");
      }

      // Then mark onboarding complete
      const resFinish = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOnboardingComplete: true }),
      });
      if (!resFinish.ok) throw new Error("Failed to finalize setup.");

      setStep(2); // Go to Tally Hook
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error finalizing setup");
    } finally {
      setSaving(false);
    }
  }

  function handleSkipTally() {
    setStep(3); // Go to success
  }

  function handleGoToTally() {
    onComplete();
    router.push("/settings/tally-import");
  }

  function finishWizard() {
    onComplete();
    router.push("/dashboard");
  }

  return (
    <div className="mx-auto max-w-4xl animate-fade-in p-4 lg:p-8" style={{ minHeight: "100vh", display: "flex", alignItems: "center" }}>
      <Card shadow="sm" className="w-full overflow-hidden" style={{ borderRadius: 24, border: "1px solid var(--hk-border)", background: "var(--hk-card)" }}>
        <CardBody className="gap-0 p-0">
          <div style={{ background: "linear-gradient(135deg, #f76000, #7b5ef6)", padding: "40px", color: "white" }}>
            <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", opacity: 0.8, fontFamily: "var(--font-space-grotesk)" }}>
              DoorCraft Pro
            </p>
            <h1 style={{ marginTop: 8, fontSize: 36, fontWeight: 700, fontFamily: "var(--font-space-grotesk)", letterSpacing: "-1px" }}>
              Apna Karobaar Shuru Karo
            </h1>
            <p style={{ marginTop: 8, fontSize: 16, opacity: 0.9 }}>
              Welcome to HisaabKitaab. Let's get your shop set up in 2 minutes.
            </p>
          </div>

          <div className="px-6 py-4 border-b border-divider">
            <div className="flex gap-2">
              {steps.map((label, index) => (
                <div key={label} className="flex-1">
                  <div style={{
                    height: 6, borderRadius: 3, transition: "background 0.3s",
                    background: index <= step ? "linear-gradient(135deg, #f76000, #7b5ef6)" : "var(--hk-border)"
                  }} />
                  <p style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: index <= step ? "var(--hk-text)" : "var(--hk-sub)", fontFamily: "var(--font-inter)" }}>
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="p-8">
            {step === 0 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--font-space-grotesk)" }}>Basic Details</h2>
                  <p className="text-default-500 mt-1">What does your business do?</p>
                </div>
                
                <div className="grid gap-6 md:grid-cols-2">
                  <Input
                    label="Business ka naam *"
                    placeholder="E.g. Sharma Traders"
                    value={businessName}
                    onValueChange={setBusinessName}
                    variant="bordered"
                    size="lg"
                  />
                  <Select
                    label="Business kya karta hai?"
                    selectedKeys={[businessType]}
                    onSelectionChange={(k) => setBusinessType(Array.from(k)[0] as string)}
                    variant="bordered"
                    size="lg"
                  >
                    {BUSINESS_TYPES.map(t => <SelectItem key={t}>{t}</SelectItem>)}
                  </Select>
                  <Select
                    label="State *"
                    selectedKeys={stateName ? [stateName] : []}
                    onSelectionChange={(k) => setStateName(Array.from(k)[0] as string)}
                    variant="bordered"
                    size="lg"
                  >
                    {INDIAN_STATES.map(s => <SelectItem key={s}>{s}</SelectItem>)}
                  </Select>
                  <Input
                    label="City"
                    placeholder="E.g. Mumbai"
                    value={city}
                    onValueChange={setCity}
                    variant="bordered"
                    size="lg"
                  />
                </div>

                {error && <p className="text-danger text-sm">{error}</p>}

                <div className="flex justify-end pt-4 border-t border-divider">
                  <Button 
                    className="px-8 font-semibold text-white" 
                    style={{ background: "linear-gradient(135deg, #f76000, #7b5ef6)", borderRadius: 12 }}
                    onPress={saveBusinessBasics}
                    isLoading={saving}
                  >
                    Aage Badho →
                  </Button>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--font-space-grotesk)" }}>GSTIN Details</h2>
                  <p className="text-default-500 mt-1">Optional, but highly recommended for B2B billing.</p>
                </div>
                
                <div className="max-w-md">
                  <Input
                    label="GSTIN Number"
                    placeholder="E.g. 27AAAAA0000A1Z5"
                    value={gstin}
                    onValueChange={setGstin}
                    variant="bordered"
                    size="lg"
                    description="Don't have it handy? You can skip this and add it later in settings."
                  />
                </div>

                {error && <p className="text-danger text-sm">{error}</p>}

                <div className="flex justify-between pt-4 border-t border-divider">
                  <Button variant="light" onPress={() => setStep(0)} isDisabled={saving}>← Peeche</Button>
                  <div className="flex gap-3">
                    <Button variant="flat" onPress={() => { setGstin(""); saveGstinAndFinish(); }} isDisabled={saving}>
                      Skip Kar Do
                    </Button>
                    <Button 
                      className="px-8 font-semibold text-white" 
                      style={{ background: "linear-gradient(135deg, #f76000, #7b5ef6)", borderRadius: 12 }}
                      onPress={saveGstinAndFinish}
                      isLoading={saving}
                    >
                      Save & Next →
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-fade-in text-center py-8">
                <span style={{ fontSize: 64 }}>📥</span>
                <h2 style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-space-grotesk)", marginTop: 16 }}>
                  Already using Tally?
                </h2>
                <p className="text-default-500 max-w-md mx-auto">
                  You can securely import all your existing vouchers and party ledgers directly from your Tally XML export.
                </p>

                <div className="flex justify-center gap-4 mt-8">
                  <Button variant="flat" size="lg" className="px-8 font-semibold" onPress={handleSkipTally}>
                    Skip for now
                  </Button>
                  <Button 
                    size="lg"
                    className="px-8 font-semibold text-white shadow-lg" 
                    style={{ background: "linear-gradient(135deg, #f76000, #7b5ef6)", borderRadius: 12 }}
                    onPress={handleGoToTally}
                  >
                    Tally se Laao →
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 animate-fade-in text-center py-8">
                <span style={{ fontSize: 64 }}>🎉</span>
                <h2 style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-space-grotesk)", marginTop: 16 }}>
                  Sab Set Hai!
                </h2>
                <p className="text-default-500 max-w-md mx-auto">
                  Your business is now set up and ready to go. You can start creating bills immediately.
                </p>

                <div className="flex justify-center mt-8">
                  <Button 
                    size="lg"
                    className="px-12 font-bold text-white shadow-lg" 
                    style={{ background: "linear-gradient(135deg, #7b5ef6, #f76000)", borderRadius: 12, height: 56, fontSize: 18 }}
                    onPress={finishWizard}
                  >
                    Dashboard Pe Jao
                  </Button>
                </div>
              </div>
            )}

          </div>
        </CardBody>
      </Card>
    </div>
  );
}
