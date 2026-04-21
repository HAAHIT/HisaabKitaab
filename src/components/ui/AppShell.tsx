"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import {
  Button,
  Avatar,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Tooltip,
} from "@heroui/react";
import { motion } from "framer-motion";
import { ThemeSwitcher } from "./ThemeSwitcher";
import BottomSheet from "./BottomSheet";
import { QuickBillSheet } from "@/components/bills/QuickBillSheet";
import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { TranslationKey } from "@/lib/i18n/translations";
import { FEATURE_FLAGS, type FeatureFlagKey } from "@/lib/feature-flags";

interface UserSession {
  userId: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
}

interface NavItem {
  icon: React.ReactNode;
  translationKey: TranslationKey;
  href: string;
  roles: string[];
  featureFlag?: FeatureFlagKey;
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

const MAIN_NAV: NavItem[] = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    translationKey: "nav.home",
    href: "/dashboard",
    roles: ["ADMIN", "STAFF", "ACCOUNTANT"],
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    translationKey: "nav.bills",
    href: "/bills",
    roles: ["ADMIN", "STAFF", "ACCOUNTANT"],
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    translationKey: "nav.purchases" as any,
    href: "/purchases",
    roles: ["ADMIN", "STAFF", "ACCOUNTANT"],
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    translationKey: "nav.parties",
    href: "/parties",
    roles: ["ADMIN", "STAFF", "ACCOUNTANT"],
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    translationKey: "nav.transactions" as any,
    href: "/transactions",
    roles: ["ADMIN", "STAFF", "ACCOUNTANT"],
  },
];

const MORE_ITEMS: NavItem[] = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    translationKey: "nav.payments",
    href: "/payments",
    roles: ["ADMIN", "STAFF", "ACCOUNTANT"],
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l-4-4m0 0l4-4m-4 4h12M15 10l4 4m0 0l-4 4m4-4H3" />
      </svg>
    ),
    translationKey: "nav.notes",
    href: "/notes",
    roles: ["ADMIN", "STAFF", "ACCOUNTANT"],
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
    translationKey: "nav.reports",
    href: "/reports",
    roles: ["ADMIN", "ACCOUNTANT"],
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5-5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
      </svg>
    ),
    translationKey: "nav.measures",
    href: "/measurements",
    roles: ["ADMIN", "STAFF"],
    featureFlag: "measurementsUi",
  },
];

