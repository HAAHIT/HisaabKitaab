"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
} from "@heroui/react";
import { useTheme } from "next-themes";
import BottomSheet from "./BottomSheet";
import { QuickBillSheet } from "@/components/bills/QuickBillSheet";
import { useLanguage } from "@/contexts/LanguageContext";
import { TranslationKey } from "@/lib/i18n/translations";
import { FEATURE_FLAGS, type FeatureFlagKey } from "@/lib/feature-flags";
import { TYPE, TOUCH } from "./hk-design";

interface UserSession {
  userId: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
}

interface NavItem {
  label: string;
  hindiLabel: string;
  translationKey: TranslationKey;
  href: string;
  roles: string[];
  featureFlag?: FeatureFlagKey;
  icon: React.ReactNode;
}

type AppRole = "ADMIN" | "STAFF" | "ACCOUNTANT" | "CUSTOMER";

const ROLE_TRANSLATION_KEYS: Record<AppRole, TranslationKey> = {
  ADMIN: "users.admin",
  STAFF: "users.staff",
  ACCOUNTANT: "users.accountant",
  CUSTOMER: "users.customer",
};

function resolveRoleTranslationKey(role: string): TranslationKey {
  return ROLE_TRANSLATION_KEYS[role as AppRole] ?? "users.staff";
}

const PRIMARY_TABS: NavItem[] = [
  {
    label: "Dashboard",
    hindiLabel: "होम",
    translationKey: "nav.home",
    href: "/dashboard",
    roles: ["ADMIN", "STAFF", "ACCOUNTANT"],
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    label: "Mere Bills",
    hindiLabel: "बिल",
    translationKey: "nav.bills",
    href: "/bills",
    roles: ["ADMIN", "STAFF", "ACCOUNTANT"],
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="9" y1="13" x2="15" y2="13"/>
      </svg>
    ),
  },
  {
    label: "Udhar Khata",
    hindiLabel: "खाता",
    translationKey: "nav.parties",
    href: "/parties",
    roles: ["ADMIN", "STAFF", "ACCOUNTANT"],
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    label: "Payments",
    hindiLabel: "पेमेंट",
    translationKey: "nav.payments",
    href: "/payments",
    roles: ["ADMIN", "STAFF", "ACCOUNTANT"],
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2"/>
        <line x1="1" y1="10" x2="23" y2="10"/>
      </svg>
    ),
  },
];

const MORE_NAV: NavItem[] = [
  {
    label: "Purchases",
    hindiLabel: "खरीद",
    translationKey: "nav.purchases" as TranslationKey,
    href: "/purchases",
    roles: ["ADMIN", "STAFF", "ACCOUNTANT"],
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
      </svg>
    ),
  },
  {
    label: "Transactions",
    hindiLabel: "लेन-देन",
    translationKey: "nav.transactions" as TranslationKey,
    href: "/transactions",
    roles: ["ADMIN", "STAFF", "ACCOUNTANT"],
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
      </svg>
    ),
  },
  {
    label: "Banking",
    hindiLabel: "बैंकिंग",
    translationKey: "nav.banking",
    href: "/banking",
    roles: ["ADMIN", "STAFF", "ACCOUNTANT"],
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/>
      </svg>
    ),
  },
  {
    label: "Reports",
    hindiLabel: "रिपोर्ट",
    translationKey: "nav.reports",
    href: "/reports",
    roles: ["ADMIN", "ACCOUNTANT"],
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
      </svg>
    ),
  },
  {
    label: "Notes",
    hindiLabel: "नोट्स",
    translationKey: "nav.notes",
    href: "/notes",
    roles: ["ADMIN", "STAFF", "ACCOUNTANT"],
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 14l-4-4m0 0l4-4m-4 4h12M15 10l4 4m0 0l-4 4m4-4H3"/>
      </svg>
    ),
  },
  {
    label: "Measurements",
    hindiLabel: "माप",
    translationKey: "nav.measures",
    href: "/measurements",
    roles: ["ADMIN", "STAFF"],
    featureFlag: "measurementsUi",
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5-5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"/>
      </svg>
    ),
  },
];

