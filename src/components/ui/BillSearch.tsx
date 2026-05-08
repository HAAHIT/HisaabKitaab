"use client";

import { useEffect, useRef, useState } from "react";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

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

export function BillSearch({
  value,
  onChange,
  partyId,
  isDisabled,
  placeholder = "Search bills…",
  description,
}: BillSearchProps) {
  const [bills, setBills] = useState<BillOption[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
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

  useEffect(() => {
    if (!partyId) {
      setBills([]);
      selectedBillRef.current = null;
      setSearchTerm("");
      return;
    }

    fetchBills("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId]);

  useEffect(() => {
    if (!value) {
      setSearchTerm("");
      selectedBillRef.current = null;
    }
  }, [value]);

  function handleInputChange(val: string) {
    setSearchTerm(val);

    if (val === "" && selectedBillRef.current) {
      selectedBillRef.current = null;
      onChange(null);
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchBills(val);
    }, 300);
  }

  if (isDisabled || !partyId) {
    return (
      <div className="opacity-50 pointer-events-none">
        <SearchableSelect<BillOption>
          items={[]}
          inputValue=""
          onInputChange={() => {}}
          onSelectionChange={() => {}}
          label="Linked Bill"
          placeholder={partyId ? placeholder : "Select a party first"}
          getKey={(b) => b.id}
          getTextValue={(b) => b.billNumber}
          renderItem={() => <></>}
        />
        {description && <p className="text-xs text-default-400 mt-1 pl-1">{description}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 w-full">
      <SearchableSelect
        items={bills}
        inputValue={searchTerm}
        onInputChange={handleInputChange}
        onSelectionChange={(bill) => {
          selectedBillRef.current = bill;
          setSearchTerm(bill.billNumber);
          onChange(bill);
        }}
        isLoading={isLoading}
        label="Linked Bill"
        placeholder={placeholder}
        emptyContent="No bills found for this party."
        getKey={(bill) => bill.id}
        getTextValue={(bill) => bill.billNumber}
        renderItem={(bill) => (
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="font-semibold">{bill.billNumber}</span>
              <span className="text-xs text-default-400">{bill.customerName}</span>
            </div>
            <span className="text-sm font-medium text-default-500">
              ₹{bill.grandTotal.toLocaleString("en-IN")}
            </span>
          </div>
        )}
      />
      {description && <p className="text-xs text-default-400 pl-1">{description}</p>}
    </div>
  );
}
