"use client";

import { Skeleton } from "@heroui/react";
import { SG } from "@/components/ui/hk-design";

export default function SettingsLoading() {
  return (
    <div style={{ padding: "20px 28px", fontFamily: SG }}>
      <Skeleton className="h-8 w-40 rounded-2xl" style={{ marginBottom: 20 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
