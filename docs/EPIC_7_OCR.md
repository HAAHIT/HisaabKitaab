# Epic 7: Purchase Bill OCR (Scan & Record)

> **Audience**: Starter-level developer. Every instruction is exact.  
> **Priority**: HIGH — This is the #1 workflow friction point for shopkeepers.  
> **Depends on**: Epic 0 (tenantId), Epic 6 (Item Catalog for matching)

---

## The User Problem

Every day, a shopkeeper receives 3-15 paper bills from suppliers. Today, they either:
1. Stuff them in a drawer (most common — no record)
2. Type each one manually into software (too slow, nobody does it)
3. Take a photo and WhatsApp it to their CA (CA still has to type it)

**This feature**: Shopkeeper photographs the bill → app extracts vendor, items, amounts, tax → shopkeeper confirms with 1 tap → purchase record created.

---

## Architecture Decision: Why Gemini API (not Mindee/Google Vision)

| Factor | Gemini Flash | Mindee | Google Vision |
|--------|-------------|--------|---------------|
| **Cost** | ~₹0.15/bill (~$0.002) | $0.10-0.20/page | $0.05-0.10/page |
| **Indian bills** | Excellent (understands Hindi, mixed layouts) | Good | Good for text, weak on structure |
| **Structured output** | Native JSON schema enforcement | Native JSON | Raw text (needs parsing) |
| **Setup** | 1 API key, no SDK needed | SDK + subscription | GCP project + service account |
| **Line item extraction** | Excellent (visual table understanding) | Good | Poor (can't understand tables) |
| **New dependency** | `@google/generative-ai` npm package | `mindee` npm | `@google-cloud/vision` |

**Winner: Gemini Flash** — cheapest, understands visual layout (critical for table extraction), enforces structured JSON output, and we only need one npm package.

> [!TIP]
> Cost analysis: At ~₹0.15 per bill scan, even a heavy user scanning 30 bills/month costs only ₹4.50/month in API costs. This is negligible.

---

## Feature Flow

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌─────────────┐
│   CAPTURE   │───▶│   EXTRACT    │───▶│   REVIEW     │───▶│   SAVE      │
│             │    │              │    │              │    │             │
│ Camera /    │    │ Gemini Flash │    │ Pre-filled   │    │ Purchase    │
│ Gallery     │    │ API call     │    │ form with    │    │ bill +      │
│ pick photo  │    │ → JSON       │    │ editable     │    │ payment     │
│             │    │              │    │ fields       │    │ record      │
└─────────────┘    └──────────────┘    └──────────────┘    └─────────────┘
     Mobile              Server              Mobile             Server
    (client)            (API route)          (client)          (API route)
```

---

## Task 7.1 — Install Gemini SDK

### Command:
```bash
npm install @google/generative-ai
```

### File: `.env` — Add Gemini API key

```
GEMINI_API_KEY=your_gemini_api_key_here
```

Get the key from: https://aistudio.google.com/apikey (free tier: 15 RPM, 1M tokens/min)

### ⛔ DO NOT:
- Install `@google-cloud/vision` — we're using Gemini, not Vision API
- Install `tesseract.js` or any client-side OCR — all processing happens server-side
- Expose the Gemini API key to the client — all calls go through our API route

---

## Task 7.2 — Purchase Bill OCR API Route

### File: `src/app/api/ocr/extract/route.ts` (NEW)

This is the core extraction endpoint. It receives an image and returns structured bill data.

```typescript
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenant";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Strict schema for invoice extraction
const INVOICE_SCHEMA = {
  type: SchemaType.OBJECT,
  description: "Extracted invoice/bill data",
  properties: {
    vendor: {
      type: SchemaType.OBJECT,
      description: "Vendor/supplier details from the bill",
      properties: {
        name: { type: SchemaType.STRING, description: "Business name of the vendor/supplier" },
        phone: { type: SchemaType.STRING, description: "Phone number if visible", nullable: true },
        address: { type: SchemaType.STRING, description: "Business address if visible", nullable: true },
        gstin: { type: SchemaType.STRING, description: "GSTIN number if visible (format: 22AAAAA0000A1Z5)", nullable: true },
      },
      required: ["name"],
    },
    billNumber: {
      type: SchemaType.STRING,
      description: "Invoice/bill number printed on the document",
      nullable: true,
    },
    billDate: {
      type: SchemaType.STRING,
      description: "Date of the bill in YYYY-MM-DD format",
      nullable: true,
    },
    lineItems: {
      type: SchemaType.ARRAY,
      description: "Individual items/products listed on the bill",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING, description: "Item/product name" },
          hsnCode: { type: SchemaType.STRING, description: "HSN/SAC code if shown", nullable: true },
          quantity: { type: SchemaType.NUMBER, description: "Quantity purchased" },
          unit: { type: SchemaType.STRING, description: "Unit of measurement (pcs, kg, meter, etc.)", nullable: true },
          rate: { type: SchemaType.NUMBER, description: "Price per unit" },
          amount: { type: SchemaType.NUMBER, description: "Total amount for this line (qty × rate)" },
        },
        required: ["name", "quantity", "rate", "amount"],
      },
    },
    subtotal: {
      type: SchemaType.NUMBER,
      description: "Subtotal before tax",
      nullable: true,
    },
    taxBreakdown: {
      type: SchemaType.OBJECT,
      description: "Tax amounts if shown",
      properties: {
        cgst: { type: SchemaType.NUMBER, description: "CGST amount", nullable: true },
        sgst: { type: SchemaType.NUMBER, description: "SGST amount", nullable: true },
        igst: { type: SchemaType.NUMBER, description: "IGST amount", nullable: true },
        totalTax: { type: SchemaType.NUMBER, description: "Total tax amount" },
        taxPercent: { type: SchemaType.NUMBER, description: "Tax percentage if identifiable", nullable: true },
      },
      required: ["totalTax"],
      nullable: true,
    },
    grandTotal: {
      type: SchemaType.NUMBER,
      description: "Final total amount payable (including tax)",
    },
    confidence: {
      type: SchemaType.STRING,
      description: "Your confidence in extraction accuracy: HIGH, MEDIUM, or LOW",
      enum: ["HIGH", "MEDIUM", "LOW"],
    },
    notes: {
      type: SchemaType.STRING,
      description: "Any additional relevant info on the bill (payment terms, due date, etc.)",
      nullable: true,
    },
  },
  required: ["vendor", "lineItems", "grandTotal", "confidence"],
};

