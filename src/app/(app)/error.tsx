"use client";

import { useEffect } from "react";

/**
 * Renders a client-side error UI that displays an error message and a retry button.
 *
 * Logs the provided `error` to the console whenever it changes.
 *
 * @param error - The error to display; may include an optional `digest` property. If `error.message` is empty, a generic fallback message is shown.
 * @param reset - Callback invoked when the user requests a retry (clicked "Try again").
 * @returns A JSX element containing the error heading, message, and retry button.
 */
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
