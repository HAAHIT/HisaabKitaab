"use client";

import { useCallback, useEffect, useState } from "react";
import { db } from "@/lib/db";
import { buildMeasurementUploadFormData } from "@/lib/measurement-upload-form";

/**
 * Tracks network connectivity and synchronizes queued measurement drafts to the server.
 *
 * Registers `online`/`offline` listeners and, while online, attempts an immediate sync and then retries every 30 seconds.
 * The `syncAll` function uploads drafts in creation order, leaves failed uploads in the local queue for later attempts,
 * and sets `isSyncing` while a sync is active.
 *
 * @returns An object with:
 * - `isOnline` — `true` when the client is currently online, `false` otherwise.
 * - `isSyncing` — `true` while a sync operation is in progress, `false` otherwise.
 * - `syncAll` — a function that uploads queued measurement drafts to `"/api/measurements"` and removes drafts that successfully upload.
 */
export function useSync() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState(false);

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

    const drafts = await db.measurementDrafts.orderBy("createdAt").toArray();
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
            continue;
          }

          await db.measurementDrafts.delete(draft.id);
        } catch {
          // silently skip failed drafts — they remain in the queue for next sync
        }
      }
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline) {
      return;
    }

    syncAll();
    const interval = window.setInterval(syncAll, 30000);

    return () => window.clearInterval(interval);
  }, [isOnline, syncAll]);

  return { isOnline, isSyncing, syncAll };
}
