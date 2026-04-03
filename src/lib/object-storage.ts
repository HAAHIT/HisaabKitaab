import { Storage } from "@google-cloud/storage";
import { randomUUID } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

const STORAGE_ROOT = path.resolve(process.env.STORAGE_ROOT || ".storage");
const OBJECT_STORAGE_PROVIDER = (
  process.env.OBJECT_STORAGE_PROVIDER || "local"
).trim().toLowerCase();

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

export type StorageNamespace = "company-logos" | "measurement-photos";
export type StoredObjectProvider = "local" | "gcs" | "proxy";

type StoreBufferParams = {
  buffer: Buffer;
  mimeType: string;
  namespace: StorageNamespace;
  originalName?: string | null;
};

let gcsStorage: Storage | null = null;

function hasErrorCode(error: unknown, code: number | string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

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

function getGcsBucketName() {
  const bucketName = process.env.GCS_BUCKET_NAME?.trim();
  if (!bucketName) {
    throw new Error("GCS_BUCKET_NAME is required when OBJECT_STORAGE_PROVIDER=gcs");
  }

  return bucketName;
}

function getGcsStorage() {
  if (!gcsStorage) {
    gcsStorage = new Storage({
      projectId: process.env.GCS_PROJECT_ID?.trim() || undefined,
    });
  }

  return gcsStorage;
}

function getConfiguredStorageProvider(): Exclude<StoredObjectProvider, "proxy"> {
  if (OBJECT_STORAGE_PROVIDER === "local" || OBJECT_STORAGE_PROVIDER === "gcs") {
    return OBJECT_STORAGE_PROVIDER;
  }

  throw new Error(
    `Unsupported OBJECT_STORAGE_PROVIDER "${OBJECT_STORAGE_PROVIDER}". Expected "local" or "gcs".`
  );
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
  const storageProvider = getConfiguredStorageProvider();

  if (storageProvider === "gcs") {
    const bucket = getGcsStorage().bucket(getGcsBucketName());
    const file = bucket.file(storageKey);

    await file.save(buffer, {
      resumable: false,
      contentType: mimeType,
      metadata: {
        cacheControl: "private, max-age=3600",
      },
    });

    return {
      storageProvider,
      storageKey,
      bytes: buffer.byteLength,
      mimeType,
      originalName: originalName || null,
    };
  }

  const absolutePath = resolveStoragePath(storageKey);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  return {
    storageProvider,
    storageKey,
    bytes: buffer.byteLength,
    mimeType,
    originalName: originalName || null,
  };
}

export async function readStoredObject(
  storageProvider: StoredObjectProvider,
  storageKey: string
) {
  if (storageProvider === "local") {
    return readFile(resolveStoragePath(storageKey));
  }

  if (storageProvider === "gcs") {
    const [buffer] = await getGcsStorage()
      .bucket(getGcsBucketName())
      .file(storageKey)
      .download();
    return buffer;
  }

  throw new Error(`Storage provider "${storageProvider}" does not support direct reads`);
}

export async function deleteStoredObject(
  storageProvider: StoredObjectProvider,
  storageKey: string
) {
  if (storageProvider === "gcs") {
    try {
      await getGcsStorage()
        .bucket(getGcsBucketName())
        .file(storageKey)
        .delete();
    } catch (error) {
      if (!hasErrorCode(error, 404)) {
        throw error;
      }
    }
    return;
  }

  if (storageProvider !== "local") {
    return;
  }

  try {
    await unlink(resolveStoragePath(storageKey));
  } catch (error) {
    if (!hasErrorCode(error, "ENOENT")) {
      throw error;
    }
  }
}
