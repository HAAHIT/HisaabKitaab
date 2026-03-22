"use client";

import { useState, useEffect, use } from "react";
import {
  Card,
  CardBody,
  Button,
  Chip,
  Select,
  SelectItem,
  Textarea,
  Skeleton,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Measurement {
  id: string;
  label: string;
  roomName: string | null;
  doorType: string | null;
  notes: string | null;
  photos: { url: string }[];
  status: string;
  reviewNotes: string | null;
  createdAt: string;
  customer: { name: string; phone: string | null; email: string | null };
}

const statusColorMap: Record<string, "default" | "primary" | "warning" | "success" | "secondary"> = {
  UPLOADED: "warning",
  REVIEWED: "primary",
  IN_PRODUCTION: "secondary",
  COMPLETED: "success",
};

const STATUS_OPTS = [
  { key: "UPLOADED", label: "Uploaded (Pending Review)" },
  { key: "REVIEWED", label: "Reviewed & Approved" },
  { key: "IN_PRODUCTION", label: "In Production" },
  { key: "COMPLETED", label: "Completed" },
];

export default function MeasurementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [data, setData] = useState<Measurement | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // For Staff review
  const [status, setStatus] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Fullscreen image viewer
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/measurements/${id}`)
      .then(r => r.json())
      .then(d => {
        setData(d.measurement);
        setStatus(d.measurement?.status || "UPLOADED");
        setReviewNotes(d.measurement?.reviewNotes || "");
      })
      .catch(() => setToast({ message: "Failed to load", type: "error" }))
      .finally(() => setLoading(false));
  }, [id]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleUpdateStatus() {
    setSaving(true);
    try {
      const res = await fetch(`/api/measurements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewNotes }),
      });
      if (!res.ok) throw new Error("Failed to update");
      showToast("Status updated", "success");
      
      const updated = await fetch(`/api/measurements/${id}`).then(r => r.json());
      setData(updated.measurement);
    } catch {
      showToast("Failed to update status", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8 space-y-4 max-w-5xl mx-auto"><Skeleton className="h-12 w-64 rounded-xl"/><Skeleton className="h-64 rounded-xl"/></div>;
  }

  if (!data) return <div className="p-8 text-center text-default-500">Not found</div>;

  return (
    <div className="p-4 lg:p-8 animate-fade-in max-w-5xl mx-auto">
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg animate-slide-up ${toast.type === "success" ? "bg-success text-white" : "bg-danger text-white"}`}>
          {toast.message}
        </div>
      )}

      {selectedImage && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center" onClick={() => setSelectedImage(null)}>
          <button className="absolute top-6 right-6 text-white p-2" onClick={() => setSelectedImage(null)}>
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div className="relative w-full max-w-4xl h-full max-h-[80vh] m-4">
            <Image src={selectedImage} alt="Fullscreen view" fill className="object-contain" />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <Button isIconOnly variant="light" onPress={() => router.push("/measurements")}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{data.label}</h1>
            <Chip size="sm" variant="flat" color={statusColorMap[data.status]} className="capitalize">
              {data.status.toLowerCase().replace("_", " ")}
            </Chip>
          </div>
          <p className="text-default-500 text-sm mt-1">Submitted {new Date(data.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card shadow="sm">
            <CardBody className="p-6">
              <h2 className="font-semibold mb-4">Photos</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {data.photos.map((p, i) => (
                  <div key={i} className="relative aspect-[4/3] rounded-xl overflow-hidden border border-divider cursor-pointer hover:opacity-90 transition group" onClick={() => setSelectedImage(p.url)}>
                    <Image src={p.url} alt={`Photo ${i+1}`} fill className="object-cover" />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card shadow="sm">
            <CardBody className="p-6">
              <h2 className="font-semibold mb-4">Details</h2>
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <span className="text-default-400">Room Name</span>
                  <p className="font-medium">{data.roomName || "—"}</p>
                </div>
                <div>
                  <span className="text-default-400">Door Type</span>
                  <p className="font-medium">{data.doorType || "—"}</p>
                </div>
              </div>
              <div>
                <span className="text-default-400 text-sm">Customer Notes</span>
                <p className="text-sm bg-default-50 p-3 rounded-lg mt-1">{data.notes || "No notes provided."}</p>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card shadow="sm">
            <CardBody className="p-6">
              <h2 className="font-semibold mb-4">Customer Info</h2>
              <div className="space-y-3 text-sm">
                <div><span className="text-default-400 block">Name</span><span className="font-medium">{data.customer.name}</span></div>
                {data.customer.phone && <div><span className="text-default-400 block">Phone</span><span className="font-medium">{data.customer.phone}</span></div>}
                {data.customer.email && <div><span className="text-default-400 block">Email</span><span className="font-medium">{data.customer.email}</span></div>}
              </div>
            </CardBody>
          </Card>

          {/* Workflow Status Panel (Visible & Editable to Staff/Admin usually, but we'll show it simplified here) */}
          <Card shadow="sm" className="bg-gradient-to-br from-blue-500/5 to-indigo-500/5 border border-primary/10">
            <CardBody className="p-6">
              <h2 className="font-semibold mb-4 text-primary">Workflow Status</h2>
              <div className="space-y-4">
                <Select label="Current Status" selectedKeys={[status]} onSelectionChange={(keys) => { const v = Array.from(keys)[0] as string; if (v) setStatus(v); }} variant="bordered">
                  {STATUS_OPTS.map(o => <SelectItem key={o.key}>{o.label}</SelectItem>)}
                </Select>
                <Textarea label="Review Notes (Internal)" placeholder="Add notes for production..." value={reviewNotes} onValueChange={setReviewNotes} variant="bordered" />
                <Button color="primary" className="w-full font-semibold shadow-md" onPress={handleUpdateStatus} isLoading={saving}>Update Status</Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
