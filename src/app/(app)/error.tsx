"use client";

import { useEffect } from "react";
import { Card, CardBody } from "@heroui/react";
import { HKButton } from "@/components/ui/HKButton";

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
    <div className="flex justify-center mt-20 p-4">
      <Card
        className="w-full max-w-sm border border-danger-200/50 bg-background/50 backdrop-blur-xl backdrop-saturate-150 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
        shadow="none"
      >
        <CardBody className="flex flex-col items-center gap-6 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger shadow-inner">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-danger">
              Something went wrong
            </h2>
            <p className="mt-2 text-sm text-default-500">
              An unexpected error occurred. Please try again.
              {error.digest && (
                <span className="mt-1 block text-xs text-default-400">
                  Ref: {error.digest}
                </span>
              )}
            </p>
          </div>
          <HKButton fullWidth onClick={reset}>
            Try again
          </HKButton>
        </CardBody>
      </Card>
    </div>
  );
}
