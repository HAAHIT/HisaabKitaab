"use client";

import { useEffect, useState } from "react";
import {
    Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader,
    Select, SelectItem, Tabs, Tab,
} from "@heroui/react";
import { PartySearch, type PartyOption } from "@/components/ui/PartySearch";
import { getSettlementDirectionForParty, type SupportedPartyType } from "@/lib/accounting";

type BankAccount = {
    id: string;
    name: string;
    type: string;
    currentBalance: number;
};

export type EditablePayment = {
    id: string;
    partyId: string | null;
    accountId: string | null;
    destinationAccountId: string | null;
    amount: number;
    direction: string;
    mode: string;
    date: string;
    notes: string | null;
    party: { name: string; type: string } | null;
};

function sanitizeAmount(value: string) {
    const normalized = value.replace(/[^\d.]/g, "");
    const parts = normalized.split(".");
    if (parts.length === 1) return parts[0];
    return `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}`;
}

async function readError(res: Response) {
    const data = await res.json().catch(() => null);
    return data?.error || "Request failed";
}

export function EditPaymentModal({
    payment,
    isOpen,
    onClose,
    onSuccess,
}: {
    payment: EditablePayment | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const isContraPayment = !payment?.partyId && !!payment?.destinationAccountId;
    const isLedgerPayment = payment?.party ? ["EXPENSE", "INCOME", "ASSET", "LIABILITY", "EQUITY"].includes(payment.party.type) : false;

    const [paymentType, setPaymentType] = useState<"party" | "ledger" | "contra">("party");
    const [selectedParty, setSelectedParty] = useState<PartyOption | null>(null);
    const [accountId, setAccountId] = useState("");
    const [destAccountId, setDestAccountId] = useState("");
    const [amount, setAmount] = useState("");
    const [direction, setDirection] = useState("INCOMING");
    const [mode, setMode] = useState("BANK_TRANSFER");
    const [date, setDate] = useState("");
    const [notes, setNotes] = useState("");
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Populate form when payment changes
    useEffect(() => {
        if (!payment) return;
        setPaymentType(isContraPayment ? "contra" : isLedgerPayment ? "ledger" : "party");
        setSelectedParty(null); // PartySearch will load by value
        setAccountId(payment.accountId ?? "");
        setDestAccountId(payment.destinationAccountId ?? "");
        setAmount(String(payment.amount));
        setDirection(payment.direction);
        setMode(payment.mode);
        setDate(new Date(payment.date).toISOString().split("T")[0]);
        setNotes(payment.notes ?? "");
        setError(null);
    }, [payment, isContraPayment]);

    // Load bank accounts once
    useEffect(() => {
        if (!isOpen || bankAccounts.length > 0) return;
        fetch("/api/bank-accounts")
            .then((r) => r.json())
            .then((d) => setBankAccounts(d.accounts || []))
            .catch(() => { });
    }, [isOpen, bankAccounts.length]);

    async function handleSave() {
        if (!payment) return;
        setError(null);

        if ((paymentType === "party" || paymentType === "ledger") && !selectedParty && !payment.partyId) {
            setError(paymentType === "ledger" ? "Select an expense/income ledger" : "Select a party");
            return;
        }
        if (!amount || parseFloat(amount) <= 0) {
            setError("Enter a valid amount");
            return;
        }
        if (!accountId) {
            setError("Select an account");
            return;
        }
        if (paymentType === "contra" && !destAccountId) {
            setError("Select a destination account");
            return;
        }
        if (paymentType === "contra" && accountId === destAccountId) {
            setError("Source and destination accounts cannot be the same");
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch(`/api/payments/${payment.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    partyId: (paymentType === "party" || paymentType === "ledger") ? (selectedParty?.id ?? payment.partyId) : null,
                    destinationAccountId: paymentType === "contra" ? destAccountId : null,
                    accountId,
                    amount: parseFloat(amount),
                    direction: paymentType === "contra" ? "OUTGOING" : direction,
                    mode,
                    date,
                    notes: notes.trim() || null,
                }),
            });
            if (!res.ok) throw new Error(await readError(res));
            onSuccess();
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to save");
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onOpenChange={(open) => { if (!open) onClose(); }}
            backdrop="blur"
            placement="center"
            size="lg"
            scrollBehavior="inside"
            classNames={{ backdrop: "bg-black/60" }}
        >
            <ModalContent>
                {() => (
                    <>
                        <ModalHeader className="text-xl font-bold">Edit Payment</ModalHeader>
                        <ModalBody className="space-y-4 pb-2">
                            <Tabs
                                aria-label="Payment type"
                                selectedKey={paymentType}
                                onSelectionChange={(k) => setPaymentType(k as "party" | "ledger" | "contra")}
                                classNames={{ base: "w-full", tabList: "w-full" }}
                            >
                                <Tab key="party" title="Party Payment" />
                                <Tab key="ledger" title="Expense / Income" />
                                <Tab key="contra" title="Bank Transfer (Contra)" />
                            </Tabs>

                            {(paymentType === "party" || paymentType === "ledger") && (
                                <PartySearch
                                    value={selectedParty?.id ?? payment?.partyId ?? null}
                                    onChange={(party) => {
                                        setSelectedParty(party);
                                        if (party) setDirection(getSettlementDirectionForParty(party.type as SupportedPartyType));
                                    }}
                                    placeholder={paymentType === "ledger" ? "Select expense, income, or other ledger" : "Select customer, vendor, or ledger"}
                                    filterTypes={paymentType === "ledger" ? ["EXPENSE", "INCOME", "ASSET", "LIABILITY", "EQUITY"] : undefined}
                                />
                            )}

                            <Input
                                label="Amount (INR)"
                                type="text"
                                value={amount}
                                onValueChange={(v) => setAmount(sanitizeAmount(v))}
                                variant="bordered"
                                inputMode="decimal"
                                startContent={<span className="text-default-400">INR</span>}
                            />

                            <div className="grid grid-cols-2 gap-3">
                                {(paymentType === "party" || paymentType === "ledger") && (
                                    <Select
                                        label="Type"
                                        selectedKeys={new Set([direction])}
                                        onSelectionChange={(keys) => {
                                            const v = Array.from(keys)[0] as string;
                                            if (v) setDirection(v);
                                        }}
                                        variant="bordered"
                                        isDisabled={paymentType === "ledger"}
                                    >
                                        <SelectItem key="INCOMING">Received</SelectItem>
                                        <SelectItem key="OUTGOING">Paid</SelectItem>
                                    </Select>
                                )}

                                <Select
                                    label={paymentType === "contra" ? "Source Account" : "Account"}
                                    selectedKeys={new Set(accountId ? [accountId] : [])}
                                    onSelectionChange={(keys) => {
                                        const v = Array.from(keys)[0] as string;
                                        if (v) {
                                            setAccountId(v);
                                            const acc = bankAccounts.find((a) => a.id === v);
                                            if (acc) setMode(acc.type === "CASH" ? "CASH" : "BANK_TRANSFER");
                                        }
                                    }}
                                    variant="bordered"
                                >
                                    {bankAccounts.map((acc) => (
                                        <SelectItem key={acc.id} textValue={acc.name}>
                                            {acc.name} (₹{acc.currentBalance})
                                        </SelectItem>
                                    ))}
                                </Select>

                                {paymentType === "contra" && (
                                    <Select
                                        label="Destination Account"
                                        selectedKeys={new Set(destAccountId ? [destAccountId] : [])}
                                        onSelectionChange={(keys) => {
                                            const v = Array.from(keys)[0] as string;
                                            if (v) setDestAccountId(v);
                                        }}
                                        variant="bordered"
                                    >
                                        {bankAccounts.map((acc) => (
                                            <SelectItem key={acc.id} textValue={acc.name}>
                                                {acc.name} (₹{acc.currentBalance})
                                            </SelectItem>
                                        ))}
                                    </Select>
                                )}

                                {(paymentType === "party" || paymentType === "ledger") && (
                                    <Select
                                        label="Payment Mode"
                                        selectedKeys={new Set([mode])}
                                        onSelectionChange={(keys) => {
                                            const v = Array.from(keys)[0] as string;
                                            if (!v) return;
                                            setMode(v);
                                            if (v === "CASH") {
                                                const cashAcc = bankAccounts.find((a) => a.type === "CASH");
                                                if (cashAcc) setAccountId(cashAcc.id);
                                            } else {
                                                const currentAcc = bankAccounts.find((a) => a.id === accountId);
                                                if (currentAcc?.type === "CASH") {
                                                    const bankAcc = bankAccounts.find((a) => a.type === "BANK");
                                                    if (bankAcc) setAccountId(bankAcc.id);
                                                }
                                            }
                                        }}
                                        variant="bordered"
                                    >
                                        <SelectItem key="BANK_TRANSFER">Bank Transfer</SelectItem>
                                        <SelectItem key="CASH">Cash</SelectItem>
                                        <SelectItem key="UPI">UPI</SelectItem>
                                        <SelectItem key="CHEQUE">Cheque</SelectItem>
                                    </Select>
                                )}
                            </div>

                            <Input label="Date" type="date" value={date} onValueChange={setDate} variant="bordered" />
                            <Input
                                label="Notes"
                                placeholder="Optional notes..."
                                value={notes}
                                onValueChange={setNotes}
                                variant="bordered"
                            />

                            {error && (
                                <p className="text-sm text-danger">{error}</p>
                            )}
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="flat" onPress={onClose} isDisabled={isSaving}>
                                Cancel
                            </Button>
                            <Button
                                color="primary"
                                onPress={handleSave}
                                isLoading={isSaving}
                                className="font-semibold"
                            >
                                Save Changes
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}
