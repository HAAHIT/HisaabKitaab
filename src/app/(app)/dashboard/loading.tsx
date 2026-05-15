"use client";

import { HKSkeleton } from "@/components/ui/HKSkeleton";

export default function DashboardLoading() {
  return (
    <div className="p-4 lg:p-8 space-y-6 animate-fade-in">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <HKSkeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <HKSkeleton className="h-64 rounded-xl" />
        <HKSkeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
