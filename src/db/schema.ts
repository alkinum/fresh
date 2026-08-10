import { relations, sql } from 'drizzle-orm';
import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
  uniqueIndex
} from 'drizzle-orm/sqlite-core';

// === better-auth ===
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull(),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' })
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
});

export const passkey = sqliteTable("passkey", {
  id: text("id").primaryKey(),
  name: text('name'),
  publicKey: text('public_key').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  credentialID: text('credential_i_d').notNull(),
  counter: integer('counter').notNull(),
  deviceType: text('device_type').notNull(),
  backedUp: integer('backed_up', { mode: 'boolean' }).notNull(),
  transports: text('transports'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  aaguid: text('aaguid')
}, (table) => [
  index('passkey_user_id_idx').on(table.userId),
  index('passkey_credential_id_idx').on(table.credentialID)
]);


// Notes table
export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  renderedContent: text('rendered_content').notNull().default(''),
  date: text('date').notNull(),
  colorIndicator: text('color_indicator').notNull(),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Tags table
export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').notNull(),
  /**
   * This is the last time the note with the tag was modified
   */
  lastNoteModifiedAt: integer('last_note_modified_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex('tags_user_name_unique').on(table.userId, table.name)
]);

// Note-Tag relation (junction table)
export const noteTags = sqliteTable('note_tags', {
  noteId: text('note_id').notNull().references(() => notes.id, { onDelete: 'cascade' }),
  tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.noteId, table.tagId] }),
}));

export const attachments = sqliteTable('attachments', {
  id: text('id').primaryKey(),
  noteId: text('note_id').notNull().references(() => notes.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  r2Key: text('r2_key').notNull().unique(),
  fileName: text('file_name').notNull(),
  mediaType: text('media_type').notNull(),
  kind: text('kind', {
    enum: ['image', 'audio', 'video', 'pdf', 'text', 'document', 'archive', 'other']
  }).notNull(),
  size: integer('size').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => [
  index('attachments_note_id_idx').on(table.noteId),
  index('attachments_user_id_idx').on(table.userId)
]);

export const backupImportReceipts = sqliteTable('backup_import_receipts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  noteCount: integer('note_count').notNull(),
  tagCount: integer('tag_count').notNull(),
  boardCount: integer('board_count').notNull(),
  attachmentCount: integer('attachment_count').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => [
  index('backup_import_receipts_user_id_idx').on(table.userId),
  index('backup_import_receipts_user_created_at_idx').on(table.userId, table.createdAt)
]);

export const kanbanBoards = sqliteTable('kanban_boards', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').notNull(),
  position: integer('position').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => [
  index('kanban_boards_user_id_idx').on(table.userId),
  index('kanban_boards_user_position_idx').on(table.userId, table.position)
]);

export const kanbanColumns = sqliteTable('kanban_columns', {
  id: text('id').primaryKey(),
  boardId: text('board_id').notNull().references(() => kanbanBoards.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  position: integer('position').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => [
  index('kanban_columns_board_position_idx').on(table.boardId, table.position),
  index('kanban_columns_user_id_idx').on(table.userId)
]);

export const kanbanCards = sqliteTable('kanban_cards', {
  id: text('id').primaryKey(),
  boardId: text('board_id').notNull().references(() => kanbanBoards.id, { onDelete: 'cascade' }),
  columnId: text('column_id').notNull().references(() => kanbanColumns.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  position: integer('position').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => [
  index('kanban_cards_column_position_idx').on(table.columnId, table.position),
  index('kanban_cards_board_id_idx').on(table.boardId),
  index('kanban_cards_user_id_idx').on(table.userId)
]);

// Relations configuration
export const noteRelations = relations(notes, ({ many, one }) => ({
  noteTags: many(noteTags),
  attachments: many(attachments),
  user: one(user, {
    fields: [notes.userId],
    references: [user.id],
  }),
}));

export const tagRelations = relations(tags, ({ many, one }) => ({
  noteTags: many(noteTags),
  user: one(user, {
    fields: [tags.userId],
    references: [user.id],
  }),
}));

export const noteTagRelations = relations(noteTags, ({ one }) => ({
  note: one(notes, {
    fields: [noteTags.noteId],
    references: [notes.id],
  }),
  tag: one(tags, {
    fields: [noteTags.tagId],
    references: [tags.id],
  }),
}));

export const attachmentRelations = relations(attachments, ({ one }) => ({
  note: one(notes, {
    fields: [attachments.noteId],
    references: [notes.id],
  }),
  user: one(user, {
    fields: [attachments.userId],
    references: [user.id],
  }),
}));

export const kanbanBoardRelations = relations(kanbanBoards, ({ many, one }) => ({
  columns: many(kanbanColumns),
  cards: many(kanbanCards),
  user: one(user, {
    fields: [kanbanBoards.userId],
    references: [user.id]
  })
}));

export const kanbanColumnRelations = relations(kanbanColumns, ({ many, one }) => ({
  cards: many(kanbanCards),
  board: one(kanbanBoards, {
    fields: [kanbanColumns.boardId],
    references: [kanbanBoards.id]
  }),
  user: one(user, {
    fields: [kanbanColumns.userId],
    references: [user.id]
  })
}));

export const kanbanCardRelations = relations(kanbanCards, ({ one }) => ({
  column: one(kanbanColumns, {
    fields: [kanbanCards.columnId],
    references: [kanbanColumns.id]
  }),
  board: one(kanbanBoards, {
    fields: [kanbanCards.boardId],
    references: [kanbanBoards.id]
  }),
  user: one(user, {
    fields: [kanbanCards.userId],
    references: [user.id]
  })
}));

// User relations
export const userRelations = relations(user, ({ many }) => ({
  notes: many(notes),
  tags: many(tags),
  kanbanBoards: many(kanbanBoards),
  kanbanColumns: many(kanbanColumns),
  kanbanCards: many(kanbanCards),
  sessions: many(session),
  accounts: many(account),
  attachments: many(attachments),
  backupImportReceipts: many(backupImportReceipts),
}));

// Types
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
export type BackupImportReceipt = typeof backupImportReceipts.$inferSelect;
export type NewBackupImportReceipt = typeof backupImportReceipts.$inferInsert;
export type KanbanBoard = typeof kanbanBoards.$inferSelect;
export type NewKanbanBoard = typeof kanbanBoards.$inferInsert;
export type KanbanColumn = typeof kanbanColumns.$inferSelect;
export type NewKanbanColumn = typeof kanbanColumns.$inferInsert;
export type KanbanCard = typeof kanbanCards.$inferSelect;
export type NewKanbanCard = typeof kanbanCards.$inferInsert;
