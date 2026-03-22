"use client";

import { useCallback, useEffect, useState } from "react";
import { getBalanceStatusLabel, type SupportedPartyType } from "@/lib/accounting";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Select,
  SelectItem,
  Skeleton,
} from "@heroui/react";
import { useRouter } from "next/navigation";

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

function getOpeningBalanceDescription(partyType: SupportedPartyType) {
  return partyType === "CUSTOMER"
    ? "Positive means customer advance. Negative means customer outstanding."
    : "Positive means vendor advance paid. Negative means amount you still owe the vendor.";
}

const TYPE_OPTIONS = [
  { key: "ALL", label: "All" },
  { key: "CUSTOMER", label: "Customers" },
  { key: "VENDOR", label: "Vendors" },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
}

function formatSignedCurrency(value: number) {
  if (value === 0) {
    return "INR 0";
  }

  return `${value > 0 ? "+" : "-"}${formatCurrency(value)}`;
}

async function readError(response: Response) {
  const data = await response.json().catch(() => null);
  return data?.error || "Request failed";
}

export default function PartiesPage() {
  const router = useRouter();
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [showPanel, setShowPanel] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formGstin, setFormGstin] = useState("");
  const [formType, setFormType] = useState("CUSTOMER");
  const [formBalance, setFormBalance] = useState("0");

  const fetchParties = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) {
        params.set("search", search);
      }
      if (typeFilter !== "ALL") {
        params.set("type", typeFilter);
      }

      const response = await fetch(`/api/parties?${params.toString()}`);
      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const data = await response.json();
      setParties((data.parties || []) as Party[]);
    } catch (error) {
      setParties([]);
      setToast({
        message: error instanceof Error ? error.message : "Failed to load parties",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter]);

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
      showToast("Name is required", "error");
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

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      showToast(editingParty ? "Party updated" : "Party created", "success");
      setShowPanel(false);
      await fetchParties();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(party: Party) {
    if (!confirm(`Archive party "${party.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/parties/${party.id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await readError(response));
      }

      showToast("Party archived", "success");
      await fetchParties();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to delete", "error");
    }
  }

  return (
    <>
      <div className="relative animate-fade-in p-4 lg:p-8">
        {toast && (
          <div
            className={`fixed right-4 top-4 z-[100] rounded-xl px-4 py-3 shadow-lg animate-slide-up ${
              toast.type === "success" ? "bg-success text-white" : "bg-danger text-white"
            }`}
          >
            {toast.message}
          </div>
        )}

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Parties</h1>
            <p className="mt-1 text-sm text-default-500">
              Manage customers and vendors from the authoritative server record.
            </p>
          </div>
          <Button
            color="primary"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold shadow-lg shadow-blue-500/25"
            onPress={openCreate}
            startContent={
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M12 4v16m8-8H4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            }
          >
            Add Party
          </Button>
        </div>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="Search by name or phone..."
            value={search}
            onValueChange={setSearch}
            variant="bordered"
            className="flex-1"
            startContent={
              <svg className="h-4 w-4 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                />
              </svg>
            }
          />
          <Select
            selectedKeys={[typeFilter]}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as string;
              if (value) {
                setTypeFilter(value);
              }
            }}
            variant="bordered"
            className="w-44"
          >
            {TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.key}>{option.label}</SelectItem>
            ))}
          </Select>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : parties.length === 0 ? (
          <Card shadow="sm">
            <CardBody className="flex flex-col items-center justify-center py-16">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-secondary/10">
                <svg className="h-10 w-10 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                  />
                </svg>
              </div>
              <p className="text-lg font-medium text-default-600">No parties yet</p>
              <Button color="primary" variant="flat" size="sm" className="mt-3" onPress={openCreate}>
                Add First Party
              </Button>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-3">
            {parties.map((party) => (
              <Card key={party.id} shadow="sm" className="transition hover:shadow-md">
                <CardBody className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{party.name}</span>
                        <Chip
                          size="sm"
                          variant="flat"
                          color={party.type === "CUSTOMER" ? "primary" : "secondary"}
                          className="capitalize"
                        >
                          {party.type.toLowerCase()}
                        </Chip>
                      </div>
                      <div className="flex gap-3 text-xs text-default-400">
                        {party.phone && <span>{party.phone}</span>}
                        {party.email && <span>{party.email}</span>}
                        {party._count && <span>{party._count.payments} payment(s)</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p
                          className={`text-lg font-bold ${
                            party.currentBalance > 0
                              ? "text-success"
                              : party.currentBalance < 0
                                ? "text-danger"
                                : "text-default-400"
                          }`}
                        >
                          {formatSignedCurrency(party.currentBalance)}
                        </p>
                        <p className="text-xs text-default-400">
                          {getBalanceStatusLabel(
                            party.type as SupportedPartyType,
                            party.currentBalance
                          )}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center gap-2 md:mt-0">
                        <Button
                          size="sm"
                          color="secondary"
                          variant="flat"
                          onPress={() => router.push(`/parties/${party.id}`)}
                          className="font-medium md:mr-2"
                        >
                          View Profile
                        </Button>
                        <Button size="sm" variant="flat" isIconOnly onPress={() => openEdit(party)}>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                            />
                          </svg>
                        </Button>
                        <Button
                          size="sm"
                          variant="flat"
                          color="danger"
                          isIconOnly
                          onPress={() => handleDelete(party)}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                            />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>

      {showPanel && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setShowPanel(false)} />
          <div
            className="fixed bottom-0 right-0 top-0 z-50 w-full max-w-md overflow-y-auto bg-background shadow-2xl"
            style={{ animation: "slideInRight 0.3s ease-out" }}
          >
            <div className="p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold">
                  {editingParty ? "Edit Party" : "Add New Party"}
                </h2>
                <Button isIconOnly variant="light" size="sm" onPress={() => setShowPanel(false)}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M6 18L18 6M6 6l12 12"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                </Button>
              </div>

              <div className="flex flex-col gap-4">
                <Input
                  label="Name"
                  placeholder="Party name"
                  value={formName}
                  onValueChange={setFormName}
                  variant="bordered"
                  isRequired
                />
                <Input
                  label="Phone"
                  placeholder="Phone number"
                  value={formPhone}
                  onValueChange={setFormPhone}
                  variant="bordered"
                  type="tel"
                />
                <Input
                  label="Email"
                  placeholder="Email (optional)"
                  value={formEmail}
                  onValueChange={setFormEmail}
                  variant="bordered"
                  type="email"
                />
                <Input
                  label="Address"
                  placeholder="Address"
                  value={formAddress}
                  onValueChange={setFormAddress}
                  variant="bordered"
                />
                <Input
                  label="GSTIN"
                  placeholder="GST Number"
                  value={formGstin}
                  onValueChange={setFormGstin}
                  variant="bordered"
                />
                <Select
                  label="Type"
                  selectedKeys={[formType]}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as string;
                    if (value) {
                      setFormType(value);
                    }
                  }}
                  variant="bordered"
                >
                  <SelectItem key="CUSTOMER">Customer</SelectItem>
                  <SelectItem key="VENDOR">Vendor</SelectItem>
                </Select>

                {!editingParty && (
                  <Input
                    label="Opening Balance (INR)"
                    placeholder="0"
                    type="number"
                    value={formBalance}
                    onValueChange={setFormBalance}
                    variant="bordered"
                    description={getOpeningBalanceDescription(
                      formType as SupportedPartyType
                    )}
                  />
                )}

                <div className="pt-4 flex gap-3">
                  <Button variant="flat" className="flex-1" onPress={() => setShowPanel(false)}>
                    Cancel
                  </Button>
                  <Button
                    color="primary"
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600"
                    onPress={handleSave}
                    isLoading={saving}
                  >
                    {editingParty ? "Update" : "Create Party"}
                  </Button>
                </div>
              </div>
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
