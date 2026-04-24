"use client";

import { useEffect, useRef, useState } from "react";
import { Autocomplete, AutocompleteItem, Button } from "@heroui/react";
import { useRouter } from "next/navigation";

export interface ItemOption {
  id: string;
  name: string;
  hsnCode: string | null;
  unit: string;
  rate: number;
  taxRate: number | null;
}

interface ItemSearchProps {
  value: string | null;
  inputValue?: string;
  onChange: (item: ItemOption | null) => void;
  onInputChange?: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  isInvalid?: boolean;
  allowsCustomValue?: boolean;
  className?: string;
}

export function ItemSearch({
  value,
  inputValue,
  onChange,
  onInputChange,
  placeholder,
  autoFocus,
  isInvalid,
  allowsCustomValue = true,
  className,
}: ItemSearchProps) {
  const router = useRouter();
  const [items, setItems] = useState<ItemOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedItemRef = useRef<ItemOption | null>(null);

  async function fetchItems(search: string) {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (search) params.set("search", search);
      const response = await fetch(`/api/items?${params}`);
      if (response.ok) {
        const data = await response.json();
        const results = (data.items || []) as ItemOption[];
        // Keep the currently selected item in the list even if not in search results
        if (selectedItemRef.current && !results.some((i) => i.id === selectedItemRef.current!.id)) {
          setItems([selectedItemRef.current, ...results]);
        } else {
          setItems(results);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }

  // Load initial items on mount
  useEffect(() => {
    fetchItems("");
  }, []);

  function handleInputChange(val: string) {
    onInputChange?.(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchItems(val);
    }, 300);
  }

  const selectedKey = value || undefined;

  return (
    <Autocomplete
      className={className}
      label={placeholder || "Search items..."}
      variant="bordered"
      items={items}
      isLoading={isLoading}
      selectedKey={selectedKey}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      allowsCustomValue={allowsCustomValue}
      onSelectionChange={(key) => {
        if (!key) {
          selectedItemRef.current = null;
          onChange(null);
          return;
        }

        const selected = items.find((item) => item.id === String(key));
        selectedItemRef.current = selected ?? null;
        onChange(selected || null);
      }}
      autoFocus={autoFocus}
      isInvalid={isInvalid}
      listboxProps={{
        emptyContent: (
          <div className="flex flex-col items-center justify-center gap-3 p-4 text-center">
            <p className="text-default-500">No items found.</p>
            <Button
              size="sm"
              color="primary"
              variant="flat"
              onPress={() => {
                router.push("/settings/items");
              }}
            >
              + Go to Item Catalog
            </Button>
          </div>
        ),
      }}
    >
      {(item) => (
        <AutocompleteItem key={item.id} textValue={item.name}>
          <div className="flex w-full items-center justify-between">
            <div className="flex flex-col">
              <span className="font-semibold">{item.name}</span>
              {item.hsnCode && (
                <span className="text-[10px] text-default-500">HSN: {item.hsnCode}</span>
              )}
            </div>
            <div className="flex flex-col items-end">
              <span className="text-sm font-semibold">₹{item.rate}</span>
              <span className="text-[10px] text-default-400">per {item.unit}</span>
            </div>
          </div>
        </AutocompleteItem>
      )}
    </Autocomplete>
  );
}
