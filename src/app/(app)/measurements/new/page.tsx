"use client";

import { useState } from "react";
import {
  Card,
  CardBody,
  Button,
  Input,
  Textarea,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function UploadMeasurementPage() {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [roomName, setRoomName] = useState("");
  const [doorType, setDoorType] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<{ url: string; displayUrl: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  // Simulate photo selection & base64 encoding (in real app, this would upload to S3/Cloudinary)
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          const base64 = ev.target.result as string;
          // In real production, we shouldn't store large base64 strings in DB JSON, 
          // we'd upload to a bucket. For this MVP, we use base64 if it's small, 
          // or we can just mock it. We will use Base64 to make it self-contained.
          setPhotos(prev => [...prev, { url: base64, displayUrl: base64 }]);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function removePhoto(index: number) {
    setPhotos(photos.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!label) { showToast("Label is required", "error"); return; }
    if (photos.length === 0) { showToast("At least one photo is required", "error"); return; }

    setUploading(true);
    try {
      const payload = {
        label, roomName, doorType, notes,
        photos: photos.map(p => ({ url: p.url })) // Save base64
      };

      const res = await fetch("/api/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast("Uploaded successfully!", "success");
      setTimeout(() => router.push("/measurements"), 800);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to upload", "error");
    } finally { setUploading(false); }
  }

  return (
    <div className="p-4 lg:p-8 animate-fade-in max-w-3xl mx-auto">
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg animate-slide-up ${toast.type === "success" ? "bg-success text-white" : "bg-danger text-white"}`}>
          {toast.message}
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <Button isIconOnly variant="light" onPress={() => router.push("/measurements")}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Upload Measurements</h1>
          <p className="text-default-500 text-sm mt-1">Submit photos of your door frames</p>
        </div>
      </div>

      <Card shadow="sm" className="mb-6">
        <CardBody className="p-6 space-y-4">
          <Input label="Reference Label" placeholder="e.g. Ground Floor Main Door" value={label} onValueChange={setLabel} variant="bordered" isRequired />
          <div className="grid md:grid-cols-2 gap-4">
            <Input label="Room Name" placeholder="e.g. Living Room (optional)" value={roomName} onValueChange={setRoomName} variant="bordered" />
            <Input label="Door Type" placeholder="e.g. Double Teak Wood (optional)" value={doorType} onValueChange={setDoorType} variant="bordered" />
          </div>
          <Textarea label="Notes / Special Instructions" placeholder="Any specific requirements..." value={notes} onValueChange={setNotes} variant="bordered" minRows={3} />
        </CardBody>
      </Card>

      <Card shadow="sm" className="mb-6">
        <CardBody className="p-6">
          <h3 className="font-semibold mb-4">Photos</h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
            {photos.map((p, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-divider group bg-default-100">
                <Image src={p.displayUrl} alt="Upload preview" fill className="object-cover" />
                <button onClick={() => removePhoto(i)} className="absolute top-2 right-2 bg-black/50 hover:bg-danger text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
            
            <label className="aspect-square rounded-xl border-2 border-dashed border-primary/50 text-primary flex flex-col items-center justify-center cursor-pointer hover:bg-primary/5 transition">
              <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
              <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
              <span className="text-sm font-medium">Add Photos</span>
            </label>
          </div>
          <p className="text-xs text-default-400">Please include photos showing the full frame and close-ups of the hinges/locks if relevant.</p>
        </CardBody>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="flat" onPress={() => router.push("/measurements")}>Cancel</Button>
        <Button color="primary" className="bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold" onPress={handleSave} isLoading={uploading}>
          Submit Measurements
        </Button>
      </div>
    </div>
  );
}
