interface HKSkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function HKSkeleton({ className, style }: HKSkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-[var(--surface-100)] ${className || ""}`}
      style={style}
    />
  );
}
