"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { HKButton } from "@/components/ui/HKButton";
import { HKChip } from "@/components/ui/HKChip";
import { HKSelect, HKSelectItem } from "@/components/ui/HKSelect";
import { HKTextarea } from "@/components/ui/HKTextarea";
import { HKModal } from "@/components/ui/hk-design";
import { HKInput } from "@/components/ui/HKInput";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import { useSync } from "@/hooks/useSync";
import { buildMeasurementUploadFormData } from "@/lib/measurement-upload-form";
import { useLanguage } from "@/contexts/LanguageContext";

const ITEM_TYPES = [
  { key: "wooden", label: "Wooden" },
  { key: "flush", label: "Flush" },
  { key: "glass", label: "Glass" },
  { key: "metal", label: "Metal" },
  { key: "pvc", label: "PVC" },
  { key: "custom", label: "Custom" },
];

async function compressImage(
  file: File,
  maxWidth = 800,
  quality = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const image = new window.Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        let width = image.width;
        let height = image.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Canvas context unavailable"));
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      image.onerror = reject;
      image.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function UploadMeasurementsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const { isOnline, isSyncing } = useSync();

  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [label, setLabel] = useState("");
  const [roomName, setRoomName] = useState("");
  const [itemType, setItemType] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<string[]>([]);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const onReviewOpen = () => setIsReviewOpen(true);
  const onReviewClose = () => setIsReviewOpen(false);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  async function queueDraft() {
    await db.measurementDrafts.put({
      id: crypto.randomUUID(),
      label: label.trim(),
      roomName: roomName.trim() || null,
      itemType: itemType || null,
      notes: notes.trim() || null,
      photos,
      createdAt: Date.now(),
    });
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setProcessing(true);
    try {
      const compressedPhotos: string[] = [];
      for (let index = 0; index < files.length; index += 1) {
        compressedPhotos.push(await compressImage(files[index]));
      }

      setPendingPhotos(compressedPhotos);
      onReviewOpen();
    } catch {
      showToast(t("measurements.processImagesFailed"), "error");
    } finally {
      setProcessing(false);
      if (fileRef.current) {
        fileRef.current.value = "";
      }
      if (cameraRef.current) {
        cameraRef.current.value = "";
      }
    }
  }

  function confirmPendingPhotos() {
    setPhotos((currentPhotos) => [...currentPhotos, ...pendingPhotos]);
    setPendingPhotos([]);
    onReviewClose();
  }

  function discardPendingPhotos() {
    setPendingPhotos([]);
    onReviewClose();
  }

  function removePhoto(index: number) {
    setPhotos((currentPhotos) =>
      currentPhotos.filter((_, photoIndex) => photoIndex !== index)
    );
  }

  async function handleSubmit() {
    if (!label.trim()) {
      showToast(t("measurements.labelRequired"), "error");
      return;
    }

    if (photos.length === 0) {
      showToast(t("measurements.photoRequired"), "error");
      return;
    }

    setSaving(true);
    try {
      if (!isOnline) {
        await queueDraft();
        showToast(t("measurements.savedOnDevice"), "success");
        window.setTimeout(() => router.push("/measurements/my-uploads"), 800);
        return;
      }

      const response = await fetch("/api/measurements", {
        method: "POST",
        body: buildMeasurementUploadFormData({
          label: label.trim(),
          roomName: roomName.trim() || null,
          itemType: itemType || null,
          notes: notes.trim() || null,
          photos,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Upload failed");
      }

      showToast(t("measurements.uploaded"), "success");
      window.setTimeout(() => router.push("/measurements/my-uploads"), 600);
    } catch (error) {
      const shouldQueueDraft =
        error instanceof TypeError ||
        (typeof navigator !== "undefined" && !navigator.onLine);

      if (shouldQueueDraft) {
        try {
          await queueDraft();
          showToast(t("measurements.networkSaved"), "success");
          window.setTimeout(() => router.push("/measurements/my-uploads"), 800);
        } catch {
          showToast(t("measurements.saveDraftFailed"), "error");
        }
      } else {
        showToast(
          error instanceof Error ? error.message : t("measurements.uploadFailed"),
          "error"
        );
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl animate-fade-in p-4 pb-12 lg:p-8">
      {toast && (
        <div
          className={`fixed right-4 top-4 z-[100] rounded-xl px-4 py-3 shadow-lg animate-slide-up ${
            toast.type === "success" ? "bg-success text-white" : "bg-danger text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Back to my uploads"
            onClick={() => router.push("/measurements/my-uploads")}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--hk-border)] bg-[var(--hk-card)] text-[var(--hk-sub)] hover:bg-[var(--hk-badge)]"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[var(--hk-text)]">{t("measurements.uploadTitle")}</h1>
            <p className="mt-1 text-sm text-[var(--hk-sub)]">{t("measurements.uploadSubtitle")}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {!isOnline && (
            <HKChip size="sm" variant="flat" color="warning">{t("common.offline")}</HKChip>
          )}
          {isSyncing && (
            <HKChip size="sm" variant="flat" color="secondary">{t("common.syncingDrafts")}</HKChip>
          )}
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-[var(--hk-border)] bg-[var(--hk-card)] shadow-sm">
        <div className="px-6 pt-6 pb-0">
          <h2 className="font-semibold text-[var(--hk-text)]">{t("measurements.photos")}</h2>
        </div>
        <div className="p-6">
          {photos.length > 0 && (
            <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {photos.map((photo, index) => (
                <div
                  key={`${photo.slice(0, 20)}-${index}`}
                  className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-[var(--hk-border)] bg-[var(--hk-badge)]"
                >
                  <Image src={photo} alt={`Photo ${index + 1}`} fill unoptimized className="object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#ef4444]/90 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={processing}
              className="flex h-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[var(--hk-border)] bg-transparent text-[var(--hk-sub)] hover:border-[var(--hk-purple)] hover:text-[var(--hk-purple)] disabled:opacity-50"
            >
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
                <path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
              </svg>
              <span className="text-sm font-medium">{t("measurements.takePhoto")}</span>
            </button>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={processing}
              className="flex h-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[var(--hk-border)] bg-transparent text-[var(--hk-sub)] hover:border-[var(--hk-purple)] hover:text-[var(--hk-purple)] disabled:opacity-50"
            >
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
              </svg>
              <span className="text-sm font-medium">{t("measurements.fromGallery")}</span>
            </button>
          </div>

          <p className="mt-2 text-center text-xs text-[var(--hk-sub)]">{t("measurements.imagesCompressed")}</p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-[var(--hk-border)] bg-[var(--hk-card)] shadow-sm">
        <div className="px-6 pt-6 pb-0">
          <h2 className="font-semibold text-[var(--hk-text)]">{t("measurements.details")}</h2>
        </div>
        <div className="space-y-5 p-6">
          <HKInput label={t("measurements.label")} placeholder={t("measurements.labelPlaceholder")} value={label} onValueChange={setLabel} isRequired />
          <HKInput label={t("measurements.roomName")} placeholder={t("measurements.roomPlaceholder")} value={roomName} onValueChange={setRoomName} />
          <HKSelect
            label={t("measurements.itemType")}
            placeholder={t("measurements.itemTypePlaceholder")}
            value={itemType}
            onValueChange={(v) => setItemType(v || "")}
          >
            {ITEM_TYPES.map((item) => (
              <HKSelectItem key={item.key} value={item.key}>{item.label}</HKSelectItem>
            ))}
          </HKSelect>
          <HKTextarea label={t("measurements.notes")} placeholder={t("measurements.notesPlaceholder")} value={notes} onValueChange={setNotes} minRows={3} />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <HKButton variant="secondary" onClick={() => router.push("/measurements/my-uploads")}>{t("common.cancel")}</HKButton>
        <HKButton onClick={handleSubmit} isLoading={saving} isDisabled={photos.length === 0}>
          {isOnline ? t("measurements.uploadMeasurement") : t("measurements.saveLocalDraft")}
        </HKButton>
      </div>

      <HKModal
        isOpen={isReviewOpen}
        onClose={discardPendingPhotos}
        title={t("measurements.reviewTitle")}
        footer={
          <>
            <HKButton variant="danger" onClick={discardPendingPhotos}>{t("common.discard")}</HKButton>
            <HKButton onClick={confirmPendingPhotos}>{t("measurements.confirmUse")}</HKButton>
          </>
        }
      >
        <p className="mb-3 text-xs text-[var(--hk-sub)]">{t("measurements.reviewSubtitle")}</p>
        <div className="grid grid-cols-2 gap-3">
          {pendingPhotos.map((photo, index) => (
            <div
              key={`${photo.slice(0, 20)}-${index}`}
              className="relative aspect-[4/3] overflow-hidden rounded-xl border border-[var(--hk-border)] shadow-sm"
            >
              <Image src={photo} alt={`Review ${index + 1}`} fill unoptimized className="object-cover" />
            </div>
          ))}
        </div>
      </HKModal>
    </div>
  );
}
