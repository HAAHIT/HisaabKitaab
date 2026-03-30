"use client";

import { useEffect, useState } from "react";
import { Autocomplete, AutocompleteItem, Button } from "@heroui/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRouter } from "next/navigation";

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

  useEffect(() => {
    async function fetchParties() {
      setIsLoading(true);
      try {
        const url = partyType ? `/api/parties?type=${partyType}` : "/api/parties";
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setParties(data.parties || []);
        }
      } catch (e) {
        console.error("Failed to load parties", e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchParties();
  }, [partyType]);

  const selectedKey = value || undefined;

  return (
    <div className="flex flex-col gap-2">
      <Autocomplete
        label={placeholder || t("parties.searchPlaceholder" as any) || "Search Party..."}
        variant="bordered"
        items={parties}
        isLoading={isLoading}
        selectedKey={selectedKey}
        onSelectionChange={(key) => {
          if (!key) {
            onChange(null);
          } else {
            const selected = parties.find((p) => p.id === key);
            onChange(selected || null);
          }
        }}
        autoFocus={autoFocus}
        isInvalid={isInvalid}
        listboxProps={{
          emptyContent: (
            <div className="flex flex-col items-center justify-center p-4 gap-3 text-center">
              <p className="text-default-500">No parties found.</p>
              <Button
                size="sm"
                color="primary"
                variant="flat"
                onPress={() => router.push(`/parties/new?type=${partyType || "CUSTOMER"}`)}
              >
                + Add New Party
              </Button>
            </div>
          ),
        }}
      >
        {(party) => (
          <AutocompleteItem key={party.id} textValue={party.name}>
            <div className="flex justify-between items-center w-full">
              <div className="flex flex-col">
                <span className="font-semibold">{party.name}</span>
                {party.phone && <span className="text-xs text-default-500">📱 {party.phone}</span>}
              </div>
              {party.currentBalance !== 0 && (
                <div className="flex flex-col items-end">
                  <span
                    className={`text-sm font-semibold ${
                      party.type === "CUSTOMER"
                        ? party.currentBalance < 0
                          ? "text-success"
                          : "text-danger"
                        : party.currentBalance < 0
                        ? "text-danger"
                        : "text-success"
                    }`}
                  >
                    ₹{Math.abs(party.currentBalance).toLocaleString("en-IN")}
                  </span>
                  <span className="text-[10px] text-default-400">
                    {party.type === "CUSTOMER"
                      ? party.currentBalance < 0
                        ? "To Get ↙"
                        : "To Pay ↗"
                      : party.currentBalance < 0
                      ? "To Pay ↗"
                      : "To Get ↙"}
                  </span>
                </div>
              )}
            </div>
          </AutocompleteItem>
        )}
      </Autocomplete>
    </div>
  );
}
