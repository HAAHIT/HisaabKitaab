"use client";

import { Skeleton } from "@heroui/react";

export default function SettingsLoading() {
  return (
    <div className="p-4 lg:p-8 space-y-4 animate-fade-in">
      <Skeleton className="h-8 w-32 rounded-lg" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
