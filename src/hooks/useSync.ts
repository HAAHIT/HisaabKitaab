"use client";

import { useCallback, useEffect, useState } from "react";
import { db } from "@/lib/db";
import { buildMeasurementUploadFormData } from "@/lib/measurement-upload-form";

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
              doorType: draft.doorType,
              notes: draft.notes,
              photos: draft.photos,
            }),
          });

          if (!response.ok) {
            continue;
          }

          await db.measurementDrafts.delete(draft.id);
        } catch (error) {
          console.error("Measurement draft sync error:", error);
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
