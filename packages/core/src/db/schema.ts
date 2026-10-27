import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  doublePrecision,
  pgEnum,
  primaryKey,
  uniqueIndex,
  index,
  check,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// === Enums ===

export const memberTierEnum = pgEnum('member_tier', [
  'probationary',
  'full',
  'provisional',
  'removed',
]);

export const chatTypeEnum = pgEnum('chat_type', ['input', 'output', 'relay']);

export const judgmentTypeEnum = pgEnum('judgment_type', ['binary', 'degrees']);

export const vouchRequestStatusEnum = pgEnum('vouch_request_status', [
  'pending',
  'approved',
  'rejected',
]);

export const disputeStatusEnum = pgEnum('dispute_status', [
  'active',
  'resolved_accused_concedes',
  'resolved_challenger_concedes',
  'cancelled',
]);

export const federationStatusEnum = pgEnum('federation_status', [
  'connected',
  'federated',
  'de_federated',
]);

// === Users & Auth ===

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  privateUsername: varchar('private_username', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_expires_at_idx').on(table.expiresAt),
  ],
);

// === Groups & Membership ===

export const groups = pgTable('groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const groupProfiles = pgTable(
  'group_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    publicUsernameCiphertext: text('public_username_ciphertext').notNull(),
    selfDescriptionCiphertext: text('self_description_ciphertext').notNull(),
    profilePhotoCiphertext: text('profile_photo_ciphertext'),
    selfVouchCiphertext: text('self_vouch_ciphertext').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('group_profiles_user_group_idx').on(table.userId, table.groupId)],
);

export const groupMembers = pgTable(
  'group_members',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    tier: memberTierEnum('tier').notNull().default('probationary'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    probationEndsAt: timestamp('probation_ends_at', { withTimezone: true }),
    removedAt: timestamp('removed_at', { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.groupId] }),
    index('group_members_group_id_idx').on(table.groupId),
  ],
);

// === Vouching ===

export const vouchRequests = pgTable(
  'vouch_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    requiredVouches: integer('required_vouches').notNull().default(4),
    status: vouchRequestStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('vouch_requests_candidate_group_idx').on(table.candidateId, table.groupId)],
);

export const vouches = pgTable(
  'vouches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    voucherId: uuid('voucher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    judgmentType: judgmentTypeEnum('judgment_type').notNull(),
    judgmentValue: integer('judgment_value').notNull(),
    reasoningCiphertext: text('reasoning_ciphertext').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('vouches_candidate_group_idx').on(table.candidateId, table.groupId)],
);

// === Chats & Messages ===

export const chats = pgTable(
  'chats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    type: chatTypeEnum('type').notNull(),
    pairedChatId: uuid('paired_chat_id').references((): AnyPgColumn => chats.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('chats_group_id_idx').on(table.groupId)],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chatId: uuid('chat_id')
      .notNull()
      .references(() => chats.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ciphertext: text('ciphertext').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    parentMessageId: uuid('parent_message_id').references((): AnyPgColumn => messages.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    index('messages_chat_id_idx').on(table.chatId),
    index('messages_parent_message_id_idx').on(table.parentMessageId),
  ],
);

// === Judgments & Scoring ===

export const judgments = pgTable(
  'judgments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    judgeId: uuid('judge_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: judgmentTypeEnum('type').notNull(),
    value: integer('value').notNull(),
    reasoningCiphertext: text('reasoning_ciphertext').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('judgments_message_id_idx').on(table.messageId),
    uniqueIndex('judgments_message_judge_idx').on(table.messageId, table.judgeId),
    check('judgments_value_range', sql`${table.value} >= 0 AND ${table.value} <= 10`),
  ],
);

export const proposalScores = pgTable('proposal_scores', {
  messageId: uuid('message_id')
    .primaryKey()
    .references(() => messages.id, { onDelete: 'cascade' }),
  greenScore: doublePrecision('green_score').notNull().default(0),
  redScore: doublePrecision('red_score').notNull().default(0),
  judgmentCount: integer('judgment_count').notNull().default(0),
  chainDepth: integer('chain_depth').notNull().default(0),
  lastUpdated: timestamp('last_updated', { withTimezone: true }).notNull().defaultNow(),
});

// === Disputes ===

export const disputes = pgTable(
  'disputes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    challengerId: uuid('challenger_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accusedId: uuid('accused_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    complaintMessageId: uuid('complaint_message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'restrict' }),
    status: disputeStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => [index('disputes_group_id_idx').on(table.groupId)],
);

export const softLocks = pgTable(
  'soft_locks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    disputeId: uuid('dispute_id')
      .notNull()
      .references(() => disputes.id, { onDelete: 'cascade' }),
    lockedAt: timestamp('locked_at', { withTimezone: true }).notNull().defaultNow(),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }),
  },
  (table) => [index('soft_locks_user_id_idx').on(table.userId)],
);

// === Federation ===

export const federationRelationships = pgTable(
  'federation_relationships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupAId: uuid('group_a_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    groupBId: uuid('group_b_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    status: federationStatusEnum('status').notNull().default('connected'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('federation_relationships_groups_idx').on(table.groupAId, table.groupBId),
    check(
      'federation_groups_ordered',
      sql`${table.groupAId} < ${table.groupBId}`,
    ),
  ],
);

export const sharedChats = pgTable('shared_chats', {
  id: uuid('id').primaryKey().defaultRandom(),
  federationRelationshipId: uuid('federation_relationship_id')
    .notNull()
    .references(() => federationRelationships.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
