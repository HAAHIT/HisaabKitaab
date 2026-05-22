"use client";

import { createContext, useContext, useId } from "react";

interface RadioGroupContextValue {
  name: string;
  value: string;
  onValueChange: (value: string) => void;
  isDisabled?: boolean;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

interface HKRadioGroupProps {
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  isDisabled?: boolean;
  orientation?: "horizontal" | "vertical";
  children: React.ReactNode;
  className?: string;
}

export function HKRadioGroup({
  value,
  onValueChange,
  label,
  isDisabled,
  orientation = "vertical",
  children,
  className,
}: HKRadioGroupProps) {
  const name = useId();

  return (
    <RadioGroupContext.Provider value={{ name, value, onValueChange, isDisabled }}>
      <fieldset className={`border-0 p-0 m-0 ${className || ""}`}>
        {label && (
          <legend className="mb-2 text-xs font-semibold text-[var(--sb-sub)]">
            {label}
          </legend>
        )}
        <div
          className={`flex gap-3 ${orientation === "horizontal" ? "flex-row flex-wrap" : "flex-col"}`}
        >
          {children}
        </div>
      </fieldset>
    </RadioGroupContext.Provider>
  );
}

interface HKRadioProps {
  value: string;
  isDisabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function HKRadio({ value, isDisabled, children, className }: HKRadioProps) {
  const ctx = useContext(RadioGroupContext);
  const id = useId();
  const disabled = isDisabled || ctx?.isDisabled;
  const checked = ctx?.value === value;

  return (
    <label
      htmlFor={id}
      className={`inline-flex cursor-pointer items-center gap-2.5 ${disabled ? "cursor-not-allowed opacity-50" : ""} ${className || ""}`}
    >
      <div className="relative flex shrink-0 items-center justify-center">
        <input
          id={id}
          type="radio"
          name={ctx?.name}
          value={value}
          checked={checked}
          disabled={disabled}
          onChange={() => ctx?.onValueChange(value)}
          className="peer sr-only"
        />
        <div
          className={`h-5 w-5 rounded-full border-2 transition-colors ${
            checked
              ? "border-[var(--sb-orange)]"
              : "border-[var(--sb-border)] bg-[var(--sb-input)] peer-hover:border-[var(--sb-orange)]/50"
          }`}
        />
        {checked && (
          <div className="pointer-events-none absolute h-2.5 w-2.5 rounded-full bg-[var(--sb-orange)]" />
        )}
      </div>
      <span className="text-sm font-medium text-[var(--sb-text)]">{children}</span>
    </label>
  );
}
