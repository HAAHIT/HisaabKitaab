"use client";

// ── SoloBooks design system — v3 restraint-first palette ──────────────────
// Color used sparingly. White space generously. Warm paper identity in light mode.

import { useEffect, useRef, useState } from "react";

// ── Semantic color constants (direct values for inline styles) ────────────────
export const C = {
  primary:      "#2563eb",
  primarySoft:  "var(--sb-primary-soft)",
  primaryDark:  "#13224a",
  positive:     "#0a8754",
  positiveSoft: "var(--sb-positive-soft)",
  negative:     "#c43e1c",
  negativeSoft: "var(--sb-negative-soft)",
  warning:      "#b07a00",
  warningSoft:  "var(--sb-warning-soft)",
  info:         "#5b4dbf",
  infoSoft:     "var(--sb-info-soft)",
};

// Legacy compat aliases
export const OR = C.primary;
export const PU = C.info;
export const GR = C.positive;
export const AM = C.warning;
export const SG = "var(--font-sans)";
export const IN = "var(--font-sans)";

// ── Typography scale — all numeric for backward compat ───────────────────────
export const TYPE = {
  display: 32,
  h1: 26, h1Mobile: 22, h1Flat: 26,
  h2: 19,
  h3: 16,
  body: 15,
  bodySm: 14, bodySmall: 14, bodyLarge: 17,
  label: 13,
  caption: 12, chip: 12, navLabel: 12,
  num: 22,
  numSm: 16, numSmall: 15,
  numLarge: 28, numMedium: 18,
} as const;

// Internal scale used by typo() for full CSS shorthand
const _SCALE: Record<string, { size: number; weight: number; height: number; tracking: string }> = {
  display: { size: 32, weight: 700, height: 1.15, tracking: "-0.6px" },
  h1:      { size: 26, weight: 700, height: 1.2,  tracking: "-0.5px" },
  h2:      { size: 19, weight: 700, height: 1.3,  tracking: "-0.3px" },
  h3:      { size: 16, weight: 600, height: 1.4,  tracking: "-0.1px" },
  body:    { size: 15, weight: 500, height: 1.5,  tracking: "0" },
  bodySm:  { size: 14, weight: 500, height: 1.45, tracking: "0" },
  label:   { size: 13, weight: 600, height: 1.3,  tracking: "0.1px" },
  caption: { size: 12, weight: 500, height: 1.3,  tracking: "0.1px" },
  num:     { size: 22, weight: 700, height: 1.1,  tracking: "-0.5px" },
  numSm:   { size: 16, weight: 700, height: 1.1,  tracking: "-0.2px" },
};

// Legacy numeric shorthands used by older page code
export const h1 = 26;
export const h1Mobile = 22;
export const body = 15;
export const bodySmall = 14;

export function typo(t: keyof typeof _SCALE): React.CSSProperties {
  const v = _SCALE[t];
  if (!v) return {};
  return {
    fontSize: v.size,
    fontWeight: v.weight,
    lineHeight: v.height,
    letterSpacing: v.tracking,
  };
}

export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };
export const TOUCH  = { primary: 48, secondary: 44, icon: 40 };
export const FONT   = "var(--font-sans)";
export const DISPLAY = "var(--font-display)";
export const BRAND  = "var(--font-brand)";
export const MONO   = "var(--font-mono)";

// ── Currency ──────────────────────────────────────────────────────────────────

export function fmt(n: number): string {
  const abs = Math.abs(n || 0);
  if (abs >= 10000000) return "₹" + (abs / 10000000).toFixed(1) + " Cr";
  if (abs >= 100000)   return "₹" + (abs / 100000).toFixed(1) + " L";
  if (abs >= 1000)     return "₹" + Math.round(abs / 1000) + "K";
  return "₹" + abs;
}

export function fmtFull(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);
}

// ── Mobile detection ─────────────────────────────────────────────────────────

