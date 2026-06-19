export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    stats?: any;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: any;

  constructor(message: string, code: string, status: number, details?: any) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Standard fetch-based API client wrapper.
 */
async function request<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Ensure path starts with slash and points to API route
  const url = path.startsWith("/") ? path : `/${path}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let payload: ApiResponse<T>;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(
      "Failed to parse API response",
      "PARSE_ERROR",
      response.status
    );
  }

  if (!response.ok || !payload.success) {
    const errCode = payload.error?.code || "UNKNOWN_ERROR";
    const errMsg = payload.error?.message || response.statusText || "Request failed";
    const errDetails = payload.error?.details;
    throw new ApiError(errMsg, errCode, response.status, errDetails);
  }

  return payload;
}

export const apiClient = {
  get: <T = any>(path: string, options?: RequestInit) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T = any>(path: string, body?: any, options?: RequestInit) =>
    request<T>(path, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  patch: <T = any>(path: string, body?: any, options?: RequestInit) =>
    request<T>(path, {
      ...options,
      method: "PATCH",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  delete: <T = any>(path: string, options?: RequestInit) =>
    request<T>(path, { ...options, method: "DELETE" }),
};
