"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getBalanceStatusLabel,
  getPartyBalanceColor,
  formatPartyBalance,
  type SupportedPartyType,
} from "@/lib/accounting";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Pagination,
  Select,
  SelectItem,
  Skeleton,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "@/components/ui/icons";

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
  const { t } = useLanguage();
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
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
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (typeFilter !== "ALL") params.set("type", typeFilter);

      const response = await fetch(`/api/parties?${params.toString()}`);
      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const data = await response.json();
      setParties((data.parties || []) as Party[]);
      setTotalPages(data.totalPages ?? 1);
    } catch (error) {
      setParties([]);
      setToast({
        message: error instanceof Error ? error.message : t("payments.loadPartiesFailed"),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [page, search, t, typeFilter]);

  const typeOptions = [
    { key: "ALL", label: t("parties.filter.all") },
    { key: "CUSTOMER", label: t("parties.filter.customers") },
    { key: "VENDOR", label: t("parties.filter.vendors") },
  ];

  useEffect(() => {
    fetchParties();
  }, [fetchParties]);

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setPage(1);
  }, [search, typeFilter]);

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

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      showToast(
        editingParty ? t("parties.updated") : t("parties.created"),
        "success"
      );
      setShowPanel(false);
      await fetchParties();
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("parties.saveFailed"), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(party: Party) {
    if (!confirm(`${t("parties.archiveConfirm")} "${party.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/parties/${party.id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await readError(response));
      }

      showToast(t("parties.archived"), "success");
      await fetchParties();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t("parties.archiveFailed"),
        "error"
      );
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
            <h1 className="text-2xl font-bold">{t("parties.title")}</h1>
            <p className="mt-1 text-sm text-default-500">
              {t("parties.subtitle")}
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
            {t("parties.add")}
          </Button>
        </div>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <Input
            aria-label={t("parties.searchPlaceholder")}
            placeholder={t("parties.searchPlaceholder")}
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
            aria-label={t("parties.filter.all")}
            placeholder={t("parties.filter.all")}
            selectedKeys={new Set([typeFilter])}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as string;
              if (value) {
                setTypeFilter(value);
              }
            }}
            variant="bordered"
            className="w-44"
          >
            {typeOptions.map((option) => (
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
          <EmptyState
            icon={Users}
            title={t("parties.empty")}
            description={search || typeFilter !== "ALL" ? "Try adjusting your search criteria." : "No parties found. Add your first customer or vendor to get started."}
            actionLabel={!search && typeFilter === "ALL" ? t("parties.addFirst") : undefined}
            onAction={!search && typeFilter === "ALL" ? openCreate : undefined}
            className="mt-8"
          />
        ) : (
          <div className="space-y-3" key={page}>
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
                        <p className={`text-lg font-bold ${getPartyBalanceColor(party.type as SupportedPartyType, party.currentBalance)}`}>
                          {formatPartyBalance(party.currentBalance)}
                        </p>
                        <p className="text-xs text-default-400">
                          {getBalanceStatusLabel(
                            party.type as SupportedPartyType,
                            roundBalance(party.currentBalance)
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
                          {t("parties.viewProfile")}
                        </Button>
                        <Button
                          size="sm"
                          variant="flat"
                          isIconOnly
                          aria-label={`Edit ${party.name}`}
                          onPress={() => openEdit(party)}
                        >
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
                          aria-label={`Delete ${party.name}`}
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
        {totalPages > 1 && !loading && (
          <div className="mt-4 flex justify-center">
            <Pagination
              total={totalPages}
              page={page}
              onChange={setPage}
              showControls
              size="sm"
            />
          </div>
        )}
      </div>

      {showPanel && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setShowPanel(false)} />
          <div
            className="fixed bottom-0 right-0 top-0 z-50 w-full max-w-md overflow-y-auto bg-background shadow-2xl animate-[slideInRight_0.3s_ease-out]"
          >
            <div className="p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold">
                  {editingParty ? t("parties.editTitle") : t("parties.createTitle")}
                </h2>
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  aria-label="Close panel"
                  onPress={() => setShowPanel(false)}
                >
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
                  label={t("parties.nameLabel")}
                  placeholder={t("parties.namePlaceholder")}
                  value={formName}
                  onValueChange={setFormName}
                  variant="bordered"
                  isRequired
                />
                <Input
                  label={t("parties.phoneLabel")}
                  placeholder={t("bills.phonePlaceholder")}
                  value={formPhone}
                  onValueChange={setFormPhone}
                  variant="bordered"
                  type="tel"
                />
                <Input
                  label={t("parties.emailLabel")}
                  placeholder={t("parties.emailPlaceholder")}
                  value={formEmail}
                  onValueChange={setFormEmail}
                  variant="bordered"
                  type="email"
                />
                <Input
                  label={t("parties.addressLabel")}
                  placeholder={t("bills.addressPlaceholder")}
                  value={formAddress}
                  onValueChange={setFormAddress}
                  variant="bordered"
                />
                <Input
                  label={t("parties.gstinLabel")}
                  placeholder={t("bills.gstinPlaceholder")}
                  value={formGstin}
                  onValueChange={setFormGstin}
                  variant="bordered"
                />
                <Select
                  label={t("parties.typeLabel")}
                  placeholder={t("parties.typeLabel")}
                  selectedKeys={new Set([formType])}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as string;
                    if (value) {
                      setFormType(value);
                    }
                  }}
                  variant="bordered"
                >
                  <SelectItem key="CUSTOMER">{t("parties.customerType")}</SelectItem>
                  <SelectItem key="VENDOR">{t("parties.vendorType")}</SelectItem>
                </Select>

                {!editingParty && (
                  <Input
                    label={t("parties.openingBalance")}
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

                <div className="pt-4 flex gap-3">
                  <Button variant="flat" className="flex-1" onPress={() => setShowPanel(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button
                    color="primary"
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600"
                    onPress={handleSave}
                    isLoading={saving}
                  >
                    {editingParty ? t("parties.updateParty") : t("parties.createParty")}
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
