"use client";

import { useMemo, useState, useEffect } from "react";
import { GST_STATE_CODES } from "@/lib/gst-states";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

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

  const [searchTerm, setSearchTerm] = useState("");

  // Initialize search term when value changes externally
  useEffect(() => {
    if (value) {
      const match = stateOptions.find((o) => o.code === value);
      if (match) {
        setSearchTerm(match.label);
      } else {
        setSearchTerm("");
      }
    } else {
      setSearchTerm("");
    }
  }, [value, stateOptions]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return stateOptions;
    const lower = searchTerm.toLowerCase();

    // If the search term exactly matches the selected label, return all options
    // so the dropdown doesn't filter out everything else when opened
    const exactMatch = stateOptions.find(o => o.label === searchTerm);
    if (exactMatch && value === exactMatch.code) {
      return stateOptions;
    }

    return stateOptions.filter(
      (opt) => opt.name.toLowerCase().includes(lower) || opt.code.includes(lower)
    );
  }, [searchTerm, stateOptions, value]);

  function handleInputChange(val: string) {
    setSearchTerm(val);
    if (val === "") {
      onChange("");
    }
  }

  return (
    <SearchableSelect
      items={filteredOptions}
      inputValue={searchTerm}
      onInputChange={handleInputChange}
      onSelectionChange={(item) => {
        setSearchTerm(item.label);
        onChange(item.code);
      }}
      label={label}
      placeholder={placeholder}
      isInvalid={isInvalid}
      errorMessage={errorMessage}
      getKey={(item) => item.code}
      getTextValue={(item) => item.label}
      renderItem={(item) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-default-400">{item.code}</span>
          <span>{item.name}</span>
        </div>
      )}
    />
  );
}
