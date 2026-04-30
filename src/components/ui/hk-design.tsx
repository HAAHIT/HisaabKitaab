"use client";

// ── HisaabKitaab design system primitives ─────────────────────────────────────
// Shared tokens and components for screens that follow the dashboard's
// visual language (top navbar + rounded cards + HK color palette).

import { useEffect, useState } from "react";

// Color tokens — kept in sync with hk-v2-shared.jsx and globals.css
export const OR = "#f76000";
export const PU = "#7b5ef6";
export const GR = "#00ca88";
export const AM = "#ffb020";
export const SG = "var(--font-space-grotesk), sans-serif";
export const IN = "var(--font-inter), sans-serif";

// ── Type scale — calibrated for middle-aged users (40–60+) with presbyopia ──
// See PRD §6.4. Min 12px floor, 14px for anything secondary, 15px+ for body.
// Avoid uppercase except short labels (≥12px + letterSpacing).
export const TYPE = {
  // Headings
  h1: 28,        // page title (desktop)
  h1Mobile: 22,  // page title (mobile)
  h2: 18,        // card title, section heading

  // Body text
  bodyLarge: 17, // primary content
  body: 15,      // standard body / list items
  bodySmall: 14, // dense lists, secondary descriptions

  // Secondary
  label: 14,     // form labels, sub-text — floor for anything readable
  caption: 12,   // captions / footnotes — absolute floor

  // Numbers (Inter — slightly tighter than UI text)
  numLarge: 28,  // dashboard hero numbers
  numMedium: 18, // amount fields in lists
  numSmall: 15,  // inline currency

  // Special
  chip: 12,      // pills, status chips
  navLabel: 12,  // bottom nav labels
} as const;

// Touch-target floors
export const TOUCH = {
  primary: 48,   // primary actions (FAB, main CTAs, submit buttons)
  secondary: 44, // secondary actions (icon buttons in lists, etc.)
} as const;

// ── Currency formatting ──────────────────────────────────────────────────────

export function fmt(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 100000) return "₹" + (abs / 100000).toFixed(1) + "L";
  if (abs >= 1000) return "₹" + Math.round(abs / 1000) + "K";
  return "₹" + abs;
}

export function fmtFull(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
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

// ── HKCard — rounded surface card matching dashboard cards ───────────────────

export function HKCard({
  children,
  style = {},
  className,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: "var(--hk-card)",
        borderRadius: 20,
        border: "1px solid var(--hk-border)",
        padding: "22px",
        transition: "background 0.25s",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── StatusChip — bill status pill with Hinglish labels ───────────────────────

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    FINAL: { label: "Final ✓", bg: GR + "22", color: GR },
    DRAFT: { label: "Draft", bg: AM + "22", color: AM },
    CANCELLED: { label: "Cancel", bg: OR + "22", color: OR },
  };
  const s = map[status] || map.DRAFT;
  return (
    <span
      style={{
        fontSize: TYPE.chip,
        fontWeight: 700,
        color: s.color,
        background: s.bg,
        padding: "4px 10px",
        borderRadius: 7,
        fontFamily: SG,
        letterSpacing: "0.2px",
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

// ── Toast — small floating notification ──────────────────────────────────────

export function HKToast({
  message,
  type,
}: {
  message: string;
  type: "success" | "error";
}) {
  const c = type === "success" ? GR : OR;
  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        top: 76,
        zIndex: 100,
        padding: "12px 18px",
        borderRadius: 12,
        background: c,
        color: "#fff",
        boxShadow: `0 8px 24px ${c}55`,
        fontFamily: SG,
        fontSize: TYPE.body,
        fontWeight: 600,
        animation: "slide-up 0.3s ease-out",
      }}
    >
      {message}
    </div>
  );
}

// ── Search input — icon + bordered input matching design ─────────────────────

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div style={{ flex: 1, minWidth: 180, position: "relative" }}>
      <svg
        style={{
          position: "absolute",
          left: 13,
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--hk-sub)",
        }}
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          height: TOUCH.secondary,
          padding: "0 14px 0 40px",
          borderRadius: 12,
          border: "1.5px solid var(--hk-border)",
          background: "var(--hk-input)",
          color: "var(--hk-text)",
          fontSize: TYPE.body,
          fontWeight: 500,
          fontFamily: SG,
          boxSizing: "border-box",
          outline: "none",
          transition: "border-color 0.15s",
        }}
        onFocus={(e) => (e.target.style.borderColor = OR)}
        onBlur={(e) => (e.target.style.borderColor = "var(--hk-border)")}
      />
    </div>
  );
}

// ── Pill filter group ────────────────────────────────────────────────────────

export function PillFilter<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        background: "var(--hk-pill)",
        borderRadius: 12,
        padding: 5,
      }}
    >
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            style={{
              minHeight: TOUCH.secondary - 10,
              padding: "8px 18px",
              borderRadius: 9,
              border: "none",
              fontSize: TYPE.bodySmall,
              fontWeight: active ? 700 : 500,
              color: active ? "var(--hk-text)" : "var(--hk-sub)",
              background: active ? "var(--hk-pill-active)" : "transparent",
              cursor: "pointer",
              fontFamily: SG,
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Page header — consistent across all screens ─────────────────────────────

export function PageHeader({
  title,
  subtitle,
  isMobile,
  action,
}: {
  title: string;
  subtitle?: string;
  isMobile: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: isMobile ? "18px 14px 14px" : "26px 28px 18px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div>
        <h1
          style={{
            fontSize: isMobile ? TYPE.h1Mobile : TYPE.h1,
            fontWeight: 700,
            color: "var(--hk-text)",
            letterSpacing: "-0.5px",
            fontFamily: SG,
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              color: "var(--hk-sub)",
              fontSize: TYPE.label,
              fontWeight: 500,
              marginTop: 4,
              fontFamily: SG,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

// ── Gradient action button — primary CTA ────────────────────────────────────

export function GradientButton({
  children,
  onClick,
  variant = "orange-purple",
  disabled,
  style = {},
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "orange-purple" | "green";
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const gradients = {
    "orange-purple": `linear-gradient(135deg, ${OR}, ${PU})`,
    green: `linear-gradient(135deg, ${GR}, #0aab74)`,
  };
  const shadows = {
    "orange-purple": `0 4px 16px ${OR}44`,
    green: `0 4px 12px ${GR}44`,
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minHeight: TOUCH.primary,
        padding: "0 22px",
        borderRadius: 14,
        background: gradients[variant],
        color: "#fff",
        fontSize: TYPE.body,
        fontWeight: 700,
        fontFamily: SG,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: shadows[variant],
        opacity: disabled ? 0.6 : 1,
        transition: "transform 0.15s, opacity 0.15s",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