export function useIsMobile(): boolean {
  const [m, setM] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

// ── HKCard ────────────────────────────────────────────────────────────────────

export function HKCard({
  children,
  style = {},
  className,
  onClick,
  hoverable = false,
  padding = 20,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
  padding?: number;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className={className}
      onClick={onClick}
      onMouseEnter={() => hoverable && setHovered(true)}
      onMouseLeave={() => hoverable && setHovered(false)}
      style={{
        background: "var(--sb-card)",
        borderRadius: RADIUS.lg,
        border: `1px solid ${hovered ? "var(--sb-border-strong)" : "var(--sb-border)"}`,
        boxShadow: hovered && hoverable ? "var(--sb-shadow-card-hover)" : "var(--sb-shadow-card)",
        padding,
        transition: "border-color 0.15s, box-shadow 0.15s",
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── StatusChip ────────────────────────────────────────────────────────────────

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: string }> = {
    FINAL:     { label: "Final",   tone: "positive" },
    DRAFT:     { label: "Draft",   tone: "warning"  },
    CANCELLED: { label: "Cancel",  tone: "negative" },
    EXPECTED:  { label: "Pending", tone: "warning"  },
    COMPLETED: { label: "Done",    tone: "positive" },
  };
  const m = map[status] || { label: status, tone: "neutral" };
  return <HKChip tone={m.tone as HKChipTone}>{m.label}</HKChip>;
}

// ── HKChip ────────────────────────────────────────────────────────────────────

type HKChipTone = "neutral" | "primary" | "positive" | "negative" | "warning" | "info";

export function HKChip({
  children,
  tone = "neutral",
  size = "sm",
}: {
  children: React.ReactNode;
  tone?: HKChipTone;
  size?: "sm" | "md";
}) {
  const tones: Record<HKChipTone, { bg: string; color: string }> = {
    neutral:  { bg: "var(--sb-surface-alt)", color: "var(--sb-sub)" },
    primary:  { bg: C.primarySoft,   color: C.primary },
    positive: { bg: C.positiveSoft,  color: C.positive },
    negative: { bg: C.negativeSoft,  color: C.negative },
    warning:  { bg: C.warningSoft,   color: C.warning },
    info:     { bg: C.infoSoft,      color: C.info },
  };
  const t = tones[tone];
  const sizes = { sm: { h: 22, fz: 11, px: 8 }, md: { h: 26, fz: 12, px: 10 } };
  const s = sizes[size];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      height: s.h, padding: `0 ${s.px}px`,
      borderRadius: RADIUS.sm,
      background: t.bg, color: t.color,
      fontFamily: FONT, fontSize: s.fz, fontWeight: 600,
      letterSpacing: "0.1px", whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

// ── HKAvatar ──────────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  { fg: "#6366f1", bg: "#eef0fe" },
  { fg: "#8b5cf6", bg: "#f3eefe" },
  { fg: "#ec4899", bg: "#fdeef6" },
  { fg: "#0891b2", bg: "#e8f4f7" },
  { fg: "#7c5e3c", bg: "#f5eee2" },
  { fg: "#475569", bg: "#eef1f5" },
  { fg: "#a16207", bg: "#fbf0d9" },
  { fg: "#9333ea", bg: "#f4e8fc" },
];

export function HKAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const init = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const seed = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const swatch = AVATAR_PALETTE[seed % AVATAR_PALETTE.length];
  return (
    <div style={{
      width: size, height: size, minWidth: size,
      borderRadius: Math.floor(size / 3),
      background: swatch.bg, color: swatch.fg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: FONT, fontWeight: 700, fontSize: Math.floor(size * 0.36),
    }}>
      {init}
    </div>
  );
}

// ── HKButton ──────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

export function HKButton({
  children, onClick, variant = "primary", size = "md",
  icon, fullWidth, disabled, type = "button", style = {},
}: {
  children?: React.ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  style?: React.CSSProperties;
}) {
  const sizes: Record<ButtonSize, { h: number; px: number; fz: number }> = {
    sm: { h: 36, px: 14, fz: 13 },
    md: { h: 44, px: 18, fz: 14 },
    lg: { h: 50, px: 24, fz: 15 },
  };
  const s = sizes[size];

  const variants: Record<ButtonVariant, { bg: string; color: string; border: string; hoverBg: string }> = {
    primary:   { bg: C.primary,   color: "#fff",              border: C.primary,    hoverBg: "#1d4ed8" },
    secondary: { bg: "var(--sb-card)", color: "var(--sb-text)", border: "var(--sb-border-strong)", hoverBg: "var(--sb-hover)" },
    ghost:     { bg: "transparent",   color: "var(--sb-sub)",  border: "transparent", hoverBg: "var(--sb-hover)" },
    danger:    { bg: "transparent",   color: C.negative,        border: C.negative + "40", hoverBg: C.negativeSoft },
    success:   { bg: C.positive,      color: "#fff",            border: C.positive,        hoverBg: "#076b41" },
  };
  const v = variants[variant];
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type={type} onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
        height: s.h, padding: `0 ${s.px}px`,
        borderRadius: RADIUS.md, border: `1px solid ${v.border}`,
        background: hovered && !disabled ? v.hoverBg : v.bg,
        color: v.color, fontFamily: FONT, fontSize: s.fz, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        width: fullWidth ? "100%" : "auto",
        whiteSpace: "nowrap",
        transition: "background 0.15s, border-color 0.15s",
        ...style,
      }}
    >
      {icon}{children}
    </button>
  );
}

