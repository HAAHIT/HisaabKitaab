"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  Card,
  CardBody,
  Chip,
  Input,
  Select,
  SelectItem,
  Skeleton,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";

interface Measurement {
  id: string;
  label: string;
  roomName: string | null;
  itemType: string | null;
  notes: string | null;
  photos: { url: string; thumbnailUrl?: string }[];
  status: string;
  createdAt: string;
  customer: { name: string; phone: string | null };
  party: { id: string; name: string; type: string } | null;
}

const statusColorMap: Record<
  string,
  "default" | "primary" | "warning" | "success" | "secondary"
> = {
  UPLOADED: "warning",
  PENDING: "warning",
  REVIEWED: "primary",
  IN_PRODUCTION: "secondary",
  COMPLETED: "success",
};

/**
 * Client-side page that fetches and displays a searchable, filterable grid of measurements.
 *
 * Renders a header, a search input and status filter, and a responsive grid of measurement cards.
 * While fetching, shows skeleton placeholders; when no results are found, shows an empty state.
 * Each card shows a photo (or placeholder), label, status chip, optional room/item tags, customer/party info,
 * and navigates to the measurement details page when pressed.
 *
 * @returns The page's React element tree for the measurements list UI.
 */
export default function MeasurementsListPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const fetchMeasurements = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) {
        params.set("search", search);
      }
      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }

      const response = await fetch(`/api/measurements?${params.toString()}`);
      const data = await response.json();
      setMeasurements((data.measurements || []) as Measurement[]);
    } catch {
      setMeasurements([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchMeasurements();
  }, [fetchMeasurements]);

  const statusOptions = [
    { key: "ALL", label: t("measurements.filter.all") },
    { key: "UPLOADED", label: t("measurements.filter.uploaded") },
    { key: "PENDING", label: t("measurements.filter.pending") },
    { key: "REVIEWED", label: t("measurements.filter.reviewed") },
    { key: "IN_PRODUCTION", label: t("measurements.filter.inProduction") },
    { key: "COMPLETED", label: t("measurements.filter.completed") },
  ];

  return (
    <div className="animate-fade-in p-4 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("measurements.title")}</h1>
          <p className="mt-1 text-sm text-default-500">
            {t("measurements.subtitle")}
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <Input
          aria-label={t("measurements.searchPlaceholder")}
          placeholder={t("measurements.searchPlaceholder")}
          value={search}
          onValueChange={setSearch}
          variant="bordered"
          className="flex-1"
          startContent={
            <svg className="h-4 w-4 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
              />
            </svg>
          }
        />
        <Select
          aria-label={t("measurements.filter.all")}
          placeholder={t("measurements.filter.all")}
          selectedKeys={new Set([statusFilter])}
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0] as string;
            if (value) {
              setStatusFilter(value);
            }
          }}
          variant="bordered"
          className="w-48"
        >
          {statusOptions.map((option) => (
            <SelectItem key={option.key} textValue={option.label}>{option.label}</SelectItem>
          ))}

        </Select>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <Skeleton key={item} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : measurements.length === 0 ? (
        <Card shadow="sm">
          <CardBody className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <svg className="h-10 w-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                />
              </svg>
            </div>
            <p className="text-lg font-medium text-default-600">
              {search || statusFilter !== "ALL"
                ? t("measurements.emptyFiltered")
                : t("measurements.empty")}
            </p>
            <p className="mt-1 text-sm text-default-400">{t("measurements.emptyHint")}</p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {measurements.map((measurement) => (
            <Card
              key={measurement.id}
              isPressable
              shadow="sm"
              className="overflow-hidden text-left transition hover:shadow-lg"
              onPress={() => router.push(`/measurements/${measurement.id}`)}
            >
              {measurement.photos.length > 0 ? (
                <div className="relative h-48 bg-default-100">
                  <Image
                    src={measurement.photos[0].thumbnailUrl || measurement.photos[0].url}
                    alt={measurement.label}
                    fill
                    unoptimized
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover"
                  />
                  <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white">
                    {measurement.photos.length} {t("measurements.photos")}
                  </div>
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center bg-default-100">
                  <svg className="h-12 w-12 text-default-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                    />
                  </svg>
                </div>
              )}

              <CardBody className="p-4">
                <div className="mb-2 flex items-start justify-between">
                  <h3 className="line-clamp-1 text-base font-semibold" title={measurement.label}>
                    {measurement.label}
                  </h3>
                  <Chip
                    size="sm"
                    variant="flat"
                    color={statusColorMap[measurement.status] || "default"}
                    className="ml-2 shrink-0 capitalize"
                  >
                    {measurement.status.toLowerCase().replace("_", " ")}
                  </Chip>
                </div>

                <div className="mb-2 flex flex-wrap gap-2">
                  {measurement.roomName && (
                    <span className="rounded-full bg-default-100 px-2 py-0.5 text-xs text-default-400">
                      {measurement.roomName}
                    </span>
                  )}
                  {measurement.itemType && (
                    <span className="rounded-full bg-default-100 px-2 py-0.5 text-xs text-default-400">
                      {measurement.itemType}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-default-400">
                  <div className="flex flex-col">
                    <span className="font-medium text-default-600">
                      {t("measurements.customerPrefix")}: {measurement.customer.name}
                    </span>
                    {measurement.party && <span>{t("bills.partyPrefix")}: {measurement.party.name}</span>}
                  </div>
                  <span>
                    {new Date(measurement.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
