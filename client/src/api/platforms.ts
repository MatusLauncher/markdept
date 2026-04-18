import { apiFetch } from "./client";

export interface PlatformAccount {
  id: number;
  userId: number;
  platform: string;
  accountName: string;
  accountId: string | null;
  isActive: boolean;
  tokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const platforms = {
  list: () => apiFetch<PlatformAccount[]>("/api/platforms"),
  delete: (id: number) =>
    apiFetch<{ ok: boolean }>(`/api/platforms/${id}`, { method: "DELETE" }),
  connectLemmy: (data: { username: string; password: string; communityId: number }) =>
    apiFetch<{ ok: boolean }>("/api/platforms/lemmy/connect", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
