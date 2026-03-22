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

export function buildMeasurementUploadFormData({
  label,
  roomName,
  doorType,
  notes,
  photos,
  partyId,
}: {
  label: string;
  roomName?: string | null;
  doorType?: string | null;
  notes?: string | null;
  photos: string[];
  partyId?: string | null;
}) {
  const formData = new FormData();
  formData.set("label", label.trim());

  if (roomName?.trim()) {
    formData.set("roomName", roomName.trim());
  }
  if (doorType?.trim()) {
    formData.set("doorType", doorType.trim());
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
