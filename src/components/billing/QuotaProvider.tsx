"use client";

import { useEffect, useState } from "react";
import { QuotaExceededModal } from "./QuotaExceededModal";

type QuotaDetail = {
  resource: "bills" | "parties";
  used: number;
  limit: number;
};

const EVENT_NAME = "hk-quota-exceeded";

/**
 * Fire from any client code when an API call returns 402 with code
 * "QUOTA_EXCEEDED". The global QuotaProvider catches the event and shows
 * the upgrade modal — no need to thread state through every API caller.
 *
 * Standard usage in a fetch handler:
 *   const res = await fetch("/api/bills", { ... });
 *   if (res.status === 402) {
 *     const data = await res.json();
 *     dispatchQuotaExceeded(data.quota);
 *     return;
 *   }
 */
export function dispatchQuotaExceeded(quota: QuotaDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<QuotaDetail>(EVENT_NAME, { detail: quota }));
}

/**
 * Mount once near the app root (inside AppShell) to listen for the
 * custom quota-exceeded event and show the modal.
 */
export function QuotaProvider() {
  const [quota, setQuota] = useState<QuotaDetail | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<QuotaDetail>;
      setQuota(ce.detail);
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  if (!quota) return null;

  return (
    <QuotaExceededModal
      isOpen={true}
      onClose={() => setQuota(null)}
      resource={quota.resource}
      used={quota.used}
      limit={quota.limit}
    />
  );
}
