"use client";

import Link from "next/link";
import { Card, CardBody, Chip } from "@heroui/react";

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.abs(n));
}

// Ensure the types match the data passed from the Server Component
type LedgerEntry = {
  id: string;
  date: Date;
  type: "BILL" | "PAYMENT" | "OPENING";
  description: string;
  debit: number;
  credit: number;
  balanceAfter: number;
  link?: string;
};

type PartyProfile = {
  name: string;
  type: "CUSTOMER" | "VENDOR";
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
}: {
  party: PartyProfile;
  ledger: LedgerEntry[];
  measurements: MeasurementItem[];
  calculatedCurrent: number;
}) {
  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/parties" className="p-2 hover:bg-default-100 rounded-xl transition">
            <svg className="w-5 h-5 text-default-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              {party.name}
              <Chip size="sm" color={party.type === "CUSTOMER" ? "primary" : "secondary"} variant="flat">{party.type}</Chip>
            </h1>
            <p className="text-default-500 text-sm">
              {party.phone ? `+91 ${party.phone}` : "No phone provided"} {party.email ? ` • ${party.email}` : ""}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-default-500 uppercase tracking-wider">Current Balance</p>
          <p className={`text-2xl font-bold ${calculatedCurrent > 0 ? "text-danger" : calculatedCurrent < 0 ? "text-success" : "text-default-900"}`}>
            {calculatedCurrent > 0 ? "" : calculatedCurrent < 0 ? "-" : ""}
            {formatCurrency(calculatedCurrent)}
          </p>
          <p className="text-xs text-default-400">
            {calculatedCurrent > 0 ? (party.type === "CUSTOMER" ? "to receive" : "to pay") : calculatedCurrent < 0 ? "advance balance" : "settled"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* LEDGER */}
          <Card shadow="sm">
            <CardBody className="p-0">
              <div className="p-4 border-b border-default-100 flex items-center justify-between">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Ledger & Transactions
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-default-50 text-xs text-default-500 uppercase">
                      <th className="p-3 font-medium">Date</th>
                      <th className="p-3 font-medium">Description</th>
                      <th className="p-3 font-medium text-right">Debit</th>
                      <th className="p-3 font-medium text-right">Credit</th>
                      <th className="p-3 font-medium text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {ledger.map((entry, i) => (
                      <tr key={i} className="border-b border-default-100 hover:bg-default-50/50 transition">
                        <td className="p-3 text-default-500">
                          {new Date(entry.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                        <td className="p-3 font-medium">
                          {entry.link ? (
                            <Link href={entry.link} className="text-primary hover:underline">{entry.description}</Link>
                          ) : entry.description}
                        </td>
                        <td className="p-3 text-right text-danger">
                          {entry.debit > 0 ? formatCurrency(entry.debit) : "-"}
                        </td>
                        <td className="p-3 text-right text-success">
                          {entry.credit > 0 ? formatCurrency(entry.credit) : "-"}
                        </td>
                        <td className="p-3 text-right font-medium">
                          {entry.balanceAfter < 0 ? `${formatCurrency(entry.balanceAfter)} (Cr)` : entry.balanceAfter > 0 ? `${formatCurrency(entry.balanceAfter)} (Dr)` : "₹0"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {ledger.length === 1 && (
                <div className="p-8 text-center text-default-500">
                  <p>No transactions yet.</p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          {/* PROFILE DETAILS */}
          <Card shadow="sm">
            <CardBody className="p-5">
              <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                Party Details
              </h2>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-default-400 text-xs">Address</p>
                  <p className="font-medium">{party.address || "Not provided"}</p>
                </div>
                <div>
                  <p className="text-default-400 text-xs">GSTIN</p>
                  <p className="font-medium font-mono">{party.gstin || "Not provided"}</p>
                </div>
                <div>
                  <p className="text-default-400 text-xs">Opening Balance</p>
                  <p className="font-medium">{formatCurrency(party.openingBalance)}</p>
                </div>
                <div>
                  <p className="text-default-400 text-xs">Registered</p>
                  <p className="font-medium">{new Date(party.createdAt).toLocaleDateString("en-IN")}</p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* MEASUREMENTS (IF APPLICABLE) */}
          {party.type === "CUSTOMER" && (
            <Card shadow="sm">
              <CardBody className="p-5">
                <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" /></svg>
                  Measurements
                </h2>
                {measurements.length > 0 ? (
                  <div className="space-y-3">
                    {measurements.map((m) => (
                      <div key={m.id} className="p-3 border border-default-200 rounded-lg flex items-center justify-between hover:bg-default-50 transition">
                        <div>
                          <p className="font-medium">{m.label}</p>
                          <p className="text-xs text-default-400">{m.roomName || "Unspecified Room"} • {new Date(m.createdAt).toLocaleDateString("en-IN")}</p>
                        </div>
                        <Chip size="sm" variant="flat">{m.status}</Chip>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-sm text-default-400 bg-default-50 rounded-lg">
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
