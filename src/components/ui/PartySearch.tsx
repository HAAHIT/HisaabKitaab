"use client";

import { useEffect, useRef, useState } from "react";
import { Autocomplete, AutocompleteItem, Button, useDisclosure } from "@heroui/react";
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
  /** Filter to multiple party types at once (e.g. ["EXPENSE","INCOME"]) */
  filterTypes?: string[];
  placeholder?: string;
  autoFocus?: boolean;
  isInvalid?: boolean;
  /** Pre-seed the list with this party (e.g. for preselection from URL param) */
  initialParty?: PartyOption | null;
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
  filterTypes,
  placeholder,
  autoFocus,
  isInvalid,
  initialParty,
}: PartySearchProps) {
  const { t } = useLanguage();
  const [parties, setParties] = useState<PartyOption[]>(
    initialParty ? [initialParty] : []
  );
  const [isLoading, setIsLoading] = useState(false);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedPartyRef = useRef<PartyOption | null>(initialParty ?? null);

  async function fetchParties(search: string) {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (filterTypes && filterTypes.length > 0) {
        params.set("types", filterTypes.join(","));
      } else if (partyType) {
        params.set("type", partyType);
      }
      if (search) params.set("search", search);
      const response = await fetch(`/api/parties?${params}`);
      if (response.ok) {
        const data = await response.json();
        const results = (data.parties || []) as PartyOption[];
        // Always keep the currently selected party in the list
        if (selectedPartyRef.current && !results.some((p) => p.id === selectedPartyRef.current!.id)) {
          setParties([selectedPartyRef.current, ...results]);
        } else {
          setParties(results);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }

  // Load initial list on mount
  useEffect(() => {
    fetchParties("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyType, filterTypes]);

  function handleInputChange(val: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchParties(val);
    }, 300);
  }

  const selectedKey = value || undefined;

  return (
    <div className="flex flex-col gap-2">
      <Autocomplete
        label={placeholder || t("parties.searchPlaceholder")}
        variant="bordered"
        items={parties}
        isLoading={isLoading}
        selectedKey={selectedKey}
        onInputChange={handleInputChange}
        onSelectionChange={(key) => {
          if (!key) {
            selectedPartyRef.current = null;
            onChange(null);
            return;
          }

          const selected = parties.find((party) => party.id === String(key));
          selectedPartyRef.current = selected ?? null;
          onChange(selected || null);
        }}
        autoFocus={autoFocus}
        isInvalid={isInvalid}
        listboxProps={{
          bottomContent: parties.length > 0 ? (
            <div className="p-2 pt-1 border-t border-divider/50 mt-1">
              <Button
                className="w-full justify-start font-medium"
                size="sm"
                color="primary"
                variant="light"
                onPress={() => {
                  if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                  onOpen();
                }}
              >
                + Add New {partyType ? t(`parties.${partyType.toLowerCase()}Type` as any) : "Party / Ledger"}
              </Button>
            </div>
          ) : undefined,
          emptyContent: (
            <div className="flex flex-col items-center justify-center gap-3 p-4 text-center">
              <p className="text-default-500">No parties found.</p>
              <Button
                size="sm"
                color="primary"
                variant="flat"
                onPress={() => {
                  if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                  onOpen();
                }}
              >
                + Add New {partyType ? t(`parties.${partyType.toLowerCase()}Type` as any) : "Party / Ledger"}
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
                    className={`text-sm font-semibold ${party.currentBalance > 0 ? "text-success" : "text-danger"
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

      <QuickAddPartyModal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        initialType={partyType || (filterTypes?.[0]) || "CUSTOMER"}
        allowedTypes={filterTypes || (partyType ? [partyType] : ["CUSTOMER", "VENDOR"])}
        onSuccess={(newParty) => {
          selectedPartyRef.current = newParty;
          setParties((prev) => [...prev, newParty]);
          onChange(newParty);
        }}
      />
    </div>
  );
}
