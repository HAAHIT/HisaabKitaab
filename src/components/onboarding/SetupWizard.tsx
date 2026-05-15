"use client";

import { useState, useEffect, useRef } from "react";
import { HKSelect, HKSelectItem } from "@/components/ui/HKSelect";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { OR, PU, GR, AM, SG, IN, TYPE } from "@/components/ui/hk-design";
import { HKInput } from "@/components/ui/HKInput";

// ── Constants ────────────────────────────────────────────────────────────────

const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka",
  "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

const BUSINESS_TYPES = ["Retail", "Wholesale", "Manufacturing", "Service", "Other"];

const BANKS = [
  "State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Mahindra Bank",
  "Punjab National Bank", "Bank of Baroda", "IndusInd Bank", "Yes Bank",
  "Canara Bank", "Union Bank of India", "Bank of India", "Other",
];

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z][Z][0-9A-Z]$/;

const STEP_META = [
  { label: "Business",  desc: "Naam aur jagah"           },
  { label: "GSTIN",     desc: "Tax registration"          },
  { label: "Bank",      desc: "Account details"           },
  { label: "Parties",   desc: "Grahak & Suppliers"        },
  { label: "Items",     desc: "Jo bechte ho"              },
  { label: "Template",  desc: "Default bill format"       },
  { label: "CA",        desc: "Accountant contact"        },
  { label: "Done",      desc: "Sab set!"                  },
];

const TOTAL_STEPS = 8;
const SKIPPABLE = [false, true, true, true, true, true, true, false];

// Preset templates shown during onboarding — user picks one, wizard creates it
const PRESET_TEMPLATES = [
  {
    id: "standard",
    label: "Standard Invoice",
    desc: "Description · Qty · Rate · Amount",
    icon: "📄",
    columns: [
      { id: "description", name: "Description", type: "text" },
      { id: "qty",         name: "Qty",         type: "number" },
      { id: "rate",        name: "Rate (₹)",    type: "number" },
      { id: "amount",      name: "Amount (₹)",  type: "formula", formula: "qty*rate" },
    ],
  },
  {
    id: "gst",
    label: "GST Invoice",
    desc: "Item · HSN · Qty · Rate · GST% · Total",
    icon: "🧾",
    columns: [
      { id: "item",    name: "Item",       type: "text" },
      { id: "hsn",     name: "HSN Code",   type: "text" },
      { id: "qty",     name: "Qty",        type: "number" },
      { id: "rate",    name: "Rate (₹)",   type: "number" },
      { id: "taxable", name: "Taxable (₹)", type: "formula", formula: "qty*rate" },
    ],
  },
  {
    id: "service",
    label: "Service Invoice",
    desc: "Service · Hours · Rate · Amount",
    icon: "🛠️",
    columns: [
      { id: "service", name: "Service",    type: "text" },
      { id: "hours",   name: "Hours",      type: "number" },
      { id: "rate",    name: "Rate (₹/hr)", type: "number" },
      { id: "amount",  name: "Amount (₹)", type: "formula", formula: "hours*rate" },
    ],
  },
  {
    id: "material",
    label: "Material Supply",
    desc: "Item · Unit · Qty · Rate · Total",
    icon: "📦",
    columns: [
      { id: "item",   name: "Item",       type: "text" },
      { id: "unit",   name: "Unit",       type: "text" },
      { id: "qty",    name: "Qty",        type: "number" },
      { id: "rate",   name: "Rate (₹)",   type: "number" },
      { id: "total",  name: "Total (₹)",  type: "formula", formula: "qty*rate" },
    ],
  },
] as const;

// ── Types ────────────────────────────────────────────────────────────────────

interface SetupWizardProps {
  onComplete: () => void;
}

interface BankEntry {
  bankName: string;
  accountNumber: string;
  openingBalance: string;
}

interface PartyEntry {
  name: string;
  phone: string;
  type: "CUSTOMER" | "VENDOR";
}

interface ItemEntry {
  name: string;
  unit: string;
  rate: string;
  hsnCode: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch(url: string, body: object) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => null);
    throw new Error(d?.error || "Request failed");
  }
  return res.json();
}

async function apiPatch(url: string, body: object) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => null);
    throw new Error(d?.error || "Request failed");
  }
  return res.json();
}

// ── Wizard draft persistence ──────────────────────────────────────────────────

const WIZARD_STORAGE_KEY = "hk_wizard_draft_v1";

interface WizardDraft {
  step: number;
  businessName: string; businessType: string; stateName: string; city: string;
  gstin: string;
  banks: BankEntry[];
  parties: PartyEntry[]; addPartyName: string; addPartyPhone: string; addPartyType: "CUSTOMER" | "VENDOR";
  items: ItemEntry[]; addItemName: string; addItemUnit: string; addItemRate: string; addItemHsn: string;
  selectedPreset: string;
  caName: string; caEmail: string; caPhone: string;
}

