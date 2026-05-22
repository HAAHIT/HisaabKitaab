"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useTheme } from "next-themes";
import { QuickBillSheet } from "@/components/bills/QuickBillSheet";
import { useLanguage } from "@/contexts/LanguageContext";
import { TranslationKey } from "@/lib/i18n/translations";
import { FEATURE_FLAGS, type FeatureFlagKey } from "@/lib/feature-flags";
import { TOUCH } from "./hk-design";

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
  icon: (active: boolean) => React.ReactNode;
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

// ── SVG Icons ─────────────────────────────────────────────────────────────────

const Icons = {
  home: (a: boolean) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={a ? "currentColor" : "none"} stroke="currentColor" strokeWidth={a ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  bills: (a: boolean) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>
    </svg>
  ),
  parties: (a: boolean) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  payments: (a: boolean) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  ),
  plus: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  more: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="1.6" fill="currentColor"/>
      <circle cx="19" cy="12" r="1.6" fill="currentColor"/>
      <circle cx="5" cy="12" r="1.6" fill="currentColor"/>
    </svg>
  ),
  sun: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4.5"/>
      <line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/>
      <line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/>
      <line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
      <line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/>
    </svg>
  ),
  moon: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M20 14.5A8 8 0 0 1 10 4.5c-.3 0-.6 0-.9.1A8 8 0 1 0 21 14.5c-.3 0-.6 0-1 0z"/>
    </svg>
  ),
  bell: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.7 21a2 2 0 0 1-3.4 0"/>
    </svg>
  ),
  close: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12"/>
    </svg>
  ),
  chevR: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6"/>
    </svg>
  ),
  reports: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18"/><path d="m7 14 4-4 4 4 5-5"/>
    </svg>
  ),
  settings: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33 1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  bank: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/>
      <line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/>
      <line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/>
    </svg>
  ),
  tally: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  logout: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  notes: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
    </svg>
  ),
  transactions: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  ),
  purchases: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
  ),
};

const PRIMARY_TABS = [
  { translationKey: "nav.home"      as const, href: "/dashboard", roles: ["ADMIN","STAFF","ACCOUNTANT"], icon: Icons.home },
  { translationKey: "nav.bills"     as const, href: "/bills",     roles: ["ADMIN","STAFF","ACCOUNTANT"], icon: Icons.bills },
  { translationKey: "nav.purchases" as const, href: "/purchases", roles: ["ADMIN","STAFF","ACCOUNTANT"], icon: Icons.purchases },
  { translationKey: "nav.khata"     as const, href: "/parties",   roles: ["ADMIN","STAFF","ACCOUNTANT"], icon: Icons.parties },
  { translationKey: "nav.payments"  as const, href: "/payments",  roles: ["ADMIN","STAFF","ACCOUNTANT"], icon: Icons.payments },
  { translationKey: "nav.banking"   as const, href: "/banking",   roles: ["ADMIN","STAFF","ACCOUNTANT"], icon: Icons.bank },
];

const BOTTOM_TABS: (null | { translationKey: TranslationKey; href: string | null; icon: ((a: boolean) => React.ReactNode) | null; isMore?: boolean })[] = [
  { translationKey: "nav.home.label",  href: "/dashboard", icon: Icons.home },
  { translationKey: "nav.bills.label", href: "/bills",     icon: Icons.bills },
  null,
  { translationKey: "nav.khata.label", href: "/parties",   icon: Icons.parties },
  { translationKey: "nav.more.label",  href: null,         icon: Icons.more, isMore: true },
];

const PAGE_TITLE_KEYS: Record<string, TranslationKey> = {
  "/dashboard":    "nav.home",
  "/bills":        "nav.bills",
  "/purchases":    "nav.purchases",
  "/parties":      "nav.khata",
  "/payments":     "nav.payments",
  "/banking":      "nav.banking",
  "/notes":        "nav.notes",
  "/transactions": "nav.transactions",
  "/reports":      "nav.reports",
  "/settings":     "shell.settings",
};

function getPageTitle(pathname: string, t: (key: TranslationKey) => string): string {
  for (const [prefix, key] of Object.entries(PAGE_TITLE_KEYS)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return t(key);
  }
  return "SoloBooks";
}

// ── Theme Toggle ──────────────────────────────────────────────────────────────

function ThemeToggleBtn() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div style={{ width: 40, height: 40 }} />;
  const isDark = resolvedTheme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        width: 40, height: 40, borderRadius: 10,
        border: "1px solid var(--sb-border)",
        background: "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--sb-sub)", cursor: "pointer",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--sb-hover)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      {isDark ? <Icons.sun /> : <Icons.moon />}
    </button>
  );
}

