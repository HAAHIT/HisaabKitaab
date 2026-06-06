"use client";

import { useCallback, useEffect, useState } from "react";
import { db } from "@/lib/db";
import { buildMeasurementUploadFormData } from "@/lib/measurement-upload-form";

export interface SyncFailure {
  draftId: string;
  label: string;
  message: string;
  attempts: number;
  lastAttemptAt: number;
}

export function useSync() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [failures, setFailures] = useState<Record<string, SyncFailure>>({});

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const syncAll = useCallback(async () => {
    if (!isOnline) {
      return;
    }

    let drafts;
    try {
      drafts = await db.measurementDrafts.orderBy("createdAt").toArray();
    } catch (err) {
      // IndexedDB unavailable (e.g. Safari private mode) — surface and abort.
      setFailures((prev) => ({
        ...prev,
        __indexeddb__: {
          draftId: "__indexeddb__",
          label: "Offline storage",
          message: err instanceof Error ? err.message : "Offline storage unavailable",
          attempts: (prev.__indexeddb__?.attempts ?? 0) + 1,
          lastAttemptAt: Date.now(),
        },
      }));
      return;
    }
    if (drafts.length === 0) {
      return;
    }

    setIsSyncing(true);
    try {
      for (const draft of drafts) {
        try {
          const response = await fetch("/api/measurements", {
            method: "POST",
            body: buildMeasurementUploadFormData({
              label: draft.label,
              roomName: draft.roomName,
              itemType: draft.itemType,
              notes: draft.notes,
              photos: draft.photos,
            }),
          });

          if (!response.ok) {
            let message = `Upload failed (${response.status})`;
            try {
              const body = await response.json();
              if (body?.error) message = String(body.error);
            } catch {
              // ignore parse error
            }
            setFailures((prev) => ({
              ...prev,
              [draft.id]: {
                draftId: draft.id,
                label: draft.label,
                message,
                attempts: (prev[draft.id]?.attempts ?? 0) + 1,
                lastAttemptAt: Date.now(),
              },
            }));
            continue;
          }

          await db.measurementDrafts.delete(draft.id);
          setFailures((prev) => {
            if (!prev[draft.id]) return prev;
            const next = { ...prev };
            delete next[draft.id];
            return next;
          });
        } catch (err) {
          setFailures((prev) => ({
            ...prev,
            [draft.id]: {
              draftId: draft.id,
              label: draft.label,
              message: err instanceof Error ? err.message : "Network error",
              attempts: (prev[draft.id]?.attempts ?? 0) + 1,
              lastAttemptAt: Date.now(),
            },
          }));
        }
      }
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline]);

  const clearFailure = useCallback(async (draftId: string) => {
    setFailures((prev) => {
      if (!prev[draftId]) return prev;
      const next = { ...prev };
      delete next[draftId];
      return next;
    });
    if (draftId !== "__indexeddb__") {
      try {
        await db.measurementDrafts.delete(draftId);
      } catch {
        // ignore — draft may already be gone
      }
    }
  }, []);

  useEffect(() => {
    if (!isOnline) {
      return;
    }

    syncAll();
    const interval = window.setInterval(syncAll, 30000);

    return () => window.clearInterval(interval);
  }, [isOnline, syncAll]);

  return { isOnline, isSyncing, syncAll, failures, clearFailure };
}
