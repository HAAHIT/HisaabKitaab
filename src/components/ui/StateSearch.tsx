"use client";

import { useMemo } from "react";
import { Autocomplete, AutocompleteItem } from "@heroui/react";
import { GST_STATE_CODES } from "@/lib/gst-states";

interface StateOption {
  code: string;
  name: string;
  label: string;
}

interface StateSearchProps {
  value: string;
  onChange: (code: string) => void;
  isInvalid?: boolean;
  errorMessage?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
  placeholder?: string;
}

/** Searchable combobox for GST Place of Supply (37+ states/UTs). */
export function StateSearch({
  value,
  onChange,
  isInvalid,
  errorMessage,
  size = "sm",
  className,
  label,
  placeholder = "Type to search state…",
}: StateSearchProps) {
  const stateOptions = useMemo<StateOption[]>(() => {
    return Object.entries(GST_STATE_CODES).map(([code, name]) => ({
      code,
      name,
      label: `${code} — ${name}`,
    }));
  }, []);

  return (
    <Autocomplete
      aria-label={label || "Place of supply"}
      label={label}
      placeholder={placeholder}
      size={size}
      variant="bordered"
      className={className}
      defaultItems={stateOptions}
      selectedKey={value || undefined}
      onSelectionChange={(key) => {
        onChange(key ? String(key) : "");
      }}
      isInvalid={isInvalid}
      errorMessage={errorMessage}
      allowsCustomValue={false}
    >
      {(item) => (
        <AutocompleteItem key={item.code} textValue={item.label}>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-default-400">{item.code}</span>
            <span>{item.name}</span>
          </div>
        </AutocompleteItem>
      )}
    </Autocomplete>
  );
}
