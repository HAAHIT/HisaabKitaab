"use client";

import { useId } from "react";

interface HKCheckboxProps {
  isSelected: boolean;
  onValueChange: (isSelected: boolean) => void;
  isDisabled?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export function HKCheckbox({
  isSelected,
  onValueChange,
  isDisabled,
  children,
  className,
}: HKCheckboxProps) {
  const id = useId();

  return (
    <label
      htmlFor={id}
      className={`inline-flex cursor-pointer items-center gap-2.5 ${isDisabled ? "cursor-not-allowed opacity-50" : ""} ${className || ""}`}
    >
      <div className="relative flex shrink-0 items-center justify-center">
        <input
          id={id}
          type="checkbox"
          checked={isSelected}
          disabled={isDisabled}
          onChange={(e) => onValueChange(e.target.checked)}
          className="peer sr-only"
        />
        <div
          className={`h-5 w-5 rounded-md border-2 transition-colors ${
            isSelected
              ? "border-[var(--hk-orange)] bg-[var(--hk-orange)]"
              : "border-[var(--hk-border)] bg-[var(--hk-input)] peer-hover:border-[var(--hk-orange)]/50"
          }`}
        />
        {isSelected && (
          <svg
            className="pointer-events-none absolute h-3 w-3 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M5 13l4 4L19 7"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
            />
          </svg>
        )}
      </div>
      {children && (
        <span className="text-sm font-medium text-[var(--hk-text)]">
          {children}
        </span>
      )}
    </label>
  );
}
