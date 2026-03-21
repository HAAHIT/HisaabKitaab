"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardBody,
  Button,
  Input,
  Textarea,
  Skeleton,
} from "@heroui/react";
import { useRouter } from "next/navigation";

export default function CompanySettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Form state
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyGstin, setCompanyGstin] = useState("");
  const [defaultTaxPercent, setDefaultTaxPercent] = useState("18");
  const [defaultTerms, setDefaultTerms] = useState("");
  const [billPrefix, setBillPrefix] = useState("BILL");

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(d => {
        if (d.settings) {
          setCompanyName(d.settings.companyName || "");
          setCompanyAddress(d.settings.companyAddress || "");
          setCompanyPhone(d.settings.companyPhone || "");
          setCompanyEmail(d.settings.companyEmail || "");
          setCompanyGstin(d.settings.companyGstin || "");
          setDefaultTaxPercent(String(d.settings.defaultTaxPercent || 0));
          setDefaultTerms(d.settings.defaultTerms || "");
          setBillPrefix(d.settings.billPrefix || "BILL");
        }
      })
      .catch(() => setToast({ message: "Failed to load settings", type: "error" }))
      .finally(() => setLoading(false));
  }, []);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        companyName,
        companyAddress,
        companyPhone,
        companyEmail,
        companyGstin,
        defaultTaxPercent: parseFloat(defaultTaxPercent) || 0,
        defaultTerms,
        billPrefix,
      };

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed");
      showToast("Settings updated successfully!", "success");
    } catch {
      showToast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-4 lg:p-8 max-w-4xl mx-auto"><Skeleton className="h-12 w-48 mb-6 rounded-lg" /><Skeleton className="h-96 w-full rounded-xl" /></div>;
  }

  return (
    <div className="p-4 lg:p-8 animate-fade-in max-w-4xl mx-auto">
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg animate-slide-up ${toast.type === "success" ? "bg-success text-white" : "bg-danger text-white"}`}>
          {toast.message}
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <Button isIconOnly variant="light" onPress={() => router.push("/dashboard")}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Company Profile</h1>
          <p className="text-default-500 text-sm mt-1">Manage business details and default preferences</p>
        </div>
      </div>

      <Card shadow="sm" className="mb-6">
        <CardBody className="p-6 md:p-8 space-y-8">
          {/* Basic Info */}
          <div>
            <h2 className="text-lg font-semibold mb-4 border-b border-divider pb-2">Business Details</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <Input label="Company Name" placeholder="DoorCraft Manufacturing" value={companyName} onValueChange={setCompanyName} variant="bordered" />
              <Input label="GSTIN" placeholder="e.g. 29ABCDE1234F1Z5" value={companyGstin} onValueChange={setCompanyGstin} variant="bordered" className="uppercase font-mono" />
              <Input label="Phone Number" placeholder="Contact number" value={companyPhone} onValueChange={setCompanyPhone} variant="bordered" />
              <Input label="Email Address" placeholder="Email" value={companyEmail} onValueChange={setCompanyEmail} variant="bordered" />
            </div>
            <div className="mt-4">
              <Textarea label="Registered Address" placeholder="Full address for invoices..." value={companyAddress} onValueChange={setCompanyAddress} variant="bordered" minRows={2} />
            </div>
          </div>

          {/* Billing Preferences */}
          <div>
            <h2 className="text-lg font-semibold mb-4 border-b border-divider pb-2">Billing Defaults</h2>
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <Input label="Bill Number Prefix" placeholder="e.g. BILL or INV" value={billPrefix} onValueChange={setBillPrefix} variant="bordered" description="Used as PREFIX-YYYYMM-NNN" />
              <Input label="Default Tax %" placeholder="0" type="number" value={defaultTaxPercent} onValueChange={setDefaultTaxPercent} variant="bordered" endContent={<span className="text-default-400">%</span>} />
            </div>
            <Textarea label="Default Terms & Conditions" placeholder="Standard terms, payment condition, warranties..." value={defaultTerms} onValueChange={setDefaultTerms} variant="bordered" minRows={3} />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-divider">
            <Button color="primary" className="bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold px-8" onPress={handleSave} isLoading={saving}>
              Save Changes
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
