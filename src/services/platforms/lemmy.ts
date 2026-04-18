import type { PlatformClient, PostPayload, PostResult, Metrics } from "./types";

interface LemmyCredentials {
  username: string;
  password: string;
  communityId: number;
}

export class LemmyClient implements PlatformClient {
  constructor(
    private readonly instanceUrl: string,
    private readonly credentials: LemmyCredentials,
  ) {}

  private async getToken(): Promise<string> {
    const res = await fetch(`${this.instanceUrl}/api/v3/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username_or_email: this.credentials.username, password: this.credentials.password }),
    });
    if (!res.ok) throw new Error(`Lemmy login failed: ${res.status}`);
    const data = await res.json() as { jwt: string };
    return data.jwt;
  }

  async post(payload: PostPayload): Promise<PostResult> {
    const jwt = await this.getToken();
    const lines = payload.content.split("\n");
    const name = lines[0].slice(0, 200);
    const body = lines.slice(2).join("\n") || payload.content;
    const res = await fetch(`${this.instanceUrl}/api/v3/post`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, body, community_id: this.credentials.communityId }),
    });
    if (!res.ok) throw new Error(`Lemmy post failed: ${res.status}`);
    const data = await res.json() as { post_view: { post: { id: number } } };
    return { platformPostId: String(data.post_view.post.id) };
  }

  async getMetrics(platformPostId: string): Promise<Metrics> {
    const res = await fetch(`${this.instanceUrl}/api/v3/post?id=${platformPostId}`);
    if (!res.ok) return { likes: 0, shares: 0, comments: 0, views: 0, clicks: 0, rawData: {} };
    const data = await res.json() as { post_view: { counts: { score: number; comments: number } } };
    const counts = data.post_view.counts;
    return {
      likes: counts.score,
      shares: 0,
      comments: counts.comments,
      views: 0,
      clicks: 0,
      rawData: data as unknown as Record<string, unknown>,
    };
  }
}
