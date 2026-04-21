"use client";

import { Skeleton } from "@heroui/react";

export default function NotesLoading() {
  return (
    <div className="p-4 lg:p-8 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32 rounded-lg" />
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
