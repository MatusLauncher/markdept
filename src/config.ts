import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(8000),
  SECRET_KEY: z.string().min(1),
  ENCRYPTION_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  ANTHROPIC_CLIENT_ID: z.string().min(1),
  ANTHROPIC_CLIENT_SECRET: z.string().min(1),
  ANTHROPIC_REDIRECT_URI: z.string().url().default("http://localhost:8000/auth/callback"),
  MASTODON_INSTANCE_URL: z.string().url().default("https://mastodon.social"),
  MASTODON_CLIENT_ID: z.string().default(""),
  MASTODON_CLIENT_SECRET: z.string().default(""),
  LINKEDIN_CLIENT_ID: z.string().default(""),
  LINKEDIN_CLIENT_SECRET: z.string().default(""),
  LEMMY_INSTANCE_URL: z.string().url().default("https://lemmy.world"),
  YOUTUBE_CLIENT_ID: z.string().default(""),
  YOUTUBE_CLIENT_SECRET: z.string().default(""),
  YOUTUBE_REDIRECT_URI: z.string().default("http://localhost:8000/api/platforms/youtube/callback"),
});

export const config = schema.parse(process.env);