// ── HKInput ───────────────────────────────────────────────────────────────────

export function HKInputField({
  label, value, onChange, type = "text", placeholder,
  hint, error, prefix, suffix, required, autoFocus, optional, style = {},
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  required?: boolean;
  autoFocus?: boolean;
  optional?: boolean;
  style?: React.CSSProperties;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={style}>
      {label && (
        <label style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 6, fontSize: 13, fontWeight: 600, color: "var(--sb-text)",
        }}>
          <span>{label}{required && <span style={{ color: C.primary, marginLeft: 3 }}>*</span>}</span>
          {optional && <span style={{ fontSize: 12, color: "var(--sb-muted)", fontWeight: 500 }}>Optional</span>}
        </label>
      )}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: prefix || suffix ? "0 12px" : "0 14px",
        height: 48, borderRadius: RADIUS.md,
        background: "var(--sb-input)",
        border: `1.5px solid ${error ? C.negative : focused ? C.primary : "transparent"}`,
        transition: "border-color 0.15s",
      }}>
        {prefix && <span style={{ color: "var(--sb-muted)", fontSize: 15 }}>{prefix}</span>}
        <input
          type={type} value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder} autoFocus={autoFocus}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            color: "var(--sb-text)", fontFamily: FONT, fontSize: 15,
            fontWeight: 500, width: "100%", minWidth: 0,
          }}
        />
        {suffix && <span style={{ color: "var(--sb-muted)", fontSize: 14 }}>{suffix}</span>}
      </div>
      {error
        ? <p style={{ marginTop: 6, fontSize: 12, color: C.negative }}>{error}</p>
        : hint && <p style={{ marginTop: 6, fontSize: 12, color: "var(--sb-muted)" }}>{hint}</p>
      }
    </div>
  );
}

// ── HKSkeleton ────────────────────────────────────────────────────────────────

export function HKSkeleton({
  width = "100%", height = 16, radius = 8, style = {},
}: {
  width?: string | number;
  height?: number;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: "linear-gradient(90deg, var(--sb-surface-alt) 0%, var(--sb-border) 50%, var(--sb-surface-alt) 100%)",
      backgroundSize: "200% 100%",
      animation: "sb-shimmer 1.4s linear infinite",
      ...style,
    }} />
  );
}

// ── HKEmptyState ──────────────────────────────────────────────────────────────

export function HKEmptyState({
  icon, title, body, action,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ padding: "48px 24px", textAlign: "center" }}>
      {icon && (
        <div style={{
          width: 56, height: 56, borderRadius: RADIUS.lg,
          background: "var(--sb-surface-alt)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          marginBottom: 14, color: "var(--sb-sub)",
        }}>
          {icon}
        </div>
      )}
      <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--sb-text)", marginBottom: 6 }}>{title}</h3>
      {body && <p style={{ fontSize: 14, color: "var(--sb-sub)", marginBottom: action ? 16 : 0, maxWidth: 320, margin: "0 auto" }}>{body}</p>}
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  );
}

// ── HKSection ─────────────────────────────────────────────────────────────────

