import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    handle: text("handle").notNull().unique(),
    displayName: text("display_name").notNull(),
    bio: text("bio").notNull().default(""),
    avatarEmoji: text("avatar_emoji"),
    accent: text("accent").notNull(),
    createdAt: text("created_at").notNull(),
    emailVerifiedAt: text("email_verified_at"),
    passwordHash: text("password_hash"),
    passwordUpdatedAt: text("password_updated_at"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("users_created_idx").on(table.createdAt)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
    userAgentHash: text("user_agent_hash"),
  },
  (table) => [
    index("sessions_user_idx").on(table.userId),
    index("sessions_expires_idx").on(table.expiresAt),
  ],
);

export const loginTokens = sqliteTable(
  "login_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    email: text("email").notNull(),
    purpose: text("purpose").notNull().default("magic_link"),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    consumedAt: text("consumed_at"),
    ipHash: text("ip_hash"),
    requestKey: text("request_key"),
  },
  (table) => [
    index("login_tokens_email_idx").on(table.email, table.expiresAt),
    index("login_tokens_expires_idx").on(table.expiresAt),
    uniqueIndex("login_tokens_request_key_idx").on(table.email, table.requestKey),
  ],
);

export const communities = sqliteTable(
  "communities",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    monogram: text("monogram").notNull(),
    accent: text("accent").notNull(),
    visibility: text("visibility").notNull().default("public"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("communities_visibility_idx").on(table.visibility)],
);

export const communityMembers = sqliteTable(
  "community_members",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    joinedAt: text("joined_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.communityId] }),
    index("community_members_community_idx").on(table.communityId),
  ],
);

export const channels = sqliteTable(
  "channels",
  {
    id: text("id").primaryKey(),
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    kind: text("kind").notNull().default("chat"),
    visibility: text("visibility").notNull().default("public"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("channels_community_slug_idx").on(table.communityId, table.slug),
    index("channels_community_idx").on(table.communityId),
  ],
);

export const channelMembers = sqliteTable(
  "channel_members",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    joinedAt: text("joined_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.channelId] }),
    index("channel_members_channel_idx").on(table.channelId),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    clientId: text("client_id").notNull(),
    createdAt: text("created_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    index("messages_channel_created_idx").on(table.channelId, table.createdAt),
    uniqueIndex("messages_client_idx").on(table.channelId, table.userId, table.clientId),
  ],
);

export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title"),
    body: text("body").notNull(),
    coverImageUrl: text("cover_image_url"),
    pinned: integer("pinned").notNull().default(0),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    index("posts_channel_created_idx").on(table.channelId, table.createdAt),
    index("posts_created_idx").on(table.createdAt),
  ],
);

export const pollOptions = sqliteTable(
  "poll_options",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [index("poll_options_post_idx").on(table.postId, table.position)],
);

export const pollVotes = sqliteTable(
  "poll_votes",
  {
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    optionId: text("option_id")
      .notNull()
      .references(() => pollOptions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.userId] }),
    index("poll_votes_option_idx").on(table.optionId),
  ],
);

export const postLikes = sqliteTable(
  "post_likes",
  {
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.userId] }),
    index("post_likes_user_idx").on(table.userId),
  ],
);

export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    body: text("body").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => [index("comments_post_created_idx").on(table.postId, table.createdAt)],
);

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    title: text("title"),
    communityId: text("community_id").references(() => communities.id, {
      onDelete: "set null",
    }),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("conversations_updated_idx").on(table.updatedAt)],
);

export const conversationMembers = sqliteTable(
  "conversation_members",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: text("last_read_at").notNull(),
    joinedAt: text("joined_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.userId] }),
    index("conversation_members_user_idx").on(table.userId),
  ],
);

export const directMessages = sqliteTable(
  "direct_messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    clientId: text("client_id").notNull(),
    createdAt: text("created_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    index("direct_messages_conversation_created_idx").on(table.conversationId, table.createdAt),
    uniqueIndex("direct_messages_client_idx").on(
      table.conversationId,
      table.userId,
      table.clientId,
    ),
  ],
);

export const badges = sqliteTable("badges", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  tier: text("tier").notNull(),
  sort: integer("sort").notNull(),
});

export const userBadges = sqliteTable(
  "user_badges",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    badgeCode: text("badge_code")
      .notNull()
      .references(() => badges.code, { onDelete: "cascade" }),
    earnedAt: text("earned_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.badgeCode] }),
    index("user_badges_badge_idx").on(table.badgeCode),
  ],
);

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    communityId: text("community_id").references(() => communities.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at"),
    location: text("location").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("events_starts_idx").on(table.startsAt)],
);

export const eventRsvps = sqliteTable(
  "event_rsvps",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.eventId, table.userId] }),
    index("event_rsvps_user_idx").on(table.userId),
  ],
);

export const idempotencyKeys = sqliteTable(
  "idempotency_keys",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    responseJson: text("response_json").notNull(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.key] }),
    index("idempotency_expires_idx").on(table.expiresAt),
  ],
);

export const attachments = sqliteTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull().unique(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width"),
    height: integer("height"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("attachments_owner_idx").on(table.ownerId)],
);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: text("reset_at").notNull(),
});

export const checkIns = sqliteTable(
  "check_ins",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    promptId: text("prompt_id").notNull(),
    answer: text("answer").notNull(),
    feeling: text("feeling"),
    context: text("context"),
    note: text("note"),
    clientId: text("client_id"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("check_ins_user_created_idx").on(table.userId, table.createdAt),
    uniqueIndex("check_ins_user_client_idx").on(table.userId, table.clientId),
  ],
);

export const checkInTags = sqliteTable(
  "check_in_tags",
  {
    checkInId: text("check_in_id")
      .notNull()
      .references(() => checkIns.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.checkInId, table.tag] }),
    index("check_in_tags_tag_idx").on(table.tag),
  ],
);

export const psychTopics = sqliteTable(
  "psych_topics",
  {
    slug: text("slug").primaryKey(),
    trigger: text("trigger").notNull().unique(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    body: text("body").notNull(),
    reflectionPrompt: text("reflection_prompt"),
    insightBody: text("insight_body").notNull(),
    channelId: text("channel_id").references(() => channels.id, {
      onDelete: "set null",
    }),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("psych_topics_channel_idx").on(table.channelId)],
);
