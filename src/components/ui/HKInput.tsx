"use client";

import { forwardRef, useId } from "react";

export type HKInputSize = "sm" | "md" | "lg";

interface HKInputProps {
  label?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  type?: string;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
  pattern?: string;
  name?: string;
  isRequired?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  description?: string;
  isDisabled?: boolean;
  readOnly?: boolean;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  size?: HKInputSize;
  className?: string;
  style?: React.CSSProperties;
  autoFocus?: boolean;
  min?: string | number;
  max?: string | number;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  classNames?: {
    inputWrapper?: string | string[];
    input?: string | string[];
    label?: string | string[];
    errorMessage?: string | string[];
    description?: string | string[];
  };
}

const SIZE_HEIGHT: Record<HKInputSize, string> = {
  sm: "h-10",
  md: "h-12",
  lg: "h-14",
};

function toClass(v: string | string[] | undefined): string {
  if (!v) return "";
  return Array.isArray(v) ? v.filter(Boolean).join(" ") : v;
}

export const HKInput = forwardRef<HTMLInputElement, HKInputProps>(
  function HKInput(
    {
      label,
      value,
      defaultValue,
      onValueChange,
      onChange,
      placeholder,
      type = "text",
      inputMode,
      pattern,
      name,
      isRequired,
      isInvalid,
      errorMessage,
      description,
      isDisabled,
      readOnly,
      startContent,
      endContent,
      size = "md",
      className,
      style,
      autoFocus,
      min,
      max,
      onFocus,
      onBlur,
      classNames,
    },
    ref
  ) {
    const id = useId();

    const borderClass = isInvalid
      ? "border-[#ef4444]"
      : "border-[var(--hk-border)] hover:border-[var(--hk-orange)]/50 focus-within:border-[var(--hk-orange)]";

    const wrapperClass = [
      "relative flex items-center w-full rounded-xl border bg-[var(--hk-input)] transition-colors",
      borderClass,
      SIZE_HEIGHT[size] ?? SIZE_HEIGHT.md,
      isDisabled ? "opacity-50" : "",
      toClass(classNames?.inputWrapper),
    ]
      .filter(Boolean)
      .join(" ");

    const inputClass = [
      "flex-1 h-full bg-transparent outline-none text-[var(--hk-text)] placeholder:text-[var(--hk-muted)] font-medium text-sm disabled:cursor-not-allowed",
      !startContent ? "pl-3" : "pl-1",
      !endContent ? "pr-3" : "pr-1",
      toClass(classNames?.input),
    ]
      .filter(Boolean)
      .join(" ");

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      onValueChange?.(e.target.value);
      onChange?.(e);
    }

    return (
      <div className={`flex flex-col gap-1 ${className || ""}`} style={style}>
        {label && (
          <label
            htmlFor={id}
            className={`text-xs font-semibold text-[var(--hk-sub)] ${toClass(classNames?.label)}`}
          >
            {label}
            {isRequired && <span className="ml-0.5 text-[#ef4444]">*</span>}
          </label>
        )}
        <div className={wrapperClass}>
          {startContent && (
            <div className="flex shrink-0 items-center pl-3">{startContent}</div>
          )}
          <input
            ref={ref}
            id={id}
            type={type}
            inputMode={inputMode}
            pattern={pattern}
            name={name}
            value={value}
            defaultValue={defaultValue}
            placeholder={placeholder}
            disabled={isDisabled}
            readOnly={readOnly}
            autoFocus={autoFocus}
            required={isRequired}
            min={min}
            max={max}
            onChange={handleChange}
            onFocus={onFocus}
            onBlur={onBlur}
            className={inputClass}
          />
          {endContent && (
            <div className="flex shrink-0 items-center pr-3">{endContent}</div>
          )}
        </div>
        {isInvalid && errorMessage && (
          <p className={`text-xs text-[#ef4444] ${toClass(classNames?.errorMessage)}`}>
            {errorMessage}
          </p>
        )}
        {!isInvalid && description && (
          <p className={`text-xs text-[var(--hk-muted)] ${toClass(classNames?.description)}`}>
            {description}
          </p>
        )}
      </div>
    );
  }
);
