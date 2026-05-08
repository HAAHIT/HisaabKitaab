"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getBalanceStatusLabel,
  type SupportedPartyType,
} from "@/lib/accounting";
import {
  Button,
  Input,
  Select,
  SelectItem,
  Skeleton,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  OR, PU, GR, SG, IN, TYPE,
  fmt, fmtFull, useIsMobile,
  HKCard, HKToast, SearchBox, PillFilter,
  PageHeader, GradientButton,
} from "@/components/ui/hk-design";
import { OverdueBanner } from "@/components/ui/OverdueBanner";
import { normalizeIndianPhone, buildWhatsAppReminderUrl } from "@/lib/phone";
import { useOverdueData } from "@/hooks/useOverdueData";

interface Party {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  type: string;
  currentBalance: number;
  isActive: boolean;
  _count?: { payments: number };
}

function roundBalance(value: number) {
  return Math.round(value * 100) / 100;
}

async function readError(response: Response) {
  const data = await response.json().catch(() => null);
  return data?.error || "Request failed";
}

export default function PartiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const overdue = useOverdueData();
  const addNewHandled = useRef(false);

  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [overflowPartyId, setOverflowPartyId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"ALL" | "CUSTOMER" | "VENDOR">("ALL");
  const [overdueFilter, setOverdueFilter] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Auto-open add panel when ?addNew=true (from Smart FAB §5.5)
  useEffect(() => {
    if (!addNewHandled.current && searchParams.get("addNew") === "true") {
      addNewHandled.current = true;
      openCreate();
    }
  }, [searchParams]);

  // Sync overdue filter from URL
  useEffect(() => {
    setOverdueFilter(searchParams.get("overdue") === "true");
  }, [searchParams]);

  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formGstin, setFormGstin] = useState("");
  const [formType, setFormType] = useState("CUSTOMER");
  const [formBalance, setFormBalance] = useState("0");
  const [companyName, setCompanyName] = useState("");

  const fetchParties = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("sortBy", "balance");
      if (search) params.set("search", search);
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      if (overdueFilter) params.set("overdue", "true");

      const [response, settingsRes] = await Promise.all([
        fetch(`/api/parties?${params.toString()}`),
        companyName ? Promise.resolve(null) : fetch("/api/settings"),
      ]);
      if (!response.ok) throw new Error(await readError(response));

      const data = await response.json();
      setParties((data.parties || []) as Party[]);
      if (settingsRes) {
        const s = await settingsRes.json().catch(() => null);
        if (s?.settings?.companyName) setCompanyName(s.settings.companyName as string);
      }
    } catch (error) {
      setParties([]);
      setToast({
        message: error instanceof Error ? error.message : t("payments.loadPartiesFailed"),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [search, t, typeFilter, overdueFilter]);

  useEffect(() => {
    fetchParties();
  }, [fetchParties]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  function openCreate() {
    setEditingParty(null);
    setFormName("");
    setFormPhone("");
    setFormEmail("");
    setFormAddress("");
    setFormGstin("");
    setFormType("CUSTOMER");
    setFormBalance("0");
    setShowPanel(true);
  }

  function openEdit(party: Party) {
    setEditingParty(party);
    setFormName(party.name);
    setFormPhone(party.phone || "");
    setFormEmail(party.email || "");
    setFormAddress(party.address || "");
    setFormGstin(party.gstin || "");
    setFormType(party.type);
    setFormBalance("0");
    setShowPanel(true);
  }

  async function handleSave() {
    if (!formName.trim()) {
      showToast(t("parties.nameRequired"), "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        phone: formPhone.trim() || null,
        email: formEmail.trim() || null,
        address: formAddress.trim() || null,
        gstin: formGstin.trim() || null,
        type: formType,
      };

      const response = editingParty
        ? await fetch(`/api/parties/${editingParty.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/parties", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...payload,
              openingBalance: Number.parseFloat(formBalance) || 0,
            }),
          });

      if (!response.ok) throw new Error(await readError(response));

      showToast(editingParty ? t("parties.updated") : t("parties.created"), "success");
      setShowPanel(false);
      await fetchParties();
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("parties.saveFailed"), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(party: Party) {
    if (!confirm(`${t("parties.archiveConfirm")} "${party.name}"?`)) return;
    try {
      const response = await fetch(`/api/parties/${party.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await readError(response));
      showToast(t("parties.archived"), "success");
      await fetchParties();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t("parties.archiveFailed"),
        "error"
      );
    }
  }

  // Lena Baki = parties owe us (customer with negative balance), Dena Baki = we owe (vendor with negative balance)
  const lenaTotal = parties
    .filter((p) => p.type === "CUSTOMER" && p.currentBalance < 0)
    .reduce((s, p) => s + Math.abs(p.currentBalance), 0);
  const denaTotal = parties
    .filter((p) => p.type === "VENDOR" && p.currentBalance < 0)
    .reduce((s, p) => s + Math.abs(p.currentBalance), 0);
  const lenaCount = parties.filter((p) => p.type === "CUSTOMER" && p.currentBalance < 0).length;
  const denaCount = parties.filter((p) => p.type === "VENDOR" && p.currentBalance < 0).length;

  const filterOptions = [
    { key: "ALL" as const, label: "Sab" },
    { key: "CUSTOMER" as const, label: "Grahak" },
    { key: "VENDOR" as const, label: "Supplier" },
  ];

  return (
    <>
      <div
        style={{
          background: "var(--hk-bg)",
          minHeight: "100%",
          paddingBottom: 0,
          fontFamily: SG,
        }}
      >
        {toast && <HKToast message={toast.message} type={toast.type} />}

        <PageHeader
          title="Udhar Khata"
          subtitle="Party-wise hisaab"
          isMobile={isMobile}
          action={<GradientButton onClick={openCreate}>+ Party Jodo</GradientButton>}
        />

        <div style={{ padding: isMobile ? "0 14px" : "0 28px", maxWidth: 1440, margin: "0 auto" }}>
          {/* Overdue banner */}
          <OverdueBanner
            overdueCount={overdue.overdueCount}
            overdueAmount={overdue.overdueAmount}
            overdueParty={overdue.overdueParty}
          />

          {/* Lena/Dena summary */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                padding: "18px 20px",
                borderRadius: 16,
                background: GR + "14",
                border: `1px solid ${GR}28`,
              }}
            >
              <p
                style={{
                  fontSize: TYPE.caption,
                  fontWeight: 700,
                  color: GR,
                  textTransform: "uppercase",
                  letterSpacing: "0.6px",
                  marginBottom: 6,
                  fontFamily: SG,
                }}
              >
                ↑ Lena Baki
              </p>
              <p
                style={{
                  fontSize: isMobile ? TYPE.numMedium + 4 : TYPE.numLarge,
                  fontWeight: 800,
                  color: "var(--hk-text)",
                  fontFamily: IN,
                  letterSpacing: "-0.5px",
                  lineHeight: 1.1,
                }}
              >
                {fmtFull(lenaTotal)}
              </p>
              <p style={{ fontSize: TYPE.bodySmall, fontWeight: 600, color: GR, marginTop: 6, fontFamily: SG }}>
                {lenaCount} {lenaCount === 1 ? "party" : "parties"} se milna hai
              </p>
            </div>
            <div
              style={{
                padding: "18px 20px",
                borderRadius: 16,
                background: OR + "14",
                border: `1px solid ${OR}28`,
              }}
            >
              <p
                style={{
                  fontSize: TYPE.caption,
                  fontWeight: 700,
                  color: OR,
                  textTransform: "uppercase",
                  letterSpacing: "0.6px",
                  marginBottom: 6,
                  fontFamily: SG,
                }}
              >
                ↓ Dena Baki
              </p>
              <p
                style={{
                  fontSize: isMobile ? TYPE.numMedium + 4 : TYPE.numLarge,
                  fontWeight: 800,
                  color: "var(--hk-text)",
                  fontFamily: IN,
                  letterSpacing: "-0.5px",
                  lineHeight: 1.1,
                }}
              >
                {fmtFull(denaTotal)}
              </p>
              <p style={{ fontSize: TYPE.bodySmall, fontWeight: 600, color: OR, marginTop: 6, fontFamily: SG }}>
                {denaCount} {denaCount === 1 ? "party" : "parties"} ko dena hai
              </p>
            </div>
          </div>

          {/* Search + filter */}
          <div style={{ display: "flex", gap: 10, marginBottom: overdueFilter ? 8 : 16, flexWrap: "wrap" }}>
            <SearchBox value={search} onChange={setSearch} placeholder="Party dhundho..." />
            <PillFilter options={filterOptions} value={typeFilter} onChange={setTypeFilter} />
          </div>

          {/* Overdue filter active chip */}
          {overdueFilter && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 12px", borderRadius: 20,
                background: OR + "18", border: `1px solid ${OR}40`,
                fontSize: TYPE.bodySmall, fontWeight: 700, color: OR, fontFamily: SG,
              }}>
                ⏰ Overdue parties sirf
                <button
                  onClick={() => router.replace("/parties")}
                  aria-label="Clear overdue filter"
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: OR, fontSize: 14, fontWeight: 700,
                    lineHeight: 1, padding: "0 2px",
                  }}
                >✕</button>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 rounded-2xl" />
              ))}
            </div>
          ) : parties.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--hk-sub)" }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>👥</div>
              <p
                style={{
                  fontWeight: 700,
                  fontSize: TYPE.h2,
                  color: "var(--hk-text)",
                  marginBottom: 8,
                  fontFamily: SG,
                }}
              >
                {search || typeFilter !== "ALL" ? "Koi party nahi mili" : "Abhi tak koi party nahi"}
              </p>
              <p style={{ fontSize: TYPE.body, fontWeight: 500, fontFamily: SG, marginBottom: 20 }}>
                {search || typeFilter !== "ALL"
                  ? "Search badlo ya nayi party jodo"
                  : "Pehli party jodke hisaab shuru karo"}
              </p>
              {!search && typeFilter === "ALL" && (
                <GradientButton onClick={openCreate}>+ Pehli Party Jodo</GradientButton>
              )}
            </div>
          ) : (
            <HKCard style={{ padding: "0 16px" }}>
              {parties.map((party, i) => {
                const isLena = party.currentBalance < 0;
                const color = isLena ? GR : OR;
                const initials = party.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <div
                    key={party.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "16px 0",
                      borderBottom:
                        i < parties.length - 1 ? "1px solid var(--hk-border)" : "none",
                      minHeight: 72,
                    }}
                  >
                    <div
                      onClick={() => router.push(`/parties/${party.id}`)}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 13,
                        background: color + "20",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontSize: TYPE.body, fontWeight: 800, color, fontFamily: IN }}>
                        {initials}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 12,
                        }}
                      >
                        <div
                          onClick={() => router.push(`/parties/${party.id}`)}
                          style={{ cursor: "pointer", minWidth: 0, flex: 1 }}
                        >
                          <p
                            style={{
                              fontSize: TYPE.bodyLarge,
                              fontWeight: 700,
                              color: "var(--hk-text)",
                              marginBottom: 5,
                              fontFamily: SG,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {party.name}
                          </p>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                fontSize: TYPE.chip,
                                fontWeight: 700,
                                color: party.type === "CUSTOMER" ? PU : "var(--hk-sub)",
                                background:
                                  party.type === "CUSTOMER" ? PU + "18" : "var(--hk-badge)",
                                padding: "3px 9px",
                                borderRadius: 6,
                                fontFamily: SG,
                              }}
                            >
                              {party.type === "CUSTOMER" ? "Grahak" : "Supplier"}
                            </span>
                            {party.phone && (
                              <span
                                style={{
                                  fontSize: TYPE.bodySmall,
                                  fontWeight: 500,
                                  color: "var(--hk-sub)",
                                  fontFamily: SG,
                                }}
                              >
                                {party.phone}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <p
                            style={{
                              fontSize: TYPE.numMedium,
                              fontWeight: 800,
                              color,
                              fontFamily: IN,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {isLena ? "+" : "-"}
                            {fmt(Math.abs(party.currentBalance))}
                          </p>
                          <p
                            style={{
                              fontSize: TYPE.caption,
                              fontWeight: 600,
                              color: "var(--hk-sub)",
                              marginTop: 4,
                              fontFamily: SG,
                            }}
                          >
                            {getBalanceStatusLabel(
                              party.type as SupportedPartyType,
                              roundBalance(party.currentBalance)
                            )}
                          </p>
                        </div>
                        {/* Call / WhatsApp / Overflow (§5.3) */}
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            alignItems: "center",
                            flexShrink: 0,
                          }}
                        >
                          {/* Call button */}
                          {party.phone && (
                            <a
                              href={`tel:${normalizeIndianPhone(party.phone)}`}
                              aria-label={`Call ${party.name}`}
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                border: "1px solid var(--hk-border)",
                                background: GR + "14",
                                color: GR,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                textDecoration: "none",
                              }}
                            >
                              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round">
                                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                              </svg>
                            </a>
                          )}
                          {/* WhatsApp button */}
                          {party.phone && (
                            <a
                              href={buildWhatsAppReminderUrl({
                                phone: party.phone,
                                partyName: party.name,
                                balanceAmount: Math.abs(party.currentBalance),
                                tenantName: companyName || undefined,
                              })}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`WhatsApp ${party.name}`}
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                border: "1px solid var(--hk-border)",
                                background: "#25D36614",
                                color: "#25D366",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                textDecoration: "none",
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                                <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.243-1.214l-.257-.154-2.952.877.877-2.952-.154-.257A8 8 0 1112 20z" />
                              </svg>
                            </a>
                          )}
                          {/* Overflow menu */}
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOverflowPartyId(overflowPartyId === party.id ? null : party.id);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.stopPropagation();
                                setOverflowPartyId(overflowPartyId === party.id ? null : party.id);
                              }
                            }}
                            aria-label={`More actions for ${party.name}`}
                            aria-haspopup="true"
                            aria-expanded={overflowPartyId === party.id}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 10,
                              border: "1px solid var(--hk-border)",
                              background: "var(--hk-badge)",
                              color: "var(--hk-sub)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              position: "relative",
                            }}
                          >
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round">
                              <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
                            </svg>
                            {overflowPartyId === party.id && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "100%",
                                  right: 0,
                                  marginTop: 4,
                                  background: "var(--hk-card)",
                                  border: "1px solid var(--hk-border)",
                                  borderRadius: 12,
                                  boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                                  zIndex: 10,
                                  minWidth: 140,
                                  overflow: "hidden",
                                }}
                              >
                                <button
                                  onClick={(e) => { e.stopPropagation(); setOverflowPartyId(null); router.push(`/bills/new?partyId=${party.id}`); }}
                                  style={{
                                    width: "100%", padding: "10px 14px",
                                    display: "flex", alignItems: "center", gap: 8,
                                    background: "transparent", border: "none", cursor: "pointer",
                                    fontSize: 14, fontWeight: 600, color: "var(--hk-text)", fontFamily: SG,
                                  }}
                                >
                                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                                  Naya Bill
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setOverflowPartyId(null); router.push(`/payments/new?partyId=${party.id}`); }}
                                  style={{
                                    width: "100%", padding: "10px 14px",
                                    display: "flex", alignItems: "center", gap: 8,
                                    background: "transparent", border: "none", cursor: "pointer",
                                    fontSize: 14, fontWeight: 600, color: "var(--hk-text)", fontFamily: SG,
                                  }}
                                >
                                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                                  Payment Record
                                </button>
                                <div style={{ height: 1, background: "var(--hk-border)", margin: "4px 0" }} />
                                <button
                                  onClick={(e) => { e.stopPropagation(); setOverflowPartyId(null); openEdit(party); }}
                                  style={{
                                    width: "100%", padding: "10px 14px",
                                    display: "flex", alignItems: "center", gap: 8,
                                    background: "transparent", border: "none", cursor: "pointer",
                                    fontSize: 14, fontWeight: 600, color: "var(--hk-text)", fontFamily: SG,
                                  }}
                                >
                                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setOverflowPartyId(null); handleDelete(party); }}
                                  style={{
                                    width: "100%", padding: "10px 14px",
                                    display: "flex", alignItems: "center", gap: 8,
                                    background: "transparent", border: "none", cursor: "pointer",
                                    fontSize: 14, fontWeight: 600, color: OR, fontFamily: SG,
                                  }}
                                >
                                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </HKCard>
          )}
        </div>
      </div>

      {/* ── Slide-in edit panel ─────────────────────────────────────────── */}
      {showPanel && (
        <>
          <div
            onClick={() => setShowPanel(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              zIndex: 499,
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
          />
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: isMobile ? "100%" : 480,
              zIndex: 500,
              display: "flex",
              flexDirection: "column",
              background: "var(--hk-card)",
              borderLeft: "1px solid var(--hk-border)",
              boxShadow: "-16px 0 48px rgba(0,0,0,0.35)",
              fontFamily: SG,
              animation: "slideInRight 0.3s ease-out",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "16px 20px",
                borderBottom: "1px solid var(--hk-border)",
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => setShowPanel(false)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  border: "1px solid var(--hk-border)",
                  background: "var(--hk-badge)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "var(--hk-sub)",
                  flexShrink: 0,
                }}
                aria-label="Close panel"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <div>
                <h2
                  style={{
                    fontSize: TYPE.h2,
                    fontWeight: 700,
                    color: "var(--hk-text)",
                    letterSpacing: "-0.3px",
                    fontFamily: SG,
                  }}
                >
                  {editingParty ? "Party Edit Karo" : "Nayi Party Jodo"}
                </h2>
                <p style={{ fontSize: TYPE.bodySmall, fontWeight: 500, color: "var(--hk-sub)", marginTop: 3, fontFamily: SG }}>
                  {editingParty ? "Details update karo" : "Grahak ya supplier add karo"}
                </p>
              </div>
            </div>

            {/* Body */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <Input
                label="Naam"
                placeholder={t("parties.namePlaceholder")}
                value={formName}
                onValueChange={setFormName}
                variant="bordered"
                isRequired
              />
              <Input
                label="Phone"
                placeholder={t("bills.phonePlaceholder")}
                value={formPhone}
                onValueChange={setFormPhone}
                variant="bordered"
                type="tel"
              />
              <Input
                label="Email"
                placeholder={t("parties.emailPlaceholder")}
                value={formEmail}
                onValueChange={setFormEmail}
                variant="bordered"
                type="email"
              />
              <Input
                label="Pata"
                placeholder={t("bills.addressPlaceholder")}
                value={formAddress}
                onValueChange={setFormAddress}
                variant="bordered"
              />
              <Input
                label="GSTIN"
                placeholder={t("bills.gstinPlaceholder")}
                value={formGstin}
                onValueChange={setFormGstin}
                variant="bordered"
              />
              <Select
                label="Type"
                placeholder="Grahak ya Supplier"
                selectedKeys={new Set([formType])}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0] as string;
                  if (value) setFormType(value);
                }}
                variant="bordered"
              >
                <SelectItem key="CUSTOMER">Grahak (Customer)</SelectItem>
                <SelectItem key="VENDOR">Supplier (Vendor)</SelectItem>
              </Select>
              {!editingParty && (
                <Input
                  label="Opening Balance"
                  placeholder="0"
                  type="number"
                  value={formBalance}
                  onValueChange={setFormBalance}
                  variant="bordered"
                  description={
                    formType === "CUSTOMER"
                      ? t("parties.customerBalanceHelp")
                      : t("parties.vendorBalanceHelp")
                  }
                />
              )}
            </div>

            {/* Footer actions */}
            <div
              style={{
                padding: "14px 20px",
                borderTop: "1px solid var(--hk-border)",
                display: "flex",
                gap: 10,
                flexShrink: 0,
              }}
            >
              <Button
                variant="flat"
                style={{ flex: 1 }}
                onPress={() => setShowPanel(false)}
              >
                Cancel
              </Button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  flex: 2,
                  minHeight: 48,
                  padding: "0 20px",
                  borderRadius: 14,
                  background: `linear-gradient(135deg, ${OR}, ${PU})`,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: TYPE.body,
                  cursor: saving ? "not-allowed" : "pointer",
                  border: "none",
                  fontFamily: SG,
                  boxShadow: `0 4px 16px ${OR}44`,
                  opacity: saving ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {saving ? (
                  <>
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        border: "2.5px solid rgba(255,255,255,0.3)",
                        borderTopColor: "white",
                        display: "inline-block",
                        animation: "hk-spin 0.7s linear infinite",
                      }}
                    />{" "}
                    Saving...
                  </>
                ) : editingParty ? (
                  "Update Karo ✓"
                ) : (
                  "Party Jodo ✓"
                )}
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
