"use client";

import { useState } from "react";
import { Button, Input, Select, SelectItem } from "@heroui/react";
import { useRouter } from "next/navigation";
import { OR, PU, GR, AM, SG, IN, TYPE } from "@/components/ui/hk-design";

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

const TOTAL_STEPS = 7;

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

// ── Component ────────────────────────────────────────────────────────────────

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — Business basics
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("Retail");
  const [stateName, setStateName] = useState("");
  const [city, setCity] = useState("");

  // Step 2 — GSTIN
  const [gstin, setGstin] = useState("");
  const [gstinValidState, setGstinValidState] = useState<"" | "valid" | "invalid">("");

  // Step 3 — Bank accounts
  const [banks, setBanks] = useState<BankEntry[]>([{ bankName: "", accountNumber: "", openingBalance: "0" }]);

  // Step 4 — Parties
  const [parties, setParties] = useState<PartyEntry[]>([]);
  const [addPartyName, setAddPartyName] = useState("");
  const [addPartyPhone, setAddPartyPhone] = useState("");
  const [addPartyType, setAddPartyType] = useState<"CUSTOMER" | "VENDOR">("CUSTOMER");

  // Step 5 — Items
  const [items, setItems] = useState<ItemEntry[]>([]);
  const [addItemName, setAddItemName] = useState("");
  const [addItemUnit, setAddItemUnit] = useState("pcs");
  const [addItemRate, setAddItemRate] = useState("");
  const [addItemHsn, setAddItemHsn] = useState("");

  // Step 6 — CA contact
  const [caName, setCaName] = useState("");
  const [caEmail, setCaEmail] = useState("");
  const [caPhone, setCaPhone] = useState("");

  // ── GSTIN validation ────────────────────────────────────────────────────────
  function onGstinChange(v: string) {
    const upper = v.toUpperCase().replace(/\s/g, "");
    setGstin(upper);
    if (!upper) { setGstinValidState(""); return; }
    setGstinValidState(GSTIN_RE.test(upper) ? "valid" : "invalid");
  }

  // ── Step savers ─────────────────────────────────────────────────────────────

  async function saveStep1() {
    if (!businessName.trim()) { setError("Business ka naam zaroori hai."); return false; }
    if (!stateName) { setError("State select karo."); return false; }
    setError(null);
    setSaving(true);
    try {
      const address = [city.trim(), stateName].filter(Boolean).join(", ");
      await apiPatch("/api/settings", {
        companyName: businessName.trim(),
        companyAddress: address || undefined,
        businessType,
      });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveStep2() {
    if (gstin && gstinValidState === "invalid") {
      setError("GSTIN format sahi nahi hai.");
      return false;
    }
    setError(null);
    setSaving(true);
    try {
      if (gstin.trim()) {
        await apiPatch("/api/settings", {
          companyGstin: gstin.trim(),
          taxRegistrationType: "REGISTERED",
        });
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveStep3() {
    setError(null);
    const validBanks = banks.filter((b) => b.bankName.trim());
    if (!validBanks.length) return true; // Step is skippable
    setSaving(true);
    try {
      for (const bank of validBanks) {
        await apiFetch("/api/bank-accounts", {
          name: bank.bankName.trim(),
          accountNumber: bank.accountNumber.trim() || null,
          openingBalance: Number(bank.openingBalance) || 0,
          type: "BANK",
        });
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bank save failed");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveStep4() {
    setError(null);
    if (!parties.length) return true;
    setSaving(true);
    try {
      for (const p of parties) {
        await apiFetch("/api/parties", {
          name: p.name,
          phone: p.phone || null,
          type: p.type,
        });
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Party save failed");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveStep5() {
    setError(null);
    if (!items.length) return true;
    setSaving(true);
    try {
      for (const it of items) {
        await apiFetch("/api/items", {
          name: it.name,
          unit: it.unit,
          rate: Number(it.rate) || 0,
          hsnCode: it.hsnCode || null,
        });
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Item save failed");
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
      await apiPatch("/api/settings", {
        caName: caName.trim() || undefined,
        caEmail: caEmail.trim() || undefined,
        caPhone: caPhone.trim() || undefined,
      });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function finishWizard() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/onboarding/complete", {});
      onComplete();
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Finish failed");
    } finally {
      setSaving(false);
    }
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  async function goNext() {
    let ok = true;
    if (step === 0) ok = await saveStep1();
    else if (step === 1) ok = await saveStep2();
    else if (step === 2) ok = await saveStep3();
    else if (step === 3) ok = await saveStep4();
    else if (step === 4) ok = await saveStep5();
    else if (step === 5) ok = await saveStep6();
    if (ok) setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1) as typeof s);
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0) as typeof s);
  }

  async function skipAndNext() {
    setError(null);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1) as typeof s);
  }

  // ── Party / Item inline add helpers ─────────────────────────────────────────

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

  // ── Render ───────────────────────────────────────────────────────────────────

  const stepLabels = ["Business", "GSTIN", "Bank", "Parties", "Items", "CA", "Done"];
  const skippable = [false, true, true, true, true, true, false];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--hk-bg)",
        display: "flex",
        flexDirection: "column",
        fontFamily: SG,
      }}
    >
      {/* Header */}
      <div
        style={{
          background: `linear-gradient(135deg, ${OR}, ${PU})`,
          padding: "28px 24px 24px",
          color: "white",
        }}
      >
        <p style={{ fontSize: TYPE.caption, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", opacity: 0.85, fontFamily: SG }}>
          HisaabKitaab
        </p>
        <h1 style={{ marginTop: 6, fontSize: 28, fontWeight: 800, fontFamily: SG, letterSpacing: "-0.5px", lineHeight: 1.2 }}>
          Apna Karobaar Shuru Karo
        </h1>
      </div>

      {/* Progress bar */}
      <div style={{ padding: "16px 24px 0", background: "var(--hk-card)", borderBottom: "1px solid var(--hk-border)" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {stepLabels.map((label, i) => (
            <div key={label} style={{ flex: 1, textAlign: "center" }}>
              <div style={{
                height: 5, borderRadius: 3,
                background: i <= step ? `linear-gradient(90deg, ${OR}, ${PU})` : "var(--hk-border)",
                transition: "background 0.3s",
                marginBottom: 5,
              }} />
              <p style={{
                fontSize: 10, fontWeight: 600,
                color: i === step ? "var(--hk-text)" : "var(--hk-sub)",
                fontFamily: SG, whiteSpace: "nowrap",
              }}>
                {label}
              </p>
            </div>
          ))}
        </div>
        <p style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: SG, paddingBottom: 10 }}>
          Step {step + 1} of {TOTAL_STEPS}
        </p>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: "28px 24px", maxWidth: 520, width: "100%", margin: "0 auto" }}>

        {/* ── Step 1: Business basics ─────────────────────────────── */}
        {step === 0 && (
          <div>
            <h2 style={{ fontSize: TYPE.h1, fontWeight: 800, fontFamily: SG, marginBottom: 6 }}>Business ki Details</h2>
            <p style={{ fontSize: TYPE.body, color: "var(--hk-sub)", marginBottom: 24, fontFamily: SG }}>Apna karobaar ka naam aur jagah batao.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Input label="Business ka naam *" placeholder="Jaise: Sharma Traders" value={businessName} onValueChange={setBusinessName} variant="bordered" size="lg" />
              <Select label="Business kya karta hai?" selectedKeys={[businessType]} onSelectionChange={(k) => setBusinessType(Array.from(k)[0] as string)} variant="bordered" size="lg">
                {BUSINESS_TYPES.map((t) => <SelectItem key={t}>{t}</SelectItem>)}
              </Select>
              <Select label="State *" selectedKeys={stateName ? [stateName] : []} onSelectionChange={(k) => setStateName(Array.from(k)[0] as string)} variant="bordered" size="lg">
                {INDIAN_STATES.map((s) => <SelectItem key={s}>{s}</SelectItem>)}
              </Select>
              <Input label="City" placeholder="Jaise: Mumbai" value={city} onValueChange={setCity} variant="bordered" size="lg" />
            </div>
          </div>
        )}

        {/* ── Step 2: GSTIN ───────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: TYPE.h1, fontWeight: 800, fontFamily: SG, marginBottom: 6 }}>GSTIN hai?</h2>
            <p style={{ fontSize: TYPE.body, color: "var(--hk-sub)", marginBottom: 24, fontFamily: SG }}>Optional, but bills mein zaroori hota hai. Baad mein bhi add kar sakte ho.</p>

            <Input
              label="GSTIN Number"
              placeholder="27AAAAA0000A1Z5"
              value={gstin}
              onValueChange={onGstinChange}
              variant="bordered"
              size="lg"
              color={gstinValidState === "invalid" ? "danger" : gstinValidState === "valid" ? "success" : "default"}
              description={gstinValidState === "valid" ? "✓ Valid GSTIN format" : gstinValidState === "invalid" ? "Format sahi nahi — 15 characters hone chahiye" : ""}
            />
          </div>
        )}

        {/* ── Step 3: Bank account ─────────────────────────────────── */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: TYPE.h1, fontWeight: 800, fontFamily: SG, marginBottom: 6 }}>Bank Account Jodo</h2>
            <p style={{ fontSize: TYPE.body, color: "var(--hk-sub)", marginBottom: 24, fontFamily: SG }}>Month-end reconciliation ke liye helpful hoga. Skip kar sakte ho.</p>

            {banks.map((bank, i) => (
              <div key={i} style={{ marginBottom: 16, padding: "16px", borderRadius: 12, border: "1px solid var(--hk-border)", background: "var(--hk-card)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <p style={{ fontSize: TYPE.body, fontWeight: 700, fontFamily: SG }}>Account {i + 1}</p>
                  {banks.length > 1 && (
                    <button onClick={() => removeBankRow(i)} style={{ background: "none", border: "none", cursor: "pointer", color: OR, fontSize: 14 }}>✕ Hatao</button>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <Select label="Bank" selectedKeys={bank.bankName ? [bank.bankName] : []} onSelectionChange={(k) => setBanks((prev) => prev.map((b, idx) => idx === i ? { ...b, bankName: Array.from(k)[0] as string } : b))} variant="bordered">
                    {BANKS.map((b) => <SelectItem key={b}>{b}</SelectItem>)}
                  </Select>
                  <Input label="Account number (optional)" placeholder="XXXX XXXX XXXX" value={bank.accountNumber} onValueChange={(v) => setBanks((prev) => prev.map((b, idx) => idx === i ? { ...b, accountNumber: v } : b))} variant="bordered" />
                  <Input label="Opening balance (₹)" type="number" value={bank.openingBalance} onValueChange={(v) => setBanks((prev) => prev.map((b, idx) => idx === i ? { ...b, openingBalance: v } : b))} variant="bordered" />
                </div>
              </div>
            ))}

            <button
              onClick={addBankRow}
              style={{
                width: "100%", padding: "12px", borderRadius: 12,
                border: `1.5px dashed var(--hk-border)`, background: "transparent",
                cursor: "pointer", color: PU, fontSize: TYPE.body, fontWeight: 700, fontFamily: SG,
              }}
            >
              + Aur Account Jodo
            </button>
          </div>
        )}

        {/* ── Step 4: Parties ──────────────────────────────────────── */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: TYPE.h1, fontWeight: 800, fontFamily: SG, marginBottom: 6 }}>Customers / Suppliers</h2>
            <p style={{ fontSize: TYPE.body, color: "var(--hk-sub)", marginBottom: 24, fontFamily: SG }}>Pehle kuch logon ko add karo, ya baad mein Udhar Khata mein karo.</p>

            {/* Added parties list */}
            {parties.map((p, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12, marginBottom: 10,
                padding: "12px 16px", borderRadius: 10,
                background: (p.type === "CUSTOMER" ? PU : OR) + "14",
                border: `1px solid ${(p.type === "CUSTOMER" ? PU : OR)}22`,
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: TYPE.body, fontWeight: 700, fontFamily: SG }}>{p.name}</p>
                  <p style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: SG }}>{p.type === "CUSTOMER" ? "Grahak" : "Supplier"}{p.phone ? ` · ${p.phone}` : ""}</p>
                </div>
                <button onClick={() => removeParty(i)} style={{ background: "none", border: "none", cursor: "pointer", color: OR, fontSize: 14 }}>✕</button>
              </div>
            ))}

            {/* Add form */}
            <div style={{ padding: "16px", borderRadius: 12, border: "1px solid var(--hk-border)", background: "var(--hk-card)", marginTop: parties.length ? 12 : 0 }}>
              <p style={{ fontSize: TYPE.bodySmall, fontWeight: 700, textTransform: "uppercase", color: "var(--hk-sub)", letterSpacing: "0.5px", marginBottom: 12, fontFamily: SG }}>Nayi party add karo</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Input label="Naam *" value={addPartyName} onValueChange={setAddPartyName} variant="bordered" />
                <Input label="Phone (optional)" value={addPartyPhone} onValueChange={setAddPartyPhone} variant="bordered" type="tel" />
                <div style={{ display: "flex", gap: 8 }}>
                  {(["CUSTOMER", "VENDOR"] as const).map((t) => (
                    <button key={t} onClick={() => setAddPartyType(t)} style={{
                      flex: 1, padding: "10px", borderRadius: 8, border: `1.5px solid ${addPartyType === t ? (t === "CUSTOMER" ? PU : OR) : "var(--hk-border)"}`,
                      background: addPartyType === t ? (t === "CUSTOMER" ? PU + "18" : OR + "18") : "transparent",
                      color: addPartyType === t ? (t === "CUSTOMER" ? PU : OR) : "var(--hk-sub)",
                      fontSize: TYPE.bodySmall, fontWeight: 700, cursor: "pointer", fontFamily: SG,
                    }}>
                      {t === "CUSTOMER" ? "Grahak" : "Supplier"}
                    </button>
                  ))}
                </div>
                <button onClick={addParty} style={{
                  padding: "12px", borderRadius: 10, border: "none",
                  background: `linear-gradient(135deg, ${OR}, ${PU})`,
                  color: "white", fontSize: TYPE.body, fontWeight: 700, cursor: "pointer", fontFamily: SG,
                }}>+ Jodo</button>
              </div>
            </div>

            {/* Tally import deeplink */}
            <div style={{ marginTop: 14, textAlign: "center" }}>
              <a href="/settings/tally-import" style={{ fontSize: TYPE.bodySmall, fontWeight: 600, color: PU, fontFamily: SG }}>
                📥 Ya Tally se import karo →
              </a>
            </div>
          </div>
        )}

        {/* ── Step 5: Items / SKUs ─────────────────────────────────── */}
        {step === 4 && (
          <div>
            <h2 style={{ fontSize: TYPE.h1, fontWeight: 800, fontFamily: SG, marginBottom: 6 }}>Items / Saman</h2>
            <p style={{ fontSize: TYPE.body, color: "var(--hk-sub)", marginBottom: 24, fontFamily: SG }}>Jo cheezein tum bechte ho. Bills mein fast pick karne ke liye. Skip bhi kar sakte ho.</p>

            {items.map((it, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12, marginBottom: 10,
                padding: "12px 16px", borderRadius: 10,
                background: GR + "10", border: `1px solid ${GR}22`,
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: TYPE.body, fontWeight: 700, fontFamily: SG }}>{it.name}</p>
                  <p style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: SG }}>
                    {it.unit} · ₹{it.rate || "0"}{it.hsnCode ? ` · HSN ${it.hsnCode}` : ""}
                  </p>
                </div>
                <button onClick={() => removeItem(i)} style={{ background: "none", border: "none", cursor: "pointer", color: OR, fontSize: 14 }}>✕</button>
              </div>
            ))}

            <div style={{ padding: "16px", borderRadius: 12, border: "1px solid var(--hk-border)", background: "var(--hk-card)", marginTop: items.length ? 12 : 0 }}>
              <p style={{ fontSize: TYPE.bodySmall, fontWeight: 700, textTransform: "uppercase", color: "var(--hk-sub)", letterSpacing: "0.5px", marginBottom: 12, fontFamily: SG }}>Naya item add karo</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Input label="Item ka naam *" value={addItemName} onValueChange={setAddItemName} variant="bordered" />
                <div style={{ display: "flex", gap: 10 }}>
                  <Input label="Unit" value={addItemUnit} onValueChange={setAddItemUnit} variant="bordered" placeholder="pcs / kg / m" style={{ flex: 1 }} />
                  <Input label="Rate (₹)" type="number" value={addItemRate} onValueChange={setAddItemRate} variant="bordered" style={{ flex: 1 }} />
                </div>
                <Input label="HSN Code (optional)" value={addItemHsn} onValueChange={setAddItemHsn} variant="bordered" placeholder="E.g. 5208" />
                <button onClick={addItem} style={{
                  padding: "12px", borderRadius: 10, border: "none",
                  background: `linear-gradient(135deg, ${GR}, ${PU})`,
                  color: "white", fontSize: TYPE.body, fontWeight: 700, cursor: "pointer", fontFamily: SG,
                }}>+ Jodo</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 6: CA Contact ───────────────────────────────────── */}
        {step === 5 && (
          <div>
            <h2 style={{ fontSize: TYPE.h1, fontWeight: 800, fontFamily: SG, marginBottom: 6 }}>CA ka Contact</h2>
            <p style={{ fontSize: TYPE.body, color: "var(--hk-sub)", marginBottom: 24, fontFamily: SG }}>
              Tally file bhejna hoga toh CA ka email auto-fill ho jayega. Skip bhi kar sakte ho.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Input label="CA ka naam" value={caName} onValueChange={setCaName} variant="bordered" size="lg" placeholder="Jaise: Pradeep Sharma" />
              <Input label="CA ka email" type="email" value={caEmail} onValueChange={setCaEmail} variant="bordered" size="lg" placeholder="ca@example.com" />
              <Input label="CA ka phone" type="tel" value={caPhone} onValueChange={setCaPhone} variant="bordered" size="lg" placeholder="+91 98765 43210" />
            </div>
          </div>
        )}

        {/* ── Step 7: Done ─────────────────────────────────────────── */}
        {step === 6 && (
          <div style={{ textAlign: "center", paddingTop: 16 }}>
            <p style={{ fontSize: 64, marginBottom: 20 }}>🎉</p>
            <h2 style={{ fontSize: TYPE.h1, fontWeight: 800, fontFamily: SG, marginBottom: 10 }}>Sab Set Hai!</h2>
            <p style={{ fontSize: TYPE.body, color: "var(--hk-sub)", fontFamily: SG, marginBottom: 28 }}>
              Business details, GSTIN, bank accounts — sab save ho gaya. Pehla bill banao aur shuru karo!
            </p>

            <div style={{ background: "var(--hk-card)", borderRadius: 14, border: "1px solid var(--hk-border)", padding: "20px", marginBottom: 28, textAlign: "left" }}>
              <p style={{ fontSize: TYPE.bodySmall, fontWeight: 700, textTransform: "uppercase", color: "var(--hk-sub)", letterSpacing: "0.5px", fontFamily: SG, marginBottom: 14 }}>Summary</p>
              {[
                { label: "Business", value: businessName || "—" },
                { label: "State", value: stateName || "—" },
                { label: "GSTIN", value: gstin || "Skip kiya" },
                { label: "Banks added", value: banks.filter((b) => b.bankName).length.toString() },
                { label: "Parties added", value: parties.length.toString() },
                { label: "Items added", value: items.length.toString() },
                { label: "CA", value: caName || caEmail || "Skip kiya" },
              ].map((row) => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid var(--hk-border)" }}>
                  <p style={{ fontSize: TYPE.body, color: "var(--hk-sub)", fontFamily: SG }}>{row.label}</p>
                  <p style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG, textAlign: "right", maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.value}</p>
                </div>
              ))}
            </div>

            <p style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: SG, marginBottom: 20 }}>
              Settings mein sab kuch baad mein edit kar sakte ho.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 10, background: OR + "14", border: `1px solid ${OR}33`, color: OR, fontSize: TYPE.bodySmall, fontWeight: 600, fontFamily: SG }}>
            ⚠ {error}
          </div>
        )}
      </div>

      {/* Sticky bottom nav */}
      <div style={{
        position: "sticky", bottom: 0,
        background: "var(--hk-card)", borderTop: "1px solid var(--hk-border)",
        padding: "16px 24px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        gap: 12,
      }}>
        <button
          onClick={goBack}
          disabled={step === 0 || saving}
          style={{
            padding: "14px 20px", borderRadius: 12, border: "1px solid var(--hk-border)",
            background: "transparent", color: "var(--hk-text)", fontSize: TYPE.body,
            fontWeight: 700, cursor: step === 0 ? "default" : "pointer",
            opacity: step === 0 ? 0 : 1, fontFamily: SG,
            minHeight: 48,
          }}
        >
          ← Peeche
        </button>

        <div style={{ display: "flex", gap: 10 }}>
          {skippable[step] && step < TOTAL_STEPS - 1 && (
            <button
              onClick={skipAndNext}
              disabled={saving}
              style={{
                padding: "14px 20px", borderRadius: 12, border: "1px solid var(--hk-border)",
                background: "transparent", color: "var(--hk-sub)", fontSize: TYPE.body,
                fontWeight: 600, cursor: "pointer", fontFamily: SG, minHeight: 48,
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
                padding: "14px 28px", borderRadius: 12, border: "none",
                background: `linear-gradient(135deg, ${OR}, ${PU})`,
                color: "white", fontSize: TYPE.body, fontWeight: 700,
                cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1,
                fontFamily: SG, minHeight: 48,
              }}
            >
              {saving ? "..." : "Aage Badho →"}
            </button>
          ) : (
            <button
              onClick={finishWizard}
              disabled={saving}
              style={{
                padding: "14px 28px", borderRadius: 12, border: "none",
                background: `linear-gradient(135deg, ${GR}, ${PU})`,
                color: "white", fontSize: TYPE.body, fontWeight: 700,
                cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1,
                fontFamily: SG, minHeight: 48,
              }}
            >
              {saving ? "..." : "Karobaar Shuru Karo ✓"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
