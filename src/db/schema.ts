import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  anthropicUserId: text("anthropic_user_id").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const oauthTokens = pgTable("oauth_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  refreshTokenEncrypted: text("refresh_token_encrypted"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  tokenType: text("token_type").notNull().default("Bearer"),
  scope: text("scope"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const platformAccounts = pgTable("platform_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  platform: text("platform").notNull(),
  accountName: text("account_name").notNull(),
  accountId: text("account_id"),
  accessTokenEncrypted: text("access_token_encrypted"),
  refreshTokenEncrypted: text("refresh_token_encrypted"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  extraDataEncrypted: text("extra_data_encrypted"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  targetAudience: text("target_audience"),
  targetPlatforms: jsonb("target_platforms").$type<string[]>().notNull().default([]),
  status: text("status").notNull().default("active"),
  contentCalendar: jsonb("content_calendar").$type<Record<string, unknown>[]>(),
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  platformAccountId: integer("platform_account_id").references(() => platformAccounts.id),
  platform: text("platform").notNull(),
  content: text("content").notNull(),
  mediaUrls: jsonb("media_urls").$type<string[]>().notNull().default([]),
  status: text("status").notNull().default("draft"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  platformPostId: text("platform_post_id"),
  videoTitle: text("video_title"),
  videoDescription: text("video_description"),
  videoTags: jsonb("video_tags").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const analytics = pgTable("analytics", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => posts.id),
  userId: integer("user_id").notNull().references(() => users.id),
  platform: text("platform").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  likes: integer("likes").notNull().default(0),
  shares: integer("shares").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  views: integer("views").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  rawData: jsonb("raw_data").$type<Record<string, unknown>>(),
});
