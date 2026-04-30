"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  Checkbox,
  Radio,
  RadioGroup,
  Input,
} from "@heroui/react";
import { useRouter } from "next/navigation";

export default function TallyExportPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Step 1: Date Range
  const [periodType, setPeriodType] = useState("year"); // month, quarter, year, custom
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Step 2: Include Options
  const [include, setInclude] = useState({
    sales: true,
    purchases: true,
    receipts: true,
    payments: true,
    ledgers: true,
    journals: false,
  });

  const [preview, setPreview] = useState<{
    salesCount: number; salesAmount: number;
    purchasesCount: number; purchasesAmount: number;
    receiptsCount: number; receiptsAmount: number;
    paymentsCount: number; paymentsAmount: number;
    journalsCount: number;
    partiesCount: number;
    unbalancedCount: number;
  } | null>(null);

  const [caEmail, setCaEmail] = useState("");

  useEffect(() => {
    // Determine default dates based on financial year
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-11
    const currentYear = today.getFullYear();
    
    // FY is April 1 to March 31
    const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
    const fyEndYear = fyStartYear + 1;
    
    if (!customFrom) setCustomFrom(`${fyStartYear}-04-01`);
    if (!customTo) setCustomTo(`${fyEndYear}-03-31`);

    // Fetch CA Email from company profile
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data?.settings?.caEmail) setCaEmail(data.settings.caEmail);
      })
      .catch(() => {});
  }, []);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  const getDateRange = () => {
    let from = customFrom;
    let to = customTo;
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    if (periodType === "month") {
      from = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;
      to = new Date(currentYear, currentMonth + 1, 0).toISOString().split("T")[0];
    } else if (periodType === "quarter") {
      const q = Math.floor(currentMonth / 3);
      from = `${currentYear}-${String(q * 3 + 1).padStart(2, "0")}-01`;
      to = new Date(currentYear, q * 3 + 3, 0).toISOString().split("T")[0];
    } else if (periodType === "year") {
      const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
      from = `${fyStartYear}-04-01`;
      to = `${fyStartYear + 1}-03-31`;
    }
    return { from, to };
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
        return; // Don't proceed to step 2
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
        a.href = url;
        a.download = `HisaabKitaab-${from}-to-${to}.xml`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showToast("Ho gaya ✓ — File CA ko bhej do", "success");
      } else if (method === "whatsapp") {
        // Just triggering download for now since we don't have public URLs for files yet
        const a = document.createElement("a");
        a.href = url;
        a.download = `HisaabKitaab-${from}-to-${to}.xml`;
        a.click();
        
        const msg = encodeURIComponent(`Namaste — yeh HisaabKitaab ka Tally file hai for ${from} to ${to}.`);
        window.open(`https://wa.me/?text=${msg}`, "_blank");
        showToast("Downloaded for WhatsApp", "success");
      } else if (method === "email") {
        const a = document.createElement("a");
        a.href = url;
        a.download = `HisaabKitaab-${from}-to-${to}.xml`;
        a.click();

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

  const fmt = (num: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(num);

  return (
    <div className="mx-auto max-w-3xl animate-fade-in p-4 lg:p-8">
      {toast && (
        <div className={`fixed right-4 top-4 z-[100] rounded-xl px-4 py-3 shadow-lg animate-slide-up ${toast.type === "success" ? "bg-success text-white" : "bg-danger text-white"}`}>
          {toast.message}
        </div>
      )}

      <div className="mb-6 flex items-center gap-3">
        <Button isIconOnly variant="light" onPress={() => router.push("/settings/company")}>
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} /></svg>
        </Button>
        <div>
          <h1 className="text-2xl font-bold font-sg">Tally ko Bhejo</h1>
          <p className="mt-1 text-sm text-default-500 font-sg">Send your books directly to your CA in Tally format.</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {[1, 2, 3].map(i => (
          <div key={i} className={`h-2 flex-1 rounded-full ${step >= i ? "bg-primary" : "bg-default-200"}`} />
        ))}
      </div>

      <Card shadow="sm">
        <CardBody className="p-6 md:p-8">
          
          {step === 1 && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-xl font-bold font-sg">Kaunsa period?</h2>
              
              <RadioGroup value={periodType} onValueChange={setPeriodType}>
                <Radio value="month">Is mahine</Radio>
                <Radio value="quarter">Is quarter</Radio>
                <Radio value="year">Is saal (Financial Year)</Radio>
                <Radio value="custom">Custom dates</Radio>
              </RadioGroup>

              {periodType === "custom" && (
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <Input type="date" label="From" value={customFrom} onValueChange={setCustomFrom} variant="bordered" />
                  <Input type="date" label="To" value={customTo} onValueChange={setCustomTo} variant="bordered" />
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button color="primary" className="font-semibold px-8" onPress={handleFetchPreview} isLoading={loading}>
                  Aage Badho →
                </Button>
              </div>
            </div>
          )}

          {step === 2 && preview && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-xl font-bold font-sg">Kya kya include karna hai?</h2>
              
              <div className="space-y-4">
                <Checkbox isSelected={include.sales} onValueChange={(v) => setInclude({...include, sales: v})}>
                  Sales bills <span className="text-default-500 text-sm ml-1">({preview.salesCount} bills, {fmt(preview.salesAmount)})</span>
                </Checkbox>
                <Checkbox isSelected={include.purchases} onValueChange={(v) => setInclude({...include, purchases: v})}>
                  Purchase bills <span className="text-default-500 text-sm ml-1">({preview.purchasesCount} bills, {fmt(preview.purchasesAmount)})</span>
                </Checkbox>
                <Checkbox isSelected={include.receipts} onValueChange={(v) => setInclude({...include, receipts: v})}>
                  Receipts (Mila) <span className="text-default-500 text-sm ml-1">({preview.receiptsCount} payments, {fmt(preview.receiptsAmount)})</span>
                </Checkbox>
                <Checkbox isSelected={include.payments} onValueChange={(v) => setInclude({...include, payments: v})}>
                  Payments out (Diya) <span className="text-default-500 text-sm ml-1">({preview.paymentsCount} payments, {fmt(preview.paymentsAmount)})</span>
                </Checkbox>
                <Checkbox isSelected={include.ledgers} onValueChange={(v) => setInclude({...include, ledgers: v})}>
                  Party balances <span className="text-default-500 text-sm ml-1">({preview.partiesCount} parties)</span>
                </Checkbox>
                <Checkbox isSelected={include.journals} onValueChange={(v) => setInclude({...include, journals: v})}>
                  Manual journal entries <span className="text-default-500 text-sm ml-1">({preview.journalsCount} entries)</span>
                </Checkbox>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="flat" onPress={() => setStep(1)}>← Wapas</Button>
                <Button color="primary" className="font-semibold px-8" onPress={() => setStep(3)}>Aage Badho →</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-xl font-bold font-sg">Kaise bhejna hai?</h2>
              
              <div className="grid grid-cols-1 gap-4">
                <Button 
                  size="lg" 
                  color="primary" 
                  variant="flat" 
                  className="justify-start px-6 font-semibold"
                  onPress={() => handleExport("download")}
                  isLoading={exporting}
                >
                  📥 Download .xml
                </Button>
                
                <Button 
                  size="lg" 
                  color="primary" 
                  variant="flat" 
                  className="justify-start px-6 font-semibold"
                  onPress={() => handleExport("email")}
                  isLoading={exporting}
                >
                  📧 Email to CA {caEmail && <span className="font-normal text-sm opacity-80">({caEmail})</span>}
                </Button>

                <Button 
                  size="lg" 
                  className="justify-start px-6 font-semibold bg-[#25D366]/10 text-[#25D366]"
                  onPress={() => handleExport("whatsapp")}
                  isLoading={exporting}
                >
                  💬 WhatsApp share
                </Button>
              </div>

              <div className="flex justify-start pt-4">
                <Button variant="light" onPress={() => setStep(2)}>← Wapas</Button>
              </div>
            </div>
          )}

        </CardBody>
      </Card>
    </div>
  );
}
