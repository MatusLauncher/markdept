import { apiFetch } from "./client";

export interface Post {
  id: number;
  userId: number;
  campaignId: number | null;
  platformAccountId: number | null;
  platform: string;
  content: string;
  mediaUrls: string[];
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  platformPostId: string | null;
  videoTitle: string | null;
  videoDescription: string | null;
  videoTags: string[];
  createdAt: string;
  updatedAt: string;
}

export const posts = {
  list: (status?: string) =>
    apiFetch<Post[]>(status ? `/api/posts?status=${status}` : "/api/posts"),
  get: (id: number) => apiFetch<Post>(`/api/posts/${id}`),
  create: (data: Partial<Post>) =>
    apiFetch<Post>("/api/posts", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Post>) =>
    apiFetch<Post>(`/api/posts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: number) =>
    apiFetch<{ ok: boolean }>(`/api/posts/${id}`, { method: "DELETE" }),
  generate: (id: number, topic: string, campaignContext?: string) =>
    apiFetch<Post>(`/api/posts/${id}/generate`, {
      method: "POST",
      body: JSON.stringify({ topic, campaignContext }),
    }),
};
