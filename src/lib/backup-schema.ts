import { z } from 'zod';
import { MAX_NOTE_CONTENT_CHARACTERS } from '$lib/note-limits';

export const MAX_BACKUP_MANIFEST_BYTES = 10 * 1024 * 1024;
export const MAX_BACKUP_ATTACHMENTS = 500;
export const MAX_BACKUP_FILE_BYTES = 512 * 1024 * 1024;
export const MAX_BACKUP_ATTACHMENT_BYTES = 501 * 1024 * 1024;

const dateTime = z.string().datetime();
const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, 'Color must use six-digit hex notation');
const mediaType = z.string().min(1).max(200).regex(
  /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i,
  'Invalid attachment media type'
);
const attachmentKinds = ['image', 'audio', 'video', 'pdf', 'text', 'document', 'archive', 'other'] as const;

const tagColor = z.string().max(40).refine((value) => {
  if (/^#[0-9a-f]{6}$/i.test(value)) return true;
  const match = value.match(/^hsl\((\d{1,3}) 58% 64%\)$/);
  return Boolean(match && Number(match[1]) <= 359);
}, 'Invalid tag color');

const manifestBaseSchema = z.object({
  exportedAt: dateTime,
  profile: z.object({
    name: z.string().max(200),
    email: z.string().email().max(320)
  }),
  notes: z.array(z.object({
    id: z.string().min(1).max(100),
    title: z.string().max(120),
    content: z.string().max(MAX_NOTE_CONTENT_CHARACTERS),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    colorIndicator: hexColor,
    isFavorite: z.boolean(),
    createdAt: dateTime,
    updatedAt: dateTime
  })).max(20_000),
  tags: z.array(z.object({
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(100),
    color: tagColor,
    createdAt: dateTime,
    updatedAt: dateTime,
    lastNoteModifiedAt: dateTime
  })).max(20_000),
  noteTags: z.array(z.object({
    noteId: z.string().min(1).max(100),
    tagId: z.string().min(1).max(100)
  })).max(100_000),
  attachments: z.array(z.object({
    id: z.string().min(1).max(100),
    noteId: z.string().min(1).max(100),
    fileName: z.string().min(1).max(255),
    mediaType,
    kind: z.enum(attachmentKinds),
    size: z.number().int().positive().max(95 * 1024 * 1024),
    createdAt: dateTime,
    url: z.string().max(500)
  })).max(MAX_BACKUP_ATTACHMENTS)
});

const kanbanBoardSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(80),
  color: hexColor,
  position: z.number().int().nonnegative().max(1000),
  createdAt: dateTime,
  updatedAt: dateTime
});

const kanbanColumnSchema = z.object({
  id: z.string().min(1).max(100),
  boardId: z.string().min(1).max(100),
  name: z.string().min(1).max(60),
  position: z.number().int().nonnegative().max(1000),
  createdAt: dateTime,
  updatedAt: dateTime
});

const kanbanCardSchema = z.object({
  id: z.string().min(1).max(100),
  boardId: z.string().min(1).max(100),
  columnId: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  description: z.string().max(10_000),
  position: z.number().int().nonnegative().max(10_000),
  createdAt: dateTime,
  updatedAt: dateTime
});

const legacyManifestSchema = manifestBaseSchema.extend({ schemaVersion: z.literal(1) });
const kanbanManifestSchema = manifestBaseSchema.extend({
  schemaVersion: z.literal(2),
  kanbanBoards: z.array(kanbanBoardSchema).max(30),
  kanbanColumns: z.array(kanbanColumnSchema).max(360),
  kanbanCards: z.array(kanbanCardSchema).max(15_000)
});

function uniqueIds(ids: string[], label: string, context: z.RefinementCtx): Set<string> {
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    context.addIssue({ code: 'custom', message: `Backup contains duplicate ${label} IDs` });
  }
  return unique;
}

export const backupManifestSchema = z.union([legacyManifestSchema, kanbanManifestSchema]).superRefine((manifest, context) => {
  const noteIds = uniqueIds(manifest.notes.map((note) => note.id), 'note', context);
  const tagIds = uniqueIds(manifest.tags.map((tag) => tag.id), 'tag', context);
  const tagNames = new Set(manifest.tags.map((tag) => tag.name));
  if (tagNames.size !== manifest.tags.length) {
    context.addIssue({ code: 'custom', message: 'Backup contains duplicate tag names' });
  }
  uniqueIds(manifest.attachments.map((attachment) => attachment.id), 'attachment', context);

  const relationKeys = new Set<string>();
  for (const relation of manifest.noteTags) {
    if (!noteIds.has(relation.noteId) || !tagIds.has(relation.tagId)) {
      context.addIssue({ code: 'custom', message: 'Backup contains an invalid note/tag relation' });
      break;
    }
    const key = `${relation.noteId}\u0000${relation.tagId}`;
    if (relationKeys.has(key)) {
      context.addIssue({ code: 'custom', message: 'Backup contains duplicate note/tag relations' });
      break;
    }
    relationKeys.add(key);
  }

  for (const attachment of manifest.attachments) {
    if (!noteIds.has(attachment.noteId)) {
      context.addIssue({ code: 'custom', message: 'Backup contains an attachment without a note' });
      break;
    }
  }

  const attachmentBytes = manifest.attachments.reduce((total, attachment) => total + attachment.size, 0);
  if (attachmentBytes > MAX_BACKUP_ATTACHMENT_BYTES) {
    context.addIssue({
      code: 'custom',
      message: 'Backup attachments exceed the 501 MiB aggregate limit'
    });
  }

  if (manifest.schemaVersion !== 2) return;

  const boardIds = uniqueIds(manifest.kanbanBoards.map((board) => board.id), 'board', context);
  const columnIds = uniqueIds(manifest.kanbanColumns.map((column) => column.id), 'column', context);
  uniqueIds(manifest.kanbanCards.map((card) => card.id), 'card', context);
  const columnsById = new Map(manifest.kanbanColumns.map((column) => [column.id, column]));
  const columnCounts = new Map<string, number>();
  const cardCounts = new Map<string, number>();

  for (const column of manifest.kanbanColumns) {
    if (!boardIds.has(column.boardId)) {
      context.addIssue({ code: 'custom', message: 'Backup contains a column without a board' });
      break;
    }
    const count = (columnCounts.get(column.boardId) ?? 0) + 1;
    columnCounts.set(column.boardId, count);
    if (count > 12) {
      context.addIssue({ code: 'custom', message: 'A restored board cannot contain more than 12 columns' });
      break;
    }
  }

  for (const card of manifest.kanbanCards) {
    const column = columnsById.get(card.columnId);
    if (!boardIds.has(card.boardId) || !columnIds.has(card.columnId)) {
      context.addIssue({ code: 'custom', message: 'Backup contains a card without a board or column' });
      break;
    }
    if (column?.boardId !== card.boardId) {
      context.addIssue({ code: 'custom', message: 'Backup contains a card with mismatched board ownership' });
      break;
    }
    const count = (cardCounts.get(card.boardId) ?? 0) + 1;
    cardCounts.set(card.boardId, count);
    if (count > 500) {
      context.addIssue({ code: 'custom', message: 'A restored board cannot contain more than 500 cards' });
      break;
    }
  }
});

export function backupManifestByteLength(manifest: unknown): number {
  return new TextEncoder().encode(JSON.stringify(manifest)).byteLength;
}
