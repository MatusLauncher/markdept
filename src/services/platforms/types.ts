export interface PostPayload {
  content: string;
  mediaUrls?: string[];
  videoTitle?: string;
  videoDescription?: string;
  videoTags?: string[];
}

export interface PostResult {
  platformPostId: string;
}

export interface Metrics {
  likes: number;
  shares: number;
  comments: number;
  views: number;
  clicks: number;
  rawData: Record<string, unknown>;
}

export interface PlatformClient {
  post(payload: PostPayload): Promise<PostResult>;
  getMetrics(platformPostId: string): Promise<Metrics>;
}
