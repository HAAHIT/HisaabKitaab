"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HKButton } from "@/components/ui/HKButton";
import { C, SG, TYPE, useIsMobile } from "@/components/ui/hk-design";
import type { OcrParsedFields } from "@/app/api/ocr/purchase-bill/route";

export type { OcrParsedFields };

interface Props {
  onScanComplete: (fields: OcrParsedFields) => void;
  onClose: () => void;
}

type ScanState = "idle" | "preview" | "recognizing" | "parsing" | "done" | "error";

/**
 * Preprocess image before OCR: resize to max 1600px for faster recognition.
 * Returns a new File (JPEG) at 92% quality.
 */
async function preprocessImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Resize to max 1600px on longest edge (2-3x speedup)
        const maxDim = 1600;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));

        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas context unavailable")); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error("Canvas toBlob failed")); return; }
            resolve(new File([blob], file.name, { type: "image/jpeg" }));
          },
          "image/jpeg",
          0.92
        );
      };
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

export function PurchaseBillScanner({ onScanComplete, onClose }: Props) {
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputUploadRef = useRef<HTMLInputElement>(null); // Separate input for desktop upload
  const workerRef = useRef<any>(null); // Cache Tesseract worker across scans
  const previewUrlRef = useRef<string | null>(null); // Track URL for cleanup
  const [state, setState] = useState<ScanState>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState("");
  const [error, setError] = useState("");
  const [parsedFields, setParsedFields] = useState<OcrParsedFields | null>(null);

  // Cleanup: revoke object URLs and terminate worker on unmount
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      if (workerRef.current) workerRef.current.terminate();
    };
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // File size check — reject files > 20MB
    const MAX_FILE_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 20MB.`);
      setState("error");
      return;
    }

    // Revoke previous preview URL to avoid memory leak
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);

    // Show preview
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setState("recognizing");
    setProgress(0);
    setProgressStatus("Preprocessing image…");
    setError("");
    setParsedFields(null);

    try {
      // Preprocess image (resize to 1600px) for 2-3x speedup
      setProgressStatus("Resizing image for OCR…");
      const processedFile = await preprocessImage(file);
      setProgress(15);

      // Dynamic import & worker caching — create worker once, reuse on retry
      if (!workerRef.current) {
        const { createWorker } = await import("tesseract.js");
        workerRef.current = await createWorker("eng", 1, {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === "loading tesseract core") {
              setProgressStatus("Loading OCR core…");
              setProgress(Math.round(15 + m.progress * 15));
            } else if (m.status === "initializing tesseract") {
              setProgressStatus("Initializing…");
              setProgress(30 + Math.round(m.progress * 15));
            } else if (m.status === "loading language traineddata") {
              setProgressStatus("Loading language data…");
              setProgress(45 + Math.round(m.progress * 15));
            } else if (m.status === "recognizing text") {
              setProgressStatus("Recognizing text…");
              setProgress(60 + Math.round(m.progress * 35));
            }
          },
        });
      } else {
        setProgress(60);
      }

      setProgressStatus("Recognizing text…");
      const {
        data: { text, confidence },
      } = await workerRef.current.recognize(processedFile);

      setProgress(95);
      setState("parsing");
      setProgressStatus("Parsing bill details…");

      // Send extracted text to server for structured parsing
      const res = await fetch("/api/ocr/purchase-bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, confidence }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to parse bill");
      }

      const data = await res.json();
      setProgress(100);
      setProgressStatus("Done!");
      setState("done");
      setParsedFields(data.fields as OcrParsedFields);
    } catch (err: unknown) {
      setState("error");
      setError(err instanceof Error ? err.message : "OCR failed. Please try again.");
    } finally {
      // Reset file inputs so the same file can be re-selected if needed
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (fileInputUploadRef.current) fileInputUploadRef.current.value = "";
    }
  }, []);

  function handleRetry() {
    setPreviewUrl(null);
    setState("idle");
    setProgress(0);
    setError("");
    setParsedFields(null);
    fileInputRef.current?.click();
  }

  function handleUse() {
    if (parsedFields) onScanComplete(parsedFields);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          zIndex: 699,
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: isMobile ? 0 : "50%",
          left: isMobile ? 0 : "50%",
          right: isMobile ? 0 : undefined,
          bottom: isMobile ? 0 : undefined,
          transform: isMobile ? "none" : "translate(-50%, -50%)",
          width: isMobile ? "100%" : 500,
          maxHeight: isMobile ? "100%" : "90vh",
          zIndex: 700,
          display: "flex",
          flexDirection: "column",
          background: "var(--sb-card)",
          borderRadius: isMobile ? 0 : 20,
          border: "1px solid var(--sb-border)",
          boxShadow: "0 32px 100px rgba(0,0,0,0.4)",
          fontFamily: SG,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 20px",
            borderBottom: "1px solid var(--sb-border)",
            flexShrink: 0,
          }}
        >
          <div>
            <h2 style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--sb-text)", margin: 0, fontFamily: SG }}>
              📷 Scan Purchase Bill
            </h2>
            <p style={{ fontSize: TYPE.caption, color: "var(--sb-muted)", marginTop: 3, fontFamily: SG }}>
              Take a photo or upload to auto-fill the form
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close scanner"
            style={{
              width: 34, height: 34, borderRadius: 9,
              border: "1px solid var(--sb-border)",
              background: "var(--sb-surface-alt)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "var(--sb-sub)", flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {/* Hidden file inputs — separate for camera vs upload (avoid DOM mutation) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            style={{ display: "none" }}
            aria-label="Camera for purchase bill"
          />
          <input
            ref={fileInputUploadRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
            aria-label="File picker for purchase bill"
          />

          {/* IDLE — show camera button */}
          {state === "idle" && (
            <div style={{ textAlign: "center", padding: "32px 20px" }}>
              <div
                style={{
                  width: 80, height: 80, borderRadius: 24,
                  background: C.primarySoft,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 16px", fontSize: 36,
                }}
              >
                📷
              </div>
              <p style={{ fontSize: TYPE.body, fontWeight: 600, color: "var(--sb-text)", fontFamily: SG, marginBottom: 8 }}>
                Capture your purchase bill
              </p>
              <p style={{ fontSize: TYPE.bodySmall, color: "var(--sb-muted)", fontFamily: SG, marginBottom: 24, maxWidth: 320, margin: "0 auto 24px" }}>
                Take a clear photo or upload an image. Vendor name, invoice number, date, and amount will be detected automatically.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <HKButton onClick={() => fileInputRef.current?.click()}>
                  📷 Take Photo
                </HKButton>
                <HKButton
                  variant="secondary"
                  onClick={() => fileInputUploadRef.current?.click()}
                >
                  🖼️ Upload Image
                </HKButton>
              </div>
              <p style={{ fontSize: TYPE.caption, color: "var(--sb-muted)", fontFamily: SG, marginTop: 16 }}>
                Supports JPEG, PNG, WEBP · Powered by Tesseract OCR
              </p>
            </div>
          )}

          {/* RECOGNIZING / PARSING — show progress */}
          {(state === "recognizing" || state === "parsing") && (
            <div>
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Bill preview"
                  style={{
                    width: "100%", maxHeight: 260, objectFit: "contain",
                    borderRadius: 12, marginBottom: 16,
                    border: "1px solid var(--sb-border)",
                  }}
                />
              )}
              <div
                style={{
                  background: "var(--sb-surface-alt)",
                  borderRadius: 12,
                  padding: "16px 20px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: TYPE.bodySmall, fontWeight: 600, color: "var(--sb-text)", fontFamily: SG }}>
                    {progressStatus}
                  </span>
                  <span style={{ fontSize: TYPE.bodySmall, fontWeight: 700, color: C.primary, fontFamily: SG }}>
                    {progress}%
                  </span>
                </div>
                {/* Progress bar */}
                <div style={{ height: 6, borderRadius: 6, background: "var(--sb-border)", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${progress}%`,
                      background: C.primary,
                      borderRadius: 6,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
                <p style={{ fontSize: TYPE.caption, color: "var(--sb-muted)", fontFamily: SG, marginTop: 8 }}>
                  {state === "parsing" ? "Extracting bill details…" : "Please wait. OCR may take 10–30 seconds for the first scan."}
                </p>
              </div>
            </div>
          )}

          {/* DONE — show extracted fields */}
          {state === "done" && parsedFields && (
            <div>
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Bill preview"
                  style={{
                    width: "100%", maxHeight: 200, objectFit: "contain",
                    borderRadius: 12, marginBottom: 16,
                    border: "1px solid var(--sb-border)",
                  }}
                />
              )}

              {/* Confidence indicator */}
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 16px", borderRadius: 10,
                  background: parsedFields.confidence > 70 ? "rgba(45,211,102,0.1)" : "rgba(255,160,0,0.1)",
                  border: `1px solid ${parsedFields.confidence > 70 ? "#25D366" : "#FFA000"}`,
                  marginBottom: 16,
                }}
              >
                <span style={{ fontSize: 14 }}>{parsedFields.confidence > 70 ? "✅" : "⚠️"}</span>
                <span style={{ fontSize: TYPE.bodySmall, fontWeight: 600, color: "var(--sb-text)", fontFamily: SG }}>
                  OCR confidence: {Math.round(parsedFields.confidence)}%
                  {parsedFields.confidence < 70 && " — image may be blurry. Review fields carefully."}
                </span>
              </div>

              {/* Extracted fields */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "Vendor / Supplier", value: parsedFields.vendor },
                  { label: "Invoice No.", value: parsedFields.invoiceNo },
                  { label: "Bill Date", value: parsedFields.date },
                  {
                    label: "Grand Total",
                    value: parsedFields.amount !== null
                      ? `₹${parsedFields.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                      : null,
                  },
                  { label: "Vendor GSTIN", value: parsedFields.gstin },
                  {
                    label: "GST Rate",
                    value: parsedFields.taxPercent !== null ? `${parsedFields.taxPercent}%` : null,
                  },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: value ? "var(--sb-surface-alt)" : "transparent",
                      border: "1px solid var(--sb-border)",
                      opacity: value ? 1 : 0.5,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{value ? "✓" : "—"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: TYPE.caption, color: "var(--sb-muted)", margin: 0, fontFamily: SG }}>{label}</p>
                      <p style={{ fontSize: TYPE.body, fontWeight: 600, color: value ? "var(--sb-text)" : "var(--sb-muted)", margin: "2px 0 0", fontFamily: SG }}>
                        {value ?? "Not detected"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <p style={{ fontSize: TYPE.caption, color: "var(--sb-muted)", fontFamily: SG, marginTop: 12, textAlign: "center" }}>
                You can review and edit all fields before saving.
              </p>
            </div>
          )}

          {/* ERROR */}
          {state === "error" && (
            <div style={{ textAlign: "center", padding: "32px 20px" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
              <p style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG, marginBottom: 8 }}>
                OCR Failed
              </p>
              <p style={{ fontSize: TYPE.bodySmall, color: C.negative, fontFamily: SG, marginBottom: 24 }}>
                {error}
              </p>
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Bill preview"
                  style={{ maxHeight: 160, maxWidth: "100%", borderRadius: 10, marginBottom: 20, opacity: 0.7 }}
                />
              )}
              <p style={{ fontSize: TYPE.caption, color: "var(--sb-muted)", fontFamily: SG, marginBottom: 20 }}>
                Tips: Ensure good lighting, keep the image flat, and avoid shadows on the bill.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--sb-border)",
            display: "flex",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <HKButton variant="secondary" onClick={onClose} style={{ flex: 1 }}>
            Cancel
          </HKButton>

          {(state === "done" || state === "error") && (
            <HKButton variant="secondary" onClick={handleRetry} style={{ flex: 1 }}>
              🔄 Retry
            </HKButton>
          )}

          {state === "done" && parsedFields && (
            <HKButton onClick={handleUse} style={{ flex: 2 }}>
              ✓ Use This Bill
            </HKButton>
          )}
        </div>
      </div>
    </>
  );
}
