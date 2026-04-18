import type { PlatformClient, PostPayload, PostResult, Metrics } from "./types";

export class YouTubeClient implements PlatformClient {
  constructor(
    private readonly accessToken: string,
    private readonly refreshToken: string,
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  private async refreshAccessToken(): Promise<string> {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });
    if (!res.ok) throw new Error("YouTube token refresh failed");
    const data = await res.json() as { access_token: string };
    return data.access_token;
  }

  async post(payload: PostPayload): Promise<PostResult> {
    const token = await this.refreshAccessToken();
    const videoUrl = payload.mediaUrls?.[0];
    if (!videoUrl) throw new Error("YouTube post requires a video URL");

    const metadata = {
      snippet: {
        title: payload.videoTitle ?? payload.content.slice(0, 100),
        description: payload.videoDescription ?? payload.content,
        tags: payload.videoTags ?? [],
      },
      status: { privacyStatus: "public" },
    };

    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": "video/*",
        },
        body: JSON.stringify(metadata),
      },
    );
    if (!initRes.ok) throw new Error(`YouTube upload init failed: ${initRes.status}`);
    const uploadUrl = initRes.headers.get("location");
    if (!uploadUrl) throw new Error("No upload URL from YouTube");

    const videoRes = await fetch(videoUrl);
    const videoBlob = await videoRes.blob();
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "video/*" },
      body: videoBlob,
    });
    if (!uploadRes.ok) throw new Error(`YouTube upload failed: ${uploadRes.status}`);
    const data = await uploadRes.json() as { id: string };
    return { platformPostId: data.id };
  }

  async getMetrics(platformPostId: string): Promise<Metrics> {
    const token = await this.refreshAccessToken();
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${platformPostId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return { likes: 0, shares: 0, comments: 0, views: 0, clicks: 0, rawData: {} };
    const data = await res.json() as { items: Array<{ statistics: Record<string, string> }> };
    const stats = data.items[0]?.statistics ?? {};
    return {
      likes: Number(stats.likeCount ?? 0),
      shares: 0,
      comments: Number(stats.commentCount ?? 0),
      views: Number(stats.viewCount ?? 0),
      clicks: 0,
      rawData: stats as Record<string, unknown>,
    };
  }
}
