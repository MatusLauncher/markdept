import { generate } from "./anthropic";

export const PLATFORM_LIMITS: Record<string, number> = {
  mastodon: 500,
  linkedin: 3000,
  lemmy: 10000,
  youtube: 5000,
};

export const PLATFORM_SYSTEM_PROMPTS: Record<string, string> = {
  mastodon: `You are a social media expert creating content for Mastodon, a federated microblogging platform.
Write concise, engaging posts under 500 characters. Use relevant hashtags (2-4 max). Favor open-source, privacy, and tech communities.
Return only the post text with hashtags, no extra commentary.`,

  linkedin: `You are a professional content strategist creating LinkedIn posts.
Write in a professional yet engaging tone, up to 3000 characters. Use line breaks for readability.
Include a call to action. Add 3-5 relevant hashtags at the end. Return only the post text.`,

  lemmy: `You are creating a post for Lemmy, a federated link aggregator similar to Reddit.
Write a clear title and body text. Be informative and encourage discussion.
Format: start with the title on the first line, then a blank line, then the body. Return only the content.`,

  youtube: `You are a YouTube content strategist.
Write a video description that is informative and SEO-friendly (up to 5000 chars).
Include a brief summary, key points as bullet list, and relevant keywords.
Return only the description text.`,
};

export async function generatePost(
  userId: number,
  platform: string,
  topic: string,
  campaignContext?: string,
): Promise<string> {
  const system = PLATFORM_SYSTEM_PROMPTS[platform];
  const limit = PLATFORM_LIMITS[platform] ?? 500;
  const context = campaignContext ? `\nCampaign context: ${campaignContext}` : "";
  const prompt = `Create a ${platform} post about: ${topic}${context}\nKeep it under ${limit} characters.`;
  return generate(userId, [{ role: "user", content: prompt }], system, 1024);
}

export async function generateContentCalendar(
  userId: number,
  campaignName: string,
  description: string,
  platforms: string[],
  weeks = 4,
): Promise<Record<string, unknown>[]> {
  const prompt = `Create a ${weeks}-week content calendar for a campaign.
Campaign: ${campaignName}
Description: ${description}
Platforms: ${platforms.join(", ")}

Return a JSON array of objects with fields: week (number), platform (string), topic (string), postType (string), notes (string).
Return only valid JSON, no markdown fences.`;

  const text = await generate(userId, [{ role: "user", content: prompt }], undefined, 2048);
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

export async function generateAnalyticsReport(
  userId: number,
  analyticsData: Record<string, unknown>[],
  campaignName?: string,
): Promise<string> {
  const context = campaignName ? ` for campaign "${campaignName}"` : "";
  const prompt = `Analyze the following social media analytics data${context} and provide a comprehensive report with insights, trends, and recommendations.

Data:
${JSON.stringify(analyticsData, null, 2)}

Include: overall performance summary, platform-specific insights, top performing content, recommendations for improvement.`;
  return generate(userId, [{ role: "user", content: prompt }], undefined, 2048);
}
