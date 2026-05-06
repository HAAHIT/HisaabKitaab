"use client";

import { useState, Suspense } from "react";
import {
  Button,
  Card,
  CardBody,
} from "@heroui/react";
import { useRouter, useSearchParams } from "next/navigation";

function TallyImportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/dashboard";

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importJobId, setImportJobId] = useState<string | null>(null);
  
  const [preview, setPreview] = useState<{
    vouchersCount: number;
    partiesCount: number;
    salesCount: number;
    purchasesCount: number;
    receiptsCount: number;
    paymentsCount: number;
    journalsCount: number;
    parseErrors: string[];
  } | null>(null);

  const [jobProgress, setJobProgress] = useState({ processed: 0, total: 0, status: "", failed: 0 });
  const [importResult, setImportResult] = useState<{
    imported: number; skipped: number; partiesCreated: number; failed: number; parseErrors: string[]; importErrors: string[];
  } | null>(null);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  const handleFetchPreview = async () => {
    if (!importFile) return;
    setLoading(true);
    try {
      const body = new FormData();
      body.append("file", importFile);
      const res = await fetch("/api/import/tally-xml/preview", {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview fetch failed");
      
      setPreview(data);
      setStep(2);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load preview", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setStep(3); // Importing step
    
    try {
      const body = new FormData();
      body.append("file", importFile);
      const res = await fetch("/api/import/tally-xml", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      
      if (data.jobId) {
        setImportJobId(data.jobId);
        setJobProgress({ processed: 0, total: preview?.vouchersCount || 0, status: "PENDING", failed: 0 });
        pollStatus(data.jobId);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Import failed", "error");
      setStep(2); // Revert to preview
      setImporting(false);
    }
  };

  const pollStatus = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/import/status/${jobId}`);
        if (!res.ok) throw new Error("Failed to fetch job status");
        const data = await res.json();

        setJobProgress({
          processed: data.processed,
          total: data.totalItems,
          status: data.status,
          failed: data.failed,
        });

        if (data.status === "COMPLETED" || data.status === "FAILED") {
          clearInterval(interval);
          setImporting(false);
          setImportJobId(null);

          if (data.status === "COMPLETED") {
            setImportResult({
              partiesCreated: 0, // Simplified for now
              imported: data.processed, 
              skipped: 0,
              failed: data.failed,
              parseErrors: preview?.parseErrors || [],
              importErrors: [],
            });
            setStep(4);
          } else {
            showToast(data.error || "Job failed in background", "error");
            setStep(2);
          }
        }
      } catch {
        // poll will retry on next tick
      }
    }, 2000);
  };

  return (
    <div className="mx-auto max-w-3xl animate-fade-in p-4 lg:p-8">
      {toast && (
        <div className={`fixed right-4 top-4 z-[100] rounded-xl px-4 py-3 shadow-lg animate-slide-up ${toast.type === "success" ? "bg-success text-white" : "bg-danger text-white"}`}>
          {toast.message}
        </div>
      )}

      <div className="mb-6 flex items-center gap-3">
        <Button isIconOnly variant="light" onPress={() => router.push(returnTo)}>
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} /></svg>
        </Button>
        <div>
          <h1 className="text-2xl font-bold font-sg">Tally se Laao</h1>
          <p className="mt-1 text-sm text-default-500 font-sg">Import historical vouchers and masters from Tally into HisaabKitaab.</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={`h-2 flex-1 rounded-full ${step >= i ? "bg-primary" : "bg-default-200"}`} />
        ))}
      </div>

      <Card shadow="sm">
        <CardBody className="p-6 md:p-8">
          
          {step === 1 && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-xl font-bold font-sg">XML file choose karo</h2>
              
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-default-300 rounded-xl p-10 bg-default-50">
                <span className="text-4xl mb-4">📄</span>
                <input
                  type="file"
                  accept=".xml,text/xml,application/xml"
                  className="w-full max-w-xs cursor-pointer rounded-xl border border-default-200 bg-white px-3 py-2 text-sm file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-sm file:font-medium file:text-primary"
                  onChange={(e) => {
                    setImportFile(e.target.files?.[0] ?? null);
                  }}
                />
                <p className="mt-4 text-sm text-default-500">Only Tally XML files up to 5MB.</p>
              </div>

              <div className="flex justify-end pt-4">
                <Button color="primary" className="font-semibold px-8" onPress={handleFetchPreview} isLoading={loading} isDisabled={!importFile}>
                  Aage Badho →
                </Button>
              </div>
            </div>
          )}

          {step === 2 && preview && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-xl font-bold font-sg">Import Preview</h2>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-default-100">
                  <p className="text-xs uppercase text-default-500">Party Masters</p>
                  <p className="text-2xl font-semibold">{preview.partiesCount}</p>
                </div>
                <div className="p-4 rounded-xl bg-default-100">
                  <p className="text-xs uppercase text-default-500">Sales</p>
                  <p className="text-2xl font-semibold">{preview.salesCount}</p>
                </div>
                <div className="p-4 rounded-xl bg-default-100">
                  <p className="text-xs uppercase text-default-500">Purchases</p>
                  <p className="text-2xl font-semibold">{preview.purchasesCount}</p>
                </div>
                <div className="p-4 rounded-xl bg-default-100">
                  <p className="text-xs uppercase text-default-500">Receipts</p>
                  <p className="text-2xl font-semibold">{preview.receiptsCount}</p>
                </div>
                <div className="p-4 rounded-xl bg-default-100">
                  <p className="text-xs uppercase text-default-500">Payments</p>
                  <p className="text-2xl font-semibold">{preview.paymentsCount}</p>
                </div>
                <div className="p-4 rounded-xl bg-default-100">
                  <p className="text-xs uppercase text-default-500">Journals</p>
                  <p className="text-2xl font-semibold">{preview.journalsCount}</p>
                </div>
              </div>

              {preview.parseErrors?.length > 0 && (
                <div className="p-4 rounded-xl bg-warning/10 border border-warning/20">
                  <p className="text-warning font-semibold text-sm mb-2">⚠ Warnings</p>
                  <ul className="list-disc pl-4 text-xs text-warning/80 space-y-1">
                    {preview.parseErrors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                    {preview.parseErrors.length > 5 && <li>... and {preview.parseErrors.length - 5} more</li>}
                  </ul>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="flat" onPress={() => setStep(1)}>← Wapas</Button>
                <Button color="primary" className="font-semibold px-8" onPress={handleImport}>
                  Haan, Import Karo →
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-fade-in py-8">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 border-4 border-default-200 border-t-primary rounded-full animate-spin"></div>
                <h2 className="text-xl font-bold font-sg">Import chal raha hai...</h2>
                <p className="text-default-500 text-sm">Please don't close this page.</p>
                
                {importJobId && (
                  <div className="w-full max-w-sm mt-4">
                    <div className="flex justify-between text-xs mb-1">
                      <span>{jobProgress.processed} processed</span>
                      <span>{jobProgress.total} total</span>
                    </div>
                    <div className="w-full bg-default-200 rounded-full h-2.5">
                      <div className="bg-primary h-2.5 rounded-full" style={{ width: `${Math.max(5, (jobProgress.processed / (jobProgress.total || 1)) * 100)}%` }}></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 4 && importResult && (
            <div className="space-y-6 animate-fade-in text-center py-6">
              <span className="text-5xl">🎉</span>
              <h2 className="text-2xl font-bold font-sg">Ho gaya!</h2>
              <p className="text-default-500">Tally data has been imported successfully.</p>
              
              <div className="grid grid-cols-2 gap-4 mt-6 max-w-sm mx-auto text-left">
                <div className="p-4 rounded-xl bg-success/10 border border-success/20">
                  <p className="text-xs uppercase text-success/80">Imported</p>
                  <p className="text-2xl font-semibold text-success">{importResult.imported}</p>
                </div>
                {importResult.failed > 0 && (
                  <div className="p-4 rounded-xl bg-danger/10 border border-danger/20">
                    <p className="text-xs uppercase text-danger/80">Failed</p>
                    <p className="text-2xl font-semibold text-danger">{importResult.failed}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-center pt-8">
                <Button color="primary" className="font-semibold px-8" onPress={() => router.push(returnTo)}>
                  {returnTo === "/dashboard" ? "Dashboard Par Jao" : "Wapas Jao"}
                </Button>
              </div>
            </div>
          )}

        </CardBody>
      </Card>
    </div>
  );
}

export default function TallyImportPage() {
  return (
    <Suspense fallback={null}>
      <TallyImportContent />
    </Suspense>
  );
}
