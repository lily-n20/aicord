import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  pgEnum,
  unique,
  index,
  customType,
} from 'drizzle-orm/pg-core'

// pgvector custom type
const vector = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'vector(1536)'
  },
})

export const presenceEnum = pgEnum('presence', ['online', 'idle', 'offline', 'ai_assisted'])
export const userRoleEnum = pgEnum('user_role', ['owner', 'admin', 'member', 'guest'])
export const channelTypeEnum = pgEnum('channel_type', ['text', 'ai', 'digest'])
export const authorTypeEnum = pgEnum('author_type', ['user', 'ai'])
export const agentBehaviorEnum = pgEnum('agent_behavior', ['passive', 'active'])
export const agentPermissionsEnum = pgEnum('agent_permissions', ['read_only', 'reply_only', 'full'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 32 }).unique().notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  avatarUrl: text('avatar_url'),
  presence: presenceEnum('presence').default('offline').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  refreshToken: text('refresh_token').unique().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const servers = pgTable('servers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).unique().notNull(),
  iconUrl: text('icon_url'),
  ownerId: uuid('owner_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    serverId: uuid('server_id')
      .references(() => servers.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: userRoleEnum('role').default('member').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    unq: unique().on(t.serverId, t.userId),
  })
)

export const channels = pgTable(
  'channels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    serverId: uuid('server_id')
      .references(() => servers.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    type: channelTypeEnum('type').default('text').notNull(),
    topic: text('topic'),
    position: integer('position').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    unq: unique().on(t.serverId, t.name),
  })
)

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channelId: uuid('channel_id')
      .references(() => channels.id, { onDelete: 'cascade' })
      .notNull(),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    authorType: authorTypeEnum('author_type').default('user').notNull(),
    content: text('content').notNull(),
    metadata: text('metadata').default('{}').notNull(),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    channelCreatedIdx: index('messages_channel_created_idx').on(t.channelId, t.createdAt),
  })
)

export const reactions = pgTable(
  'reactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .references(() => messages.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    emoji: varchar('emoji', { length: 32 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    unq: unique().on(t.messageId, t.userId, t.emoji),
  })
)

export const dmChannels = pgTable('dm_channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const dmParticipants = pgTable(
  'dm_participants',
  {
    dmChannelId: uuid('dm_channel_id')
      .references(() => dmChannels.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (t) => ({
    pk: unique().on(t.dmChannelId, t.userId),
  })
)

export const aiAgents = pgTable('ai_agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id')
    .references(() => channels.id, { onDelete: 'cascade' })
    .unique()
    .notNull(),
  persona: text('persona'),
  model: varchar('model', { length: 100 }).default('claude-sonnet-4-6').notNull(),
  behavior: agentBehaviorEnum('behavior').default('passive').notNull(),
  triggerCount: integer('trigger_count').default(50).notNull(),
  permissions: agentPermissionsEnum('permissions').default('reply_only').notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const aiContexts = pgTable(
  'ai_contexts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channelId: uuid('channel_id')
      .references(() => channels.id, { onDelete: 'cascade' })
      .notNull(),
    messageId: uuid('message_id')
      .references(() => messages.id, { onDelete: 'cascade' })
      .notNull(),
    embedding: vector('embedding').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    channelIdx: index('ai_contexts_channel_idx').on(t.channelId),
  })
)
