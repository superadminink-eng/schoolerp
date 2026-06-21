/**
 * Client-safe helper to construct upload URLs.
 * Separate from upload.ts so client components don't import sharp/fs.
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

  // 4. Fallback to API proxy (which correctly routes to cPanel or local)
  return `/api/v1/upload-proxy?path=${encodeURIComponent(cleanPath)}`;
}
