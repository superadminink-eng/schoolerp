import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import sharp from "sharp";
import crypto from "crypto";

/**
 * Zero-dependency magic byte validation for JPEG, PNG, and WebP images.
 * Prevents MIME-type spoofing of scripts or executables.
 */
export function isValidImageMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return true;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return true;
  }

  // WebP: RIFF (52 49 46 46) at offset 0 and WEBP (57 41 56 45) at offset 8
  const isRiff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
  const isWebp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
  if (isRiff && isWebp) {
    return true;
  }

  return false;
}

/**
 * Magic byte validation for PDF files (%PDF- / 25 50 44 46).
 */
export function isValidPdfMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  return (
    buffer[0] === 0x25 && // %
    buffer[1] === 0x50 && // P
    buffer[2] === 0x44 && // D
    buffer[3] === 0x46    // F
  );
}

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB for images
export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB for documents/PDFs

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
export function getUploadUrl(relativePath: string | null | undefined): string {
  if (!relativePath) return "";
  const trimmed = relativePath.trim();
  if (trimmed === "") return "";

  // 1. Prevent double-prefixing of absolute URLs or Data URLs
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed;
  }

  // 2. Normalize Windows-style backslashes to unix-style forward slashes
  const cleanPath = trimmed.replace(/\\/g, "/");

  // 3. Resolve base upload URL if set
  const baseUrl = process.env.NEXT_PUBLIC_UPLOAD_BASE_URL;
  if (baseUrl && baseUrl.trim() !== "") {
    const base = baseUrl.trim().replace(/\/$/, "");
    const rel = cleanPath.replace(/^\//, "");
    return `${base}/${rel}`;
  }

  // 4. Fallback to local server path (safely prefixing slash)
  return cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;
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
      `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum: 5MB`
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (!isValidImageMagicBytes(buffer)) {
    throw new UploadError(
      "File content validation failed. The file structure is not a valid JPEG, PNG, or WebP image."
    );
  }

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

  const randToken = crypto.randomBytes(4).toString("hex");
  const fileName = `${prefix}_${Date.now()}_${randToken}.webp`;
  const filePath = path.join(subDir, fileName).replace(/\\/g, "/");

  if (process.env.UPLOAD_PROXY_URL) {
    await uploadViaProxy(processedBuffer, filePath);
  } else {
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
 * Validate and save an uploaded document (supporting both PDF and Images).
 * Supports up to 10MB PDFs and 5MB Images with zero collision.
 */
export async function saveUploadedDocument(
  file: File,
  subDir: string,
  prefix: string
): Promise<{
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
}> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  if (!isPdf && !ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    throw new UploadError(
      `Invalid file type "${file.type}". Allowed: PDF, JPEG, PNG, WebP`
    );
  }

  if (file.size > MAX_DOCUMENT_SIZE) {
    throw new UploadError(
      `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum: 10MB`
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const randToken = crypto.randomBytes(4).toString("hex");

  if (isPdf) {
    if (!isValidPdfMagicBytes(buffer)) {
      throw new UploadError(
        "File content validation failed. The file structure is not a valid PDF document."
      );
    }

    const fileName = `${prefix}_${Date.now()}_${randToken}.pdf`;
    const filePath = path.join(subDir, fileName).replace(/\\/g, "/");

    if (process.env.UPLOAD_PROXY_URL) {
      await uploadViaProxy(buffer, filePath);
    } else {
      const absoluteDir = path.join(process.cwd(), "public", subDir);
      await mkdir(absoluteDir, { recursive: true });
      await writeFile(path.join(absoluteDir, fileName), buffer);
    }

    return {
      fileName,
      filePath,
      fileSize: buffer.length,
      mimeType: "application/pdf",
    };
  } else {
    // Process image with Sharp optimization
    if (!isValidImageMagicBytes(buffer)) {
      throw new UploadError(
        "File content validation failed. The file structure is not a valid image."
      );
    }

    const processedBuffer = await sharp(buffer)
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();

    const fileName = `${prefix}_${Date.now()}_${randToken}.webp`;
    const filePath = path.join(subDir, fileName).replace(/\\/g, "/");

    if (process.env.UPLOAD_PROXY_URL) {
      await uploadViaProxy(processedBuffer, filePath);
    } else {
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
}

/**
 * Delete an uploaded file.
 */
export async function deleteUploadedFile(relativePath: string): Promise<void> {
  try {
    if (!relativePath) return;
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
