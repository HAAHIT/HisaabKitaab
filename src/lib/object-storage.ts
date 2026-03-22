import { randomUUID } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

const STORAGE_ROOT = path.resolve(
  process.env.STORAGE_ROOT || path.join(process.cwd(), ".storage")
);

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

export type StorageNamespace = "company-logos" | "measurement-photos";

type StoreBufferParams = {
  buffer: Buffer;
  mimeType: string;
  namespace: StorageNamespace;
  originalName?: string | null;
};

function getSafeExtension(mimeType: string, originalName?: string | null) {
  const loweredMimeType = mimeType.toLowerCase();
  if (MIME_EXTENSION_MAP[loweredMimeType]) {
    return MIME_EXTENSION_MAP[loweredMimeType];
  }

  if (originalName) {
    const extension = path.extname(originalName).replace(".", "").toLowerCase();
    if (/^[a-z0-9]{1,10}$/.test(extension)) {
      return extension;
    }
  }

  return "bin";
}

function resolveStoragePath(storageKey: string) {
  const normalizedKey = storageKey.replace(/\\/g, "/").replace(/^\/+/, "");
  const absolutePath = path.resolve(STORAGE_ROOT, normalizedKey);
  const relativePath = path.relative(STORAGE_ROOT, absolutePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Invalid storage key");
  }

  return absolutePath;
}

export async function storeBuffer({
  buffer,
  mimeType,
  namespace,
  originalName,
}: StoreBufferParams) {
  const now = new Date();
  const extension = getSafeExtension(mimeType, originalName);
  const storageKey = `${namespace}/${now.getUTCFullYear()}/${String(
    now.getUTCMonth() + 1
  ).padStart(2, "0")}/${randomUUID()}.${extension}`;
  const absolutePath = resolveStoragePath(storageKey);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  return {
    storageProvider: "local",
    storageKey,
    bytes: buffer.byteLength,
    mimeType,
    originalName: originalName || null,
  };
}

export async function readStoredObject(storageKey: string) {
  return readFile(resolveStoragePath(storageKey));
}

export async function deleteStoredObject(storageKey: string) {
  try {
    await unlink(resolveStoragePath(storageKey));
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
  }
}
