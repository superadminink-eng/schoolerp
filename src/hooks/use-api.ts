import useSWR, { SWRConfiguration } from "swr";
import { apiClient, ApiResponse } from "@/lib/api-client";

/**
 * Standard hook for retrieving data from the API with SWR caching.
 */
export function useApi<T = any>(
  url: string | null,
  config?: SWRConfiguration
) {
  const { data, error, isLoading, mutate, isValidating } = useSWR<ApiResponse<T>>(
    url,
    (path: string) => apiClient.get<T>(path),
    config
  );

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
  };
}
