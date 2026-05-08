"use client";

import { useState } from "react";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Input,
    Select,
    SelectItem,
} from "@heroui/react";

interface Props {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSuccess: (account: any) => void;
}

export function AddBankAccountModal({ isOpen, onOpenChange, onSuccess }: Props) {
    const [name, setName] = useState("");
    const [type, setType] = useState<string>("BANK");
    const [accountNumber, setAccountNumber] = useState("");
    const [ifscCode, setIfscCode] = useState("");
    const [openingBalance, setOpeningBalance] = useState("0");

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSave(onClose: () => void) {
        if (!name.trim()) {
            setError("Name is required");
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
                throw new Error(data.error || "Failed to create account");
            }

            const data = await response.json();
            onSuccess(data);
            onClose();
            setName("");
            setAccountNumber("");
            setIfscCode("");
            setOpeningBalance("0");
            setType("BANK");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="md" backdrop="blur">
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader className="flex flex-col gap-1">Add Account</ModalHeader>
                        <ModalBody>
                            {error && (
                                <div className="bg-danger-50 text-danger-600 px-4 py-2 rounded-lg text-sm mb-2 border border-danger-200">
                                    {error}
                                </div>
                            )}
                            <div className="flex flex-col gap-4">
                                <Select
                                    label="Account Type *"
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
                                    label="Opening Balance"
                                    type="number"
                                    placeholder="0.00"
                                    value={openingBalance}
                                    onValueChange={setOpeningBalance}
                                    variant="bordered"
                                />
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button color="danger" variant="light" onPress={onClose}>
                                Cancel
                            </Button>
                            <Button color="primary" onPress={() => handleSave(onClose)} isLoading={isLoading}>
                                Create Account
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}