export function HKSection({
  title, action, subtitle, children, style = {},
}: {
  title?: string;
  action?: React.ReactNode;
  subtitle?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <section style={{ marginBottom: 20, ...style }}>
      {(title || action) && (
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "flex-end", marginBottom: 12, gap: 8,
        }}>
          <div>
            {title && <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--sb-text)", margin: 0 }}>{title}</h2>}
            {subtitle && <p style={{ fontSize: 12, color: "var(--sb-sub)", margin: "2px 0 0" }}>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// ── HKMoney — typographic money display ───────────────────────────────────────

export function HKMoney({
  value, size = "md", sign = false, color,
}: {
  value: number;
  size?: "sm" | "md" | "lg" | "xl";
  sign?: boolean;
  color?: string;
}) {
  const sizes: Record<string, number> = { sm: 14, md: 17, lg: 22, xl: 32 };
  const auto = value > 0 ? C.positive : value < 0 ? C.negative : "var(--sb-text)";
  const c = color || (sign ? auto : "var(--sb-text)");
  return (
    <span style={{
      fontFamily: FONT, fontWeight: 700,
      fontSize: sizes[size], letterSpacing: "-0.3px",
      color: c, fontVariantNumeric: "tabular-nums",
    }}>
      {sign && value > 0 ? "+" : ""}
      {fmtFull(value)}
    </span>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

export function HKToast({
  message,
  type,
}: {
  message: string;
  type: "success" | "error";
}) {
  const bg = type === "success" ? C.positive : C.negative;
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%",
      transform: "translateX(-50%)", zIndex: 2000,
      padding: "12px 18px", borderRadius: 14,
      background: bg, color: "#fff",
      boxShadow: "0 14px 40px rgba(0,0,0,0.25)",
      fontSize: 14, fontWeight: 600, fontFamily: FONT,
      display: "flex", alignItems: "center", gap: 10,
      animation: "sb-sheet-up 0.25s ease-out",
      maxWidth: "calc(100vw - 32px)",
    }}>
      <span>{type === "success" ? "✓" : "⚠"}</span>
      <span>{message}</span>
    </div>
  );
}

// ── SearchBox ─────────────────────────────────────────────────────────────────

export function SearchBox({
  value, onChange, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ flex: 1, minWidth: 180, position: "relative" }}>
      <svg
        style={{
          position: "absolute", left: 14, top: "50%",
          transform: "translateY(-50%)", color: "var(--sb-muted)",
          pointerEvents: "none",
        }}
        width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <input
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%", height: TOUCH.secondary,
          padding: "0 14px 0 38px",
          borderRadius: RADIUS.md,
          border: `1.5px solid ${focused ? C.primary : "var(--sb-border)"}`,
          background: "var(--sb-card)",
          color: "var(--sb-text)", fontSize: 15, fontWeight: 500, fontFamily: FONT,
          boxSizing: "border-box", outline: "none",
          transition: "border-color 0.15s",
        }}
      />
    </div>
  );
}

// ── PillFilter ────────────────────────────────────────────────────────────────

export function PillFilter<T extends string>({
  options, value, onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map(o => {
        const active = value === o.key;
        return (
          <button
            key={o.key} onClick={() => onChange(o.key)}
            style={{
              padding: "7px 14px", borderRadius: RADIUS.pill,
              border: `1px solid ${active ? C.primary : "var(--sb-border)"}`,
              background: active ? C.primary : "var(--sb-card)",
              color: active ? "#fff" : "var(--sb-sub)",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              fontFamily: FONT, transition: "all 0.15s", whiteSpace: "nowrap",
            }}
          >{o.label}</button>
        );
      })}
    </div>
  );
}

// ── PageHeader ────────────────────────────────────────────────────────────────

