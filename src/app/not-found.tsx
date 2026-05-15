"use client";

import { Card, CardBody } from "@heroui/react";
import { HKButton } from "@/components/ui/HKButton";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex justify-center mt-20 p-4">
      <Card
        className="w-full max-w-sm border border-primary-200/50 bg-background/50 backdrop-blur-xl backdrop-saturate-150 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
        shadow="none"
      >
        <CardBody className="flex flex-col items-center gap-6 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary shadow-inner">
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
            <h2 className="text-lg font-semibold text-primary">
              Page Not Found
            </h2>
            <p className="mt-2 text-sm text-default-500">
              The page you are looking for doesn't exist or has been moved.
            </p>
          </div>
          <HKButton fullWidth onClick={() => router.push("/")}>
            Return to Dashboard
          </HKButton>
        </CardBody>
      </Card>
    </div>
  );
}
