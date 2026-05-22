"use client";

import { C, OR, PU, GR, SG, TYPE, TOUCH } from "@/components/ui/hk-design";

// ── Variant & size maps ───────────────────────────────────────────────────────

export type HKButtonVariant =
  | "primary"    // gradient orange→purple — primary CTA
  | "success"    // gradient green — confirm / receive payment
  | "secondary"  // ghost-bordered — cancel / back
  | "ghost"      // text-only — icon buttons, close X
  | "danger";    // red tint — destructive actions

export type HKButtonSize = "sm" | "md" | "lg";

interface SizeDef {
  height: number;
  fontSize: number;
  padding: string;
  borderRadius: number;
  gap: number;
}

const SIZE_MAP: Record<HKButtonSize, SizeDef> = {
  sm: { height: TOUCH.secondary, fontSize: TYPE.bodySmall, padding: "0 14px", borderRadius: 10, gap: 6 },
  md: { height: TOUCH.primary,   fontSize: TYPE.body,      padding: "0 22px", borderRadius: 14, gap: 8 },
  lg: { height: 56,              fontSize: TYPE.bodyLarge,  padding: "0 28px", borderRadius: 16, gap: 10 },
};

const VARIANT_STYLES: Record<HKButtonVariant, React.CSSProperties> = {
  primary: {
    background: C.primary,
    color: "#fff",
    border: "none",
    boxShadow: `0 2px 8px ${C.primary}44`,
  },
  success: {
    background: C.positive,
    color: "#fff",
    border: "none",
    boxShadow: `0 2px 8px ${C.positive}44`,
  },
  secondary: {
    background: "var(--sb-card)",
    color: "var(--sb-text)",
    border: "1px solid var(--sb-border-strong)",
    boxShadow: "none",
  },
  ghost: {
    background: "transparent",
    color: "var(--sb-sub)",
    border: "none",
    boxShadow: "none",
  },
  danger: {
    background: "rgba(239,68,68,0.10)",
    color: "#ef4444",
    border: "1px solid rgba(239,68,68,0.20)",
    boxShadow: "none",
  },
};

// ── Spinner (uses .sb-spin from globals.css) ──────────────────────────────────

function Spinner({ size }: { size: HKButtonSize }) {
  const px = size === "sm" ? 14 : 16;
  return (
    <svg
      className="sb-spin"
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

// ── HKButton ──────────────────────────────────────────────────────────────────

export interface HKButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> {
  variant?: HKButtonVariant;
  size?: HKButtonSize;
  /** Shows a spinner and sets aria-busy; the button is automatically non-interactive. */
  isLoading?: boolean;
  /** Visually and functionally disables the button. */
  isDisabled?: boolean;
  /** Stretches the button to 100% width of its container. */
  fullWidth?: boolean;
  /** Icon or text rendered before the label (hidden during loading). */
  startContent?: React.ReactNode;
  /** Icon or text rendered after the label (hidden during loading). */
  endContent?: React.ReactNode;
}

/**
 * Single canonical button for SoloBooks.
 *
 * Replaces:
 *   - GradientButton (variant="primary" | "success")
 *   - Raw <button> cancel patterns (variant="secondary")
 *   - HeroUI <Button color="danger"> (variant="danger")
 *
 * Usage:
 *   <HKButton onClick={handleSave} isLoading={saving}>Save</HKButton>
 *   <HKButton variant="secondary" onClick={onClose}>Cancel</HKButton>
 *   <HKButton variant="danger" size="sm" onClick={handleDelete}>Delete</HKButton>
 */
export function HKButton({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  isDisabled = false,
  fullWidth = false,
  startContent,
  endContent,
  onClick,
  style,
  ...rest
}: HKButtonProps) {
  const disabled = isDisabled || isLoading;
  const { height, fontSize, padding, borderRadius, gap } = SIZE_MAP[size];
  const variantStyles = VARIANT_STYLES[variant];

  return (
    <button
      {...rest}
      disabled={disabled}
      aria-disabled={disabled}
      aria-busy={isLoading || undefined}
      onClick={disabled ? undefined : onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap,
        minHeight: height,
        width: fullWidth ? "100%" : undefined,
        padding,
        borderRadius,
        fontSize,
        fontWeight: 700,
        fontFamily: SG,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: isDisabled && !isLoading ? 0.5 : 1,
        transition: "transform 0.15s, opacity 0.15s, box-shadow 0.15s",
        boxSizing: "border-box",
        whiteSpace: "nowrap",
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
        ...variantStyles,
        ...style,
      }}
    >
      {isLoading ? <Spinner size={size} /> : startContent}
      <span>{children}</span>
      {!isLoading && endContent}
    </button>
  );
}
