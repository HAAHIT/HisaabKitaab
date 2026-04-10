import Dexie, { Table } from "dexie";

export interface MeasurementDraft {
  id: string;
  label: string;
  roomName: string | null;
  itemType: string | null;
  notes: string | null;
  photos: string[];
  createdAt: number;
}

interface LegacyMeasurementPhoto {
  url?: string;
  thumbnailUrl?: string;
}

interface LegacyMeasurementRecord {
  id?: string;
  label?: string;
  roomName?: string | null;
  itemType?: string | null;
  notes?: string | null;
  photos?: Array<string | LegacyMeasurementPhoto> | null;
  createdAt?: number;
  updatedAt?: number;
  isDirty?: boolean;
  isDeleted?: boolean;
}

export class HisaabKitaabDB extends Dexie {
  measurements!: Table<LegacyMeasurementRecord, string | number>;
  parties!: Table<Record<string, unknown>, string>;
  bills!: Table<Record<string, unknown>, string>;
  payments!: Table<Record<string, unknown>, string>;
  templates!: Table<Record<string, unknown>, string>;
  measurementDrafts!: Table<MeasurementDraft, string>;

  constructor() {
    super("HisaabKitaabDB");

    // Retain legacy tables only long enough to migrate old offline measurements into draft records.
    this.version(2).stores({
      measurements: "++id, customerId, label, status, updatedAt, isDirty, isDeleted",
      parties: "id, name, type, updatedAt, isDirty, isDeleted",
      bills: "id, billNumber, templateId, customerName, updatedAt, isDirty, isDeleted",
      payments: "id, partyId, direction, status, updatedAt, isDirty, isDeleted",
      templates: "id, name, updatedAt",
    });

    this.version(3)
      .stores({
        measurements: "++id, customerId, label, status, updatedAt, isDirty, isDeleted",
        parties: "id, name, type, updatedAt, isDirty, isDeleted",
        bills: "id, billNumber, templateId, customerName, updatedAt, isDirty, isDeleted",
        payments: "id, partyId, direction, status, updatedAt, isDirty, isDeleted",
        templates: "id, name, updatedAt",
        measurementDrafts: "&id, createdAt",
      })
      .upgrade(async (tx) => {
        const legacyMeasurements = (await tx
          .table("measurements")
          .toArray()) as LegacyMeasurementRecord[];
        const drafts = legacyMeasurements
          .filter(
            (measurement) =>
              measurement.isDirty &&
              !measurement.isDeleted &&
              typeof measurement.label === "string" &&
              measurement.label.trim().length > 0
          )
          .map((measurement) => ({
            id: measurement.id ?? crypto.randomUUID(),
            label: measurement.label!.trim(),
            roomName: measurement.roomName ?? null,
            itemType: measurement.itemType ?? null,
            notes: measurement.notes ?? null,
            photos: Array.isArray(measurement.photos)
              ? measurement.photos
                  .map((photo) =>
                    typeof photo === "string" ? photo : photo.url ?? photo.thumbnailUrl ?? null
                  )
                  .filter((photo): photo is string => Boolean(photo))
              : [],
            createdAt: measurement.createdAt ?? measurement.updatedAt ?? Date.now(),
          }));

        if (drafts.length > 0) {
          await tx.table("measurementDrafts").bulkPut(drafts);
        }
      });
  }
}

export const db = new HisaabKitaabDB();