export function PageHeader({
  title, subtitle, isMobile, action,
}: {
  title: string;
  subtitle?: string;
  isMobile: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      alignItems: "center", gap: 12, flexWrap: "wrap",
      marginBottom: 18,
    }}>
      <div>
        <h1 style={{
          fontFamily: DISPLAY,
          fontSize: isMobile ? 24 : 30,
          fontWeight: 600,
          color: "var(--sb-text)",
          letterSpacing: "-0.01em",
          margin: 0, lineHeight: 1.2,
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{
            fontSize: 14, fontWeight: 500, color: "var(--sb-sub)",
            marginTop: 4,
          }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

// ── HKSheet ───────────────────────────────────────────────────────────────────

export function HKSheet({
  isOpen, onClose, title, children, footer, width = 460,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.body.classList.add("hk-sheet-open");
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      document.body.style.overflow = "";
      document.body.classList.remove("hk-sheet-open");
    }
    return () => {
      document.body.style.overflow = "";
      document.body.classList.remove("hk-sheet-open");
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen && !visible) return null;

  const panelStyle: React.CSSProperties = isMobile ? {
    position: "fixed", left: 0, right: 0, bottom: 0,
    width: "100%", maxWidth: "100vw", boxSizing: "border-box", overflowX: "hidden",
    maxHeight: "92vh", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    background: "var(--sb-card)", display: "flex", flexDirection: "column",
    zIndex: 1000,
    transform: visible ? "translateY(0)" : "translateY(100%)",
    transition: "transform 0.28s cubic-bezier(0.32,0.72,0,1)",
    boxShadow: "0 -4px 40px rgba(0,0,0,0.18)",
  } : {
    position: "fixed", top: 0, right: 0, bottom: 0,
    width, maxWidth: "100vw", boxSizing: "border-box",
    background: "var(--sb-card)",
    borderLeft: "1px solid var(--sb-border)",
    display: "flex", flexDirection: "column",
    zIndex: 1000,
    transform: visible ? "translateX(0)" : "translateX(100%)",
    transition: "transform 0.28s cubic-bezier(0.32,0.72,0,1)",
    boxShadow: "-4px 0 40px rgba(0,0,0,0.12)",
  };

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, zIndex: 999,
        background: "var(--sb-overlay, rgba(0,0,0,0.45))",
        opacity: visible ? 1 : 0, transition: "opacity 0.25s",
        backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)",
      }} />
      <div style={panelStyle}>
        {isMobile && (
          <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--sb-border-strong)" }} />
          </div>
        )}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "1px solid var(--sb-border)", flexShrink: 0,
        }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: "var(--sb-text)", margin: 0, fontFamily: SG }}>{title}</p>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: 9,
            border: "1px solid var(--sb-border)", background: "var(--sb-surface-alt)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "var(--sb-sub)",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>{children}</div>
        {footer && (
          <div style={{
            padding: "14px 20px 20px", borderTop: "1px solid var(--sb-border)",
            display: "flex", gap: 10, flexShrink: 0,
          }}>{footer}</div>
        )}
      </div>
    </>
  );
}

// ── HKModal ───────────────────────────────────────────────────────────────────

export function HKModal({
  isOpen, onClose, title, children, footer, width = 520,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    document.body.classList.add("hk-sheet-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("hk-sheet-open");
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--sb-overlay, rgba(0,0,0,0.50))",
        backdropFilter: "blur(2px)",
        padding: "16px",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={panelRef} style={{
        background: "var(--sb-card)", borderRadius: RADIUS.xl,
        border: "1px solid var(--sb-border)",
        width: "100%", maxWidth: width,
        maxHeight: "88vh", display: "flex", flexDirection: "column",
        boxShadow: "var(--sb-shadow-lg)",
        fontFamily: FONT,
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "1px solid var(--sb-divider)", flexShrink: 0,
        }}>
          <p style={{ fontSize: 19, fontWeight: 700, color: "var(--sb-text)", margin: 0 }}>{title}</p>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: RADIUS.md,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", border: "1px solid var(--sb-border)",
            cursor: "pointer", color: "var(--sb-sub)",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        {/* Body */}
        <div style={{ padding: "18px 20px", overflowY: "auto", flex: 1 }}>{children}</div>
        {/* Footer */}
        {footer && (
          <div style={{
            padding: "14px 20px 16px", borderTop: "1px solid var(--sb-divider)",
            display: "flex", gap: 10, flexShrink: 0,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ── OverdueBanner — shared across Dashboard / Bills / Parties ─────────────────

export function OverdueBanner({ count, amount, topPartyName, onClick }: {
  count: number;
  amount: number;
  topPartyName?: string;
  onClick?: () => void;
}) {
  if (count === 0) return null;
  return (
    <button onClick={onClick} style={{
      width: "100%", display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px", borderRadius: RADIUS.md,
      border: `1px solid ${C.primary}33`,
      background: C.primarySoft, cursor: "pointer", textAlign: "left",
      marginBottom: 16, fontFamily: FONT,
      transition: "border-color 0.15s",
    }}
    onMouseEnter={e => (e.currentTarget.style.borderColor = C.primary + "66")}
    onMouseLeave={e => (e.currentTarget.style.borderColor = C.primary + "33")}
    >
      <div style={{
        width: 40, height: 40, borderRadius: RADIUS.md,
        background: C.primary, color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: C.primaryDark, margin: 0 }}>
          {fmtFull(amount)} overdue
        </p>
        <p style={{ fontSize: 12, color: C.primaryDark, margin: "2px 0 0", opacity: 0.7 }}>
          {count === 1 && topPartyName
            ? `from ${topPartyName} — chase karo`
            : `from ${count} parties — ek chakkar laga lo`}
        </p>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: C.primary, display: "flex", alignItems: "center", gap: 4 }}>
        Dekho →
      </span>
    </button>
  );
}