export async function POST(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const tenantId = await getTenantId();

    // Read the uploaded image
    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid image format. Use JPEG, PNG, or WebP." },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image too large. Maximum 10MB." },
        { status: 400 }
      );
    }

    // Convert to base64 for Gemini
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    // Call Gemini Flash
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: INVOICE_SCHEMA,
        temperature: 0.1,  // Low temperature for accurate extraction
      },
    });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: file.type,
          data: base64,
        },
      },
      {
        text: `You are an expert at extracting data from Indian business invoices and bills.

Extract ALL information from this bill/invoice image. Key instructions:
- For dates, convert to YYYY-MM-DD format regardless of how shown
- For GSTIN, extract the exact 15-character alphanumeric code
- For line items, extract EVERY row from the items table
- If quantity or rate aren't shown but amount is, set quantity=1 and rate=amount
- For amounts, use numbers only (no currency symbols)
- If you can identify HSN/SAC codes, include them
- Set confidence to HIGH if the image is clear and all fields readable, MEDIUM if some fields are unclear, LOW if the image is blurry or partially cut off
- Extract tax breakdown (CGST/SGST/IGST) if shown separately
- The grandTotal MUST be the final payable amount including all taxes`,
      },
    ]);

    const extracted = JSON.parse(result.response.text());

    return NextResponse.json({
      success: true,
      extracted,
      // Include raw image size for client display
      imageSize: file.size,
    });
  } catch (error) {
    console.error("OCR extraction error:", error);

    // Handle Gemini-specific errors
    const errorMessage =
      error instanceof Error && error.message.includes("SAFETY")
        ? "Could not process this image. Please try a clearer photo."
        : "Failed to extract bill data. Please try again.";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
```

### ⛔ DO NOT:
- Use `gemini-1.5-pro` — use `gemini-2.0-flash` (cheaper, faster, good enough for invoices)
- Set temperature above 0.2 — we need deterministic extraction, not creative output
- Skip the `responseSchema` — without it, the JSON structure won't be consistent
- Process images client-side — always send to server (API key security)
- Accept PDF uploads in Phase 1 — images only for simplicity (PDF support comes later)

---

## Task 7.3 — Camera Capture Component

### File: `src/components/ocr/BillScanner.tsx` (NEW)

A mobile-optimized camera capture component with image compression.

```tsx
"use client";

import { useRef, useState, useCallback } from "react";
import { Button } from "@heroui/react";
import { useLanguage } from "@/contexts/LanguageContext";

interface BillScannerProps {
  onImageCaptured: (file: File, previewUrl: string) => void;
  isProcessing: boolean;
}

export default function BillScanner({ onImageCaptured, isProcessing }: BillScannerProps) {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const compressImage = useCallback(async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 1920;  // High enough for OCR accuracy
          const MAX_HEIGHT = 1920;

          let { width, height } = img;

          // Scale down if needed
          if (width > MAX_WIDTH || height > MAX_HEIGHT) {
            const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("Canvas not supported"));

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) return reject(new Error("Compression failed"));
              const compressed = new File([blob], "bill-scan.jpg", {
                type: "image/jpeg",
              });
              resolve(compressed);
            },
            "image/jpeg",
            0.85  // Good quality for OCR
          );
        };

        img.onerror = () => reject(new Error("Image load failed"));
        img.src = e.target?.result as string;
      };

      reader.onerror = () => reject(new Error("File read failed"));
      reader.readAsDataURL(file);
    });
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const compressed = await compressImage(file);
        const url = URL.createObjectURL(compressed);

        // Clean up previous preview
        if (previewUrl) URL.revokeObjectURL(previewUrl);

        setPreviewUrl(url);
        onImageCaptured(compressed, url);
      } catch (err) {
        console.error("Image processing failed:", err);
      }

      // Reset input so same file can be re-selected
      e.target.value = "";
    },
    [compressImage, onImageCaptured, previewUrl]
  );

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        capture="environment"  // Opens rear camera on mobile
        onChange={handleFileChange}
        className="hidden"
      />

      {previewUrl ? (
        /* Image preview */
        <div className="relative rounded-2xl overflow-hidden border-2 border-primary/20">
          <img
            src={previewUrl}
            alt="Captured bill"
            className="w-full max-h-[60vh] object-contain bg-default-50"
          />

          {isProcessing && (
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              <p className="text-white text-sm font-medium">
                {t("ocr.extracting")}
              </p>
            </div>
          )}

          {!isProcessing && (
            <div className="absolute bottom-3 right-3">
              <Button
                size="sm"
                variant="flat"
                className="glass"
                onPress={() => fileInputRef.current?.click()}
              >
                📷 {t("ocr.retake")}
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* Capture prompt */
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="w-full aspect-[3/4] max-h-[50vh] rounded-2xl border-2 border-dashed border-default-300 
          hover:border-primary hover:bg-primary/5 transition-all
          flex flex-col items-center justify-center gap-4 cursor-pointer"
        >
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="text-center px-6">
            <p className="font-semibold text-default-700">{t("ocr.tapToScan")}</p>
            <p className="text-sm text-default-400 mt-1">{t("ocr.scanHint")}</p>
          </div>
        </button>
      )}
    </div>
  );
}
```

### ⛔ DO NOT:
- Use `capture="user"` — use `capture="environment"` (rear camera for documents)
- Skip image compression — raw phone photos are 5-12MB, wasteful for API calls
- Compress below 0.8 quality — too lossy for OCR accuracy
- Show a live camera preview — use the native file picker (simpler, better UX on Android)

---

## Task 7.4 — Purchase Bill Review Form

### File: `src/components/ocr/BillReviewForm.tsx` (NEW)

After extraction, show a pre-filled form that the user can review and correct before saving.

```typescript
interface ExtractedBillData {
  vendor: {
    name: string;
    phone?: string | null;
    address?: string | null;
    gstin?: string | null;
  };
  billNumber?: string | null;
  billDate?: string | null;
  lineItems: Array<{
    name: string;
    hsnCode?: string | null;
    quantity: number;
    unit?: string | null;
    rate: number;
    amount: number;
  }>;
  subtotal?: number | null;
  taxBreakdown?: {
    cgst?: number | null;
    sgst?: number | null;
    igst?: number | null;
    totalTax: number;
    taxPercent?: number | null;
  } | null;
  grandTotal: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  notes?: string | null;
}

