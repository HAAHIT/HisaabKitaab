"use client";

import { useState, useRef } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Select,
  SelectItem,
  Textarea,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/react";
import { useRouter } from "next/navigation";

const DOOR_TYPES = [
  { key: "wooden", label: "🚪 Wooden Door" },
  { key: "flush", label: "🪵 Flush Door" },
  { key: "glass", label: "🪟 Glass Door" },
  { key: "metal", label: "🏗️ Metal Door" },
  { key: "pvc", label: "🔧 PVC Door" },
  { key: "custom", label: "✏️ Custom" },
];

// Client-side image compression using canvas
async function compressImage(file: File, maxWidth = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function UploadMeasurementsPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [label, setLabel] = useState("");
  const [roomName, setRoomName] = useState("");
  const [doorType, setDoorType] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<string[]>([]);
  const { isOpen: isReviewOpen, onOpen: onReviewOpen, onClose: onReviewClose } = useDisclosure();

  function showToast(message: string, t: "success" | "error") {
    setToast({ message, type: t });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setProcessing(true);
    try {
      const compressed: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const result = await compressImage(files[i]);
        compressed.push(result);
      }
      setPendingPhotos(compressed);
      onReviewOpen();
    } catch {
      showToast("Failed to process images", "error");
    } finally {
      setProcessing(false);
      // Reset both file inputs so they can be used again
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  function confirmPendingPhotos() {
    setPhotos((prev) => [...prev, ...pendingPhotos]);
    setPendingPhotos([]);
    onReviewClose();
  }

  function discardPendingPhotos() {
    setPendingPhotos([]);
    onReviewClose();
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!label.trim()) {
      showToast("Label is required", "error");
      return;
    }
    if (photos.length === 0) {
      showToast("Add at least one photo", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          roomName: roomName.trim() || null,
          doorType: doorType || null,
          notes: notes.trim() || null,
          photos: photos.map((url) => ({ url, thumbnailUrl: url })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast("Measurement uploaded successfully!", "success");
      setTimeout(() => router.push("/measurements/my-uploads"), 800);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 lg:p-8 animate-fade-in max-w-2xl mx-auto pb-12">
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg animate-slide-up ${toast.type === "success" ? "bg-success text-white" : "bg-danger text-white"}`}>
          {toast.message}
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <Button isIconOnly variant="light" onPress={() => router.push("/measurements/my-uploads")}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">📐 Upload Measurements</h1>
          <p className="text-default-500 text-sm mt-1">Take photos and upload door measurements</p>
        </div>
      </div>

      {/* Photo Upload Area */}
      <Card shadow="sm" className="mb-4">
        <CardHeader className="px-6 pt-6 pb-0">
          <h2 className="font-semibold">📸 Photos</h2>
        </CardHeader>
        <CardBody className="p-6">
          {/* Preview grid */}
          {photos.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4">
              {photos.map((photo, i) => (
                <div key={i} className="relative group rounded-xl overflow-hidden aspect-[4/3] bg-default-100 border border-divider">
                  <img src={photo} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-danger/90 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-lg backdrop-blur-md"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Hidden file inputs */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Camera & Gallery buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="bordered"
              className="border-dashed border-2 h-20"
              onPress={() => cameraRef.current?.click()}
              isLoading={processing}
            >
              <div className="flex flex-col items-center gap-1">
                <svg className="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm font-medium">📷 Take Photo</span>
              </div>
            </Button>
            <Button
              variant="bordered"
              className="border-dashed border-2 h-20"
              onPress={() => fileRef.current?.click()}
              isLoading={processing}
            >
              <div className="flex flex-col items-center gap-1">
                <svg className="w-7 h-7 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium">🖼️ From Gallery</span>
              </div>
            </Button>
          </div>
          <p className="text-xs text-default-400 mt-2 text-center">
            Images are compressed automatically for fast upload.
          </p>
        </CardBody>
      </Card>

      {/* Details Form */}
      <Card shadow="sm" className="mb-6">
        <CardHeader className="px-6 pt-6 pb-0">
          <h2 className="font-semibold">📋 Details</h2>
        </CardHeader>
        <CardBody className="p-6 space-y-5">
          <Input
            label="Label"
            placeholder="e.g. Main Door, Room 2 Window"
            value={label}
            onValueChange={setLabel}
            variant="bordered"
            isRequired
          />

          <Input
            label="Room Name"
            placeholder="e.g. Master Bedroom, Kitchen"
            value={roomName}
            onValueChange={setRoomName}
            variant="bordered"
          />

          <Select
            label="Door Type"
            placeholder="Select door type"
            selectedKeys={doorType ? [doorType] : []}
            onSelectionChange={(keys) => {
              const v = Array.from(keys)[0] as string;
              setDoorType(v || "");
            }}
            variant="bordered"
          >
            {DOOR_TYPES.map((dt) => (
              <SelectItem key={dt.key}>{dt.label}</SelectItem>
            ))}
          </Select>

          <Textarea
            label="Notes"
            placeholder="Any special instructions, dimensions, or details..."
            value={notes}
            onValueChange={setNotes}
            variant="bordered"
            minRows={3}
          />
        </CardBody>
      </Card>

      <div className="flex gap-3 justify-end">
        <Button variant="flat" onPress={() => router.push("/measurements/my-uploads")}>Cancel</Button>
        <Button
          color="primary"
          className="bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold"
          onPress={handleSubmit}
          isLoading={saving}
          isDisabled={photos.length === 0}
        >
          📤 Upload Measurement
        </Button>
      </div>

      {/* Review Modal */}
      <Modal 
        isOpen={isReviewOpen} 
        onClose={discardPendingPhotos}
        size="lg"
        scrollBehavior="inside"
        backdrop="blur"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <span>🔍 Review New Photos</span>
            <span className="text-xs font-normal text-default-500">Check if the images are clear before using them</span>
          </ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-2 gap-3">
              {pendingPhotos.map((photo, i) => (
                <div key={i} className="aspect-[4/3] rounded-xl overflow-hidden border border-divider shadow-sm">
                  <img src={photo} alt={`Review ${i}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={discardPendingPhotos}>
              Discard
            </Button>
            <Button 
              color="primary" 
              className="bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold"
              onPress={confirmPendingPhotos}
            >
              Confirm & Use
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
