"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { HKSkeleton } from "@/components/ui/HKSkeleton";
import {
  OR, PU, GR, AM, SG, IN, TYPE, TOUCH,
  fmtFull, useIsMobile, HKCard, HKToast, HKModal,
  PageHeader,
} from "@/components/ui/hk-design";
import { HKButton } from "@/components/ui/HKButton";
import { AddBankAccountModal } from "@/components/banking/AddBankAccountModal";

interface BankAccount {
  id: string;
  name: string;
  type: "BANK" | "CASH";
  accountNumber: string | null;
  currentBalance: number;
  isDefault: boolean;
}

function BankIcon() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
    </svg>
  );
}

function CashIcon() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  );
}

function ArrowsIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

export default function BankingPage() {
  const isMobile = useIsMobile();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<BankAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bank-accounts");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch {
      showToast("Accounts load nahi hue", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  async function handleSetDefault(account: BankAccount) {
    setSettingDefaultId(account.id);
    try {
      const res = await fetch(`/api/bank-accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Update failed");
      }
      showToast(`${account.name} default ho gaya`, "success");
      await fetchAccounts();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Default set nahi hua", "error");
    } finally {
      setSettingDefaultId(null);
    }
  }

  async function handleDelete() {
    if (!accountToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/bank-accounts/${accountToDelete.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed");
      }
      showToast("Account delete ho gaya", "success");
      setIsDeleteOpen(false);
      setAccountToDelete(null);
      await fetchAccounts();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete nahi hua", "error");
    } finally {
      setIsDeleting(false);
    }
  }

  const bankAccounts = accounts.filter((a) => a.type === "BANK");
  const cashAccounts = accounts.filter((a) => a.type === "CASH");
  const totalBank = bankAccounts.reduce((s, a) => s + Number(a.currentBalance), 0);
  const totalCash = cashAccounts.reduce((s, a) => s + Number(a.currentBalance), 0);

  return (
    <div style={{ background: "var(--sb-bg)", minHeight: "100%", fontFamily: SG }}>
      {toast && <HKToast message={toast.message} type={toast.type} />}

      <div style={{ padding: isMobile ? "18px 14px 80px" : "24px 28px 40px", maxWidth: 1200, margin: "0 auto" }}>
        <PageHeader
          title="Banking"
          subtitle="Bank aur cash accounts"
          isMobile={isMobile}
          action={
            <div style={{ display: "flex", gap: 10 }}>
              <Link href="/payments/new?tab=contra">
                <button
                  style={{
                    height: TOUCH.secondary,
                    padding: "0 18px",
                    borderRadius: 12,
                    border: "1.5px solid var(--sb-border)",
                    background: "var(--sb-card)",
                    color: "var(--sb-text)",
                    fontSize: TYPE.bodySmall,
                    fontWeight: 600,
                    fontFamily: SG,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                  }}
                >
                  <ArrowsIcon /> Contra
                </button>
              </Link>
              <HKButton onClick={() => setIsAddOpen(true)}>+ Account Jodo</HKButton>
            </div>
          }
        />

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Bank Balance", value: totalBank, color: PU, icon: <BankIcon /> },
            { label: "Cash in Hand", value: totalCash, color: GR, icon: <CashIcon /> },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                padding: "18px 20px",
                borderRadius: 16,
                background: item.color + "12",
                border: `1px solid ${item.color}28`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, color: item.color }}>
                {item.icon}
                <span style={{ fontSize: TYPE.label, fontWeight: 600, color: item.color }}>{item.label}</span>
              </div>
              <p style={{ fontSize: isMobile ? TYPE.numMedium : TYPE.numLarge - 2, fontWeight: 800, color: "var(--sb-text)", fontFamily: IN, lineHeight: 1.1 }}>
                {loading ? "..." : fmtFull(item.value)}
              </p>
            </div>
          ))}
        </div>

        {/* Accounts list */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1, 2, 3].map((i) => <HKSkeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
        ) : accounts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--sb-sub)" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🏦</div>
            <p style={{ fontWeight: 700, fontSize: TYPE.h2, color: "var(--sb-text)", marginBottom: 8, fontFamily: SG }}>
              Koi account nahi
            </p>
            <p style={{ fontSize: TYPE.body, fontWeight: 500, fontFamily: SG, marginBottom: 20 }}>
              Bank ya cash account add karo
            </p>
            <HKButton onClick={() => setIsAddOpen(true)}>+ Account Jodo</HKButton>
          </div>
        ) : (
          <HKCard style={{ padding: 0, overflow: "hidden" }}>
            {accounts.map((account, i) => {
              const isBank = account.type === "BANK";
              const color = isBank ? PU : GR;
              const bal = Number(account.currentBalance);
              const isSettingDefault = settingDefaultId === account.id;
              return (
                <div
                  key={account.id}
                  style={{
                    padding: isMobile ? "14px 16px" : "16px 20px",
                    borderBottom: i < accounts.length - 1 ? "1px solid var(--sb-border)" : undefined,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: color + "18",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, color,
                    position: "relative",
                  }}>
                    {isBank ? <BankIcon /> : <CashIcon />}
                    {account.isDefault && (
                      <div style={{
                        position: "absolute", top: -4, right: -4,
                        width: 16, height: 16, borderRadius: "50%",
                        background: AM, color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <StarIcon />
                      </div>
                    )}
                  </div>

                  {/* Name + account number */}
                  <Link href={`/banking/${account.id}`} style={{ flex: 1, minWidth: 0, textDecoration: "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <p style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG, lineHeight: 1.3 }}>
                        {account.name}
                      </p>
                      {account.isDefault && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, fontFamily: SG,
                          color: AM, background: AM + "18",
                          padding: "2px 7px", borderRadius: 6,
                          border: `1px solid ${AM}30`,
                          letterSpacing: "0.02em",
                        }}>
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: TYPE.bodySmall, fontWeight: 500, color: "var(--sb-sub)", fontFamily: SG, marginTop: 2 }}>
                      {account.type === "BANK" ? "Bank Account" : "Cash Register"}
                      {account.accountNumber && ` • ${account.accountNumber}`}
                    </p>
                  </Link>

                  {/* Balance */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{
                      fontSize: TYPE.numSmall,
                      fontWeight: 800,
                      color: bal >= 0 ? "var(--sb-text)" : OR,
                      fontFamily: IN,
                    }}>
                      {fmtFull(bal)}
                    </p>
                    <p style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", fontWeight: 500, marginTop: 2, fontFamily: SG }}>Balance</p>
                  </div>

                  {/* Set as default (bank accounts only, not already default) */}
                  {isBank && !account.isDefault && (
                    <button
                      onClick={() => handleSetDefault(account)}
                      disabled={isSettingDefault}
                      title="Default account set karo"
                      style={{
                        width: TOUCH.secondary, height: TOUCH.secondary,
                        borderRadius: 10, border: "none",
                        background: "transparent", color: "var(--sb-sub)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: isSettingDefault ? "default" : "pointer",
                        flexShrink: 0, opacity: isSettingDefault ? 0.5 : 1,
                      }}
                      onMouseEnter={(e) => { if (!isSettingDefault) { (e.currentTarget as HTMLButtonElement).style.background = AM + "15"; (e.currentTarget as HTMLButtonElement).style.color = AM; } }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--sb-sub)"; }}
                    >
                      <StarIcon />
                    </button>
                  )}

                  {/* Delete */}
                  <button
                    onClick={() => { setAccountToDelete(account); setIsDeleteOpen(true); }}
                    style={{
                      width: TOUCH.secondary, height: TOUCH.secondary,
                      borderRadius: 10, border: "none",
                      background: "transparent", color: "var(--sb-sub)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = OR + "15"; (e.currentTarget as HTMLButtonElement).style.color = OR; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--sb-sub)"; }}
                  >
                    <TrashIcon />
                  </button>

                  {/* Chevron */}
                  <Link href={`/banking/${account.id}`} style={{ color: "var(--sb-sub)", flexShrink: 0, display: "flex" }}>
                    <ChevronRight />
                  </Link>
                </div>
              );
            })}
          </HKCard>
        )}
      </div>

      <AddBankAccountModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} onSuccess={fetchAccounts} />

      <HKModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Account Delete Karo?"
        width={440}
        footer={
          <>
            <HKButton variant="secondary" onClick={() => setIsDeleteOpen(false)} isDisabled={isDeleting}>Cancel</HKButton>
            <HKButton variant="danger" onClick={handleDelete} isLoading={isDeleting}>Delete Karo</HKButton>
          </>
        }
      >
        <p style={{ fontFamily: SG, fontSize: TYPE.body, color: "var(--sb-sub)", lineHeight: 1.6 }}>
          <span style={{ fontWeight: 700, color: "var(--sb-text)" }}>{accountToDelete?.name}</span> delete ho jayega.
          Purana history safe rahega, sirf future payments mein nahi dikhega.
        </p>
      </HKModal>
    </div>
  );
}
