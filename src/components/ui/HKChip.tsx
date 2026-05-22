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
  default:   "bg-[var(--surface-100)] text-[var(--sb-sub)]",
  primary:   "bg-[var(--sb-orange)]/10 text-[var(--sb-orange)]",
  success:   "bg-[var(--sb-green)]/10 text-[var(--sb-green)]",
  danger:    "bg-[#ef4444]/10 text-[#ef4444]",
  warning:   "bg-[var(--sb-amber)]/10 text-[var(--sb-amber)]",
  secondary: "bg-[var(--sb-purple)]/10 text-[var(--sb-purple)]",
};

const COLOR_SOLID: Record<HKChipColor, string> = {
  default:   "bg-[var(--surface-200)] text-[var(--sb-text)]",
  primary:   "bg-[var(--sb-orange)] text-white",
  success:   "bg-[var(--sb-green)] text-white",
  danger:    "bg-[#ef4444] text-white",
  warning:   "bg-[var(--sb-amber)] text-white",
  secondary: "bg-[var(--sb-purple)] text-white",
};

const COLOR_BORDERED: Record<HKChipColor, string> = {
  default:   "border-[var(--sb-border)] text-[var(--sb-sub)]",
  primary:   "border-[var(--sb-orange)] text-[var(--sb-orange)]",
  success:   "border-[var(--sb-green)] text-[var(--sb-green)]",
  danger:    "border-[#ef4444] text-[#ef4444]",
  warning:   "border-[var(--sb-amber)] text-[var(--sb-amber)]",
  secondary: "border-[var(--sb-purple)] text-[var(--sb-purple)]",
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
