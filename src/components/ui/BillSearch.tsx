"use client";

import { useEffect, useRef, useState } from "react";
import { Autocomplete, AutocompleteItem } from "@heroui/react";

export interface BillOption {
  id: string;
  billNumber: string;
  grandTotal: number;
  customerName: string;
}

interface BillSearchProps {
  value: string;
  onChange: (bill: BillOption | null) => void;
  partyId: string;
  isDisabled?: boolean;
  placeholder?: string;
  description?: string;
}

/**
 * Searchable combobox for selecting a bill linked to a party.
 * Fetches bills from /api/bills with debounced search.
 */
export function BillSearch({
  value,
  onChange,
  partyId,
  isDisabled,
  placeholder = "Search bills…",
  description,
}: BillSearchProps) {
  const [bills, setBills] = useState<BillOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedBillRef = useRef<BillOption | null>(null);

  async function fetchBills(search: string) {
    if (!partyId) {
      setBills([]);
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        status: "FINAL",
        partyId,
        limit: "20",
      });
      if (search) params.set("search", search);

      const response = await fetch(`/api/bills?${params}`);
      if (response.ok) {
        const data = await response.json();
        const results = (data.bills || []) as BillOption[];
        // Keep the selected bill in the list
        if (
          selectedBillRef.current &&
          !results.some((b) => b.id === selectedBillRef.current!.id)
        ) {
          setBills([selectedBillRef.current, ...results]);
        } else {
          setBills(results);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }

  // Load bills when partyId changes
  useEffect(() => {
    if (!partyId) {
      setBills([]);
      selectedBillRef.current = null;
      return;
    }

    fetchBills("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId]);

  function handleInputChange(val: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchBills(val);
    }, 300);
  }

  return (
    <Autocomplete
      label="Linked Bill"
      placeholder={partyId ? placeholder : "Select a party first"}
      variant="bordered"
      items={bills}
      isLoading={isLoading}
      isDisabled={isDisabled || !partyId}
      selectedKey={value || undefined}
      onInputChange={handleInputChange}
      onSelectionChange={(key) => {
        if (!key) {
          selectedBillRef.current = null;
          onChange(null);
          return;
        }
        const selected = bills.find((b) => b.id === String(key));
        selectedBillRef.current = selected ?? null;
        onChange(selected || null);
      }}
      description={description}
      listboxProps={{
        emptyContent: (
          <div className="p-4 text-center text-sm text-default-500">
            No bills found for this party.
          </div>
        ),
      }}
    >
      {(bill) => (
        <AutocompleteItem key={bill.id} textValue={bill.billNumber}>
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="font-semibold">{bill.billNumber}</span>
              <span className="text-xs text-default-400">
                {bill.customerName}
              </span>
            </div>
            <span className="text-sm font-medium text-default-500">
              ₹{bill.grandTotal.toLocaleString("en-IN")}
            </span>
          </div>
        </AutocompleteItem>
      )}
    </Autocomplete>
  );
}
