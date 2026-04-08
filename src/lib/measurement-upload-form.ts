"use client";

function dataUrlToFile(dataUrl: string, fileName: string) {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) {
    throw new Error("Invalid draft photo");
  }

  const mimeType = match[1] || "application/octet-stream";
  const payload = match[3] || "";
  const byteString = atob(decodeURIComponent(payload));
  const bytes = new Uint8Array(byteString.length);

  for (let index = 0; index < byteString.length; index += 1) {
    bytes[index] = byteString.charCodeAt(index);
  }

  return new File([bytes], fileName, { type: mimeType });
}

/**
 * Build a FormData payload for uploading a measurement with metadata and photos.
 *
 * Optional string fields are trimmed and omitted if empty after trimming. Each entry in `photos`
 * is converted to a File and appended under the "photos" key using the filename pattern
 * `measurement-<index>.jpg` (starting at 1).
 *
 * @param label - Measurement label; required and trimmed before set
 * @param roomName - Optional room name; trimmed and included only if non-empty
 * @param itemType - Optional item type; trimmed and included only if non-empty
 * @param notes - Optional notes; trimmed and included only if non-empty
 * @param photos - Array of data URLs representing images to include as files in the form
 * @param partyId - Optional party identifier; trimmed and included only if non-empty
 * @returns A FormData containing the fields:
 *  - `"label"` (always),
 *  - optionally `"roomName"`, `"itemType"`, `"notes"`, and `"partyId"`,
 *  - one or more `"photos"` entries (File objects)
 */
export function buildMeasurementUploadFormData({
  label,
  roomName,
  itemType,
  notes,
  photos,
  partyId,
}: {
  label: string;
  roomName?: string | null;
  itemType?: string | null;
  notes?: string | null;
  photos: string[];
  partyId?: string | null;
}) {
  const formData = new FormData();
  formData.set("label", label.trim());

  if (roomName?.trim()) {
    formData.set("roomName", roomName.trim());
  }
  if (itemType?.trim()) {
    formData.set("itemType", itemType.trim());
  }
  if (notes?.trim()) {
    formData.set("notes", notes.trim());
  }
  if (partyId?.trim()) {
    formData.set("partyId", partyId.trim());
  }

  photos.forEach((photo, index) => {
    formData.append("photos", dataUrlToFile(photo, `measurement-${index + 1}.jpg`));
  });

  return formData;
}