// ── Logo ──────────────────────────────────────────────────────────────────────
// Mark: bold S letterform built from two arcs — references the brand name,
// reads clearly at 34 px, and is entirely original.

function HKLogo({ size = 34 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.26),
      background: "#1e1b4b",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
      boxShadow: "0 2px 8px rgba(30,27,75,0.45)",
    }}>
      <svg
        width={Math.round(size * 0.68)}
        height={Math.round(size * 0.68)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2.3"
        strokeLinecap="round"
      >
        {/* S: top arc CCW over the crown, diagonal cross, bottom arc CW under the base */}
        <path d="M16.5 9 A4.5 4.5 0 1 0 7.5 9 L16.5 15 A4.5 4.5 0 1 1 7.5 15" />
      </svg>
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  { fg: "#6366f1", bg: "#eef0fe" },
  { fg: "#8b5cf6", bg: "#f3eefe" },
  { fg: "#ec4899", bg: "#fdeef6" },
  { fg: "#0891b2", bg: "#e8f4f7" },
  { fg: "#7c5e3c", bg: "#f5eee2" },
  { fg: "#475569", bg: "#eef1f5" },
  { fg: "#a16207", bg: "#fbf0d9" },
  { fg: "#9333ea", bg: "#f4e8fc" },
];

function UserAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const seed = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const swatch = AVATAR_PALETTE[seed % AVATAR_PALETTE.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 3,
      background: swatch.bg, color: swatch.fg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, fontSize: size * 0.36,
      fontFamily: "var(--font-sans)",
      flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

// ── Side Panel (right drawer on desktop, bottom sheet on mobile) ──────────────

function SidePanel({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open && !visible) return null;

  const panelStyle: React.CSSProperties = isMobile ? {
    position: "fixed",
    left: 0, right: 0, bottom: 0,
    maxHeight: "92vh",
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    background: "var(--sb-nav)",
    display: "flex", flexDirection: "column",
    zIndex: 301,
    transform: visible ? "translateY(0)" : "translateY(100%)",
    transition: "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
    boxShadow: "0 -4px 40px rgba(0,0,0,0.18)",
  } : {
    position: "fixed",
    top: 0, right: 0, bottom: 0,
    width: 400,
    background: "var(--sb-nav)",
    borderLeft: "1px solid var(--sb-border)",
    display: "flex", flexDirection: "column",
    zIndex: 301,
    transform: visible ? "translateX(0)" : "translateX(100%)",
    transition: "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
    boxShadow: "-4px 0 40px rgba(0,0,0,0.12)",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 300,
          background: "var(--sb-overlay)",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.25s",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
        }}
      />
      {/* Panel */}
      <div style={panelStyle}>
        {/* Mobile drag handle */}
        {isMobile && (
          <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--sb-border-strong)" }} />
          </div>
        )}
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 20px 16px",
          borderBottom: "1px solid var(--sb-divider)",
          flexShrink: 0,
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--sb-text)", margin: 0, fontFamily: "var(--font-sans)" }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 36, height: 36, borderRadius: 9,
              border: "none", background: "var(--sb-surface-alt)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--sb-sub)", cursor: "pointer",
            }}
          >
            <Icons.close />
          </button>
        </div>
        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 20px" }}>
          {children}
        </div>
      </div>
    </>
  );
}

// ── Theme toggle as menu item ─────────────────────────────────────────────────

