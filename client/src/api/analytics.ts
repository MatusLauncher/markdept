import { apiFetch } from "./client";

export interface AnalyticsEntry {
  id: number;
  postId: number;
  userId: number;
  platform: string;
  fetchedAt: string;
  likes: number;
  shares: number;
  comments: number;
  views: number;
  clicks: number;
  rawData: Record<string, unknown> | null;
}

export const analytics = {
  list: () => apiFetch<AnalyticsEntry[]>("/api/analytics"),
  fetch: (postId: number) =>
    apiFetch<AnalyticsEntry>(`/api/analytics/fetch/${postId}`, { method: "POST" }),
  report: (campaignId?: number, campaignName?: string) =>
    apiFetch<{ report: string }>("/api/analytics/report", {
      method: "POST",
      body: JSON.stringify({ campaignId, campaignName }),
    }),
};
