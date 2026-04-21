"use client";

import { useEffect, useState } from "react";
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchItems() {
      setIsLoading(true);
      try {
        const response = await fetch("/api/items");
        if (response.ok) {
          const data = await response.json();
          setItems(data.items || []);
        }
      } catch {
        // silently fail
      } finally {
        setIsLoading(false);
      }
    }

    fetchItems();
  }, []);

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
      onInputChange={onInputChange}
      allowsCustomValue={allowsCustomValue}
      onSelectionChange={(key) => {
        if (!key) {
          onChange(null);
          return;
        }

        const selected = items.find((item) => item.id === String(key));
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