function getWizardDraft(): WizardDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(WIZARD_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WizardDraft) : null;
  } catch { return null; }
}

function clearWizardDraft() {
  if (typeof window !== "undefined") localStorage.removeItem(WIZARD_STORAGE_KEY);
}

// ── Component ────────────────────────────────────────────────────────────────

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Load persisted draft once — used as lazy initial values for all state below
  const draft = useRef(getWizardDraft());

  const [step, setStep] = useState<number>(draft.current?.step ?? 0);

  useEffect(() => setThemeMounted(true), []);

  // Responsive detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Step 0 — Business basics
  const [businessName, setBusinessName] = useState(draft.current?.businessName ?? "");
  const [businessType, setBusinessType] = useState(draft.current?.businessType ?? "Retail");
  const [stateName, setStateName] = useState(draft.current?.stateName ?? "");
  const [city, setCity] = useState(draft.current?.city ?? "");

  // Step 1 — GSTIN
  const [gstin, setGstin] = useState(draft.current?.gstin ?? "");
  const [gstinValidState, setGstinValidState] = useState<"" | "valid" | "invalid">(() => {
    const g = draft.current?.gstin ?? "";
    if (!g) return "";
    return GSTIN_RE.test(g) ? "valid" : "invalid";
  });

  // Step 2 — Bank accounts
  const [banks, setBanks] = useState<BankEntry[]>(
    draft.current?.banks ?? [{ bankName: "", accountNumber: "", openingBalance: "0" }]
  );

  // Step 3 — Parties
  const [parties, setParties] = useState<PartyEntry[]>(draft.current?.parties ?? []);
  const [addPartyName, setAddPartyName] = useState(draft.current?.addPartyName ?? "");
  const [addPartyPhone, setAddPartyPhone] = useState(draft.current?.addPartyPhone ?? "");
  const [addPartyType, setAddPartyType] = useState<"CUSTOMER" | "VENDOR">(draft.current?.addPartyType ?? "CUSTOMER");

  // Step 4 — Items
  const [items, setItems] = useState<ItemEntry[]>(draft.current?.items ?? []);
  const [addItemName, setAddItemName] = useState(draft.current?.addItemName ?? "");
  const [addItemUnit, setAddItemUnit] = useState(draft.current?.addItemUnit ?? "pcs");
  const [addItemRate, setAddItemRate] = useState(draft.current?.addItemRate ?? "");
  const [addItemHsn, setAddItemHsn] = useState(draft.current?.addItemHsn ?? "");

  // Step 5 — Template selection
  const [selectedPreset, setSelectedPreset] = useState<string>(draft.current?.selectedPreset ?? "standard");

  // Step 6 — CA contact
  const [caName, setCaName] = useState(draft.current?.caName ?? "");
  const [caEmail, setCaEmail] = useState(draft.current?.caEmail ?? "");
  const [caPhone, setCaPhone] = useState(draft.current?.caPhone ?? "");

  // Auto-save all wizard state to localStorage on every change
  useEffect(() => {
    try {
      const wizardDraft: WizardDraft = {
        step, businessName, businessType, stateName, city,
        gstin,
        banks,
        parties, addPartyName, addPartyPhone, addPartyType,
        items, addItemName, addItemUnit, addItemRate, addItemHsn,
        selectedPreset,
        caName, caEmail, caPhone,
      };
      localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(wizardDraft));
    } catch { /* ignore quota errors */ }
  }, [step, businessName, businessType, stateName, city, gstin, banks, parties, addPartyName, addPartyPhone, addPartyType, items, addItemName, addItemUnit, addItemRate, addItemHsn, selectedPreset, caName, caEmail, caPhone]);

  // ── GSTIN validation ──────────────────────────────────────────────────────
  function onGstinChange(v: string) {
    const upper = v.toUpperCase().replace(/\s/g, "");
    setGstin(upper);
    if (!upper) { setGstinValidState(""); return; }
    setGstinValidState(GSTIN_RE.test(upper) ? "valid" : "invalid");
  }

  // ── Step savers ───────────────────────────────────────────────────────────

  async function saveStep1() {
    if (!businessName.trim()) { setError("Business ka naam zaroori hai."); return false; }
    if (!stateName) { setError("State select karo."); return false; }
    setError(null); setSaving(true);
    try {
      const address = [city.trim(), stateName].filter(Boolean).join(", ");
      await apiPatch("/api/settings", { companyName: businessName.trim(), companyAddress: address || undefined, businessType });
      return true;
    } catch (err) { setError(err instanceof Error ? err.message : "Save failed"); return false; }
    finally { setSaving(false); }
  }

  async function saveStep2() {
    if (gstin && gstinValidState === "invalid") { setError("GSTIN format sahi nahi hai."); return false; }
    setError(null); setSaving(true);
    try {
      if (gstin.trim()) await apiPatch("/api/settings", { companyGstin: gstin.trim(), taxRegistrationType: "REGISTERED" });
      return true;
    } catch (err) { setError(err instanceof Error ? err.message : "Save failed"); return false; }
    finally { setSaving(false); }
  }

  async function saveStep3() {
    setError(null);
    const validBanks = banks.filter((b) => b.bankName.trim());
    if (!validBanks.length) return true;
    setSaving(true);
    try {
      for (const bank of validBanks) {
        await apiFetch("/api/bank-accounts", { name: bank.bankName.trim(), accountNumber: bank.accountNumber.trim() || null, openingBalance: Number(bank.openingBalance) || 0, type: "BANK" });
      }
      return true;
    } catch (err) { setError(err instanceof Error ? err.message : "Bank save failed"); return false; }
    finally { setSaving(false); }
  }

  async function saveStep4() {
    setError(null);
    if (!parties.length) return true;
    setSaving(true);
    try {
      for (const p of parties) await apiFetch("/api/parties", { name: p.name, phone: p.phone || null, type: p.type });
      return true;
    } catch (err) { setError(err instanceof Error ? err.message : "Party save failed"); return false; }
    finally { setSaving(false); }
  }

  async function saveStep5() {
    setError(null);
    if (!items.length) return true;
    setSaving(true);
    try {
      for (const it of items) await apiFetch("/api/items", { name: it.name, unit: it.unit, rate: Number(it.rate) || 0, hsnCode: it.hsnCode || null });
      return true;
    } catch (err) { setError(err instanceof Error ? err.message : "Item save failed"); return false; }
    finally { setSaving(false); }
  }

  async function saveStep5Template() {
    setError(null);
    setSaving(true);
    try {
      const preset = PRESET_TEMPLATES.find((p) => p.id === selectedPreset);
      if (!preset) return true;
      // Create the template
      const res = await apiFetch("/api/templates", { name: preset.label, columns: preset.columns });
      const templateId: string = res.template?.id;
      if (templateId) {
        // Save as default
        await apiPatch("/api/settings", { defaultTemplateId: templateId });
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Template save failed");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveStep6() {
    setError(null);
    if (!caName && !caEmail && !caPhone) return true;
    setSaving(true);
    try {
      await apiPatch("/api/settings", { caName: caName.trim() || undefined, caEmail: caEmail.trim() || undefined, caPhone: caPhone.trim() || undefined });
      return true;
    } catch (err) { setError(err instanceof Error ? err.message : "Save failed"); return false; }
    finally { setSaving(false); }
  }

  async function finishWizard() {
    setSaving(true); setError(null);
    try {
      await apiFetch("/api/onboarding/complete", {});
      clearWizardDraft();
      onComplete();
      router.push("/dashboard");
    }
    catch (err) { setError(err instanceof Error ? err.message : "Finish failed"); }
    finally { setSaving(false); }
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  async function goNext() {
    let ok = true;
    if (step === 0) ok = await saveStep1();
    else if (step === 1) ok = await saveStep2();
    else if (step === 2) ok = await saveStep3();
    else if (step === 3) ok = await saveStep4();
    else if (step === 4) ok = await saveStep5();
    else if (step === 5) ok = await saveStep5Template();
    else if (step === 6) ok = await saveStep6();
    if (ok) setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1) as typeof s);
  }

  function goBack() { setError(null); setStep((s) => Math.max(s - 1, 0) as typeof s); }
  function skipAndNext() { setError(null); setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1) as typeof s); }

  // ── Inline add helpers ────────────────────────────────────────────────────

  function addParty() {
    if (!addPartyName.trim()) return;
    setParties((p) => [...p, { name: addPartyName.trim(), phone: addPartyPhone.trim(), type: addPartyType }]);
    setAddPartyName(""); setAddPartyPhone(""); setAddPartyType("CUSTOMER");
  }
  function removeParty(i: number) { setParties((p) => p.filter((_, idx) => idx !== i)); }

  function addItem() {
    if (!addItemName.trim()) return;
    setItems((it) => [...it, { name: addItemName.trim(), unit: addItemUnit, rate: addItemRate, hsnCode: addItemHsn }]);
    setAddItemName(""); setAddItemUnit("pcs"); setAddItemRate(""); setAddItemHsn("");
  }
  function removeItem(i: number) { setItems((it) => it.filter((_, idx) => idx !== i)); }

  function addBankRow() { setBanks((b) => [...b, { bankName: "", accountNumber: "", openingBalance: "0" }]); }
  function removeBankRow(i: number) { setBanks((b) => b.filter((_, idx) => idx !== i)); }

  // ── Shared styles ─────────────────────────────────────────────────────────

  const contentPad = isMobile ? "28px 20px" : "40px 48px";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "var(--hk-bg)", display: "flex", fontFamily: SG }}>

      {/* ═══════════════════════════════════════════════════════════
          LEFT SIDEBAR — step list (desktop only)
      ═══════════════════════════════════════════════════════════ */}
      {!isMobile && (
        <div style={{
          width: 288,
          flexShrink: 0,
          minHeight: "100vh",
          background: "var(--hk-card)",
          borderRight: "1.5px solid var(--hk-border)",
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
        }}>
          {/* Brand header */}
          <div style={{
            background: `linear-gradient(150deg, ${OR} 0%, #c44de0 55%, ${PU} 100%)`,
            padding: "36px 28px 32px",
            color: "white",
            flexShrink: 0,
          }}>
            <p style={{
              fontSize: 10, fontWeight: 800, letterSpacing: "2.5px",
              textTransform: "uppercase", opacity: 0.9, fontFamily: SG, margin: 0,
            }}>
              HisaabKitaab
            </p>
            <h1 style={{
              marginTop: 10, fontSize: 22, fontWeight: 800,
              fontFamily: SG, letterSpacing: "-0.3px", lineHeight: 1.3, margin: "10px 0 0",
            }}>
              Apna Karobaar<br />Shuru Karo
            </h1>
            <p style={{ marginTop: 10, fontSize: TYPE.bodySmall, opacity: 0.75, fontFamily: SG }}>
              Sirf 5 minute mein setup taiyaar
            </p>
          </div>

          {/* Step list */}
          <div style={{ flex: 1, padding: "24px 20px" }}>
            {STEP_META.map((meta, i) => {
              const isComplete = i < step;
              const isActive   = i === step;

              return (
                <div key={i}>
                  <div style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 14,
                    padding: "11px 12px",
                    borderRadius: 12,
                    background: isActive ? OR + "12" : "transparent",
                    transition: "background 0.2s",
                  }}>
                    {/* Circle indicator */}
                    <div style={{
                      width: 30, height: 30, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                      background: isComplete
                        ? GR
                        : isActive
                        ? `linear-gradient(135deg, ${OR}, ${PU})`
                        : "transparent",
                      border: `2px solid ${isComplete ? GR : isActive ? "transparent" : "var(--hk-border)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: isActive ? `0 2px 10px ${OR}44` : "none",
                      transition: "all 0.25s",
                    }}>
                      {isComplete
                        ? <span style={{ color: "white", fontSize: 13, fontWeight: 800, lineHeight: 1 }}>✓</span>
                        : <span style={{
                            color: isActive ? "white" : "var(--hk-muted)",
                            fontSize: 11, fontWeight: 800, fontFamily: IN,
                          }}>{i + 1}</span>
                      }
                    </div>

                    {/* Label + status */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: TYPE.body,
                        fontWeight: isActive ? 700 : isComplete ? 600 : 500,
                        color: isComplete ? GR : isActive ? "var(--hk-text)" : "var(--hk-sub)",
                        fontFamily: SG, margin: 0, lineHeight: 1.3,
                      }}>
                        {meta.label}
                      </p>
                      <p style={{
                        fontSize: TYPE.caption,
                        color: isComplete ? GR + "bb" : isActive ? OR : "var(--hk-muted)",
                        fontFamily: SG, marginTop: 2,
                      }}>
                        {isComplete ? "Ho gaya ✓" : isActive ? "Abhi yahan ho" : meta.desc}
                      </p>
                    </div>
                  </div>

                  {/* Connector line between steps */}
                  {i < STEP_META.length - 1 && (
                    <div style={{
                      width: 2, height: 10,
                      marginLeft: 26, marginTop: 1, marginBottom: 1,
                      background: i < step ? GR + "55" : "var(--hk-border)",
                      borderRadius: 1,
                      transition: "background 0.3s",
                    }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer: note + theme toggle */}
          <div style={{ padding: "14px 20px", borderTop: "1px solid var(--hk-border)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <p style={{ fontSize: TYPE.caption, color: "var(--hk-muted)", fontFamily: SG, lineHeight: 1.5, margin: 0 }}>
              Baad mein Settings mein<br />edit kar sakte ho.
            </p>
            {themeMounted && (
              <button
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                title={resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
                style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  border: "1px solid var(--hk-border)", background: "var(--hk-badge)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--hk-sub)", cursor: "pointer",
                }}
              >
                {resolvedTheme === "dark" ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          RIGHT PANEL — form content
      ═══════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>

        {/* Mobile: gradient header */}
        {isMobile && (
          <div style={{
            background: `linear-gradient(135deg, ${OR}, ${PU})`,
            padding: "24px 20px 20px",
            color: "white",
            flexShrink: 0,
          }}>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "2px", textTransform: "uppercase", opacity: 0.85, fontFamily: SG, margin: 0 }}>
              HisaabKitaab
            </p>
            <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: SG, marginTop: 6, marginBottom: 0 }}>
              Apna Karobaar Shuru Karo
            </h1>
          </div>
        )}

        {/* Mobile: step progress strip */}
        {isMobile && (
          <div style={{
            padding: "12px 20px 10px",
            background: "var(--hk-card)",
            borderBottom: "1px solid var(--hk-border)",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", gap: 3, marginBottom: 8 }}>
              {STEP_META.map((_, i) => (
                <div key={i} style={{
                  flex: 1, height: 4, borderRadius: 2,
                  background: i < step ? GR : i === step ? OR : "var(--hk-border)",
                  transition: "background 0.3s",
                }} />
              ))}
            </div>
            <p style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: SG, margin: 0 }}>
              Step {step + 1} of {TOTAL_STEPS} · <strong style={{ color: "var(--hk-text)" }}>{STEP_META[step].label}</strong>
            </p>
          </div>
        )}

        {/* ── Form scroll area ──────────────────────────────────── */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: contentPad,
        }}>
          <div style={{ maxWidth: 540, width: "100%" }}>

            {/* ── Step 0: Business basics ──────────────────────── */}
            {step === 0 && (
              <div>
                <h2 style={{ fontSize: TYPE.h1, fontWeight: 800, fontFamily: SG, marginBottom: 6, marginTop: 0 }}>
                  Business ki Details
                </h2>
                <p style={{ fontSize: TYPE.body, color: "var(--hk-sub)", marginBottom: 28, fontFamily: SG }}>
                  Apna karobaar ka naam aur jagah batao.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <HKInput label="Business ka naam *" placeholder="Jaise: Sharma Traders" value={businessName} onValueChange={setBusinessName} size="lg" />
                  <HKSelect label="Business kya karta hai?" value={businessType} onValueChange={(v) => { if (v) setBusinessType(v); }} size="lg">
                    {BUSINESS_TYPES.map((t) => <HKSelectItem key={t} value={t}>{t}</HKSelectItem>)}
                  </HKSelect>
                  <HKSelect label="State *" value={stateName} onValueChange={(v) => { if (v) setStateName(v); }} size="lg">
                    {INDIAN_STATES.map((s) => <HKSelectItem key={s} value={s}>{s}</HKSelectItem>)}
                  </HKSelect>
                  <HKInput label="City" placeholder="Jaise: Mumbai" value={city} onValueChange={setCity} size="lg" />
                </div>
              </div>
            )}

            {/* ── Step 1: GSTIN ───────────────────────────────── */}
            {step === 1 && (
              <div>
                <h2 style={{ fontSize: TYPE.h1, fontWeight: 800, fontFamily: SG, marginBottom: 6, marginTop: 0 }}>
                  GSTIN hai?
                </h2>
                <p style={{ fontSize: TYPE.body, color: "var(--hk-sub)", marginBottom: 28, fontFamily: SG }}>
                  Optional, par bills mein zaroori hota hai. Baad mein bhi add kar sakte ho.
                </p>
                <HKInput
                  label="GSTIN Number"
                  placeholder="27AAAAA0000A1Z5"
                  value={gstin}
                  onValueChange={onGstinChange}
                  size="lg"
                  isInvalid={gstinValidState === "invalid"}
                  description={
                    gstinValidState === "valid" ? "✓ Valid GSTIN format"
                    : gstinValidState === "invalid" ? "Format sahi nahi — 15 characters hone chahiye"
                    : ""
                  }
                />
              </div>
            )}

            {/* ── Step 2: Bank account ─────────────────────────── */}
            {step === 2 && (
              <div>
                <h2 style={{ fontSize: TYPE.h1, fontWeight: 800, fontFamily: SG, marginBottom: 6, marginTop: 0 }}>
                  Bank Account Jodo
                </h2>
                <p style={{ fontSize: TYPE.body, color: "var(--hk-sub)", marginBottom: 28, fontFamily: SG }}>
                  Month-end reconciliation ke liye helpful hoga. Skip kar sakte ho.
                </p>
                {banks.map((bank, i) => (
                  <div key={i} style={{ marginBottom: 16, padding: "16px", borderRadius: 14, border: "1.5px solid var(--hk-border)", background: "var(--hk-card)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                      <p style={{ fontSize: TYPE.body, fontWeight: 700, fontFamily: SG, margin: 0 }}>Account {i + 1}</p>
                      {banks.length > 1 && (
                        <button onClick={() => removeBankRow(i)} style={{ background: "none", border: "none", cursor: "pointer", color: OR, fontSize: TYPE.bodySmall, fontFamily: SG }}>✕ Hatao</button>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <HKSelect label="Bank" value={bank.bankName} onValueChange={(v) => { if (v) setBanks((prev) => prev.map((b, idx) => idx === i ? { ...b, bankName: v } : b)); }}>
                        {BANKS.map((b) => <HKSelectItem key={b} value={b}>{b}</HKSelectItem>)}
                      </HKSelect>
                      <HKInput label="Account number (optional)" placeholder="XXXX XXXX XXXX" value={bank.accountNumber} onValueChange={(v) => setBanks((prev) => prev.map((b, idx) => idx === i ? { ...b, accountNumber: v } : b))} />
                      <HKInput label="Opening balance (₹)" type="number" value={bank.openingBalance} onValueChange={(v) => setBanks((prev) => prev.map((b, idx) => idx === i ? { ...b, openingBalance: v } : b))} />
                    </div>
                  </div>
                ))}
                <button onClick={addBankRow} style={{ width: "100%", padding: "13px", borderRadius: 12, border: `1.5px dashed var(--hk-border)`, background: "transparent", cursor: "pointer", color: PU, fontSize: TYPE.body, fontWeight: 700, fontFamily: SG }}>
                  + Aur Account Jodo
                </button>
              </div>
            )}

            {/* ── Step 3: Parties ─────────────────────────────── */}
            {step === 3 && (
              <div>
                <h2 style={{ fontSize: TYPE.h1, fontWeight: 800, fontFamily: SG, marginBottom: 6, marginTop: 0 }}>
                  Customers / Suppliers
                </h2>
                <p style={{ fontSize: TYPE.body, color: "var(--hk-sub)", marginBottom: 28, fontFamily: SG }}>
                  Kuch logon ko add karo, ya baad mein Udhar Khata mein karo.
                </p>
                {parties.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, padding: "12px 16px", borderRadius: 10, background: (p.type === "CUSTOMER" ? PU : OR) + "14", border: `1px solid ${(p.type === "CUSTOMER" ? PU : OR)}22` }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: TYPE.body, fontWeight: 700, fontFamily: SG, margin: 0 }}>{p.name}</p>
                      <p style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: SG, marginTop: 2 }}>{p.type === "CUSTOMER" ? "Grahak" : "Supplier"}{p.phone ? ` · ${p.phone}` : ""}</p>
                    </div>
                    <button onClick={() => removeParty(i)} style={{ background: "none", border: "none", cursor: "pointer", color: OR, fontSize: 14 }}>✕</button>
                  </div>
                ))}
                <div style={{ padding: "16px", borderRadius: 14, border: "1.5px solid var(--hk-border)", background: "var(--hk-card)", marginTop: parties.length ? 12 : 0 }}>
                  <p style={{ fontSize: TYPE.caption, fontWeight: 700, textTransform: "uppercase", color: "var(--hk-sub)", letterSpacing: "0.5px", marginBottom: 12, fontFamily: SG }}>Nayi party add karo</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <HKInput label="Naam *" value={addPartyName} onValueChange={setAddPartyName} />
                    <HKInput label="Phone (optional)" value={addPartyPhone} onValueChange={setAddPartyPhone} type="tel" />
                    <div style={{ display: "flex", gap: 8 }}>
                      {(["CUSTOMER", "VENDOR"] as const).map((t) => (
                        <button key={t} onClick={() => setAddPartyType(t)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1.5px solid ${addPartyType === t ? (t === "CUSTOMER" ? PU : OR) : "var(--hk-border)"}`, background: addPartyType === t ? (t === "CUSTOMER" ? PU + "18" : OR + "18") : "transparent", color: addPartyType === t ? (t === "CUSTOMER" ? PU : OR) : "var(--hk-sub)", fontSize: TYPE.bodySmall, fontWeight: 700, cursor: "pointer", fontFamily: SG }}>
                          {t === "CUSTOMER" ? "Grahak" : "Supplier"}
                        </button>
                      ))}
                    </div>
                    <button onClick={addParty} style={{ padding: "12px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${OR}, ${PU})`, color: "white", fontSize: TYPE.body, fontWeight: 700, cursor: "pointer", fontFamily: SG }}>+ Jodo</button>
                  </div>
                </div>
                <div style={{ marginTop: 14, textAlign: "center" }}>
                  <a href="/settings/tally-import?returnTo=/dashboard" style={{ fontSize: TYPE.bodySmall, fontWeight: 600, color: PU, fontFamily: SG }}>📥 Ya Tally se import karo →</a>
                </div>
              </div>
            )}

            {/* ── Step 4: Items ───────────────────────────────── */}
            {step === 4 && (
              <div>
                <h2 style={{ fontSize: TYPE.h1, fontWeight: 800, fontFamily: SG, marginBottom: 6, marginTop: 0 }}>
                  Items / Saman
                </h2>
                <p style={{ fontSize: TYPE.body, color: "var(--hk-sub)", marginBottom: 28, fontFamily: SG }}>
                  Jo cheezein tum bechte ho — bills mein fast pick ke liye.
                </p>
                {items.map((it, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, padding: "12px 16px", borderRadius: 10, background: GR + "10", border: `1px solid ${GR}22` }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: TYPE.body, fontWeight: 700, fontFamily: SG, margin: 0 }}>{it.name}</p>
                      <p style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: SG, marginTop: 2 }}>{it.unit} · ₹{it.rate || "0"}{it.hsnCode ? ` · HSN ${it.hsnCode}` : ""}</p>
                    </div>
                    <button onClick={() => removeItem(i)} style={{ background: "none", border: "none", cursor: "pointer", color: OR, fontSize: 14 }}>✕</button>
                  </div>
                ))}
                <div style={{ padding: "16px", borderRadius: 14, border: "1.5px solid var(--hk-border)", background: "var(--hk-card)", marginTop: items.length ? 12 : 0 }}>
                  <p style={{ fontSize: TYPE.caption, fontWeight: 700, textTransform: "uppercase", color: "var(--hk-sub)", letterSpacing: "0.5px", marginBottom: 12, fontFamily: SG }}>Naya item add karo</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <HKInput label="Item ka naam *" value={addItemName} onValueChange={setAddItemName} />
                    <div style={{ display: "flex", gap: 10 }}>
                      <HKInput label="Unit" value={addItemUnit} onValueChange={setAddItemUnit} placeholder="pcs / kg / m" style={{ flex: 1 }} />
                      <HKInput label="Rate (₹)" type="number" value={addItemRate} onValueChange={setAddItemRate} style={{ flex: 1 }} />
                    </div>
                    <HKInput label="HSN Code (optional)" value={addItemHsn} onValueChange={setAddItemHsn} placeholder="E.g. 5208" />
                    <button onClick={addItem} style={{ padding: "12px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${GR}, ${PU})`, color: "white", fontSize: TYPE.body, fontWeight: 700, cursor: "pointer", fontFamily: SG }}>+ Jodo</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 5: Template ────────────────────────────── */}
            {step === 5 && (
              <div>
                <h2 style={{ fontSize: TYPE.h1, fontWeight: 800, fontFamily: SG, marginBottom: 6, marginTop: 0 }}>
                  Bill ka Format Chuno
                </h2>
                <p style={{ fontSize: TYPE.body, color: "var(--hk-sub)", marginBottom: 28, fontFamily: SG }}>
                  Ye default template har naye bill mein auto-select hoga. Baad mein Settings mein change kar sakte ho.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {PRESET_TEMPLATES.map((preset) => {
                    const active = selectedPreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => setSelectedPreset(preset.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 16,
                          padding: "16px 18px", borderRadius: 14, textAlign: "left",
                          border: `2px solid ${active ? OR : "var(--hk-border)"}`,
                          background: active ? OR + "0a" : "var(--hk-card)",
                          cursor: "pointer", transition: "all 0.15s", width: "100%",
                        }}
                      >
                        {/* Selection indicator */}
                        <div style={{
                          width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                          border: `2px solid ${active ? OR : "var(--hk-border)"}`,
                          background: active ? OR : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.15s",
                        }}>
                          {active && <span style={{ color: "white", fontSize: 12, lineHeight: 1 }}>✓</span>}
                        </div>

                        {/* Icon */}
                        <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{preset.icon}</span>

                        {/* Label */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize: TYPE.bodyLarge, fontWeight: active ? 700 : 600,
                            color: active ? OR : "var(--hk-text)", fontFamily: SG, margin: 0,
                          }}>
                            {preset.label}
                          </p>
                          <p style={{
                            fontSize: TYPE.bodySmall, color: "var(--hk-sub)",
                            fontFamily: SG, marginTop: 3,
                          }}>
                            {preset.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <p style={{ fontSize: TYPE.caption, color: "var(--hk-muted)", fontFamily: SG, marginTop: 16 }}>
                  Columns baad mein Settings → Templates mein edit ho sakta hai.
                </p>
              </div>
            )}

            {/* ── Step 6: CA Contact ──────────────────────────── */}
            {step === 6 && (
              <div>
                <h2 style={{ fontSize: TYPE.h1, fontWeight: 800, fontFamily: SG, marginBottom: 6, marginTop: 0 }}>
                  CA ka Contact
                </h2>
                <p style={{ fontSize: TYPE.body, color: "var(--hk-sub)", marginBottom: 28, fontFamily: SG }}>
                  Tally file bhejna hoga toh CA ka email auto-fill ho jayega.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <HKInput label="CA ka naam" value={caName} onValueChange={setCaName} size="lg" placeholder="Jaise: Pradeep Sharma" />
                  <HKInput label="CA ka email" type="email" value={caEmail} onValueChange={setCaEmail} size="lg" placeholder="ca@example.com" />
                  <HKInput label="CA ka phone" type="tel" value={caPhone} onValueChange={setCaPhone} size="lg" placeholder="+91 98765 43210" />
                </div>
              </div>
            )}

            {/* ── Step 7: Done ────────────────────────────────── */}
            {step === 7 && (
              <div>
                <div style={{ textAlign: isMobile ? "center" : "left", marginBottom: 32 }}>
                  <p style={{ fontSize: 56, marginBottom: 16, lineHeight: 1 }}>🎉</p>
                  <h2 style={{ fontSize: TYPE.h1, fontWeight: 800, fontFamily: SG, marginBottom: 8, marginTop: 0 }}>Sab Set Hai!</h2>
                  <p style={{ fontSize: TYPE.body, color: "var(--hk-sub)", fontFamily: SG }}>
                    Business details, GSTIN, bank accounts — sab save ho gaya. Pehla bill banao aur shuru karo!
                  </p>
                </div>

                {/* Summary card */}
                <div style={{ background: "var(--hk-card)", borderRadius: 16, border: "1.5px solid var(--hk-border)", overflow: "hidden" }}>
                  <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--hk-border)", background: OR + "08" }}>
                    <p style={{ fontSize: TYPE.caption, fontWeight: 800, textTransform: "uppercase", color: OR, letterSpacing: "1px", fontFamily: SG, margin: 0 }}>Setup Summary</p>
                  </div>
                  <div style={{ padding: "4px 0" }}>
                    {[
                      { label: "Business",      value: businessName || "—" },
                      { label: "State",          value: stateName || "—" },
                      { label: "GSTIN",          value: gstin || "Skip kiya" },
                      { label: "Banks added",    value: String(banks.filter((b) => b.bankName).length) },
                      { label: "Parties added",  value: String(parties.length) },
                      { label: "Items added",    value: String(items.length) },
                      { label: "Bill Template",  value: PRESET_TEMPLATES.find((p) => p.id === selectedPreset)?.label || "Skip kiya" },
                      { label: "CA",             value: caName || caEmail || "Skip kiya" },
                    ].map((row, idx, arr) => (
                      <div key={row.label} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "13px 20px",
                        borderBottom: idx < arr.length - 1 ? "1px solid var(--hk-border)" : "none",
                      }}>
                        <p style={{ fontSize: TYPE.body, color: "var(--hk-sub)", fontFamily: SG, margin: 0 }}>{row.label}</p>
                        <p style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG, margin: 0, maxWidth: "55%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>{row.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <p style={{ fontSize: TYPE.bodySmall, color: "var(--hk-muted)", fontFamily: SG, marginTop: 16 }}>
                  Settings mein sab kuch baad mein edit kar sakte ho.
                </p>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div style={{
                marginTop: 20, padding: "13px 16px", borderRadius: 10,
                background: OR + "12", border: `1px solid ${OR}33`,
                color: OR, fontSize: TYPE.bodySmall, fontWeight: 600, fontFamily: SG,
              }}>
                ⚠ {error}
              </div>
            )}

          </div>{/* /maxWidth wrapper */}
        </div>{/* /scroll area */}

        {/* ── Bottom nav ─────────────────────────────────────── */}
        <div style={{
          flexShrink: 0,
          background: "var(--hk-card)",
          borderTop: "1.5px solid var(--hk-border)",
          padding: isMobile ? "14px 20px" : "18px 48px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}>
          {/* Back */}
          <button
            onClick={goBack}
            disabled={step === 0 || saving}
            style={{
              padding: "13px 22px", borderRadius: 12,
              border: "1.5px solid var(--hk-border)",
              background: "transparent", color: "var(--hk-text)",
              fontSize: TYPE.body, fontWeight: 700, cursor: step === 0 ? "default" : "pointer",
              opacity: step === 0 ? 0 : 1, fontFamily: SG, minHeight: 48,
              transition: "opacity 0.2s",
            }}
          >
            ← Peeche
          </button>

          {/* Right actions */}
          <div style={{ display: "flex", gap: 10 }}>
            {SKIPPABLE[step] && step < TOTAL_STEPS - 1 && (
              <button
                onClick={skipAndNext}
                disabled={saving}
                style={{
                  padding: "13px 20px", borderRadius: 12,
                  border: "1.5px solid var(--hk-border)",
                  background: "transparent", color: "var(--hk-sub)",
                  fontSize: TYPE.body, fontWeight: 600, cursor: "pointer",
                  fontFamily: SG, minHeight: 48,
                }}
              >
                Skip
              </button>
            )}

            {step < TOTAL_STEPS - 1 ? (
              <button
                onClick={goNext}
                disabled={saving}
                style={{
                  padding: "13px 28px", borderRadius: 12, border: "none",
                  background: saving ? "var(--hk-border)" : `linear-gradient(135deg, ${OR}, ${PU})`,
                  color: "white", fontSize: TYPE.body, fontWeight: 700,
                  cursor: saving ? "wait" : "pointer",
                  fontFamily: SG, minHeight: 48,
                  boxShadow: saving ? "none" : `0 4px 16px ${OR}44`,
                  transition: "box-shadow 0.2s",
                }}
              >
                {saving ? "..." : "Aage Badho →"}
              </button>
            ) : (
              <button
                onClick={finishWizard}
                disabled={saving}
                style={{
                  padding: "13px 28px", borderRadius: 12, border: "none",
                  background: saving ? "var(--hk-border)" : `linear-gradient(135deg, ${GR}, ${PU})`,
                  color: "white", fontSize: TYPE.body, fontWeight: 700,
                  cursor: saving ? "wait" : "pointer",
                  fontFamily: SG, minHeight: 48,
                  boxShadow: saving ? "none" : `0 4px 16px ${GR}55`,
                }}
              >
                {saving ? "..." : "Karobaar Shuru Karo ✓"}
              </button>
            )}
          </div>
        </div>

      </div>{/* /right panel */}
    </div>
  );
}
