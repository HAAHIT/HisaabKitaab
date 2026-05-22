"use client";

// ── Hook to fetch overdue summary from the dashboard API ─────────────────────
// Reused by Bills, Parties, and any page that mounts <OverdueBanner>.

import { useEffect, useState } from "react";

interface OverdueData {
  overdueCount: number;
  overdueAmount: number;
  overdueParty: string | null;
}

export function useOverdueData(): OverdueData {
  const [data, setData] = useState<OverdueData>({
    overdueCount: 0,
    overdueAmount: 0,
    overdueParty: null,
  });

  useEffect(() => {
    let cancelled = false;
    async function fetchOverdue() {
      try {
        const res = await fetch("/api/dashboard");
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setData({
          overdueCount: json.summary?.overdueCount ?? 0,
          overdueAmount: json.summary?.overdueAmount ?? 0,
          overdueParty: json.summary?.overdueParty ?? null,
        });
      } catch {
        // Silently fail — banner just won't show
      }
    }
    fetchOverdue();
    return () => { cancelled = true; };
  }, []);

  return data;
}
