"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardBody,
  Button,
  Input,
  Select,
  SelectItem,
  Chip,
  Skeleton,
} from "@heroui/react";
import { useRouter } from "next/navigation";

interface Measurement {
  id: string;
  label: string;
  roomName: string | null;
  doorType: string | null;
  notes: string | null;
  photos: { url: string; thumbnailUrl?: string }[];
  status: string;
  createdAt: string;
  customer: { name: string; phone: string | null };
}

const STATUS_OPTS = [
  { key: "ALL", label: "All" },
  { key: "UPLOADED", label: "📤 Uploaded" },
  { key: "PENDING", label: "🕐 Pending" },
  { key: "REVIEWED", label: "✅ Reviewed" },
  { key: "IN_PRODUCTION", label: "🏭 In Production" },
  { key: "COMPLETED", label: "🎉 Completed" },
];

const statusColorMap: Record<string, "default" | "primary" | "warning" | "success" | "secondary"> = {
  UPLOADED: "warning",
  PENDING: "warning",
  REVIEWED: "primary",
  IN_PRODUCTION: "secondary",
  COMPLETED: "success",
};

export default function MeasurementsListPage() {
  const router = useRouter();
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const fetchMeasurements = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      
      const res = await fetch(`/api/measurements?${params}`);
      const data = await res.json();
      setMeasurements(data.measurements || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { fetchMeasurements(); }, [fetchMeasurements]);

  return (
    <div className="p-4 lg:p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">📐 Measurements Gallery</h1>
          <p className="text-default-500 text-sm mt-1">View and manage customer door measurement uploads</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Input placeholder="Search label, room or customer..." value={search} onValueChange={setSearch} variant="bordered" className="flex-1"
          startContent={<svg className="w-4 h-4 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>} />
        <Select selectedKeys={[statusFilter]} onSelectionChange={(keys) => { const v = Array.from(keys)[0] as string; if (v) setStatusFilter(v); }} variant="bordered" className="w-48">
          {STATUS_OPTS.map((o) => <SelectItem key={o.key}>{o.label}</SelectItem>)}
        </Select>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-72 rounded-xl" />)}</div>
      ) : measurements.length === 0 ? (
        <Card shadow="sm"><CardBody className="flex flex-col items-center justify-center py-16">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <p className="text-lg font-medium text-default-600">{search || statusFilter !== "ALL" ? "No matches found" : "No measurements uploaded yet"}</p>
          <p className="text-sm text-default-400 mt-1">Customer uploads will appear here</p>
        </CardBody></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {measurements.map((m) => (
            <Card key={m.id} isPressable shadow="sm" className="hover:shadow-lg transition text-left overflow-hidden" onPress={() => router.push(`/measurements/${m.id}`)}>
              {/* Photo preview */}
              {m.photos && m.photos.length > 0 ? (
                <div className="relative h-48 bg-default-100">
                  <img
                    src={m.photos[0].thumbnailUrl || m.photos[0].url}
                    alt={m.label}
                    className="w-full h-full object-cover"
                  />
                  {/* Photo count badge */}
                  <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    📷 {m.photos.length}
                  </div>
                </div>
              ) : (
                <div className="h-32 bg-default-100 flex items-center justify-center">
                  <svg className="w-12 h-12 text-default-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
              )}

              <CardBody className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-base line-clamp-1" title={m.label}>{m.label}</h3>
                  <Chip size="sm" variant="flat" color={statusColorMap[m.status] || "default"} className="capitalize flex-shrink-0 ml-2">
                    {m.status.toLowerCase().replace("_", " ")}
                  </Chip>
                </div>
                <div className="flex gap-2 flex-wrap mb-2">
                  {m.roomName && (
                    <span className="text-xs text-default-400 bg-default-100 px-2 py-0.5 rounded-full">🏠 {m.roomName}</span>
                  )}
                  {m.doorType && (
                    <span className="text-xs text-default-400 bg-default-100 px-2 py-0.5 rounded-full">🚪 {m.doorType}</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-default-400">
                  <span className="font-medium text-default-600">👤 {m.customer.name}</span>
                  <span>{new Date(m.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
