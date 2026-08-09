import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api.js";

/**
 * The merged runtime config: businessConfig.js with any admin Settings
 * overrides applied. Always fetched from the API rather than imported from
 * the file, so a Settings change rebrands the live site without a redeploy.
 *
 * No provider needed — React Query dedupes every caller onto one request
 * and one cache entry.
 */
export function useConfig() {
  const { data: config, isLoading, error } = useQuery({
    queryKey: ["config"],
    queryFn: async () => (await apiFetch("/api/config")).config,
    staleTime: 5 * 60 * 1000,
  });

  return { config, isLoading, error };
}
