"use client";

import Link from "next/link";
import { Card, CardBody, Chip } from "@heroui/react";
import BalanceHeader from "@/components/parties/BalanceHeader";
import LedgerChat from "@/components/parties/LedgerChat";
import {
  getBalanceStatusLabel,
  type PartyLedgerEntry,
  type SupportedPartyType,
} from "@/lib/accounting";

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.abs(n));
}

function formatSignedCurrency(value: number) {
  if (value === 0) {
    return "INR 0";
  }

  return `${value > 0 ? "+" : "-"}${formatCurrency(value)}`;
}

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

export default function PartyProfileClient({
  party,
  ledger,
  measurements,
  calculatedCurrent,
  partyId,
}: {
  party: PartyProfile;
  ledger: PartyLedgerEntry[];
  measurements: MeasurementItem[];
  calculatedCurrent: number;
  partyId: string;
}) {
  const openingBalanceLabel = getBalanceStatusLabel(
    party.type,
    party.openingBalance
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/parties"
            className="rounded-xl p-2 transition hover:bg-default-100"
          >
            <svg
              className="h-5 w-5 text-default-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </Link>
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold">
              {party.name}
              <Chip
                size="sm"
                color={party.type === "CUSTOMER" ? "primary" : "secondary"}
                variant="flat"
              >
                {party.type}
              </Chip>
            </h1>
            <p className="text-sm text-default-500">
              {party.phone ? `+91 ${party.phone}` : "No phone provided"}
              {party.email ? ` | ${party.email}` : ""}
            </p>
          </div>
        </div>
      </div>

      <BalanceHeader
        partyName={party.name}
        partyType={party.type}
        currentBalance={calculatedCurrent}
        partyPhone={party.phone}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <LedgerChat
            partyId={partyId}
            partyName={party.name}
            partyType={party.type}
            partyPhone={party.phone}
            currentBalance={calculatedCurrent}
            ledger={ledger}
          />
        </div>

        <div className="space-y-6">
          <Card shadow="sm">
            <CardBody className="p-5">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <svg
                  className="h-5 w-5 text-secondary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                  />
                </svg>
                Party Details
              </h2>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-default-400">Address</p>
                  <p className="font-medium">{party.address || "Not provided"}</p>
                </div>
                <div>
                  <p className="text-xs text-default-400">GSTIN</p>
                  <p className="font-medium font-mono">
                    {party.gstin || "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-default-400">Opening Balance</p>
                  <p className="font-medium">
                    {formatSignedCurrency(party.openingBalance)}
                  </p>
                  <p className="text-xs text-default-400">{openingBalanceLabel}</p>
                </div>
                <div>
                  <p className="text-xs text-default-400">Registered</p>
                  <p className="font-medium">
                    {new Date(party.createdAt).toLocaleDateString("en-IN")}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          {party.type === "CUSTOMER" && (
            <Card shadow="sm">
              <CardBody className="p-5">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <svg
                    className="h-5 w-5 text-success"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                    />
                  </svg>
                  Measurements
                </h2>
                {measurements.length > 0 ? (
                  <div className="space-y-3">
                    {measurements.map((measurement) => (
                      <div
                        key={measurement.id}
                        className="flex items-center justify-between rounded-lg border border-default-200 p-3 transition hover:bg-default-50"
                      >
                        <div>
                          <p className="font-medium">{measurement.label}</p>
                          <p className="text-xs text-default-400">
                            {measurement.roomName || "Unspecified Room"} |{" "}
                            {new Date(measurement.createdAt).toLocaleDateString(
                              "en-IN"
                            )}
                          </p>
                        </div>
                        <Chip size="sm" variant="flat">
                          {measurement.status}
                        </Chip>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg bg-default-50 py-6 text-center text-sm text-default-400">
                    No measurements found for this customer.
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
