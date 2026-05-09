"use client";

import { useState } from "react";
import { Input, Select, SelectItem } from "@heroui/react";
import { HKModal, GradientButton, SG, OR, TYPE } from "@/components/ui/hk-design";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function AddBankAccountModal({ isOpen, onClose, onSuccess }: Props) {
    const [name, setName] = useState("");
    const [type, setType] = useState<string>("BANK");
    const [accountNumber, setAccountNumber] = useState("");
    const [ifscCode, setIfscCode] = useState("");
    const [openingBalance, setOpeningBalance] = useState("0");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSave() {
        if (!name.trim()) {
            setError("Account ka naam daalo");
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            const response = await fetch("/api/bank-accounts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    type,
                    accountNumber: accountNumber.trim() || undefined,
                    ifscCode: ifscCode.trim() || undefined,
                    openingBalance: Number(openingBalance) || 0,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Account nahi bana");
            }

            onSuccess();
            onClose();
            setName("");
            setAccountNumber("");
            setIfscCode("");
            setOpeningBalance("0");
            setType("BANK");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Account nahi bana");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <HKModal
            isOpen={isOpen}
            onClose={onClose}
            title="Account Jodo"
            footer={
                <>
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        style={{
                            padding: "10px 20px", borderRadius: 12, border: "1px solid var(--hk-border)",
                            background: "var(--hk-badge)", color: "var(--hk-text)", fontFamily: SG,
                            fontSize: TYPE.body, fontWeight: 600, cursor: isLoading ? "not-allowed" : "pointer",
                            opacity: isLoading ? 0.5 : 1,
                        }}
                    >
                        Cancel
                    </button>
                    <GradientButton onClick={handleSave} disabled={isLoading}>
                        {isLoading ? "Bana raha hai..." : "Account Banao"}
                    </GradientButton>
                </>
            }
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {error && (
                    <div style={{
                        padding: "10px 14px", borderRadius: 10,
                        background: OR + "15", border: `1px solid ${OR}33`,
                        fontSize: TYPE.bodySmall, fontWeight: 600, color: OR, fontFamily: SG,
                    }}>
                        {error}
                    </div>
                )}

                <Select
                    label="Account Type"
                    variant="bordered"
                    selectedKeys={[type]}
                    onSelectionChange={(keys) => setType(Array.from(keys)[0] as string)}
                >
                    <SelectItem key="BANK">Bank Account</SelectItem>
                    <SelectItem key="CASH">Cash Register</SelectItem>
                </Select>

                <Input
                    label="Account Name *"
                    autoFocus
                    placeholder="e.g. HDFC Current Account"
                    value={name}
                    onValueChange={setName}
                    variant="bordered"
                />

                {type === "BANK" && (
                    <>
                        <Input
                            label="Account Number"
                            placeholder="Optional"
                            value={accountNumber}
                            onValueChange={setAccountNumber}
                            variant="bordered"
                        />
                        <Input
                            label="IFSC Code"
                            placeholder="Optional"
                            value={ifscCode}
                            onValueChange={setIfscCode}
                            variant="bordered"
                        />
                    </>
                )}

                <Input
                    label="Opening Balance (₹)"
                    type="number"
                    placeholder="0"
                    value={openingBalance}
                    onValueChange={setOpeningBalance}
                    variant="bordered"
                />
            </div>
        </HKModal>
    );
}
