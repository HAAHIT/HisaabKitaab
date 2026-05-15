type HKChipColor =
  | "default"
  | "primary"
  | "success"
  | "danger"
  | "warning"
  | "secondary";

type HKChipVariant = "flat" | "solid" | "bordered";

interface HKChipProps {
  color?: HKChipColor;
  variant?: HKChipVariant;
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  className?: string;
}

const COLOR_FLAT: Record<HKChipColor, string> = {
  default:   "bg-[var(--surface-100)] text-[var(--hk-sub)]",
  primary:   "bg-[var(--hk-orange)]/10 text-[var(--hk-orange)]",
  success:   "bg-[var(--hk-green)]/10 text-[var(--hk-green)]",
  danger:    "bg-[#ef4444]/10 text-[#ef4444]",
  warning:   "bg-[var(--hk-amber)]/10 text-[var(--hk-amber)]",
  secondary: "bg-[var(--hk-purple)]/10 text-[var(--hk-purple)]",
};

const COLOR_SOLID: Record<HKChipColor, string> = {
  default:   "bg-[var(--surface-200)] text-[var(--hk-text)]",
  primary:   "bg-[var(--hk-orange)] text-white",
  success:   "bg-[var(--hk-green)] text-white",
  danger:    "bg-[#ef4444] text-white",
  warning:   "bg-[var(--hk-amber)] text-white",
  secondary: "bg-[var(--hk-purple)] text-white",
};

const COLOR_BORDERED: Record<HKChipColor, string> = {
  default:   "border-[var(--hk-border)] text-[var(--hk-sub)]",
  primary:   "border-[var(--hk-orange)] text-[var(--hk-orange)]",
  success:   "border-[var(--hk-green)] text-[var(--hk-green)]",
  danger:    "border-[#ef4444] text-[#ef4444]",
  warning:   "border-[var(--hk-amber)] text-[var(--hk-amber)]",
  secondary: "border-[var(--hk-purple)] text-[var(--hk-purple)]",
};

const SIZE_CLASS: Record<string, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1.5 text-sm",
};

export function HKChip({
  color = "default",
  variant = "flat",
  size = "md",
  children,
  className,
}: HKChipProps) {
  const colorClass =
    variant === "solid"
      ? COLOR_SOLID[color]
      : variant === "bordered"
        ? `border ${COLOR_BORDERED[color]}`
        : COLOR_FLAT[color];

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${SIZE_CLASS[size]} ${colorClass} ${className || ""}`}
    >
      {children}
    </span>
  );
}
