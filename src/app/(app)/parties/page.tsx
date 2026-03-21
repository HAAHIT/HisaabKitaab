"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardBody,
  Button,
  Input,
  Chip,
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
  type: string;
  currentBalance: number;
  isActive: boolean;
  _count: { payments: number };
}

const TYPE_OPTIONS = [
  { key: "ALL", label: "All" },
  { key: "CUSTOMER", label: "Customers" },
  { key: "VENDOR", label: "Vendors" },
];

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.abs(n));
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
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Form
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
      if (search) params.set("search", search);
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      const res = await fetch(`/api/parties?${params}`);
      const data = await res.json();
      setParties(data.parties || []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [search, typeFilter]);

  useEffect(() => { fetchParties(); }, [fetchParties]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  function openCreate() {
    setEditingParty(null);
    setFormName(""); setFormPhone(""); setFormEmail(""); setFormAddress("");
    setFormGstin(""); setFormType("CUSTOMER"); setFormBalance("0");
    setShowPanel(true);
  }

  function openEdit(p: Party) {
    setEditingParty(p);
    setFormName(p.name); setFormPhone(p.phone || ""); setFormEmail(p.email || "");
    setFormAddress(""); setFormGstin(""); setFormType(p.type); setFormBalance("0");
    setShowPanel(true);
  }

  async function handleSave() {
    if (!formName.trim()) { showToast("Name is required", "error"); return; }
    setSaving(true);
    try {
      const url = editingParty ? `/api/parties/${editingParty.id}` : "/api/parties";
      const method = editingParty ? "PATCH" : "POST";
      const bodyData: Record<string, unknown> = {
        name: formName, phone: formPhone || undefined, email: formEmail || undefined,
        address: formAddress || undefined, gstin: formGstin || undefined, type: formType,
      };
      if (!editingParty) bodyData.openingBalance = parseFloat(formBalance) || 0;

      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyData) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(editingParty ? "Party updated" : "Party created", "success");
      setShowPanel(false); fetchParties();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Deactivate this party?")) return;
    try {
      const res = await fetch(`/api/parties/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      showToast("Party deactivated", "success");
      fetchParties();
    } catch { showToast("Failed to deactivate", "error"); }
  }

  return (
    <div className="p-4 lg:p-8 animate-fade-in relative">
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg animate-slide-up ${toast.type === "success" ? "bg-success text-white" : "bg-danger text-white"}`}>
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Parties</h1>
          <p className="text-default-500 text-sm mt-1">Manage customers and vendors</p>
        </div>
        <Button color="primary" className="font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/25" onPress={openCreate}
          startContent={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}>
          Add Party
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Input placeholder="Search by name or phone..." value={search} onValueChange={setSearch} variant="bordered" className="flex-1"
          startContent={<svg className="w-4 h-4 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>} />
        <Select selectedKeys={[typeFilter]} onSelectionChange={(keys) => { const v = Array.from(keys)[0] as string; if (v) setTypeFilter(v); }} variant="bordered" className="w-44">
          {TYPE_OPTIONS.map((o) => <SelectItem key={o.key}>{o.label}</SelectItem>)}
        </Select>
      </div>

      {/* Party List */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : parties.length === 0 ? (
        <Card shadow="sm"><CardBody className="flex flex-col items-center justify-center py-16">
          <div className="w-20 h-20 rounded-full bg-secondary/10 flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
          <p className="text-lg font-medium text-default-600">No parties yet</p>
          <Button color="primary" variant="flat" size="sm" className="mt-3" onPress={openCreate}>Add First Party</Button>
        </CardBody></Card>
      ) : (
        <div className="space-y-3">
          {parties.map((p) => (
            <Card key={p.id} shadow="sm" className="hover:shadow-md transition">
              <CardBody className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{p.name}</span>
                      <Chip size="sm" variant="flat" color={p.type === "CUSTOMER" ? "primary" : "secondary"} className="capitalize">
                        {p.type.toLowerCase()}
                      </Chip>
                    </div>
                    <div className="flex gap-3 text-xs text-default-400">
                      {p.phone && <span>📞 {p.phone}</span>}
                      {p.email && <span>✉️ {p.email}</span>}
                      <span>{p._count.payments} payment(s)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={`text-lg font-bold ${p.currentBalance > 0 ? "text-danger" : p.currentBalance < 0 ? "text-success" : "text-default-400"}`}>
                        {p.currentBalance === 0 ? "₹0" : `${p.currentBalance > 0 ? "" : "-"}${formatCurrency(p.currentBalance)}`}
                      </p>
                      <p className="text-xs text-default-400">
                        {p.currentBalance > 0 ? (p.type === "CUSTOMER" ? "receivable" : "payable") : p.currentBalance < 0 ? "advance" : "settled"}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="flat" isIconOnly onPress={() => openEdit(p)}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </Button>
                      <Button size="sm" variant="flat" color="danger" isIconOnly onPress={() => handleDelete(p.id)}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Slide-Over Panel */}
      {showPanel && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowPanel(false)} />
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-background shadow-2xl z-50 overflow-y-auto" style={{ animation: "slideInRight 0.3s ease-out" }}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">{editingParty ? "Edit Party" : "Add New Party"}</h2>
                <Button isIconOnly variant="light" size="sm" onPress={() => setShowPanel(false)}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </Button>
              </div>
              <div className="flex flex-col gap-4">
                <Input label="Name" placeholder="Party name" value={formName} onValueChange={setFormName} variant="bordered" isRequired />
                <Input label="Phone" placeholder="Phone number" value={formPhone} onValueChange={setFormPhone} variant="bordered" type="tel" />
                <Input label="Email" placeholder="Email (optional)" value={formEmail} onValueChange={setFormEmail} variant="bordered" type="email" />
                <Input label="Address" placeholder="Address" value={formAddress} onValueChange={setFormAddress} variant="bordered" />
                <Input label="GSTIN" placeholder="GST Number" value={formGstin} onValueChange={setFormGstin} variant="bordered" />
                <Select label="Type" selectedKeys={[formType]} onSelectionChange={(keys) => { const v = Array.from(keys)[0] as string; if (v) setFormType(v); }} variant="bordered">
                  <SelectItem key="CUSTOMER">Customer</SelectItem>
                  <SelectItem key="VENDOR">Vendor</SelectItem>
                </Select>
                {!editingParty && (
                  <Input label="Opening Balance (₹)" placeholder="0" type="number" value={formBalance} onValueChange={setFormBalance} variant="bordered"
                    description="Positive = they owe you. Negative = you owe them." />
                )}
                <div className="flex gap-3 pt-4">
                  <Button variant="flat" className="flex-1" onPress={() => setShowPanel(false)}>Cancel</Button>
                  <Button color="primary" className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600" onPress={handleSave} isLoading={saving}>
                    {editingParty ? "Update" : "Create Party"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );
}
