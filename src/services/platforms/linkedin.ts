import type { PlatformClient, PostPayload, PostResult, Metrics } from "./types";

export class LinkedInClient implements PlatformClient {
  constructor(private readonly accessToken: string) {}

  private async getPersonUrn(): Promise<string> {
    const res = await fetch("https://api.linkedin.com/v2/me", {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!res.ok) throw new Error(`LinkedIn profile fetch failed: ${res.status}`);
    const data = await res.json() as { id: string };
    return `urn:li:person:${data.id}`;
  }

  async post(payload: PostPayload): Promise<PostResult> {
    const authorUrn = await this.getPersonUrn();
    const body = {
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: payload.content },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    };
    const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`LinkedIn post failed: ${res.status}`);
    const location = res.headers.get("x-restli-id") ?? res.headers.get("location") ?? "";
    return { platformPostId: location };
  }

  async getMetrics(platformPostId: string): Promise<Metrics> {
    const encodedId = encodeURIComponent(platformPostId);
    const res = await fetch(
      `https://api.linkedin.com/v2/socialActions/${encodedId}`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } },
    );
    if (!res.ok) return { likes: 0, shares: 0, comments: 0, views: 0, clicks: 0, rawData: {} };
    const data = await res.json() as Record<string, unknown>;
    const likes = (data.likesSummary as { totalLikes?: number } | undefined)?.totalLikes ?? 0;
    const comments = (data.commentsSummary as { totalFirstLevelComments?: number } | undefined)?.totalFirstLevelComments ?? 0;
    return { likes, shares: 0, comments, views: 0, clicks: 0, rawData: data };
  }
}
