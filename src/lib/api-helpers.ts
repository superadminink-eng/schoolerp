import { NextResponse } from "next/server";
import { ZodError } from "zod";

type ApiResponseMeta = {
  page?: number;
  limit?: number;
  total?: number;
  stats?: any;
};

export function apiSuccess<T>(data: T, meta?: ApiResponseMeta, status = 200) {
  return NextResponse.json({ success: true, data, ...(meta && { meta }) }, { status });
}

export function apiError(
  code: string,
  message: string,
  status = 400,
  details?: unknown
) {
  return NextResponse.json(
    { success: false, error: { code, message, ...(details ? { details } : {}) } },
    { status }
  );
}

export function apiValidationError(error: ZodError) {
  const details = error.errors.map((e) => ({
    field: e.path.join("."),
    message: e.message,
  }));
  return apiError("VALIDATION_ERROR", "Invalid request data", 422, details);
}

export function apiNotFound(resource = "Resource") {
  return apiError("NOT_FOUND", `${resource} not found`, 404);
}

export function apiUnauthorized() {
  return apiError("UNAUTHORIZED", "Authentication required", 401);
}

export function apiForbidden() {
  return apiError("FORBIDDEN", "Insufficient permissions", 403);
}

/**
 * Parse pagination params from URL search params.
 */
export function parsePagination(url: URL) {
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limitParam = url.searchParams.get("limit");
  
  let limit = 20; // Default limit
  if (limitParam) {
    const parsedLimit = parseInt(limitParam);
    if (!isNaN(parsedLimit)) {
      // Allow higher limits (up to 10000) when explicitly requested by client 
      // to avoid silent truncation in list views/grids.
      limit = Math.min(10000, Math.max(1, parsedLimit));
    }
  }
  
  const search = url.searchParams.get("search") ?? undefined;
  return { page, limit, search };
}

