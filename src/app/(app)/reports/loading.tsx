"use client";

import { Skeleton } from "@heroui/react";

export default function ReportsLoading() {
  return (
    <div className="p-4 lg:p-8 space-y-4 animate-fade-in">
      <Skeleton className="h-8 w-40 rounded-lg" />
      <div className="grid lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
