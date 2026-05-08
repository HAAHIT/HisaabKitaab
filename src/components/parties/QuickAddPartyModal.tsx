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
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSuccess: (party: any) => void;
  initialType?: string;
  allowedTypes?: string[];
}

const TYPE_LABELS: Record<string, string> = {
  CUSTOMER: "Customer",
  VENDOR: "Vendor",
  EXPENSE: "Expense",
  INCOME: "Income",
  ASSET: "Asset",
  LIABILITY: "Liability",
  EQUITY: "Equity",
};

export function QuickAddPartyModal({
  isOpen,
  onOpenChange,
  onSuccess,
  initialType = "CUSTOMER",
  allowedTypes = ["CUSTOMER", "VENDOR"],
}: Props) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gstin, setGstin] = useState("");
  const [type, setType] = useState<string>(initialType);
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
      const response = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          gstin: gstin.trim() || null,
          type,
          openingBalance: 0,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create party");
      }

      const data = await response.json();
      onSuccess(data.party);
      onClose();
      setName("");
      setPhone("");
      setGstin("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="md"
      backdrop="blur"
      motionProps={{
        variants: {
          enter: { y: 0, opacity: 1, scale: 1, transition: { duration: 0.3, ease: "easeOut" } },
          exit: { y: -20, opacity: 0, scale: 0.95, transition: { duration: 0.2, ease: "easeIn" } },
        },
      }}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">Quick Add Party</ModalHeader>
            <ModalBody>
              {error && (
                <div className="bg-danger-50 text-danger-600 px-4 py-2 rounded-lg text-sm mb-2 border border-danger-200">
                  {error}
                </div>
              )}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex flex-col gap-4"
              >
                <Input
                  label="Party Name *"
                  autoFocus
                  placeholder="Enter name"
                  value={name}
                  onValueChange={setName}
                  variant="bordered"
                />
                <Input
                  label="Phone"
                  placeholder="10 digit mobile number"
                  value={phone}
                  onValueChange={setPhone}
                  variant="bordered"
                />
                <Input
                  label="GSTIN"
                  placeholder="22AAAAA0000A1Z5"
                  value={gstin}
                  onValueChange={setGstin}
                  variant="bordered"
                />
                <Select
                  label="Type"
                  variant="bordered"
                  selectedKeys={[type]}
                  onSelectionChange={(keys) => setType(Array.from(keys)[0] as string)}
                >
                  {allowedTypes.map((tKey) => {
                    const translationKey = `parties.${tKey.toLowerCase()}Type` as Parameters<typeof t>[0];
                    const translated = t(translationKey);
                    const label =
                      translated === translationKey ? (TYPE_LABELS[tKey] || tKey) : translated;
                    return <SelectItem key={tKey}>{label}</SelectItem>;
                  })}
                </Select>
              </motion.div>
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button color="primary" onPress={() => handleSave(onClose)} isLoading={isLoading}>
                Create Party
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
