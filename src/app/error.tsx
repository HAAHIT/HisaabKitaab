"use client";

import { useEffect } from "react";

/**
 * Renders a full-screen error fallback UI and logs the provided error to the console.
 *
 * @param error - The error to display; may include an optional `digest` string for tracking.
 * @param reset - Callback invoked when the user clicks "Try again" to attempt recovery.
 * @returns The JSX element rendering a centered error message with a retry button.
 */
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
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        onClick={reset}
      >
        Try again
      </button>
    </div>
  );
}