// ── Theme Toggle ──────────────────────────────────────────────────────────────

function ThemeToggleBtn() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div style={{ width: 44, height: 44 }} />;
  const isDark = resolvedTheme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Light mode" : "Dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        width: 44, height: 44, borderRadius: 12,
        border: "1px solid var(--hk-border)",
        background: "var(--hk-badge)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--hk-sub)", cursor: "pointer", transition: "background 0.15s",
        flexShrink: 0,
      }}
    >
      {isDark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  );
}

// ── HK Logo ───────────────────────────────────────────────────────────────────

function HKLogo() {
  return (
    <div style={{
      width: 34, height: 34, borderRadius: 10, flexShrink: 0,
      background: "linear-gradient(135deg, #f76000, #7b5ef6)",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 4px 12px rgba(247,96,0,0.27)",
    }}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        <line x1="9" y1="8" x2="15" y2="8"/>
        <line x1="9" y1="12" x2="12" y2="12"/>
      </svg>
    </div>
  );
}

// ── Main AppShell ─────────────────────────────────────────────────────────────

export default function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: UserSession;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [quickBillOpen, setQuickBillOpen] = useState(false);
  const [smartFabOpen, setSmartFabOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
        (document.activeElement as HTMLElement)?.isContentEditable) return;
      if (e.key === "F8") { e.preventDefault(); router.push("/bills/new"); }
      else if (e.key === "F9") { e.preventDefault(); router.push("/purchases/new"); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  const canQuickBill = user.role !== "CUSTOMER";
  const roleLabel = t(resolveRoleTranslationKey(user.role));
  const initials = user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const primaryTabs = useMemo(
    () => PRIMARY_TABS.filter((item) => item.roles.includes(user.role)),
    [user.role]
  );

  const moreItems = useMemo(
    () => MORE_NAV.filter(
      (item) =>
        item.roles.includes(user.role) &&
        (!item.featureFlag || FEATURE_FLAGS[item.featureFlag as keyof typeof FEATURE_FLAGS])
    ),
    [user.role]
  );

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function openSmartFab() {
    setMoreSheetOpen(false);
    setSmartFabOpen(true);
  }

  function openQuickBill() {
    setSmartFabOpen(false);
    setMoreSheetOpen(false);
    setQuickBillOpen(true);
  }

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }


  return (
    <div className="app-shell-root" style={{ minHeight: "100vh", background: "var(--hk-bg)", transition: "background 0.25s" }}>
      {/* ── Top NavBar ─────────────────────────────────────── */}
      <header className="no-print" style={{
        height: 64, background: "var(--hk-nav)",
        borderBottom: "1px solid var(--hk-border)",
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        padding: "0 20px",
        position: "sticky", top: 0, zIndex: 200,
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        transition: "background 0.25s",
      }}>
        {/* Left — Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <HKLogo />
          <span className="hidden lg:block" style={{
            fontSize: TYPE.bodyLarge, fontWeight: 700, color: "var(--hk-text)",
            letterSpacing: "-0.3px", fontFamily: "var(--font-space-grotesk)",
          }}>
            HisaabKitaab
          </span>
        </div>

        {/* Center — Nav tabs, truly centered */}
        <div style={{
          display: "flex",
          background: "var(--hk-pill)", borderRadius: 12, padding: 4,
          gap: 2, overflowX: "auto", scrollbarWidth: "none",
        }}>
          {primaryTabs.map((tab) => {
            const active = isActive(tab.href);
            return (
              <button
                key={tab.href}
                onClick={() => router.push(tab.href)}
                style={{
                  minHeight: 36, whiteSpace: "nowrap",
                  padding: "0 16px", borderRadius: 8, border: "none", cursor: "pointer",
                  fontSize: TYPE.body, fontWeight: active ? 700 : 500,
                  color: active ? "var(--hk-text)" : "var(--hk-sub)",
                  background: active ? "var(--hk-pill-active)" : "transparent",
                  transition: "all 0.15s", fontFamily: "var(--font-space-grotesk)",
                  flexShrink: 0,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right — Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>
          {canQuickBill && (
            <button
              onClick={openSmartFab}
              className="hidden lg:flex"
              style={{
                alignItems: "center", gap: 8,
                minHeight: TOUCH.secondary, padding: "0 20px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #f76000, #7b5ef6)",
                color: "#fff", fontSize: TYPE.body, fontWeight: 700,
                fontFamily: "var(--font-space-grotesk)", border: "none",
                cursor: "pointer", boxShadow: "0 4px 16px rgba(247,96,0,0.27)",
              }}
            >
              + Quick Add
            </button>
          )}

          <ThemeToggleBtn />

          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <button style={{
                width: 40, height: 40, borderRadius: "50%", cursor: "pointer",
                background: "linear-gradient(135deg, #7b5ef6, #f76000)",
                display: "flex", alignItems: "center", justifyContent: "center", border: "none",
              }}>
                <span style={{ fontSize: TYPE.bodySmall, fontWeight: 700, color: "white", fontFamily: "var(--font-inter)" }}>
                  {initials}
                </span>
              </button>
            </DropdownTrigger>
            <DropdownMenu aria-label="User menu">
              <DropdownItem key="profile" className="h-14 gap-2" textValue={user.name}>
                <p className="font-semibold">{user.name}</p>
                <p className="text-sm text-default-500">{user.email || user.phone || roleLabel}</p>
              </DropdownItem>
              <DropdownItem key="lang" textValue="Language" onPress={() => setLanguage(language === "en" ? "hi" : "en")}>
                {language === "en" ? "Switch to हिंदी" : "Switch to English"}
              </DropdownItem>
              {(user.role === "ADMIN" ? (
                <DropdownItem key="settings" textValue="Settings" onPress={() => router.push("/settings/company")}>
                  Settings
                </DropdownItem>
              ) : null) as never}
              {(user.role === "ADMIN" || user.role === "ACCOUNTANT" ? (
                <DropdownItem key="tally-export" textValue="Tally ko Bhejo" onPress={() => router.push("/settings/tally-export")}>
                  Tally Export
                </DropdownItem>
              ) : null) as never}
              {(user.role === "ADMIN" ? (
                <DropdownItem key="tally-import" textValue="Tally se Laao" onPress={() => router.push("/settings/tally-import")}>
                  Tally Import
                </DropdownItem>
              ) : null) as never}
              {(user.role === "ADMIN" || user.role === "ACCOUNTANT" ? (
                <DropdownItem key="reconcile" textValue="Bank Reconciliation" onPress={() => router.push("/settings/reconcile")}>
                  Bank Reconciliation
                </DropdownItem>
              ) : null) as never}
              <DropdownItem key="more" textValue="More" onPress={() => setMoreSheetOpen(true)}>
                More screens
              </DropdownItem>
              <DropdownItem
                key="logout" color="danger" onPress={handleLogout} textValue="Sign out"
                startContent={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                  </svg>
                }
              >
                {t("shell.signOut")}
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </header>

      {/* ── Page Content ───────────────────────────────────── */}
      <main className="main-content-area" style={{ minHeight: "calc(100vh - 64px)" }}>
        {children}
      </main>

      {/* ── More Sheet ─────────────────────────────────────── */}
      <BottomSheet isOpen={moreSheetOpen} onClose={() => setMoreSheetOpen(false)} title="Menu">
        <div className="space-y-1">
          <div className="flex items-center gap-3 rounded-2xl bg-default-100 px-3 py-3 mb-2">
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "linear-gradient(135deg, #7b5ef6, #f76000)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{user.name}</p>
              <p className="truncate text-sm text-default-500">{user.email || user.phone || roleLabel}</p>
            </div>
          </div>

          {canQuickBill && (
            <button
              onClick={openSmartFab}
              style={{
                width: "100%", borderRadius: 16, padding: "12px 16px",
                background: "linear-gradient(135deg, #f76000, #7b5ef6)",
                color: "#fff", display: "flex", alignItems: "center", gap: 10,
                border: "none", cursor: "pointer", marginBottom: 8,
                boxShadow: "0 4px 16px rgba(247,96,0,0.27)",
              }}
            >
              <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <div style={{ textAlign: "left" }}>
                <p style={{ fontWeight: 700, fontSize: 14 }}>+ Quick Add</p>
                <p style={{ fontSize: 11, opacity: 0.8 }}>Bill, payment ya party</p>
              </div>
            </button>
          )}

          {/* Secondary navigation */}
          {moreItems.map((item) => (
            <button
              key={item.href}
              onClick={() => { setMoreSheetOpen(false); router.push(item.href); }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-default-100 transition text-left"
            >
              <span style={{ color: "var(--hk-sub)" }}>{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}

          <div className="h-px bg-divider my-2" />

          {user.role === "ADMIN" && (
            <>
              {[
                { label: "Business Profile", href: "/settings/company" },
                { label: "Users", href: "/settings/users" },
                { label: "Templates", href: "/settings/templates" },
                { label: "Items", href: "/settings/items" },
                { label: "Bank Reconciliation", href: "/settings/reconcile" },
              ].map((s) => (
                <button
                  key={s.href}
                  onClick={() => { setMoreSheetOpen(false); router.push(s.href); }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-default-100 transition text-left"
                >
                  <span className="font-medium">{s.label}</span>
                </button>
              ))}
              <div className="h-px bg-divider my-2" />
            </>
          )}

          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-default-500 font-medium">Language</span>
            <Button size="sm" variant="flat" color="primary" onPress={() => setLanguage(language === "en" ? "hi" : "en")}>
              {language === "en" ? "HI" : "EN"}
            </Button>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-danger hover:bg-danger/10 transition text-left"
          >
            <svg className="w-5 h-5 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            <span className="font-semibold">{t("shell.signOut")}</span>
          </button>
        </div>
      </BottomSheet>

      {/* ── Smart FAB Sheet (§5.5) ───────────────────────────── */}
      {canQuickBill && (
        <BottomSheet isOpen={smartFabOpen} onClose={() => setSmartFabOpen(false)} title="Quick Add">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              {
                label: "Payment Likho",
                sub: "Mila ya diya record karo",
                emoji: "💰",
                bg: "#10b98118",
                border: "#10b98133",
                action: () => { setSmartFabOpen(false); router.push("/payments/new"); },
              },
              {
                label: "Naya Bill Banao",
                sub: "Quick bill create karo",
                emoji: "📝",
                bg: "#f7600018",
                border: "#f7600033",
                action: () => { setSmartFabOpen(false); openQuickBill(); },
              },
              {
                label: "Nayi Party Jodo",
                sub: "Customer ya vendor add karo",
                emoji: "👤",
                bg: "#7b5ef618",
                border: "#7b5ef633",
                action: () => { setSmartFabOpen(false); router.push("/parties?addNew=true"); },
              },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "16px 18px",
                  borderRadius: 14,
                  background: item.bg,
                  border: `1px solid ${item.border}`,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "transform 0.1s",
                }}
              >
                <span style={{ fontSize: 28, lineHeight: 1 }}>{item.emoji}</span>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "var(--hk-text)", fontFamily: "var(--font-space-grotesk)" }}>
                    {item.label}
                  </p>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "var(--hk-sub)", fontFamily: "var(--font-space-grotesk)", marginTop: 2 }}>
                    {item.sub}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      {canQuickBill && (
        <QuickBillSheet
          isOpen={quickBillOpen}
          onClose={() => setQuickBillOpen(false)}
          onBillCreated={({ id }) => router.push(`/bills/${id}`)}
        />
      )}
    </div>
  );
}
