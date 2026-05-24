"use client";

import { HKSkeleton } from "@/components/ui/HKSkeleton";

export default function ReportsLoading() {
  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <HKSkeleton className="h-8 w-40 rounded-lg" />
      <div className="grid lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <HKSkeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <HKSkeleton className="h-64 rounded-xl" />
    </div>
  );
}
