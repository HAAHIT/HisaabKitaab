"use client";

import { HKSkeleton } from "@/components/ui/HKSkeleton";
import { SG } from "@/components/ui/hk-design";

export default function BillsLoading() {
  return (
    <div style={{ background: "var(--hk-bg)", minHeight: "100%", fontFamily: SG }}>
      <div style={{ padding: "20px 28px 0", maxWidth: 1440, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <HKSkeleton className="h-8 w-36 rounded-xl" />
          <HKSkeleton className="h-10 w-32 rounded-xl" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
          {[1, 2, 3].map((i) => <HKSkeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
        <HKSkeleton className="h-10 w-full rounded-2xl" style={{ marginBottom: 12 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3, 4, 5].map((i) => <HKSkeleton key={i} className="h-16 w-full rounded-2xl" />)}
        </div>
      </div>
    </div>
  );
}