interface BillReviewFormProps {
  data: ExtractedBillData;
  imageUrl: string;
  onSave: (data: ExtractedBillData & { partyId: string | null }) => void;
  onRetake: () => void;
  isSaving: boolean;
}
```

**Layout:**

```
┌──────────────────────────────────────────────┐
│ Purchase Bill Scanned ✓                      │
│                                              │
│ ⚠️ MEDIUM confidence — please verify        │
│ ↑ Only shown if confidence ≠ HIGH            │
│                                              │
│ ── Vendor ───────────────────────────────    │
│ [Sharma Electronics     ] ← editable         │
│ [9876543210             ] ← editable         │
│ [GSTIN: 27AADCS1234R1ZP ] ← editable         │
│                                              │
│ 🔗 Match: "Sharma Electronics" found         │
│    in your parties. [Link ▶]                 │
│ ↑ Auto-match suggestion from existing parties│
│                                              │
│ ── Bill Info ────────────────────────────    │
│ Bill #: [INV-2026-0453  ]  Date: [29/03/26] │
│                                              │
│ ── Items ────────────────────────────────    │
│ ┌────────┬─────┬───────┬────────┐           │
│ │ Item   │ Qty │ Rate  │ Amount │           │
│ ├────────┼─────┼───────┼────────┤           │
│ │[Ply 18]│[5  ]│[₹ 450]│ ₹2,250│           │
│ │[Handle]│[10 ]│[₹ 120]│ ₹1,200│           │
│ │[Screw ]│[2  ]│[₹ 85 ]│ ₹  170│           │
│ └────────┴─────┴───────┴────────┘           │
│ [+ Add Item]     ↑ rows are editable         │
│                                              │
│ ── Totals ───────────────────────────────    │
│ Subtotal:              ₹3,620               │
│ CGST (9%):               ₹326               │
│ SGST (9%):               ₹326               │
│ ─────────────────────────────               │
│ Grand Total:           ₹4,272               │
│ ↑ Grand total field editable as override     │
│                                              │
│ ── Payment ──────────────────────────────    │
│ [CASH] [UPI] [BANK] [CHEQUE] [UNPAID]       │
│ ↑ UNPAID means "record bill but no payment"  │
│                                              │
│ [━━━━ Save Purchase ₹4,272 ━━━━━━━━━]       │
└──────────────────────────────────────────────┘
```

**Key behaviors:**

1. **Confidence banner**: If confidence is MEDIUM or LOW, show a yellow/red warning asking user to verify amounts
2. **Party auto-match**: Fuzzy-search vendor name against existing parties. If match found, suggest linking.
3. **Editable fields**: ALL extracted fields are editable — the user is the final authority
4. **Line items**: Can add/remove/edit rows. Amount auto-recalculates if qty or rate changes.
5. **Payment mode**: Includes an "UNPAID" option (creates bill but no payment record — for credit purchases)
6. **Split view on desktop**: Show the original image on the left, form on the right (for reference while editing)

### ⛔ DO NOT:
- Auto-save without user confirmation — the user MUST tap "Save" explicitly
- Skip the review form for HIGH confidence — always show it, just without the warning
- Hide the original image — user needs to reference it while verifying
- Pre-select a party match without user confirmation — suggest, don't auto-link

---

## Task 7.5 — Purchase Bill Data Model

### File: `prisma/schema.prisma` — Add PurchaseBill model

The purchase bill is stored separately from sales bills because:
- Sales bills are created by the shopkeeper (they control the format)
- Purchase bills are received from vendors (formats vary wildly)
- Purchase bills may have items NOT in the shopkeeper's catalog

```prisma
model PurchaseBill {
  id            String   @id @default(cuid())
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id])
  
  // Vendor info (snapshot from OCR / party record)
  partyId       String?
  party         Party?   @relation(fields: [partyId], references: [id])
  vendorName    String
  vendorPhone   String?
  vendorGstin   String?
  
  // Bill details
  billNumber    String?          // Vendor's bill number
  billDate      DateTime?        // Date on the vendor's bill
  
  // Items and amounts
  lineItems     Json             // Array of {name, qty, unit, rate, amount, hsnCode}
  subtotal      Float            @default(0)
  cgst          Float            @default(0)
  sgst          Float            @default(0)
  igst          Float            @default(0)
  totalTax      Float            @default(0)
  grandTotal    Float            @default(0)
  
  // Payment tracking
  paymentMode   String?          // CASH, UPI, BANK_TRANSFER, CHEQUE, null=UNPAID
  paymentStatus String           @default("UNPAID")  // PAID, UNPAID, PARTIAL
  
  // OCR metadata
  imageUrl      String?          // Stored scan image
  ocrConfidence String?          // HIGH, MEDIUM, LOW
  
  // Audit
  notes         String?
  createdBy     String
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
  isDeleted     Boolean          @default(false)

  @@index([tenantId])
  @@index([tenantId, partyId])
  @@index([tenantId, billDate])
}
```

Add `purchaseBills PurchaseBill[]` to both `Tenant` and `Party` model relations.

---

## Task 7.6 — Purchase Bill Save API

### File: `src/app/api/purchases/route.ts` (NEW)

```typescript
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";
import { getPaymentBalanceDelta } from "@/lib/accounting";
import { NextRequest, NextResponse } from "next/server";

