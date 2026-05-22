"use client";

import { HKSkeleton } from "@/components/ui/HKSkeleton";

export default function PaymentsLoading() {
  return (
    <div className="p-4 lg:p-8 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <HKSkeleton className="h-8 w-36 rounded-lg" />
        <HKSkeleton className="h-10 w-28 rounded-lg" />
      </div>
      <HKSkeleton className="h-10 w-full rounded-lg" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <HKSkeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
