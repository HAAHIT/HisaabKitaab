"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-xl font-semibold text-danger">Something went wrong</h2>
      <p className="max-w-md text-sm text-default-500">
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      <button
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        onClick={reset}
      >
        Try again
      </button>
    </div>
  );
}
