/**
 * Client-safe helper to construct upload URLs.
 * Separate from upload.ts so client components don't import sharp/fs.
 */
export function getUploadUrl(relativePath: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_UPLOAD_BASE_URL;
  if (baseUrl && baseUrl.trim() !== "") {
    return `${baseUrl.trim().replace(/\/$/, "")}/${relativePath}`;
  }
  return `/${relativePath}`;
}