// GET /api/purchases — List purchase bills
export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = await getTenantId();
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const where = { tenantId, isDeleted: false };

  const [purchases, total] = await Promise.all([
    prisma.purchaseBill.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        party: { select: { name: true, type: true } },
      },
    }),
    prisma.purchaseBill.count({ where }),
  ]);

  return NextResponse.json({ purchases, total, page, totalPages: Math.ceil(total / limit) });
}

// POST /api/purchases — Save a scanned purchase bill
export async function POST(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  const userId = request.headers.get("x-user-id");
  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = await getTenantId();
  const body = await request.json();

  const {
    partyId,
    vendorName,
    vendorPhone,
    vendorGstin,
    billNumber,
    billDate,
    lineItems,
    subtotal,
    cgst,
    sgst,
    igst,
    totalTax,
    grandTotal,
    paymentMode,
    imageUrl,
    ocrConfidence,
    notes,
  } = body;

  if (!vendorName?.trim() || !grandTotal || grandTotal <= 0) {
    return NextResponse.json(
      { error: "Vendor name and amount are required" },
      { status: 400 }
    );
  }

  const purchase = await prisma.$transaction(async (tx) => {
    // Create purchase bill
    const created = await tx.purchaseBill.create({
      data: {
        tenantId,
        partyId: partyId || null,
        vendorName: vendorName.trim(),
        vendorPhone: vendorPhone?.trim() || null,
        vendorGstin: vendorGstin?.trim() || null,
        billNumber: billNumber?.trim() || null,
        billDate: billDate ? new Date(billDate) : null,
        lineItems: lineItems || [],
        subtotal: subtotal || 0,
        cgst: cgst || 0,
        sgst: sgst || 0,
        igst: igst || 0,
        totalTax: totalTax || 0,
        grandTotal,
        paymentMode: paymentMode || null,
        paymentStatus: paymentMode ? "PAID" : "UNPAID",
        imageUrl: imageUrl || null,
        ocrConfidence: ocrConfidence || null,
        notes: notes?.trim() || null,
        createdBy: userId!,
      },
    });

    // If payment mode is set and party is linked, create payment record
    if (paymentMode && partyId) {
      await tx.payment.create({
        data: {
          tenantId,
          partyId,
          direction: "OUTGOING",  // We're paying the vendor
          amount: grandTotal,
          date: billDate ? new Date(billDate) : new Date(),
          mode: paymentMode,
          status: "COMPLETED",
          notes: `Purchase: ${billNumber || vendorName}`,
          createdBy: userId!,
        },
      });

      // Update party balance
      const party = await tx.party.findUnique({ where: { id: partyId } });
      if (party) {
        const delta = getPaymentBalanceDelta(party.type, "OUTGOING", grandTotal);
        await tx.party.update({
          where: { id: partyId },
          data: { currentBalance: { increment: delta } },
        });
      }
    }

    // If party is linked, also update balance for the purchase itself
    // Purchase = vendor gave us goods → we owe more
    if (partyId) {
      const party = await tx.party.findUnique({ where: { id: partyId } });
      if (party) {
        // Purchase from vendor increases what we owe
        await tx.party.update({
          where: { id: partyId },
          data: { currentBalance: { increment: grandTotal } },
        });
      }
    }

    return created;
  });

  return NextResponse.json({ purchase }, { status: 201 });
}
```

### ⛔ DO NOT:
- Create a sales Bill record — purchases go into PurchaseBill, NOT Bill
- Update party balance without checking party type — VENDOR vs CUSTOMER logic differs
- Skip the transaction — purchase + payment must be atomic
- Allow CUSTOMER role to create purchases — purchases are for shop owners/staff only

---

## Task 7.7 — Purchase Bills Page (Scan Entry Point)

### File: `src/app/(app)/purchases/page.tsx` (NEW)

This page serves dual purpose:
1. Entry point to scan a new purchase bill
2. List of previously scanned purchase bills

**Layout:**

```
┌──────────────────────────────────────────────┐
│ Purchase Bills                               │
│ "Scan supplier bills to keep records"        │
│                                              │
│ ┌────────────────────────────────────────┐   │
│ │ 📷 Scan New Bill                       │   │
│ │                                        │   │
│ │ [Tap to photograph a supplier bill]    │   │
│ │                                        │   │
│ │ ↑ Large tappable area (primary action) │   │
│ └────────────────────────────────────────┘   │
│                                              │
│ ── Recent Purchases ─────────────────────    │
│                                              │
│ ┌──────────────────────────────────────┐     │
│ │ Sharma Electronics       29 Mar 2026 │     │
│ │ INV-2026-0453            ₹4,272     │     │
│ │ ✅ Paid (UPI)                        │     │
│ └──────────────────────────────────────┘     │
│                                              │
│ ┌──────────────────────────────────────┐     │
│ │ Gupta Hardware           28 Mar 2026 │     │
│ │ Bill #445                ₹12,800    │     │
│ │ ⏳ Unpaid                           │     │
│ └──────────────────────────────────────┘     │
└──────────────────────────────────────────────┘
```

**State machine for the scan flow:**

```typescript
type ScanState = 
  | { step: "idle" }                           // Show list + scan button
  | { step: "capturing" }                      // Camera/file picker open
  | { step: "extracting"; imageUrl: string }    // Gemini API processing
  | { step: "reviewing"; data: ExtractedBillData; imageUrl: string }  // Review form
  | { step: "saving" };                         // Saving to DB

