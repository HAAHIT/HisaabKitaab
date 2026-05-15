"use client";

import { forwardRef, useId } from "react";

interface HKSelectProps {
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  isRequired?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  isDisabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
  startContent?: React.ReactNode;
  description?: string;
}

const SIZE_CLASS: Record<string, string> = {
  sm: "h-10 text-sm",
  md: "h-12 text-sm",
  lg: "h-14 text-base",
};

export const HKSelect = forwardRef<HTMLSelectElement, HKSelectProps>(
  function HKSelect(
    {
      label,
      value,
      onValueChange,
      placeholder,
      isRequired,
      isInvalid,
      errorMessage,
      isDisabled,
      size = "md",
      className,
      children,
      startContent,
      description,
    },
    ref
  ) {
    const id = useId();
    const borderClass = isInvalid
      ? "border-[#ef4444]"
      : "border-[var(--hk-border)] hover:border-[var(--hk-orange)]/50 focus-within:border-[var(--hk-orange)]";

    return (
      <div className={`flex flex-col gap-1 ${className || ""}`}>
        {label && (
          <label
            htmlFor={id}
            className="text-xs font-semibold text-[var(--hk-sub)]"
          >
            {label}
            {isRequired && <span className="ml-0.5 text-[#ef4444]">*</span>}
          </label>
        )}
        <div
          className={`relative flex items-center rounded-xl border bg-[var(--hk-input)] transition-colors ${borderClass} ${SIZE_CLASS[size] ?? SIZE_CLASS.md} ${isDisabled ? "opacity-50" : ""}`}
        >
          {startContent && (
            <div className="flex shrink-0 items-center pl-3">
              {startContent}
            </div>
          )}
          <select
            ref={ref}
            id={id}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            disabled={isDisabled}
            required={isRequired}
            className="h-full w-full flex-1 cursor-pointer appearance-none bg-transparent px-3 font-medium text-[var(--hk-text)] outline-none disabled:cursor-not-allowed"
            style={{ paddingRight: "2rem" }}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {children}
          </select>
          {/* Chevron icon */}
          <div className="pointer-events-none absolute right-3 flex items-center">
            <svg
              className="h-4 w-4 text-[var(--hk-muted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="m6 9 6 6 6-6"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </div>
        </div>
        {isInvalid && errorMessage && (
          <p className="text-xs text-[#ef4444]">{errorMessage}</p>
        )}
        {!isInvalid && description && (
          <p className="text-xs text-[var(--hk-muted)]">{description}</p>
        )}
      </div>
    );
  }
);

export function HKSelectItem({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  return <option value={value}>{children}</option>;
}
