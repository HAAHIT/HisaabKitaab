"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardBody,
  Button,
  Chip,
  Skeleton,
} from "@heroui/react";
import { useRouter } from "next/navigation";

interface MeasurementUpload {
  id: string;
  label: string;
  roomName: string | null;
  doorType: string | null;
  notes: string | null;
  photos: { url: string; thumbnailUrl: string }[];
  status: string;
  reviewNotes: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { color: "default" | "warning" | "primary" | "secondary" | "success"; label: string }> = {
  UPLOADED: { color: "default", label: "📤 Uploaded" },
  PENDING: { color: "warning", label: "🕐 Pending Review" },
  REVIEWED: { color: "primary", label: "✅ Reviewed" },
  IN_PRODUCTION: { color: "secondary", label: "🏭 In Production" },
  COMPLETED: { color: "success", label: "🎉 Completed" },
};

export default function MyUploadsPage() {
  const router = useRouter();
  const [uploads, setUploads] = useState<MeasurementUpload[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUploads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/measurements");
      const data = await res.json();
      setUploads(data.measurements || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUploads(); }, [fetchUploads]);

  return (
    <div className="p-4 lg:p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Uploads</h1>
          <p className="text-default-500 text-sm mt-1">Track the status of your measurement uploads</p>
        </div>
        <Button
          color="primary"
          className="font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/25"
          onPress={() => router.push("/measurements/upload")}
          startContent={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
        >
          New Upload
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : uploads.length === 0 ? (
        <Card shadow="sm">
          <CardBody className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-lg font-medium text-default-600">No uploads yet</p>
            <p className="text-sm text-default-400 mt-1 text-center max-w-sm">
              Upload photos of doors and measurements so the factory team can review them.
            </p>
            <Button
              color="primary"
              variant="flat"
              size="sm"
              className="mt-4"
              onPress={() => router.push("/measurements/upload")}
            >
              📸 Upload Your First Measurement
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {uploads.map((upload) => {
            const statusCfg = STATUS_CONFIG[upload.status] || STATUS_CONFIG.UPLOADED;
            return (
              <Card key={upload.id} shadow="sm" className="hover:shadow-md transition">
                <CardBody className="p-5">
                  <div className="flex flex-col gap-3">
                    {/* Header row */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{upload.label}</h3>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {upload.roomName && (
                            <span className="text-xs text-default-400 bg-default-100 px-2 py-0.5 rounded-full">
                              🏠 {upload.roomName}
                            </span>
                          )}
                          {upload.doorType && (
                            <span className="text-xs text-default-400 bg-default-100 px-2 py-0.5 rounded-full">
                              🚪 {upload.doorType}
                            </span>
                          )}
                          <span className="text-xs text-default-400">
                            {new Date(upload.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </div>
                      <Chip size="sm" variant="flat" color={statusCfg.color}>
                        {statusCfg.label}
                      </Chip>
                    </div>

                    {/* Photos */}
                    {upload.photos && upload.photos.length > 0 && (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {upload.photos.map((photo, i) => (
                          <div
                            key={i}
                            className="aspect-square rounded-lg overflow-hidden bg-default-100"
                          >
                            <img
                              src={photo.thumbnailUrl || photo.url}
                              alt={`${upload.label} - ${i + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Notes */}
                    {upload.notes && (
                      <p className="text-sm text-default-500 bg-default-50 p-3 rounded-lg">
                        📝 {upload.notes}
                      </p>
                    )}

                    {/* Review notes from admin */}
                    {upload.reviewNotes && (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                        <p className="text-xs font-semibold text-primary mb-1">Review Notes:</p>
                        <p className="text-sm text-default-700">{upload.reviewNotes}</p>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
