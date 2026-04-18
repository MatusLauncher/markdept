import type { PlatformClient, PostPayload, PostResult, Metrics } from "./types";

export class MastodonClient implements PlatformClient {
  constructor(
    private readonly instanceUrl: string,
    private readonly accessToken: string,
  ) {}

  async post(payload: PostPayload): Promise<PostResult> {
    const res = await fetch(`${this.instanceUrl}/api/v1/statuses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: payload.content }),
    });
    if (!res.ok) throw new Error(`Mastodon post failed: ${res.status}`);
    const data = await res.json() as { id: string };
    return { platformPostId: data.id };
  }

  async getMetrics(platformPostId: string): Promise<Metrics> {
    const res = await fetch(`${this.instanceUrl}/api/v1/statuses/${platformPostId}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!res.ok) throw new Error(`Mastodon metrics failed: ${res.status}`);
    const data = await res.json() as { favourites_count: number; reblogs_count: number; replies_count: number };
    return {
      likes: data.favourites_count,
      shares: data.reblogs_count,
      comments: data.replies_count,
      views: 0,
      clicks: 0,
      rawData: data as unknown as Record<string, unknown>,
    };
  }
}
