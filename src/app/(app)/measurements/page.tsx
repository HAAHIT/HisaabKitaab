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

// Assumes we can read role from somewhere, but for UI sake we'll just show what the API returns.
// The API already filters based on role.

interface Measurement {
  id: string;
  label: string;
  roomName: string | null;
  doorType: string | null;
  status: string;
  createdAt: string;
  customer: { name: string; phone: string | null };
}

const STATUS_OPTS = [
  { key: "ALL", label: "All" },
  { key: "UPLOADED", label: "Uploaded" },
  { key: "REVIEWED", label: "Reviewed" },
  { key: "IN_PRODUCTION", label: "In Production" },
  { key: "COMPLETED", label: "Completed" },
];

const statusColorMap: Record<string, "default" | "primary" | "warning" | "success" | "secondary"> = {
  UPLOADED: "warning",
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
          <h1 className="text-2xl font-bold">Measurements</h1>
          <p className="text-default-500 text-sm mt-1">Manage door measurements & photos</p>
        </div>
        <Button color="primary" className="font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/25"
          onPress={() => router.push("/measurements/new")}
          startContent={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>}>
          Upload New
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Input placeholder="Search label, room or customer..." value={search} onValueChange={setSearch} variant="bordered" className="flex-1"
          startContent={<svg className="w-4 h-4 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>} />
        <Select selectedKeys={[statusFilter]} onSelectionChange={(keys) => { const v = Array.from(keys)[0] as string; if (v) setStatusFilter(v); }} variant="bordered" className="w-44">
          {STATUS_OPTS.map((o) => <SelectItem key={o.key}>{o.label}</SelectItem>)}
        </Select>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      ) : measurements.length === 0 ? (
        <Card shadow="sm"><CardBody className="flex flex-col items-center justify-center py-16">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <p className="text-lg font-medium text-default-600">{search || statusFilter !== "ALL" ? "No matches found" : "No measurements uploaded"}</p>
          <Button color="primary" variant="flat" size="sm" className="mt-3" onPress={() => router.push("/measurements/new")}>Upload Measurement</Button>
        </CardBody></Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {measurements.map((m) => (
            <Card key={m.id} isPressable shadow="sm" className="hover:shadow-md transition text-left" onPress={() => router.push(`/measurements/${m.id}`)}>
              <CardBody className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-lg line-clamp-1" title={m.label}>{m.label}</h3>
                  <Chip size="sm" variant="flat" color={statusColorMap[m.status] || "default"} className="capitalize flex-shrink-0">
                    {m.status.toLowerCase().replace("_", " ")}
                  </Chip>
                </div>
                <div className="space-y-1 text-sm text-default-600 mb-4">
                  {m.roomName && <p>🚪 Room: {m.roomName}</p>}
                  {m.doorType && <p>🪟 Type: {m.doorType}</p>}
                  <p>👤 {m.customer.name}</p>
                </div>
                <div className="text-xs text-default-400 mt-auto">
                  {new Date(m.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
