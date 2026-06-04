import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import sharp from "sharp";

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB

export type ImagePurpose = "photo" | "document";

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

/**
 * Construct a full URL for a relative upload path (server-side).
 */
export function getUploadUrl(relativePath: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_UPLOAD_BASE_URL;
  if (baseUrl && baseUrl.trim() !== "") {
    return `${baseUrl.trim().replace(/\/$/, "")}/${relativePath}`;
  }
  return `/${relativePath}`;
}

/**
 * Upload a buffer to the cPanel proxy endpoint.
 */
async function uploadViaProxy(
  buffer: Buffer,
  relativePath: string
): Promise<void> {
  const proxyUrl = process.env.UPLOAD_PROXY_URL!;
  const secret = process.env.UPLOAD_PROXY_SECRET || "";

  const formData = new FormData();
  formData.append(
    "file",
    new Blob([new Uint8Array(buffer)]),
    path.basename(relativePath)
  );
  formData.append("path", relativePath);

  const res = await fetch(proxyUrl, {
    method: "POST",
    headers: { "X-Upload-Secret": secret },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new UploadError(
      `Upload proxy error (${res.status}): ${(body as { error?: string }).error || res.statusText}`
    );
  }
}

/**
 * Delete a file via the cPanel proxy endpoint.
 */
async function deleteViaProxy(relativePath: string): Promise<void> {
  const proxyUrl = process.env.UPLOAD_PROXY_URL!;
  const secret = process.env.UPLOAD_PROXY_SECRET || "";

  const res = await fetch(proxyUrl, {
    method: "DELETE",
    headers: {
      "X-Upload-Secret": secret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path: relativePath }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new UploadError(
      `Delete proxy error (${res.status}): ${(body as { error?: string }).error || res.statusText}`
    );
  }
}

/**
 * Validate, optimize, and save an uploaded image.
 *
 * If UPLOAD_PROXY_URL is set, sends the processed buffer to the cPanel PHP proxy.
 * Otherwise, writes to the local filesystem (dev mode).
 *
 * @param file    - The uploaded File object
 * @param subDir  - Subdirectory under uploads base, e.g. "uploads/staff-documents"
 * @param prefix  - Filename prefix, e.g. the staff ID
 * @param purpose - "photo" (400px max) or "document" (1200px max)
 * @returns       - { fileName, filePath, fileSize, mimeType }
 */
export async function saveUploadedImage(
  file: File,
  subDir: string,
  prefix: string,
  purpose: ImagePurpose = "document"
): Promise<{
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
}> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    throw new UploadError(
      `Invalid file type "${file.type}". Allowed: JPEG, PNG, WebP`
    );
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new UploadError(
      `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum: 2MB`
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Optimize with Sharp — resize and convert to WebP
  const maxDim = purpose === "photo" ? 400 : 1200;
  const processedBuffer = await sharp(buffer)
    .resize({
      width: maxDim,
      height: maxDim,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 80 })
    .toBuffer();

  const fileName = `${prefix}_${Date.now()}.webp`;
  const filePath = path.join(subDir, fileName);

  if (process.env.UPLOAD_PROXY_URL) {
    // Production: send to cPanel via HTTP proxy
    await uploadViaProxy(processedBuffer, filePath);
  } else {
    // Local dev: write to public/ folder
    const absoluteDir = path.join(process.cwd(), "public", subDir);
    await mkdir(absoluteDir, { recursive: true });
    await writeFile(path.join(absoluteDir, fileName), processedBuffer);
  }

  return {
    fileName,
    filePath,
    fileSize: processedBuffer.length,
    mimeType: "image/webp",
  };
}

/**
 * Delete an uploaded file.
 *
 * If UPLOAD_PROXY_URL is set, sends a DELETE request to the cPanel PHP proxy.
 * Otherwise, deletes from the local filesystem (dev mode).
 *
 * @param relativePath - Path relative to uploads base, e.g. "uploads/staff-documents/abc_123.webp"
 */
export async function deleteUploadedFile(relativePath: string): Promise<void> {
  try {
    if (process.env.UPLOAD_PROXY_URL) {
      await deleteViaProxy(relativePath);
    } else {
      const absolutePath = path.join(process.cwd(), "public", relativePath);
      await unlink(absolutePath);
    }
  } catch (error) {
    console.warn(`Failed to delete file "${relativePath}":`, error);
  }
}