const [scanState, setScanState] = useState<ScanState>({ step: "idle" });
```

**Flow:**

```typescript
async function handleImageCaptured(file: File, previewUrl: string) {
  setScanState({ step: "extracting", imageUrl: previewUrl });
  
  const formData = new FormData();
  formData.append("image", file);
  
  try {
    const response = await fetch("/api/ocr/extract", {
      method: "POST",
      body: formData,  // NOT JSON — multipart form data
    });
    
    if (!response.ok) throw new Error(await response.text());
    
    const { extracted } = await response.json();
    setScanState({ step: "reviewing", data: extracted, imageUrl: previewUrl });
  } catch (error) {
    showToast("Failed to scan bill. Please try again.", "error");
    setScanState({ step: "idle" });
  }
}

async function handleSave(data: ExtractedBillData & { partyId: string | null }) {
  setScanState({ step: "saving" });
  
  try {
    const response = await fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) throw new Error(await response.text());
    
    showToast("Purchase bill saved!", "success");
    setScanState({ step: "idle" });
    fetchPurchases();  // Refresh list
  } catch (error) {
    showToast("Failed to save. Please try again.", "error");
    setScanState({ step: "reviewing", data, imageUrl: scanState.imageUrl });
  }
}
```

---

## Task 7.8 — Navigation & Translations

### Add "Purchases" to the navigation:

**File**: `src/components/ui/AppShell.tsx`

Add to the MORE_ITEMS array (bottom sheet "More" menu):

```typescript
{
  icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
    </svg>
  ),
  translationKey: "nav.purchases",
  href: "/purchases",
  roles: ["ADMIN", "STAFF"],
},
```

### Translation keys:

```typescript
// English
"nav.purchases": "Purchases",
"ocr.scanBill": "Scan Bill",
"ocr.tapToScan": "Tap to scan a supplier bill",
"ocr.scanHint": "Photograph the bill clearly. AI will extract all details.",
"ocr.extracting": "Reading bill...",
"ocr.retake": "Retake",
"ocr.reviewTitle": "Verify Scanned Bill",
"ocr.confidence.HIGH": "Scanned accurately ✓",
"ocr.confidence.MEDIUM": "Please verify amounts",
"ocr.confidence.LOW": "Low quality scan — check all fields",
"ocr.matchFound": "Match found in your contacts",
"ocr.linkParty": "Link to this party",
"ocr.savePurchase": "Save Purchase",
"ocr.unpaid": "Unpaid (Credit)",
"purchases.title": "Purchase Bills",
"purchases.subtitle": "Scan supplier bills to keep records",
"purchases.empty": "No purchase bills yet",
"purchases.emptyHint": "Scan your first supplier bill to get started",
"purchases.paid": "Paid",
"purchases.unpaid": "Unpaid",