function ThemeToggleMenuBtn() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const isDark = resolvedTheme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 12,
        padding: "12px 14px", border: "none", background: "transparent",
        cursor: "pointer", textAlign: "left", borderRadius: 10, color: "var(--sb-text)",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--sb-hover)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ color: "var(--sb-sub)" }}>{isDark ? <Icons.sun /> : <Icons.moon />}</span>
      <span style={{ fontWeight: 600, fontSize: 15 }}>{isDark ? "Light Mode" : "Dark Mode"}</span>
    </button>
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
  const pageTitle = getPageTitle(pathname, t);

  const visibleTabs = useMemo(
    () => PRIMARY_TABS.filter(tab => tab.roles.includes(user.role)),
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

  const menuItemStyle: React.CSSProperties = {
    width: "100%", display: "flex", alignItems: "center", gap: 12,
    padding: "12px 14px", border: "none", background: "transparent",
    cursor: "pointer", textAlign: "left", borderRadius: 10,
    color: "var(--sb-text)", transition: "background 0.15s",
    fontFamily: "var(--font-sans)",
  };

  return (
    <div className="app-shell-root" style={{
      minHeight: "100vh",
      background: "var(--sb-bg)",
      transition: "background 0.25s, color 0.25s",
      color: "var(--sb-text)",
    }}>
      <style>{`
        @media (min-width: 768px) {
          .sb-mobile-header { display: none !important; }
          .sb-bottom-nav-wrap { display: none !important; }
          .sb-desktop-nav { display: flex !important; }
          .sb-desktop-actions { display: flex !important; }
        }
        @media (max-width: 767px) {
          .sb-desktop-nav { display: none !important; }
          .sb-desktop-actions { display: none !important; }
          .sb-desktop-more { display: none !important; }
        }
      `}</style>

      {/* ── Unified Header ──────────────────────────────────── */}
      <header className="no-print" style={{
        height: 64,
        background: "var(--sb-nav)",
        borderBottom: "1px solid var(--sb-border)",
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        gap: 12,
        position: "sticky", top: 0, zIndex: 200,
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        transition: "background 0.25s",
      }}>
        {/* Logo + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <HKLogo size={34} />
          <span style={{
            fontFamily: "var(--font-brand, serif)",
            fontSize: 20,
            fontWeight: 600,
            color: "var(--sb-text)",
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
          }}>SoloBooks</span>
        </div>

        {/* Desktop — Nav tabs (center) */}
        <nav className="sb-desktop-nav" style={{
          flex: 1, alignItems: "center",
          justifyContent: "center", gap: 2, minWidth: 0,
          overflow: "hidden",
        }}>
          {visibleTabs.map(tab => {
            const active = isActive(tab.href);
            return (
              <button
                key={tab.href}
                onClick={() => router.push(tab.href)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "none",
                  background: active ? "var(--sb-surface-alt)" : "transparent",
                  color: active ? "var(--sb-text)" : "var(--sb-sub)",
                  fontSize: 14,
                  fontWeight: active ? 700 : 500,
                  fontFamily: "var(--font-sans)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "var(--sb-hover)"; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                {t(tab.translationKey)}
              </button>
            );
          })}
        </nav>

        {/* Mobile — page title (flex fill) */}
        <span className="sb-mobile-header" style={{
          flex: 1, fontSize: 17, fontWeight: 700,
          color: "var(--sb-text)", fontFamily: "var(--font-display)",
          letterSpacing: "-0.01em",
        }}>
          {pageTitle}
        </span>

        {/* Desktop actions */}
        <div className="sb-desktop-actions" style={{ alignItems: "center", gap: 8, flexShrink: 0 }}>
          {canQuickBill && (
            <button
              onClick={openSmartFab}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                height: 40, padding: "0 16px",
                borderRadius: 10,
                background: "var(--sb-primary)",
                color: "#fff",
                fontSize: 13, fontWeight: 600,
                fontFamily: "var(--font-sans)",
                border: "none", cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#1d4ed8")}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--sb-primary)")}
            >
              <Icons.plus /> {t("nav.billAction")}
            </button>
          )}
          <ThemeToggleBtn />
          <button
            aria-label="Notifications"
            style={{
              width: 40, height: 40, borderRadius: 10, border: "none",
              background: "transparent", color: "var(--sb-sub)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--sb-hover)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <Icons.bell />
          </button>
          <UserAvatar name={user.name} size={34} />
        </div>

        {/* More/menu button — desktop only (mobile uses bottom nav) */}
        <button
          className="sb-desktop-more"
          onClick={() => setMoreSheetOpen(true)}
          aria-label="Menu"
          style={{
            width: 40, height: 40, borderRadius: 10, border: "none",
            background: "transparent", color: "var(--sb-sub)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--sb-hover)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          <Icons.more />
        </button>
      </header>

      {/* ── Page Content ───────────────────────────────────── */}
      <main className="main-content-area" style={{ minHeight: "calc(100vh - 64px)" }}>
        {children}
      </main>

      {/* ── Mobile Bottom Nav ───────────────────────────────── */}
      <nav
        className="sb-bottom-nav-wrap no-print bottom-nav-glass"
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0,
          zIndex: 40, height: 68,
          borderTop: "1px solid var(--sb-border)",
          display: "flex", alignItems: "center",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div style={{ display: "flex", width: "100%", alignItems: "center" }}>
          {BOTTOM_TABS.map((tab, idx) => {
            if (!tab) return (
              <div key="fab" style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                <button
                  onClick={openSmartFab}
                  aria-label="Quick add"
                  style={{
                    width: 54, height: 54, borderRadius: 18,
                    border: "none",
                    background: "var(--sb-primary)",
                    color: "#fff", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transform: "translateY(-14px)",
                    boxShadow: "0 6px 18px rgba(37,99,235,0.4), 0 0 0 4px var(--sb-nav)",
                    transition: "transform 0.15s",
                  }}
                  onMouseDown={e => (e.currentTarget.style.transform = "translateY(-14px) scale(0.94)")}
                  onMouseUp={e => (e.currentTarget.style.transform = "translateY(-14px)")}
                  onMouseLeave={e => (e.currentTarget.style.transform = "translateY(-14px)")}
                >
                  <Icons.plus />
                </button>
              </div>
            );
            if (tab.isMore) {
              return (
                <button
                  key="more"
                  onClick={() => setMoreSheetOpen(true)}
                  style={{
                    flex: 1, height: "100%", border: "none",
                    background: "transparent",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", gap: 3,
                    color: "var(--sb-sub)",
                    cursor: "pointer",
                  }}
                >
                  <Icons.more />
                  <span style={{
                    fontSize: 12, fontWeight: 500,
                    fontFamily: "var(--font-sans)",
                  }}>{t(tab.translationKey)}</span>
                </button>
              );
            }
            const active = isActive(tab.href!);
            return (
              <button
                key={tab.href}
                onClick={() => router.push(tab.href!)}
                style={{
                  flex: 1, height: "100%", border: "none",
                  background: "transparent",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 3,
                  color: active ? "var(--sb-primary)" : "var(--sb-sub)",
                  cursor: "pointer",
                }}
              >
                {tab.icon!(active)}
                <span style={{
                  fontSize: 12, fontWeight: active ? 700 : 500,
                  fontFamily: "var(--font-sans)",
                }}>{t(tab.translationKey)}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── More Menu Side Panel ────────────────────────────── */}
      <SidePanel open={moreSheetOpen} onClose={() => setMoreSheetOpen(false)} title="Menu">
        {/* User profile card */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 14px", marginBottom: 14,
          borderRadius: 12, background: "var(--sb-surface-alt)",
        }}>
          <UserAvatar name={user.name} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700, fontSize: 15, color: "var(--sb-text)", margin: 0, fontFamily: "var(--font-sans)" }}>
              {user.name}
            </p>
            <p style={{ fontSize: 12, color: "var(--sb-sub)", margin: "3px 0 0", fontFamily: "var(--font-sans)" }}>
              {roleLabel}{user.email ? ` · ${user.email}` : user.phone ? ` · ${user.phone}` : ""}
            </p>
          </div>
        </div>

        {/* Quick add CTA */}
        {canQuickBill && (
          <button
            onClick={openSmartFab}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px", borderRadius: 12, marginBottom: 14,
              border: "none", cursor: "pointer",
              background: "var(--sb-primary)", color: "#fff",
              fontFamily: "var(--font-sans)",
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <Icons.plus />
            </div>
            <div style={{ textAlign: "left" }}>
              <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>{t("nav.quickActionTitle")}</p>
              <p style={{ fontSize: 12, opacity: 0.8, margin: "2px 0 0" }}>{t("nav.quickActionSub")}</p>
            </div>
          </button>
        )}

        {/* Karobaar section */}
        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--sb-muted)", textTransform: "uppercase", letterSpacing: "0.5px", padding: "0 14px 6px", margin: 0, fontFamily: "var(--font-sans)" }}>
          Karobaar
        </p>
        {[
          { label: t("nav.payments"),     href: "/payments",     icon: <>{Icons.payments(false)}</> },
          { label: t("nav.notes"),        href: "/notes",        icon: <Icons.notes /> },
          { label: t("nav.transactions"), href: "/transactions", icon: <Icons.transactions /> },
        ].map(item => (
          <button key={item.href}
            onClick={() => { setMoreSheetOpen(false); router.push(item.href); }}
            style={menuItemStyle}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--sb-hover)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ color: "var(--sb-sub)", flexShrink: 0 }}>{item.icon}</span>
            <span style={{ fontWeight: 600, fontSize: 15, flex: 1 }}>{item.label}</span>
            <span style={{ color: "var(--sb-muted)" }}><Icons.chevR /></span>
          </button>
        ))}

        {/* Tools section — role-gated */}
        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--sb-muted)", textTransform: "uppercase", letterSpacing: "0.5px", padding: "10px 14px 6px", margin: 0, fontFamily: "var(--font-sans)" }}>
          Tools
        </p>
        {[
          { label: t("nav.reports"),       href: "/reports",               icon: <Icons.reports />,  roles: ["ADMIN","ACCOUNTANT"] },
          { label: t("nav.tallyExportImport"), href: "/settings/tally-export", icon: <Icons.tally />, roles: ["ADMIN","ACCOUNTANT"] },
          { label: t("nav.reconcile"),     href: "/settings/reconcile",    icon: <Icons.bank />,     roles: ["ADMIN","ACCOUNTANT"] },
          { label: t("shell.settings"),    href: "/settings/company",      icon: <Icons.settings />, roles: ["ADMIN"] },
        ].filter(item => item.roles.includes(user.role)).map(item => (
          <button key={item.href}
            onClick={() => { setMoreSheetOpen(false); router.push(item.href); }}
            style={menuItemStyle}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--sb-hover)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ color: "var(--sb-sub)", flexShrink: 0 }}>{item.icon}</span>
            <span style={{ fontWeight: 600, fontSize: 15, flex: 1 }}>{item.label}</span>
            <span style={{ color: "var(--sb-muted)" }}><Icons.chevR /></span>
          </button>
        ))}

        <div style={{ height: 1, background: "var(--sb-divider)", margin: "10px 0" }} />

        <ThemeToggleMenuBtn />

        <div style={{ padding: "10px 14px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <span style={{ color: "var(--sb-sub)", display: "flex", alignItems: "center" }}>🌐</span>
            <span style={{ fontWeight: 600, fontSize: 15, color: "var(--sb-text)" }}>Language / Bhasha</span>
          </div>
          <div style={{ display: "flex", gap: 6, width: "100%" }}>
            {(["en", "hl", "hi"] as const).map((lang) => {
              const labels = { en: "English", hl: "Hinglish", hi: "हिंदी" };
              const isActive = language === lang;
              return (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: 8,
                    border: "none",
                    background: isActive ? "var(--sb-primary)" : "var(--sb-surface-alt)",
                    color: isActive ? "#fff" : "var(--sb-text)",
                    fontWeight: isActive ? 700 : 400,
                    fontSize: 13,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    fontFamily: "var(--font-sans)",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    outline: "none",
                  }}
                >
                  {labels[lang]}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ height: 1, background: "var(--sb-divider)", margin: "10px 0" }} />

        <button
          onClick={handleLogout}
          style={{ ...menuItemStyle, color: "var(--sb-negative)" }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--sb-hover)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          <Icons.logout />
          <span style={{ fontWeight: 600, fontSize: 15 }}>Sign Out</span>
        </button>
      </SidePanel>

      {/* ── Smart FAB Sheet ─────────────────────────────────── */}
      {canQuickBill && (
        <SidePanel open={smartFabOpen} onClose={() => setSmartFabOpen(false)} title={t("nav.quickActionTitle")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: t("nav.paymentAction"), sub: t("nav.paymentActionSub"), emoji: "💸",
                action: () => { setSmartFabOpen(false); router.push("/payments/new"); } },
              { label: t("nav.billAction"), sub: t("nav.billActionSub"), emoji: "🧾",
                action: () => { setSmartFabOpen(false); openQuickBill(); } },
              { label: t("nav.partyAction"), sub: t("nav.partyActionSub"), emoji: "👤",
                action: () => { setSmartFabOpen(false); router.push("/parties?addNew=true"); } },
            ].map(item => (
              <button key={item.label} onClick={item.action}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px", borderRadius: 12,
                  background: "var(--sb-surface-alt)",
                  border: "none", cursor: "pointer", textAlign: "left", width: "100%",
                  color: "var(--sb-text)", transition: "background 0.15s",
                  fontFamily: "var(--font-sans)",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--sb-hover)")}
                onMouseLeave={e => (e.currentTarget.style.background = "var(--sb-surface-alt)")}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: "var(--sb-card)", border: "1px solid var(--sb-border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, flexShrink: 0,
                }}>{item.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 15, color: "var(--sb-text)", margin: 0 }}>{item.label}</p>
                  <p style={{ fontSize: 12, color: "var(--sb-sub)", margin: "2px 0 0" }}>{item.sub}</p>
                </div>
                <span style={{ color: "var(--sb-muted)" }}><Icons.chevR /></span>
              </button>
            ))}
          </div>
        </SidePanel>
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
