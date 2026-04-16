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
  Checkbox,
} from "@heroui/react";
import { PartySearch, type PartyOption } from "@/components/ui/PartySearch";
import { GST_STATE_CODES } from "@/lib/gst-states";

interface Props {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSuccess?: () => void;
  noteType: "CREDIT_NOTE" | "DEBIT_NOTE";
}

export function CreditDebitNoteModal({ isOpen, onOpenChange, onSuccess, noteType }: Props) {
  const [selectedParty, setSelectedParty] = useState<PartyOption | null>(null);
  const [originalInvoiceNo, setOriginalInvoiceNo] = useState("");
  const [reasonForIssuance, setReasonForIssuance] = useState("Sales Return");
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [subtotal, setSubtotal] = useState<number>(0);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [isInterState, setIsInterState] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const grandTotal = subtotal + taxAmount;

  const isCredit = noteType === "CREDIT_NOTE";
  const title = isCredit ? "Create Credit Note" : "Create Debit Note";
  const partyType = isCredit ? "CUSTOMER" : "VENDOR";

  async function handleSave(onClose: () => void) {
    if (!selectedParty || !originalInvoiceNo || !placeOfSupply || grandTotal <= 0) {
      setErrorMsg("Please fill in all required fields and ensure total > 0.");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");

    try {
      const response = await fetch("/api/credit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyId: selectedParty.id,
          originalInvoiceNo,
          reasonForIssuance,
          placeOfSupply,
          noteType,
          subtotal,
          taxAmount,
          grandTotal,
          isInterState,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create note");
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" backdrop="blur">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              {title}
              <p className="text-sm text-default-500 font-normal">
                {isCredit ? "Record a Sales Return or discount given" : "Record a Purchase Return or discount received"}
              </p>
            </ModalHeader>
            <ModalBody>
              {errorMsg && (
                <div className="bg-danger-50 text-danger-600 px-4 py-2 rounded-lg text-sm mb-2 border border-danger-200">
                  {errorMsg}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">{isCredit ? "Customer" : "Vendor"} *</label>
                  <PartySearch
                    partyType={partyType}
                    value={selectedParty?.id || null}
                    onChange={(p) => {
                       setSelectedParty(p);
                       if (p?.gstin && p.gstin.length >= 2) {
                           const code = p.gstin.substring(0,2);
                           if (GST_STATE_CODES[code]) setPlaceOfSupply(code);
                       }
                    }}
                  />
                </div>
                
                <Input
                  label="Original Invoice Reference *"
                  placeholder="INV-..."
                  value={originalInvoiceNo}
                  onValueChange={setOriginalInvoiceNo}
                  variant="bordered"
                />

                <Select
                  label="Reason for Issuance *"
                  variant="bordered"
                  selectedKeys={[reasonForIssuance]}
                  onSelectionChange={(keys) => setReasonForIssuance(Array.from(keys)[0] as string)}
                >
                  <SelectItem key="Sales Return">Sales Return</SelectItem>
                  <SelectItem key="Post Sale Discount">Post Sale Discount</SelectItem>
                  <SelectItem key="Deficiency in Services">Deficiency in Services</SelectItem>
                  <SelectItem key="Correction in Invoice">Correction in Invoice</SelectItem>
                  <SelectItem key="Change in POS">Change in POS</SelectItem>
                  <SelectItem key="Other">Other</SelectItem>
                </Select>

                <Select
                  label="Place of Supply *"
                  placeholder="Select State"
                  variant="bordered"
                  selectedKeys={placeOfSupply ? [placeOfSupply] : []}
                  onSelectionChange={(k) => setPlaceOfSupply(Array.from(k)[0] as string)}
                >
                  {Object.entries(GST_STATE_CODES).map(([code, name]) => (
                    <SelectItem key={code} textValue={`${code} - ${name}`}>{code} - {name}</SelectItem>
                  ))}
                </Select>

                <Input
                  label="Subtotal (Taxable Value)"
                  type="number"
                  variant="bordered"
                  value={String(subtotal || "")}
                  onValueChange={(v) => setSubtotal(Number(v))}
                />

                <Input
                  label="Total Tax Amount"
                  type="number"
                  variant="bordered"
                  value={String(taxAmount || "")}
                  onValueChange={(v) => setTaxAmount(Number(v))}
                  description={isInterState ? "Will be logged as IGST" : "Will be split CGST/SGST"}
                />
              </div>

              <div className="flex justify-between items-center mt-4 p-4 rounded-xl bg-default-100/50">
                <Checkbox isSelected={isInterState} onValueChange={setIsInterState}>
                  Inter-State (IGST) Note
                </Checkbox>
                <div className="text-lg font-bold">
                  Total Value: ₹{grandTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </div>
              </div>

            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button color="primary" onPress={() => handleSave(onClose)} isLoading={isLoading}>
                Create Note
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
