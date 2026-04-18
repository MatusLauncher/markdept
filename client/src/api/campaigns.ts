import { apiFetch } from "./client";

export interface Campaign {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  targetAudience: string | null;
  targetPlatforms: string[];
  status: string;
  contentCalendar: Record<string, unknown>[] | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export const campaigns = {
  list: () => apiFetch<Campaign[]>("/api/campaigns"),
  get: (id: number) => apiFetch<Campaign>(`/api/campaigns/${id}`),
  create: (data: Partial<Campaign>) =>
    apiFetch<Campaign>("/api/campaigns", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Campaign>) =>
    apiFetch<Campaign>(`/api/campaigns/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: number) =>
    apiFetch<{ ok: boolean }>(`/api/campaigns/${id}`, { method: "DELETE" }),
  generateCalendar: (id: number) =>
    apiFetch<{ contentCalendar: Record<string, unknown>[] }>(`/api/campaigns/${id}/generate-calendar`, { method: "POST" }),
};
