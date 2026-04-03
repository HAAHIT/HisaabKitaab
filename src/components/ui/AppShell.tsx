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
import { ThemeSwitcher } from "./ThemeSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";
import { TranslationKey } from "@/lib/i18n/translations";

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
}

const NAV_ITEMS: NavItem[] = [
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
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    translationKey: "nav.bills",
    href: "/bills",
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
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
      </svg>
    ),
    translationKey: "nav.measures",
    href: "/measurements",
    roles: ["ADMIN", "STAFF"],
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
  },
];

const ROLE_TRANSLATION_KEYS: Record<string, TranslationKey> = {
  ADMIN: "users.admin",
  STAFF: "users.staff",
  ACCOUNTANT: "users.accountant",
  CUSTOMER: "users.customer",
};

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
  const [fabOpenPath, setFabOpenPath] = useState<string | null>(null);

  const navItems = useMemo(
    () =>
      (user.role === "CUSTOMER" ? CUSTOMER_NAV : NAV_ITEMS).filter((item) =>
        item.roles.includes(user.role)
      ),
    [user.role]
  );
  const roleLabelKey = ROLE_TRANSLATION_KEYS[user.role];
  const roleLabel = roleLabelKey ? t(roleLabelKey) : user.role;

  const showFab = fabOpenPath === pathname;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
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
          {navItems.map((item) => {
            return (
            <Tooltip
              key={item.href}
              content={t(item.translationKey)}
              placement="right"
              isDisabled={!sidebarCollapsed}
            >
              <button
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
              </button>
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
                content={t("shell.company")}
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
                    <span className="truncate">{t("shell.company")}</span>
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
              DoorCraft
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="flat" 
              color="primary"
              onPress={() => setLanguage(language === "en" ? "hi" : "en")}
            >
              {language === "en" ? "HI" : "EN"}
            </Button>
            <ThemeSwitcher />
            <Dropdown>
              <DropdownTrigger>
                <Avatar
                  name={user.name}
                  size="sm"
                  className="cursor-pointer bg-gradient-to-br from-blue-500 to-indigo-500 text-white"
                />
              </DropdownTrigger>
            <DropdownMenu aria-label="User menu">
              <DropdownItem key="info" className="h-14 gap-2" textValue={user.name}>
                <p className="font-semibold">{user.name}</p>
                <p className="text-sm text-default-500">{roleLabel}</p>
              </DropdownItem>
              {user.role === "ADMIN" ? (
                <>
                  <DropdownItem key="settings-users" onPress={() => router.push("/settings/users")}>
                    {t("shell.userManagement")}
                  </DropdownItem>
                  <DropdownItem key="settings-templates" onPress={() => router.push("/settings/templates")}>
                    {t("shell.billTemplates")}
                  </DropdownItem>
                  <DropdownItem key="settings-company" onPress={() => router.push("/settings/company")}>
                    {t("shell.companySettings")}
                  </DropdownItem>
                </>
              ) : null}
              <DropdownItem key="logout" color="danger" onPress={handleLogout}>
                {t("shell.signOut")}
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto pb-20 lg:pb-4">
          {children}
        </div>

        {/* ── Mobile Bottom Nav ────────────────────────── */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-xl border-t border-divider z-50 pb-safe-bottom print:hidden">
          <div className="flex items-center justify-around h-16 relative">
            {navItems.map((item, index) => {
              // For non-customer, inject FAB in middle position
              if (user.role !== "CUSTOMER" && index === 2) {
                return (
                  <div key="fab-group" className="contents">
                    {/* FAB */}
                    <div className="relative">
                      <Button
                        isIconOnly
                        color="primary"
                        size="lg"
                        radius="full"
                        className="shadow-lg shadow-primary/30 -mt-6 bg-gradient-to-br from-blue-600 to-indigo-600"
                        onPress={() =>
                          setFabOpenPath((currentPath) =>
                            currentPath === pathname ? null : pathname
                          )
                        }
                      >
                        <svg
                          className={`w-6 h-6 transition-transform duration-200 ${showFab ? "rotate-45" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </Button>

                      {/* FAB menu */}
                      {showFab && (
                        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 flex flex-col gap-2 animate-slide-up">
                          {[
                            { label: "New Bill", transKey: "bills.new", href: "/bills/new", icon: "🧾" },
                            { label: "Record Payment", transKey: "nav.recordpayment", href: "/payments/new", icon: "💰" },
                            { label: "Add Party", transKey: "nav.addparty", href: "/parties", icon: "👤" },
                          ].map((action) => (
                            <Button
                              key={action.href}
                              size="sm"
                              variant="flat"
                              className="whitespace-nowrap glass shadow-md"
                              onPress={() => {
                                setFabOpenPath(null);
                                router.push(action.href);
                              }}
                            >
                              {action.icon} {t(action.transKey as TranslationKey)}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Render the current item after FAB */}
                    <button
                      key={item.href}
                      onClick={() => router.push(item.href)}
                      className={`flex flex-col items-center gap-0.5 px-3 py-1 transition ${
                        isActive(item.href) ? "text-primary" : "text-default-400"
                      }`}
                    >
                      {item.icon}
                      <span className="text-[10px] font-medium">
                        {t(item.translationKey)}
                      </span>
                    </button>
                  </div>
                );
              }

              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1 transition ${
                    isActive(item.href) ? "text-primary" : "text-default-400"
                  }`}
                >
                  {item.icon}
                  <span className="text-[10px] font-medium">
                    {t(item.translationKey)}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </main>

      {/* FAB overlay backdrop */}
      {showFab && (
        <div
          className="lg:hidden fixed inset-0 bg-black/20 z-40"
          onClick={() => setFabOpenPath(null)}
        />
      )}
    </div>
  );
}
