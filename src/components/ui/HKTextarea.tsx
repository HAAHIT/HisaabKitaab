"use client";

import { forwardRef, useId } from "react";

interface HKTextareaProps {
  label?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
  isRequired?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  minRows?: number;
  maxRows?: number;
  className?: string;
  name?: string;
  description?: string;
}

export const HKTextarea = forwardRef<HTMLTextAreaElement, HKTextareaProps>(
  function HKTextarea(
    {
      label,
      value,
      defaultValue,
      onValueChange,
      onChange,
      placeholder,
      isRequired,
      isInvalid,
      errorMessage,
      isDisabled,
      isReadOnly,
      minRows = 3,
      maxRows,
      className,
      name,
      description,
    },
    ref
  ) {
    const id = useId();
    const borderClass = isInvalid
      ? "border-[#ef4444]"
      : "border-[var(--sb-border)] hover:border-[var(--sb-orange)]/50 focus-within:border-[var(--sb-orange)]";

    function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
      onValueChange?.(e.target.value);
      onChange?.(e);
    }

    return (
      <div className={`flex flex-col gap-1 ${className || ""}`}>
        {label && (
          <label
            htmlFor={id}
            className="text-xs font-semibold text-[var(--sb-sub)]"
          >
            {label}
            {isRequired && <span className="ml-0.5 text-[#ef4444]">*</span>}
          </label>
        )}
        <div
          className={`rounded-xl border bg-[var(--sb-input)] transition-colors ${borderClass} ${isDisabled ? "opacity-50" : ""}`}
        >
          <textarea
            ref={ref}
            id={id}
            name={name}
            value={value}
            defaultValue={defaultValue}
            placeholder={placeholder}
            disabled={isDisabled}
            readOnly={isReadOnly}
            required={isRequired}
            rows={minRows}
            onChange={handleChange}
            className="w-full resize-none bg-transparent p-3 text-sm font-medium text-[var(--sb-text)] outline-none placeholder:text-[var(--sb-muted)] disabled:cursor-not-allowed"
            style={maxRows ? { maxHeight: `${maxRows * 1.5}rem`, overflowY: "auto" } : undefined}
          />
        </div>
        {isInvalid && errorMessage && (
          <p className="text-xs text-[#ef4444]">{errorMessage}</p>
        )}
        {!isInvalid && description && (
          <p className="text-xs text-[var(--sb-muted)]">{description}</p>
        )}
      </div>
    );
  }
);
