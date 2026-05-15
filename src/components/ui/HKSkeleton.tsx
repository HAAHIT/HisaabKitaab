interface HKSkeletonProps {
  className?: string;
}

export function HKSkeleton({ className }: HKSkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-[var(--surface-100)] ${className || ""}`}
    />
  );
}
