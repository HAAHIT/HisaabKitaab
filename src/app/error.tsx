"use client";

import { useEffect } from "react";

export default function RootError({
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="max-w-md text-sm text-gray-500">
        {error.message || "An unexpected error occurred. Please reload the page."}
      </p>
      <button
        className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        onClick={reset}
      >
        Try again
      </button>
    </div>
  );
}
