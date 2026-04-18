import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiError } from "../api/client";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
}

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<AuthUser | null>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      try {
        return await apiFetch<AuthUser>("/auth/me");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return { user: user ?? null, isLoading, isAuthenticated: !!user };
}
