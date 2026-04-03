"use client";

import { use, useEffect, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Select,
  SelectItem,
  Skeleton,
  Textarea,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Measurement {
  id: string;
  label: string;
  roomName: string | null;
  itemType: string | null;
  notes: string | null;
  photos: { url: string }[];
  status: string;
  reviewNotes: string | null;
  createdAt: string;
  customer: { name: string; phone: string | null; email: string | null };
  party: { id: string; name: string; type: string } | null;
}

const statusColorMap: Record<
  string,
  "default" | "primary" | "warning" | "success" | "secondary"
> = {
  UPLOADED: "warning",
  REVIEWED: "primary",
  IN_PRODUCTION: "secondary",
  COMPLETED: "success",
};

const STATUS_OPTIONS = [
  { key: "UPLOADED", label: "Uploaded (Pending Review)" },
  { key: "REVIEWED", label: "Reviewed and Approved" },
  { key: "IN_PRODUCTION", label: "In Production" },
  { key: "COMPLETED", label: "Completed" },
];

export default function MeasurementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const [data, setData] = useState<Measurement | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [status, setStatus] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/measurements/${id}`)
      .then((response) => response.json())
      .then((payload) => {
        setData(payload.measurement);
        setStatus(payload.measurement?.status || "UPLOADED");
        setReviewNotes(payload.measurement?.reviewNotes || "");
      })
      .catch(() => setToast({ message: "Failed to load", type: "error" }))
      .finally(() => setLoading(false));
  }, [id]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  async function handleUpdateStatus() {
    setSaving(true);
    try {
      const response = await fetch(`/api/measurements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewNotes }),
      });

      if (!response.ok) {
        throw new Error("Failed to update");
      }

      showToast("Status updated", "success");
      const updated = await fetch(`/api/measurements/${id}`).then((result) => result.json());
      setData(updated.measurement);
    } catch {
      showToast("Failed to update status", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-8">
        <Skeleton className="h-12 w-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return <div className="p-8 text-center text-default-500">Not found</div>;
  }

  return (
    <div className="mx-auto max-w-5xl animate-fade-in p-4 lg:p-8">
      {toast && (
        <div
          className={`fixed right-4 top-4 z-[100] rounded-xl px-4 py-3 shadow-lg animate-slide-up ${
            toast.type === "success" ? "bg-success text-white" : "bg-danger text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute right-6 top-6 p-2 text-white"
            onClick={() => setSelectedImage(null)}
          >
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M6 18L18 6M6 6l12 12"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </button>
          <div className="relative m-4 h-full max-h-[80vh] w-full max-w-4xl">
            <Image
              src={selectedImage}
              alt="Fullscreen view"
              fill
              unoptimized
              className="object-contain"
            />
          </div>
        </div>
      )}

      <div className="mb-6 flex items-center gap-3">
        <Button
          isIconOnly
          variant="light"
          aria-label="Back to measurements"
          onPress={() => router.push("/measurements")}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
            />
          </svg>
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{data.label}</h1>
            <Chip
              size="sm"
              variant="flat"
              color={statusColorMap[data.status] || "default"}
              className="capitalize"
            >
              {data.status.toLowerCase().replace("_", " ")}
            </Chip>
          </div>
          <p className="mt-1 text-sm text-default-500">
            Submitted{" "}
            {new Date(data.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card shadow="sm">
            <CardBody className="p-6">
              <h2 className="mb-4 font-semibold">Photos</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {data.photos.map((photo, index) => (
                  <div
                    key={index}
                    className="group relative aspect-[4/3] cursor-pointer overflow-hidden rounded-xl border border-divider"
                    onClick={() => setSelectedImage(photo.url)}
                  >
                    <Image
                      src={photo.url}
                      alt={`Photo ${index + 1}`}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                      <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                        />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card shadow="sm">
            <CardBody className="p-6">
              <h2 className="mb-4 font-semibold">Details</h2>
              <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-default-400">Room Name</span>
                  <p className="font-medium">{data.roomName || "-"}</p>
                </div>
                <div>
                  <span className="text-default-400">Item Type</span>
                  <p className="font-medium">{data.itemType || "-"}</p>
                </div>
              </div>
              <div>
                <span className="text-sm text-default-400">Customer Notes</span>
                <p className="mt-1 rounded-lg bg-default-50 p-3 text-sm">
                  {data.notes || "No notes provided."}
                </p>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card shadow="sm">
            <CardBody className="space-y-4 p-6">
              <div>
                <h2 className="mb-4 font-semibold">Customer Info</h2>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="block text-default-400">Name</span>
                    <span className="font-medium">{data.customer.name}</span>
                  </div>
                  {data.customer.phone && (
                    <div>
                      <span className="block text-default-400">Phone</span>
                      <span className="font-medium">{data.customer.phone}</span>
                    </div>
                  )}
                  {data.customer.email && (
                    <div>
                      <span className="block text-default-400">Email</span>
                      <span className="font-medium">{data.customer.email}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-divider pt-4">
                <h3 className="mb-2 font-semibold">Linked Party</h3>
                {data.party ? (
                  <button
                    type="button"
                    className="w-full rounded-xl border border-divider bg-default-50 p-3 text-left transition hover:bg-default-100"
                    onClick={() => router.push(`/parties/${data.party?.id}`)}
                  >
                    <p className="font-medium">{data.party.name}</p>
                    <p className="text-xs capitalize text-default-400">
                      {data.party.type.toLowerCase()}
                    </p>
                  </button>
                ) : (
                  <div className="rounded-xl border border-divider bg-default-50 p-3 text-sm text-default-400">
                    No party record linked.
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          <Card shadow="sm" className="border border-primary/10 bg-gradient-to-br from-blue-500/5 to-indigo-500/5">
            <CardBody className="space-y-4 p-6">
              <h2 className="font-semibold text-primary">Workflow Status</h2>
              <Select
                label="Current Status"
                placeholder="Select status"
                selectedKeys={new Set([status])}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0] as string;
                  if (value) {
                    setStatus(value);
                  }
                }}
                variant="bordered"
              >
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.key}>{option.label}</SelectItem>
                ))}
              </Select>
              <Textarea
                label="Review Notes (Internal)"
                placeholder="Add notes for production..."
                value={reviewNotes}
                onValueChange={setReviewNotes}
                variant="bordered"
              />
              <Button
                color="primary"
                className="w-full font-semibold shadow-md"
                onPress={handleUpdateStatus}
                isLoading={saving}
              >
                Update Status
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
