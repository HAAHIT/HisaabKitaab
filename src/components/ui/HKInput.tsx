"use client";

import { Input } from "@heroui/react";
import type { InputProps } from "@heroui/react";

// ── HKInput ───────────────────────────────────────────────────────────────────

export type HKInputSize = "sm" | "md" | "lg";

export interface HKInputProps
  extends Omit<InputProps, "variant" | "size" | "color"> {
  size?: HKInputSize;
}

/**
 * Canonical form input for HisaabKitaab.
 *
 * Standardises:
 *   - Variant: always "bordered" (eliminates "flat"/"underlined"/"faded" scatter)
 *   - Focus color: HK orange via --hk-orange CSS variable
 *   - Label style: --hk-sub color, semibold weight
 *   - Background: --hk-input (adapts to dark/light theme automatically)
 *   - Error display: red errorMessage with consistent styling
 *
 * Consumers may still pass classNames to extend specific slots.
 *
 * Usage:
 *   <HKInput label="Party Name *" value={name} onValueChange={setName} isRequired />
 *   <HKInput label="Amount" type="number" isInvalid={!!err} errorMessage={err} />
 *   <HKInput label="Notes" endContent={<span>INR</span>} />
 */
export function HKInput({ size = "md", classNames, ...props }: HKInputProps) {
  return (
    <Input
      variant="bordered"
      size={size}
      classNames={{
        ...classNames,
        inputWrapper: mergeSlot(
          [
            "border-[var(--hk-border)]",
            "data-[focus=true]:border-[var(--hk-orange)]",
            "hover:border-[var(--hk-orange)]/50",
            "bg-[var(--hk-input)]",
            "transition-colors",
            "!shadow-none",
          ],
          classNames?.inputWrapper,
        ),
        input: mergeSlot(
          [
            "!text-[var(--hk-text)]",
            "placeholder:text-[var(--hk-muted)]",
            "font-medium",
          ],
          classNames?.input,
        ),
        label: mergeSlot(
          ["text-[var(--hk-sub)]", "font-semibold"],
          classNames?.label,
        ),
        errorMessage: mergeSlot(
          ["text-[#ef4444]", "font-medium"],
          classNames?.errorMessage,
        ),
        description: mergeSlot(
          ["text-[var(--hk-muted)]"],
          classNames?.description,
        ),
      }}
      {...props}
    />
  );
}

// ── Utility — merge HeroUI slot classNames (string | string[] | undefined) ────

function mergeSlot(
  base: string[],
  override: string | string[] | undefined,
): string[] {
  if (!override) return base;
  return [...base, ...(Array.isArray(override) ? override : [override])];
}
