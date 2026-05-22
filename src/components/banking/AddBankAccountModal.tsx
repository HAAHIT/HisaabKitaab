"use client";

import { useState } from "react";
import { HKSelect, HKSelectItem } from "@/components/ui/HKSelect";
import { HKSheet, SG, OR, TYPE } from "@/components/ui/hk-design";
import { HKButton } from "@/components/ui/HKButton";
import { HKInput } from "@/components/ui/HKInput";

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
        <HKSheet
            isOpen={isOpen}
            onClose={onClose}
            title="Account Jodo"
            footer={
                <>
                    <HKButton variant="secondary" onClick={onClose} isDisabled={isLoading}>Cancel</HKButton>
                    <HKButton onClick={handleSave} isLoading={isLoading}>Account Banao</HKButton>
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

                <HKSelect
                    label="Account Type"
                    value={type}
                    onValueChange={(v) => { if (v) setType(v); }}
                >
                    <HKSelectItem value="BANK">Bank Account</HKSelectItem>
                    <HKSelectItem value="CASH">Cash Register</HKSelectItem>
                </HKSelect>

                <HKInput
                    label="Account Name *"
                    autoFocus
                    placeholder="e.g. HDFC Current Account"
                    value={name}
                    onValueChange={setName}
                />

                {type === "BANK" && (
                    <>
                        <HKInput
                            label="Account Number"
                            placeholder="Optional"
                            value={accountNumber}
                            onValueChange={setAccountNumber}
                        />
                        <HKInput
                            label="IFSC Code"
                            placeholder="Optional"
                            value={ifscCode}
                            onValueChange={setIfscCode}
                        />
                    </>
                )}

                <HKInput
                    label="Opening Balance (₹)"
                    type="number"
                    placeholder="0"
                    value={openingBalance}
                    onValueChange={setOpeningBalance}
                />
            </div>
        </HKSheet>
    );
}