// Hindi
"nav.purchases": "खरीदारी",
"ocr.scanBill": "बिल स्कैन करें",
"ocr.tapToScan": "सप्लायर का बिल स्कैन करने के लिए टैप करें",
"ocr.scanHint": "बिल को साफ तरीके से फोटो करें। AI सभी जानकारी निकाल लेगा।",
"ocr.extracting": "बिल पढ़ रहा है...",
"ocr.retake": "दोबारा लें",
"ocr.reviewTitle": "स्कैन किया हुआ बिल जांचें",
"ocr.confidence.HIGH": "सही से स्कैन हुआ ✓",
"ocr.confidence.MEDIUM": "कृपया रकम जांचें",
"ocr.confidence.LOW": "कम क्वालिटी स्कैन — सभी फ़ील्ड जांचें",
"ocr.matchFound": "आपके कॉन्टैक्ट में मिला",
"ocr.linkParty": "इस पार्टी से जोड़ें",
"ocr.savePurchase": "खरीदारी सेव करें",
"ocr.unpaid": "बाकी (उधार)",
"purchases.title": "खरीदारी बिल",
"purchases.subtitle": "रिकॉर्ड रखने के लिए सप्लायर बिल स्कैन करें",
"purchases.empty": "अभी कोई खरीदारी बिल नहीं",
"purchases.emptyHint": "शुरू करने के लिए अपना पहला सप्लायर बिल स्कैन करें",
"purchases.paid": "भुगतान हो गया",
"purchases.unpaid": "बाकी",
```

---

## Acceptance Criteria for Epic 7

- [ ] `npm install @google/generative-ai` added to dependencies
- [ ] GEMINI_API_KEY in `.env`
- [ ] Camera opens rear camera on mobile devices
- [ ] Image is compressed to < 2MB before upload
- [ ] Gemini extracts vendor name, items, amounts, tax, total
- [ ] Extracted data shown in editable review form
- [ ] Confidence indicator shown (HIGH/MEDIUM/LOW)
- [ ] Vendor auto-matched against existing parties (fuzzy search)
- [ ] User can link to existing party or skip
- [ ] User can add/remove/edit line items
- [ ] Payment mode selector includes "Unpaid" option
- [ ] PurchaseBill record created in database
- [ ] Payment record created automatically if payment mode selected
- [ ] Party balance updated correctly for purchases
- [ ] Purchase bills list shows recent scans with totals and status
- [ ] "Purchases" link in the "More" bottom sheet
- [ ] Hindi translations for all OCR-related strings

---

## File Manifest for Epic 7

### New Files

| File | Type |
|------|------|
| `src/app/api/ocr/extract/route.ts` | API Route (Gemini OCR) |
| `src/app/api/purchases/route.ts` | API Route (CRUD) |
| `src/app/(app)/purchases/page.tsx` | Page |
| `src/components/ocr/BillScanner.tsx` | Component |
| `src/components/ocr/BillReviewForm.tsx` | Component |

### Modified Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `PurchaseBill` model |
| `package.json` | Add `@google/generative-ai` |
| `.env` | Add `GEMINI_API_KEY` |
| `src/components/ui/AppShell.tsx` | Add Purchases to nav |
| `src/lib/i18n/translations.ts` | Add OCR/purchase translations |

---

## Cost & Performance Notes

> [!TIP]
> **Expected performance:**
> - Image upload: 1-3 seconds (depends on connection)
> - Gemini extraction: 2-5 seconds
> - Total scan-to-review: 3-8 seconds
>
> **Cost at scale:**
> - Gemini Flash: ~$0.075 / 1M input tokens
> - Average bill image: ~2000 tokens (after vision encoding)
> - Cost per scan: ~$0.002 (₹0.15)
> - 1000 scans/month: ~$2 (₹170)
