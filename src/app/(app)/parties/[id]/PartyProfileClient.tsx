"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Avatar,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
} from "@heroui/react";
import { motion } from "framer-motion";
import {
  getBalanceStatusLabel,
  getPartyBalanceColor,
  formatPartyBalance,
  getBalanceIndicator,
  type PartyLedgerEntry,
  type SupportedPartyType,
} from "@/lib/accounting";
import { useLanguage } from "@/contexts/LanguageContext";

/* ── Helpers ──────────────────────────────────────────── */

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.abs(n));
}

function formatBalance(value: number, partyType: SupportedPartyType) {
  const indicator = getBalanceIndicator(partyType, value);
  if (!indicator) return "₹0";
  return `${formatCurrency(value)} (${indicator})`;
}

/* ── Types ────────────────────────────────────────────── */

type PartyProfile = {
  name: string;
  type: SupportedPartyType;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  openingBalance: number;
  createdAt: Date;
};

type MeasurementItem = {
  id: string;
  label: string;
  roomName: string | null;
  status: string;
  createdAt: Date;
};

type ReconcileResult = {
  total: number;
  drifted: { partyId: string; name: string; stored: number; computed: number }[];
};

/* ── Component ────────────────────────────────────────── */

export default function PartyProfileClient({
  party,
  ledger,
  measurements,
  calculatedCurrent,
  partyId,
  role,
}: {
  party: PartyProfile;
  ledger: PartyLedgerEntry[];
  measurements: MeasurementItem[];
  calculatedCurrent: number;
  partyId: string;
  role: string | null;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null);
  const [reconcileLoading, setReconcileLoading] = useState<"check" | "fix" | null>(null);
  const [reconcileError, setReconcileError] = useState<string | null>(null);

  const roundedBalance = Math.round(calculatedCurrent * 100) / 100;
  const balanceColor = getPartyBalanceColor(party.type, roundedBalance);
  const balanceLabel = getBalanceStatusLabel(party.type, roundedBalance);

  /* Derive KPI stats from ledger */
  const stats = useMemo(() => {
    let billCount = 0;
    let billTotal = 0;
    let paymentCount = 0;
    let paymentTotal = 0;
    for (const entry of ledger) {
      if (entry.type === "BILL") {
        billCount++;
        billTotal += entry.debit + entry.credit;
      } else if (entry.type === "PAYMENT") {
        paymentCount++;
        paymentTotal += entry.debit + entry.credit;
      }
    }
    return { billCount, billTotal, paymentCount, paymentTotal };
  }, [ledger]);

  /* Reconcile handlers */
  async function handleCheckBalances() {
    setReconcileLoading("check");
    setReconcileError(null);
    setReconcileResult(null);
    try {
      const res = await fetch("/api/parties/reconcile");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Check failed");
      setReconcileResult(data);
    } catch (err) {
      setReconcileError(err instanceof Error ? err.message : "Check failed");
    } finally {
      setReconcileLoading(null);
    }
  }

  async function handleFixBalances() {
    setReconcileLoading("fix");
    setReconcileError(null);
    try {
      const res = await fetch("/api/parties/reconcile", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fix failed");
      setReconcileResult(null);
      router.refresh();
      await handleCheckBalances();
    } catch (err) {
      setReconcileError(err instanceof Error ? err.message : "Fix failed");
      setReconcileLoading(null);
    }
  }

  const typeColor = party.type === "CUSTOMER" ? "primary" : "secondary";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="mx-auto max-w-6xl p-4 lg:p-8"
    >
      {/* ── Profile Header ────────────────────────────── */}
      <div className="mb-6">
        <Button
          as={Link}
          href="/parties"
          variant="light"
          size="sm"
          className="mb-4 -ml-2 text-default-500"
          startContent={
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
            </svg>
          }
        >
          All Parties
        </Button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Left: Avatar + Name */}
          <div className="flex items-center gap-4">
            <Avatar
              name={party.name}
              size="lg"
              className={`flex-shrink-0 bg-${typeColor}/10 text-${typeColor} text-xl font-bold`}
              showFallback
              fallback={
                <span className={`text-xl font-bold text-${typeColor}`}>
                  {party.name[0]?.toUpperCase()}
                </span>
              }
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold">{party.name}</h1>
                <Chip size="sm" color={typeColor} variant="flat">
                  {party.type}
                </Chip>
              </div>
              <p className="mt-0.5 text-sm text-default-500">
                {party.phone ? `+91 ${party.phone}` : "No phone"}
                {party.email ? ` · ${party.email}` : ""}
              </p>
            </div>
          </div>

          {/* Right: Balance + Actions */}
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="sm:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-default-400">
                {t("khata.currentBalance")}
              </p>
              <p className={`text-3xl font-black leading-tight ${balanceColor}`}>
                {formatPartyBalance(roundedBalance)}
              </p>
              <p className="text-sm capitalize text-default-500">{balanceLabel}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {party.phone && (
                <Button
                  as="a"
                  href={`tel:${party.phone}`}
                  size="sm"
                  variant="flat"
                  color="default"
                  startContent={
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
                    </svg>
                  }
                >
                  Call
                </Button>
              )}
              <Button
                size="sm"
                color="danger"
                variant="flat"
                onPress={() => router.push(`/bills/new?partyId=${partyId}`)}
                startContent={
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
                  </svg>
                }
              >
                {t("bills.new")}
              </Button>
              <Button
                size="sm"
                color="success"
                variant="flat"
                onPress={() => router.push(`/payments/new?partyId=${partyId}`)}
                startContent={
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
                  </svg>
                }
              >
                {t("payments.record")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Summary Cards ─────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card shadow="none" className="glass-card">
          <CardBody className="p-5">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger/10">
                <svg className="h-5 w-5 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
                </svg>
              </div>
              <span className="text-sm text-default-500">Total Bills</span>
            </div>
            <p className="text-2xl font-bold text-danger">{formatCurrency(stats.billTotal)}</p>
            <p className="mt-0.5 text-xs text-default-400">{stats.billCount} bills</p>
          </CardBody>
        </Card>

        <Card shadow="none" className="glass-card">
          <CardBody className="p-5">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
                <svg className="h-5 w-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
                </svg>
              </div>
              <span className="text-sm text-default-500">Payments</span>
            </div>
            <p className="text-2xl font-bold text-success">{formatCurrency(stats.paymentTotal)}</p>
            <p className="mt-0.5 text-xs text-default-400">{stats.paymentCount} payments</p>
          </CardBody>
        </Card>

        <Card shadow="none" className="glass-card">
          <CardBody className="p-5">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
                <svg className="h-5 w-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
                </svg>
              </div>
              <span className="text-sm text-default-500">Opening Bal.</span>
            </div>
            <p className="text-2xl font-bold text-warning">{formatCurrency(party.openingBalance)}</p>
            <p className="mt-0.5 text-xs text-default-400">{getBalanceStatusLabel(party.type, party.openingBalance)}</p>
          </CardBody>
        </Card>

        <Card shadow="none" className="glass-card">
          <CardBody className="p-5">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M9 14l-4-4m0 0l4-4m-4 4h12M15 10l4 4m0 0l-4 4m4-4H7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
                </svg>
              </div>
              <span className="text-sm text-default-500">Current Bal.</span>
            </div>
            <p className={`text-2xl font-bold ${balanceColor}`}>
              {formatPartyBalance(roundedBalance)}
            </p>
            <p className="mt-0.5 text-xs capitalize text-default-400">{balanceLabel}</p>
          </CardBody>
        </Card>
      </div>

      {/* ── Content Grid ──────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Ledger Table ───── Left column ────────── */}
        <div className="lg:col-span-2">
          <Card shadow="sm">
            <CardHeader className="flex items-center justify-between px-6 pb-0 pt-5">
              <h2 className="text-lg font-semibold">Ledger & Transactions</h2>
              <Chip variant="flat" color={roundedBalance >= 0 ? "success" : "danger"} size="sm">
                {formatBalance(calculatedCurrent, party.type)}
              </Chip>
            </CardHeader>
            <Divider className="mt-3" />
            <CardBody className="p-0">
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px] text-sm">
                  <thead>
                    <tr className="border-b border-divider bg-default-50 text-left text-xs font-semibold uppercase tracking-wider text-default-500">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3 text-right">Debit</th>
                      <th className="px-4 py-3 text-right">Credit</th>
                      <th className="px-4 py-3 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((entry, idx) => {
                      const isOpening = entry.type === "OPENING";
                      return (
                        <tr
                          key={entry.id}
                          className={`border-b border-divider transition-colors hover:bg-default-50 ${isOpening ? "bg-default-50/50" : ""
                            } ${idx === ledger.length - 1 ? "border-b-0" : ""}`}
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-default-600">
                            {new Date(entry.date).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "2-digit",
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <Chip
                              size="sm"
                              variant="flat"
                              color={
                                entry.type === "BILL"
                                  ? "danger"
                                  : entry.type === "PAYMENT"
                                    ? "success"
                                    : entry.type === "NOTE"
                                      ? "warning"
                                      : "default"
                              }
                              className="capitalize"
                            >
                              {entry.type.toLowerCase()}
                            </Chip>
                          </td>
                          <td className="max-w-[200px] truncate px-4 py-3">
                            {entry.link ? (
                              <Link
                                href={entry.link}
                                className="font-medium text-primary hover:underline"
                              >
                                {entry.description}
                              </Link>
                            ) : (
                              <span className={isOpening ? "font-medium text-default-500" : "font-medium"}>
                                {entry.description}
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-mono">
                            {entry.debit > 0 ? (
                              <span className="text-danger">{formatCurrency(entry.debit)}</span>
                            ) : (
                              <span className="text-default-300">—</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-mono">
                            {entry.credit > 0 ? (
                              <span className="text-success">{formatCurrency(entry.credit)}</span>
                            ) : (
                              <span className="text-default-300">—</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold text-default-700">
                            {formatBalance(entry.balanceAfter, party.type)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {ledger.length <= 1 && (
                <div className="px-6 py-10 text-center text-sm text-default-400">
                  {t("khata.noTransactions")}
                </div>
              )}

              {/* Action bar */}
              <Divider />
              <div className="flex gap-3 p-4">
                <Button
                  className="flex-1"
                  color="danger"
                  variant="flat"
                  onPress={() => router.push(`/bills/new?partyId=${partyId}`)}
                >
                  {t("bills.new")}
                </Button>
                <Button
                  className="flex-1"
                  color="success"
                  variant="flat"
                  onPress={() => router.push(`/payments/new?partyId=${partyId}`)}
                >
                  {t("payments.record")}
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* ── Sidebar ───── Right column ────────── */}
        <div className="space-y-6">
          {/* Party Details Card */}
          <Card shadow="sm" className="border-l-4 border-l-primary">
            <CardHeader className="px-6 pb-0 pt-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-default-500">
                Party Details
              </h2>
            </CardHeader>
            <CardBody className="space-y-4 px-6 pb-6 pt-3">
              <div>
                <p className="text-xs text-default-400">Address</p>
                <p className="text-sm font-medium">{party.address || "Not provided"}</p>
              </div>
              <div>
                <p className="text-xs text-default-400">GSTIN</p>
                <p className="font-mono text-sm font-medium">{party.gstin || "Not provided"}</p>
              </div>
              <div>
                <p className="text-xs text-default-400">Opening Balance</p>
                <p className="text-sm font-medium">{formatCurrency(party.openingBalance)}</p>
                <p className="text-xs capitalize text-default-400">
                  {getBalanceStatusLabel(party.type, party.openingBalance)}
                </p>
              </div>
              <div>
                <p className="text-xs text-default-400">Registered</p>
                <p className="text-sm font-medium">
                  {new Date(party.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </CardBody>
          </Card>

          {/* Balance Health (Admin only) */}
          {role === "ADMIN" && (
            <Card shadow="sm" className="border-l-4 border-l-warning">
              <CardHeader className="px-6 pb-0 pt-5">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-default-500">
                  Balance Health
                </h2>
              </CardHeader>
              <CardBody className="px-6 pb-6 pt-3">
                <p className="mb-4 text-xs text-default-400">
                  Verify all party balances match their journal history.
                </p>

                {reconcileError && (
                  <p className="mb-3 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
                    {reconcileError}
                  </p>
                )}

                {reconcileResult && (
                  <div className="mb-4 space-y-2">
                    {reconcileResult.drifted.length === 0 ? (
                      <p className="rounded-lg bg-success/10 px-3 py-2 text-xs font-medium text-success">
                        All {reconcileResult.total} balances are correct.
                      </p>
                    ) : (
                      <>
                        <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs font-medium text-warning">
                          {reconcileResult.drifted.length} of {reconcileResult.total} parties have drift.
                        </p>
                        <div className="max-h-36 space-y-1.5 overflow-y-auto">
                          {reconcileResult.drifted.map((d) => (
                            <div key={d.partyId} className="rounded-lg border border-default-100 p-2 text-xs">
                              <p className="font-medium">{d.name}</p>
                              <p className="text-default-400">
                                Stored: {formatCurrency(d.stored)} → Actual: {formatCurrency(d.computed)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    color="default"
                    className="flex-1"
                    isLoading={reconcileLoading === "check"}
                    isDisabled={reconcileLoading !== null}
                    onPress={handleCheckBalances}
                  >
                    Check
                  </Button>
                  {reconcileResult && reconcileResult.drifted.length > 0 && (
                    <Button
                      size="sm"
                      variant="flat"
                      color="warning"
                      className="flex-1"
                      isLoading={reconcileLoading === "fix"}
                      isDisabled={reconcileLoading !== null}
                      onPress={handleFixBalances}
                    >
                      Fix All
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          )}

          {/* Measurements (Customer only) */}
          {party.type === "CUSTOMER" && (
            <Card shadow="sm" className="border-l-4 border-l-success">
              <CardHeader className="px-6 pb-0 pt-5">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-default-500">
                  Measurements
                </h2>
              </CardHeader>
              <CardBody className="px-6 pb-6 pt-3">
                {measurements.length > 0 ? (
                  <div className="space-y-3">
                    {measurements.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between rounded-lg border border-default-200 p-3 transition hover:bg-default-50"
                      >
                        <div>
                          <p className="text-sm font-medium">{m.label}</p>
                          <p className="text-xs text-default-400">
                            {m.roomName || "Unspecified"} ·{" "}
                            {new Date(m.createdAt).toLocaleDateString("en-IN")}
                          </p>
                        </div>
                        <Chip size="sm" variant="flat">
                          {m.status}
                        </Chip>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg bg-default-50 py-6 text-center text-sm text-default-400">
                    No measurements found.
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </motion.div>
  );
}
