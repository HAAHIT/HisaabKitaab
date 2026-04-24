"use client";

import { useEffect, useRef, useState } from "react";
import { Button, useDisclosure } from "@heroui/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { getBalanceStatusLabel } from "@/lib/accounting";
import { QuickAddPartyModal } from "@/components/parties/QuickAddPartyModal";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

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
  filterTypes?: string[];
  placeholder?: string;
  autoFocus?: boolean;
  isInvalid?: boolean;
  initialParty?: PartyOption | null;
}

function formatSignedBalance(value: number) {
  const absolute = Math.abs(value).toLocaleString("en-IN");
  if (value === 0) return `INR ${absolute}`;
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
  const [searchTerm, setSearchTerm] = useState(initialParty?.name || "");
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

  useEffect(() => {
    fetchParties("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyType, filterTypes]);

  useEffect(() => {
    if (!value) {
      setSearchTerm("");
      selectedPartyRef.current = null;
    }
  }, [value]);

  function handleInputChange(val: string) {
    setSearchTerm(val);

    // If the user clears the input, clear the selected value
    if (val === "" && selectedPartyRef.current) {
      selectedPartyRef.current = null;
      onChange(null);
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchParties(val);
    }, 300);
  }

  const bottomSection = (closePopover: () => void) => (
    <div className="p-2 pt-1 border-t border-divider/50 mt-1">
      <Button
        className="w-full justify-start font-medium"
        size="sm"
        color="primary"
        variant="light"
        onPress={() => {
          closePopover();
          onOpen();
        }}
      >
        + Add New {partyType ? t(`parties.${partyType.toLowerCase()}Type` as any) : "Party / Ledger"}
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      <SearchableSelect
        items={parties}
        inputValue={searchTerm}
        onInputChange={handleInputChange}
        onSelectionChange={(party) => {
          selectedPartyRef.current = party;
          setSearchTerm(party.name);
          onChange(party);
        }}
        isLoading={isLoading}
        placeholder={placeholder || t("parties.searchPlaceholder")}
        isInvalid={isInvalid}
        getKey={(party) => party.id}
        getTextValue={(party) => party.name}
        bottomContent={bottomSection}
        emptyContent="No parties found."
        renderItem={(party) => (
          <div className="flex w-full items-center justify-between">
            <div className="flex flex-col">
              <span className="font-semibold">{party.name}</span>
              {party.phone && (
                <span className="text-xs text-default-500">Phone {party.phone}</span>
              )}
            </div>
            <div className="flex flex-col items-end">
              {Number(party.currentBalance) === 0 ? (
                <span className="text-sm font-semibold text-default-400">Settled</span>
              ) : (
                <>
                  <span
                    className={`text-sm font-semibold ${Number(party.currentBalance) > 0 ? "text-success" : "text-danger"}`}
                  >
                    {formatSignedBalance(Number(party.currentBalance))}
                  </span>
                  <span className="text-[10px] text-default-400">
                    {getBalanceStatusLabel(party.type as "CUSTOMER" | "VENDOR", Number(party.currentBalance))}
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      />

      <QuickAddPartyModal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        initialType={partyType || filterTypes?.[0] || "CUSTOMER"}
        allowedTypes={filterTypes || (partyType ? [partyType] : ["CUSTOMER", "VENDOR"])}
        onSuccess={(newParty) => {
          selectedPartyRef.current = newParty;
          setSearchTerm(newParty.name);
          setParties((prev) => [...prev, newParty]);
          onChange(newParty);
        }}
      />
    </div>
  );
}
