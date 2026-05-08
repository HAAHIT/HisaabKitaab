"use client";

import { useEffect, useState } from "react";
import { Autocomplete, AutocompleteItem, Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { getBalanceStatusLabel } from "@/lib/accounting";
import { QuickAddPartyModal } from "@/components/parties/QuickAddPartyModal";

export interface PartyOption {
  id: string;
  name: string;
  phone: string | null;
  type: string;
  currentBalance: number;
  address: string | null;
  gstin: string | null;
}

interface PartySearchProps {
  value: string | null;
  onChange: (party: PartyOption | null) => void;
  partyType?: "CUSTOMER" | "VENDOR" | null;
  placeholder?: string;
  autoFocus?: boolean;
  isInvalid?: boolean;
}

function formatSignedBalance(value: number) {
  const absolute = Math.abs(value).toLocaleString("en-IN");
  if (value === 0) {
    return `INR ${absolute}`;
  }

  return `${value > 0 ? "+" : "-"}INR ${absolute}`;
}

export function PartySearch({
  value,
  onChange,
  partyType,
  placeholder,
  autoFocus,
  isInvalid,
}: PartySearchProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const onOpen = () => setIsOpen(true);
  const onOpenChange = (open: boolean) => setIsOpen(open);

  useEffect(() => {
    async function fetchParties() {
      setIsLoading(true);
      try {
        const url = partyType ? `/api/parties?type=${partyType}` : "/api/parties";
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setParties(data.parties || []);
        }
      } catch {
        // silently fail — parties list will remain empty
      } finally {
        setIsLoading(false);
      }
    }

    fetchParties();
  }, [partyType]);

  const selectedKey = value || undefined;

  return (
    <div className="flex flex-col gap-2">
      {!isOpen && (
        <Autocomplete
          label={placeholder || t("parties.searchPlaceholder")}
          variant="bordered"
          items={parties}
          isLoading={isLoading}
          selectedKey={selectedKey}
          onSelectionChange={(key) => {
            if (!key) {
              onChange(null);
              return;
            }

            const selected = parties.find((party) => party.id === String(key));
            onChange(selected || null);
          }}
          autoFocus={autoFocus}
          isInvalid={isInvalid}
          listboxProps={{
            emptyContent: (
              <div className="flex flex-col items-center justify-center gap-3 p-4 text-center">
                <p className="text-default-500">No parties found.</p>
                <Button
                  size="sm"
                  color="primary"
                  variant="flat"
                  onPress={onOpen}
                >
                  + Add New Party
                </Button>
              </div>
            ),
          }}
        >
          {(party) => (
            <AutocompleteItem key={party.id} textValue={party.name}>
              <div className="flex w-full items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-semibold">{party.name}</span>
                  {party.phone && (
                    <span className="text-xs text-default-500">Phone {party.phone}</span>
                  )}
                </div>
                {party.currentBalance !== 0 && (
                  <div className="flex flex-col items-end">
                    <span
                      className={`text-sm font-semibold ${
                        party.currentBalance > 0 ? "text-success" : "text-danger"
                      }`}
                    >
                      {formatSignedBalance(party.currentBalance)}
                    </span>
                    <span className="text-[10px] text-default-400">
                      {getBalanceStatusLabel(
                        party.type as "CUSTOMER" | "VENDOR",
                        party.currentBalance
                      )}
                    </span>
                  </div>
                )}
              </div>
            </AutocompleteItem>
          )}
        </Autocomplete>
      )}

      <QuickAddPartyModal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        initialType={partyType || "CUSTOMER"}
        onSuccess={(newParty) => {
          setParties((prev) => [...prev, newParty]);
          onChange(newParty);
        }}
      />
    </div>
  );
}
