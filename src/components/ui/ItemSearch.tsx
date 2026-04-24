"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

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
  autoFocus, // currently not natively supported by SearchableSelect container without refs, but could be added later
  isInvalid,
  allowsCustomValue = true,
  className,
}: ItemSearchProps) {
  const router = useRouter();
  const [items, setItems] = useState<ItemOption[]>([]);
  const [localSearch, setLocalSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedItemRef = useRef<ItemOption | null>(null);

  const currentSearch = inputValue !== undefined ? inputValue : localSearch;

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
    if (inputValue === undefined) {
      setLocalSearch(val);
    }
    onInputChange?.(val);

    // Clear selection if input is cleared
    if (val === "" && selectedItemRef.current) {
      selectedItemRef.current = null;
      onChange(null);
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchItems(val);
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
          router.push("/settings/items");
        }}
      >
        + Go to Item Catalog
      </Button>
    </div>
  );

  return (
    <div className={className}>
      <SearchableSelect
        items={items}
        inputValue={currentSearch}
        onInputChange={handleInputChange}
        onSelectionChange={(item) => {
          selectedItemRef.current = item;
          if (inputValue === undefined) {
            setLocalSearch(item.name);
          }
          onInputChange?.(item.name);
          onChange(item);
        }}
        isLoading={isLoading}
        label={placeholder || "Search items..."}
        isInvalid={isInvalid}
        getKey={(item) => item.id}
        getTextValue={(item) => item.name}
        bottomContent={bottomSection}
        emptyContent="No items found."
        renderItem={(item) => (
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
        )}
      />
    </div>
  );
}