const CUSTOMER_NAV: NavItem[] = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
    translationKey: "nav.upload",
    href: "/measurements/upload",
    roles: ["CUSTOMER"],
    featureFlag: "measurementsUi",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    translationKey: "nav.myuploads",
    href: "/measurements/my-uploads",
    roles: ["CUSTOMER"],
    featureFlag: "measurementsUi",
  },
];


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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [quickBillOpen, setQuickBillOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (
        activeTag === "INPUT" ||
        activeTag === "TEXTAREA" ||
        activeTag === "SELECT" ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      
      if (e.key === "F8") {
        e.preventDefault();
        router.push("/bills/new");
      } else if (e.key === "F9") {
        e.preventDefault();
        router.push("/purchases/new");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  const showFab =
    user.role !== "CUSTOMER" &&
    !pathname.includes("/bills/new") &&
    !pathname.includes("/login");

  const navItems = useMemo(
    () =>
      (user.role === "CUSTOMER" ? CUSTOMER_NAV : [...MAIN_NAV, ...MORE_ITEMS]).filter(
        (item) =>
          item.roles.includes(user.role) &&
          (!item.featureFlag || FEATURE_FLAGS[item.featureFlag as keyof typeof FEATURE_FLAGS])
      ),
    [user.role]
  );
  
  const canQuickBill = user.role !== "CUSTOMER";
  const hasMoreSheet = user.role !== "CUSTOMER";
  const roleLabel = t(resolveRoleTranslationKey(user.role));

  const moreItems = useMemo(
    () => MORE_ITEMS.filter((item) => item.roles.includes(user.role)),
    [user.role]
  );

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function openQuickBill() {
    setMoreSheetOpen(false);
    setQuickBillOpen(true);
  }

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-default-50 dark:bg-default-50/10">
      {/* ── Desktop Sidebar ──────────────────────────── */}
      <aside
        className={`hidden lg:flex flex-col border-r border-divider bg-background transition-all duration-300 print:hidden ${
          sidebarCollapsed ? "w-[72px]" : "w-[260px]"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-divider">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          {!sidebarCollapsed && (
            <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent truncate">
              HisaabKitaab
            </span>
          )}
        </div>

        {/* Nav Links */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {canQuickBill && (
            <Tooltip
              content={t("bills.quickBill")}
              placement="right"
              isDisabled={!sidebarCollapsed}
            >
              <motion.button
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.96 }}
                onClick={openQuickBill}
                className="mb-3 flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-3 text-white shadow-lg shadow-blue-500/20 transition hover:shadow-xl hover:shadow-blue-500/25"
              >
                <span className="flex-shrink-0">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M12 4v16m8-8H4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                </span>
                {!sidebarCollapsed && (
                  <span className="truncate font-semibold">{t("bills.quickBill")}</span>
                )}
              </motion.button>
            </Tooltip>
          )}

          {navItems.map((item) => {
            return (
            <Tooltip
              key={item.href}
              content={t(item.translationKey)}
              placement="right"
              isDisabled={!sidebarCollapsed}
            >
              <motion.button
                whileHover={{ scale: 1.02, x: 2 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => router.push(item.href)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                  isActive(item.href)
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-default-600 hover:bg-default-100 hover:text-default-900"
                }`}
              >
                <span
                  className={`flex-shrink-0 ${
                    isActive(item.href) ? "text-primary" : "text-default-400 group-hover:text-default-600"
                  }`}
                >
                  {item.icon}
                </span>
                {!sidebarCollapsed && (
                  <span className="truncate">{t(item.translationKey)}</span>
                )}
              </motion.button>
            </Tooltip>
            );
          })}

          {user.role === "ADMIN" && (
            <>
              <div className="pt-4 pb-2">
                {!sidebarCollapsed && (
                  <span className="px-3 text-xs font-semibold text-default-400 uppercase tracking-wider">
                    {t("shell.settings")}
                  </span>
                )}
              </div>
              <Tooltip
                content={t("shell.users")}
                placement="right"
                isDisabled={!sidebarCollapsed}
              >
                <button
                  onClick={() => router.push("/settings/users")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                    pathname === "/settings/users"
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-default-600 hover:bg-default-100 hover:text-default-900"
                  }`}
                  >
                  <svg className="w-5 h-5 flex-shrink-0 text-default-400 group-hover:text-default-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  {!sidebarCollapsed && (
                    <span className="truncate">{t("shell.users")}</span>
                  )}
                </button>
              </Tooltip>

              <Tooltip
                content={t("shell.templates")}
                placement="right"
                isDisabled={!sidebarCollapsed}
              >
                <button
                  onClick={() => router.push("/settings/templates")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                    pathname.startsWith("/settings/templates")
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-default-600 hover:bg-default-100 hover:text-default-900"
                  }`}
                  >
                  <svg className="w-5 h-5 flex-shrink-0 text-default-400 group-hover:text-default-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {!sidebarCollapsed && (
                    <span className="truncate">{t("shell.templates")}</span>
                  )}
                </button>
              </Tooltip>

              <Tooltip
                content={t("settings.businessProfile")}
                placement="right"
                isDisabled={!sidebarCollapsed}
              >
                <button
                  onClick={() => router.push("/settings/company")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                    pathname === "/settings/company"
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-default-600 hover:bg-default-100 hover:text-default-900"
                  }`}
                  >
                  <svg className="w-5 h-5 flex-shrink-0 text-default-400 group-hover:text-default-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  {!sidebarCollapsed && (
                    <span className="truncate">{t("settings.businessProfile")}</span>
                  )}
                </button>
              </Tooltip>

              <Tooltip
                content={t("settings.items")}
                placement="right"
                isDisabled={!sidebarCollapsed}
              >
                <button
                  onClick={() => router.push("/settings/items")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                    pathname === "/settings/items"
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-default-600 hover:bg-default-100 hover:text-default-900"
                  }`}
                >
                  <svg
                    className="w-5 h-5 flex-shrink-0 text-default-400 group-hover:text-default-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                  {!sidebarCollapsed && (
                    <span className="truncate">{t("settings.items")}</span>
                  )}
                </button>
              </Tooltip>
            </>
          )}
        </nav>

        {/* Collapse Toggle & Theme */}
        <div className="flex items-center gap-2 px-3 py-2 border-t border-divider justify-between">
          {!sidebarCollapsed && (
            <div className="flex gap-2 items-center">
              <Button 
                size="sm" 
                variant="flat" 
                color="primary"
                onPress={() => setLanguage(language === "en" ? "hi" : "en")}
                className="font-bold"
              >
                {language === "en" ? "HI" : "EN"}
              </Button>
              <ThemeSwitcher />
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="flex-1 flex items-center justify-center p-2 rounded-xl text-default-400 hover:text-default-600 hover:bg-default-100 transition"
          >
            <svg
              className={`w-5 h-5 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* User Profile */}
        <div className="px-3 py-3 border-t border-divider">
          <Dropdown placement="top-start">
            <DropdownTrigger>
              <button className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-default-100 transition">
                <Avatar
                  name={user.name}
                  size="sm"
                  className="flex-shrink-0 bg-gradient-to-br from-blue-500 to-indigo-500 text-white"
                />
                {!sidebarCollapsed && (
                  <div className="text-left truncate">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    <p className="text-xs text-default-400 capitalize">
                      {roleLabel}
                    </p>
                  </div>
                )}
              </button>
            </DropdownTrigger>
            <DropdownMenu aria-label="User Menu">
              <DropdownItem
                key="profile"
                className="h-14 gap-2"
                textValue={user.name}
              >
                <p className="font-semibold">{user.name}</p>
                <p className="text-sm text-default-500">{user.email || user.phone}</p>
              </DropdownItem>
              <DropdownItem
                key="logout"
                color="danger"
                onPress={handleLogout}
                textValue={t("shell.signOut")}

                startContent={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                }
              >
                {t("shell.signOut")}
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 h-14 border-b border-divider bg-background/80 backdrop-blur-lg sticky top-0 z-40 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <span className="font-bold text-lg bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              HisaabKitaab
            </span>
          </div>
          {hasMoreSheet ? (
            <Button
              isIconOnly
              size="sm"
              variant="light"
              aria-label={t("nav.more")}
              onPress={() => setMoreSheetOpen(true)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </Button>
          ) : (
            <Avatar
              name={user.name}
              size="sm"
              className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white"
            />
          )}
        </header>

        {/* Content area */}
        <div className="main-content-area flex-1 overflow-y-auto lg:pb-4">
          {children}
        </div>

        {/* ── Mobile Bottom Nav ────────────────────────── */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-white/60 p-2 pb-safe backdrop-blur-xl dark:bg-black/60 lg:hidden">
          <div className="mx-auto flex max-w-md items-center justify-around gap-1">
            {navItems.slice(0, 4).map((item) => {
              const isActive = pathname === item.href;
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl px-4 py-2 transition-all ${
                    isActive
                      ? "bg-primary/15 text-primary shadow-[0_4px_12px_rgba(59,130,246,0.1)]"
                      : "text-default-500 hover:bg-default-100/50"
                  }`}
                >
                  <div
                    className={`transition-transform duration-300 ${isActive ? "scale-110" : ""}`}
                  >
                    {item.icon}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    {t(item.translationKey as never)}
                  </span>
                </button>
              );
            })}

            {showFab && (
              <div className="relative -mt-12">
                <button
                  onClick={() => setQuickBillOpen(true)}
                  className="group relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-[0_8px_20px_-6px_rgba(59,130,246,0.5)] transition-all hover:scale-110 active:scale-95"
                >
                  <svg
                    className="h-7 w-7 text-white transition-transform duration-500 group-hover:rotate-90"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M12 4v16m8-8H4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                    />
                  </svg>
                </button>
              </div>
            )}

            <button
              onClick={() => setMoreSheetOpen(true)}
              className="flex flex-col items-center gap-1.5 rounded-2xl px-4 py-2 transition-all text-default-500 hover:bg-default-100/50"
            >
              <div className="transition-transform duration-300">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M4 6h16M4 12h16m-7 6h7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest">
                {t("nav.more")}
              </span>
            </button>
          </div>
        </nav>
      </main>

      <BottomSheet
        isOpen={moreSheetOpen}
        onClose={() => setMoreSheetOpen(false)}
        title={t("nav.more")}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-3 rounded-2xl bg-default-100 px-3 py-3">
            <Avatar
              name={user.name}
              size="md"
              className="flex-shrink-0 bg-gradient-to-br from-blue-500 to-indigo-500 text-white"
            />
            <div className="min-w-0">
              <p className="truncate font-semibold text-default-900">{user.name}</p>
              <p className="truncate text-sm text-default-500">
                {user.email || user.phone || roleLabel}
              </p>
            </div>
          </div>

          {canQuickBill && (
            <button
              onClick={openQuickBill}
              className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-3 text-left text-white shadow-lg shadow-blue-500/20 transition hover:shadow-xl hover:shadow-blue-500/25"
            >
              <div className="flex items-center gap-3">
                <span className="flex-shrink-0">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M12 4v16m8-8H4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                </span>
                <div>
                  <p className="font-semibold">{t("bills.quickBill")}</p>
                  <p className="text-xs text-white/80">{t("bills.quickCreate")}</p>
                </div>
              </div>
            </button>
          )}
          {canQuickBill && (
            <button
              onClick={() => { setMoreSheetOpen(false); router.push("/notes/new?type=CREDIT_NOTE"); }}
              className="w-full mt-2 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 px-3 py-3 text-left text-white shadow-lg shadow-teal-500/20 transition hover:shadow-xl hover:shadow-teal-500/25"
            >
              <div className="flex items-center gap-3">
                <span className="flex-shrink-0">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </span>
                <div>
                  <p className="font-semibold">Credit Note</p>
                  <p className="text-xs text-white/80">Sales Return / Discount</p>
                </div>
              </div>
            </button>
          )}
          {canQuickBill && (
            <button
              onClick={() => { setMoreSheetOpen(false); router.push("/notes/new?type=DEBIT_NOTE"); }}
              className="w-full mt-2 rounded-2xl bg-gradient-to-r from-orange-400 to-red-500 px-3 py-3 text-left text-white shadow-lg shadow-orange-500/20 transition hover:shadow-xl hover:shadow-orange-500/25"
            >
              <div className="flex items-center gap-3">
                <span className="flex-shrink-0">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </span>
                <div>
                  <p className="font-semibold">Debit Note</p>
                  <p className="text-xs text-white/80">Purchase Return</p>
                </div>
              </div>
            </button>
          )}

          {moreItems.map((item) => (
            <button
              key={item.href}
              onClick={() => { setMoreSheetOpen(false); router.push(item.href); }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-default-100 transition text-left"
            >
              <span className="text-default-500">{item.icon}</span>
              <span className="font-medium">{t(item.translationKey)}</span>
            </button>
          ))}
          
          <div className="h-px bg-divider my-2" />
          
          {user.role === "ADMIN" && (
            <>
              <button 
                onClick={() => { setMoreSheetOpen(false); router.push("/settings/company"); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-default-100 transition text-left"
              >
                <span className="text-default-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                </span>
                <span>{t("settings.businessProfile")}</span>
              </button>
              <button 
                onClick={() => { setMoreSheetOpen(false); router.push("/settings/users"); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-default-100 transition text-left"
              >
                <span className="text-default-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                </span>
                <span>{t("shell.users")}</span>
              </button>
              <button 
                onClick={() => { setMoreSheetOpen(false); router.push("/settings/templates"); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-default-100 transition text-left"
              >
                <span className="text-default-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </span>
                <span>{t("shell.templates")}</span>
              </button>
              <button
                onClick={() => { setMoreSheetOpen(false); router.push("/settings/items"); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-default-100 transition text-left"
              >
                <span className="text-default-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                </span>
                <span>{t("settings.items")}</span>
              </button>
            </>
          )}
          
          <div className="h-px bg-divider my-2" />
          
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-default-500 font-medium">{t("shell.settings")}</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="flat" color="primary" onPress={() => setLanguage(language === "en" ? "hi" : "en")}>
                {language === "en" ? "HI" : "EN"}
              </Button>
              <ThemeSwitcher />
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-danger hover:bg-danger/10 transition text-left"
          >
            <span className="text-danger">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </span>
            <span className="font-semibold">{t("shell.signOut")}</span>
          </button>
        </div>
      </BottomSheet>

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
