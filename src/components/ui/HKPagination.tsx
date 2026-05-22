"use client";

interface HKPaginationProps {
  page: number;
  total: number;
  onChange: (page: number) => void;
  className?: string;
  showControls?: boolean;
}

export function HKPagination({
  page,
  total,
  onChange,
  className,
}: HKPaginationProps) {
  if (total <= 1) return null;

  const pages = Array.from({ length: total }, (_, i) => i + 1);

  // Show max 7 page buttons with ellipsis
  function getVisible(): (number | "...")[] {
    if (total <= 7) return pages;
    const result: (number | "...")[] = [1];
    if (page > 3) result.push("...");
    for (let p = Math.max(2, page - 1); p <= Math.min(total - 1, page + 1); p++) {
      result.push(p);
    }
    if (page < total - 2) result.push("...");
    result.push(total);
    return result;
  }

  const visible = getVisible();

  return (
    <div className={`flex items-center gap-1 ${className || ""}`}>
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-sm text-[var(--sb-sub)] transition-colors hover:bg-[var(--surface-100)] disabled:pointer-events-none disabled:opacity-40"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
        </svg>
      </button>

      {visible.map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} className="flex h-8 w-8 items-center justify-center text-sm text-[var(--sb-muted)]">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
              p === page
                ? "bg-[var(--sb-orange)] text-white"
                : "text-[var(--sb-sub)] hover:bg-[var(--surface-100)]"
            }`}
          >
            {p}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= total}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-sm text-[var(--sb-sub)] transition-colors hover:bg-[var(--surface-100)] disabled:pointer-events-none disabled:opacity-40"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
        </svg>
      </button>
    </div>
  );
}
