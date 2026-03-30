# HisaabKitaab (MSME Digital Bookkeeping Platform)

Welcome to the **HisaabKitaab** repository. This is a Next.js 16 application designed to revolutionize bookkeeping for Indian MSMEs by acting as a "cognitive translator" between simple business actions and complex accounting requirements.

---

## 📚 Project Documentation (Start Here)

For developers joining the project, please review the following documents in order:

1.  **[Project Strategy & Vision](docs/STRATEGY.md)**: Understand the "Money In" / "Money Out" philosophy.
2.  **[PRD Review & Foundation](docs/PRD_REVIEW.md)**: Product Requirements and high-level technical foundations.

### 🏗️ Phase 1 Implementation Epics

- [**Epic 0-2: Foundation**](docs/EPICS_0-2_FOUNDATION.md): Tenant-Ready Architecture, PWA, and Mobile-First UI Shell.
- [**Epic 3-5: Core Business Logic**](docs/EPICS_3-5_CORE_LOGIC.md): Fast Billing, Udhar Khata (Party Ledger), and Sharing.
- [**Epic 3A & 6: Setup & Onboarding**](docs/EPICS_3A-6_SETUP_FLOWS.md): Zero-Jargon Billing and Configuration Modules.
- [**Epic 7: Purchase Bill OCR**](docs/EPIC_7_OCR.md): AI-powered scanning of supplier bills using Gemini Flash.
- [**Epic 8: Journal & CA Export**](docs/EPIC_8_JOURNAL.md): Double-entry journal system with Tally-compatible exports.

---

## 🛠️ Technology Stack

- **Frontend**: Next.js 16 (App Router), HeroUI, Tailwind CSS.
- **Backend**: Next.js API Routes, Prisma ORM, PostgreSQL.
- **Database**: PostgreSQL (managed), Dexie.js (local sync).
- **AI**: Google Gemini 2.0 Flash (for OCR).
- **Internationalization**: Custom context-based i18n (English/Hindi).

---

## 🚀 Getting Started

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Environment Setup**:
    Copy `.env.example` to `.env` and fill in:
    - `DATABASE_URL` (PostgreSQL)
    - `GEMINI_API_KEY` (for OCR features)
    - `DEFAULT_TENANT_ID` (obtained after running step 3)

3.  **Database Initial Setup**:
    ```bash
    npx prisma db push
    npx tsx prisma/seed-tenant.ts
    ```

4.  **Run Dev Server**:
    ```bash
    npm run dev
    ```

---

## 🤝 Contributing

This project is built for speed and simplicity. Every feature must follow the "3-Tap Rule": no transaction should take more than 3 taps for a frequent user. All accounting logic resides in the backend and is invisible to the shopkeeper.
