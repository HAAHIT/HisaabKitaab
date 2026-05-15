"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Card, CardBody, Chip, Skeleton } from "@heroui/react";
import { HKButton } from "@/components/ui/HKButton";
import { useRouter } from "next/navigation";
import { db, type MeasurementDraft } from "@/lib/db";
import { useSync } from "@/hooks/useSync";
import { useLanguage } from "@/contexts/LanguageContext";

interface MeasurementUpload {
  id: string;
  label: string;
  roomName: string | null;
  itemType: string | null;
  notes: string | null;
  photos: { url: string; thumbnailUrl?: string }[];
  status: string;
  reviewNotes?: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<
  string,
  { color: "default" | "warning" | "primary" | "secondary" | "success"; label: string }
> = {
  UPLOADED: { color: "default", label: "Uploaded" },
  PENDING: { color: "warning", label: "Pending Review" },
  REVIEWED: { color: "primary", label: "Reviewed" },
  IN_PRODUCTION: { color: "secondary", label: "In Production" },
  COMPLETED: { color: "success", label: "Completed" },
};

function formatDate(value: string | number) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function MyUploadsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { isOnline, isSyncing, syncAll } = useSync();
  const [uploads, setUploads] = useState<MeasurementUpload[]>([]);
  const [drafts, setDrafts] = useState<MeasurementDraft[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUploads = useCallback(async () => {
    setLoading(true);
    try {
      const draftPromise = db.measurementDrafts.orderBy("createdAt").reverse().toArray();
      const serverPromise = fetch("/api/measurements")
        .then(async (response) => {
          if (!response.ok) {
            return [];
          }

          const data = await response.json();
          return (data.measurements || []) as MeasurementUpload[];
        })
        .catch(() => []);

      const [nextDrafts, nextUploads] = await Promise.all([draftPromise, serverPromise]);
      setDrafts(nextDrafts);
      setUploads(nextUploads);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads, isSyncing]);

  return (
    <div className="animate-fade-in p-4 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("measurements.myUploadsTitle")}</h1>
          <p className="mt-1 text-sm text-default-500">
            {t("measurements.myUploadsSubtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          {!isOnline && (
            <Chip size="sm" variant="flat" color="warning">
              {t("common.offline")}
            </Chip>
          )}
          {isSyncing && (
            <Chip size="sm" variant="flat" color="primary" className="animate-pulse">
              {t("common.syncingDrafts")}
            </Chip>
          )}
          {drafts.length > 0 && isOnline && (
            <HKButton variant="secondary" onClick={syncAll}>
              {t("measurements.syncNow")}
            </HKButton>
          )}
          <HKButton
            onClick={() => router.push("/measurements/upload")}
            startContent={
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M12 4v16m8-8H4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            }
          >
            {t("measurements.newUpload")}
          </HKButton>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : uploads.length === 0 && drafts.length === 0 ? (
        <Card shadow="sm">
          <CardBody className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <svg className="h-10 w-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                />
                <path
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                />
              </svg>
            </div>
            <p className="text-lg font-medium text-default-600">{t("measurements.noUploads")}</p>
            <p className="mt-1 max-w-sm text-center text-sm text-default-400">
              {t("measurements.noUploadsSubtitle")}
            </p>
            <HKButton
              size="sm"
              variant="ghost"
              className="mt-4"
              onClick={() => router.push("/measurements/upload")}
            >
              {t("measurements.firstUpload")}
            </HKButton>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-8">
          {drafts.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{t("measurements.pendingDeviceTitle")}</h2>
                  <p className="text-sm text-default-500">
                    {t("measurements.pendingDeviceSubtitle")}
                  </p>
                </div>
                <Chip size="sm" variant="flat" color={isOnline ? "primary" : "warning"}>
                  {isOnline ? t("measurements.readyToSync") : t("measurements.waitingConnection")}
                </Chip>
              </div>

              <div className="space-y-4">
                {drafts.map((draft) => (
                  <Card key={draft.id} shadow="sm" className="border border-warning/30 bg-warning/5">
                    <CardBody className="p-5">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold">{draft.label}</h3>
                              <Chip size="sm" variant="flat" color="warning">
                                {t("measurements.pendingUpload")}
                              </Chip>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {draft.roomName && (
                                <span className="rounded-full bg-default-100 px-2 py-0.5 text-xs text-default-400">
                                  {draft.roomName}
                                </span>
                              )}
                              {draft.itemType && (
                                <span className="rounded-full bg-default-100 px-2 py-0.5 text-xs text-default-400">
                                  {draft.itemType}
                                </span>
                              )}
                              <span className="text-xs text-default-400">
                                {formatDate(draft.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {draft.photos.length > 0 && (
                          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                            {draft.photos.map((photo, index) => (
                              <div
                                key={`${draft.id}-${index}`}
                                className="relative aspect-square overflow-hidden rounded-lg bg-default-100"
                              >
                                <Image
                                  src={photo}
                                  alt={`${draft.label} draft ${index + 1}`}
                                  fill
                                  unoptimized
                                  className="object-cover"
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {draft.notes && (
                          <p className="rounded-lg bg-default-50 p-3 text-sm text-default-500">
                            {draft.notes}
                          </p>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {uploads.length > 0 && (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">{t("measurements.uploadedServerTitle")}</h2>
                <p className="text-sm text-default-500">
                  {t("measurements.uploadedServerSubtitle")}
                </p>
              </div>

              <div className="space-y-4">
                {uploads.map((upload) => {
                  const status = STATUS_CONFIG[upload.status] || STATUS_CONFIG.UPLOADED;

                  return (
                    <Card key={upload.id} shadow="sm" className="transition hover:shadow-md">
                      <CardBody className="p-5">
                        <div className="flex flex-col gap-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-semibold">{upload.label}</h3>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-2">
                                {upload.roomName && (
                                  <span className="rounded-full bg-default-100 px-2 py-0.5 text-xs text-default-400">
                                    {upload.roomName}
                                  </span>
                                )}
                                {upload.itemType && (
                                  <span className="rounded-full bg-default-100 px-2 py-0.5 text-xs text-default-400">
                                    {upload.itemType}
                                  </span>
                                )}
                                <span className="text-xs text-default-400">
                                  {formatDate(upload.createdAt)}
                                </span>
                              </div>
                            </div>
                            <Chip size="sm" variant="flat" color={status.color}>
                              {status.label}
                            </Chip>
                          </div>

                          {upload.photos.length > 0 && (
                            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                              {upload.photos.map((photo, index) => (
                                <div
                                  key={`${upload.id}-${index}`}
                                  className="relative aspect-square overflow-hidden rounded-lg bg-default-100"
                                >
                                  <Image
                                    src={photo.thumbnailUrl || photo.url}
                                    alt={`${upload.label} ${index + 1}`}
                                    fill
                                    unoptimized
                                    className="object-cover"
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          {upload.notes && (
                            <p className="rounded-lg bg-default-50 p-3 text-sm text-default-500">
                              {upload.notes}
                            </p>
                          )}

                          {upload.reviewNotes && (
                            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                              <p className="mb-1 text-xs font-semibold text-primary">
                                {t("measurements.reviewNotes")}
                              </p>
                              <p className="text-sm text-default-700">{upload.reviewNotes}</p>
                            </div>
                          )}
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
