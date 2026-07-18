import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '@/db';
import { attachments, notes, noteTags, tags } from '@/db/schema';
import { classifyAttachment, deleteR2Objects, safeFileName } from '$lib/server/attachments';
import { deriveNoteTitle, renderNoteBody } from '$lib/server/markdown';
import type { AttachmentKind, BackupManifest } from '$lib/types';

const dateTime = z.string().datetime();
const attachmentKinds = ['image', 'audio', 'video', 'pdf', 'text', 'document', 'archive', 'other'] as const;

export const backupManifestSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: dateTime,
  profile: z.object({
    name: z.string().max(200),
    email: z.string().email().max(320)
  }),
  notes: z.array(z.object({
    id: z.string().min(1).max(100),
    title: z.string().max(120),
    content: z.string().max(1_000_000),
    date: z.string().max(40),
    colorIndicator: z.string().max(40),
    isFavorite: z.boolean(),
    createdAt: dateTime,
    updatedAt: dateTime
  })).max(20_000),
  tags: z.array(z.object({
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(100),
    color: z.string().max(40),
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
    mediaType: z.string().min(1).max(200),
    kind: z.enum(attachmentKinds),
    size: z.number().int().positive().max(95 * 1024 * 1024),
    createdAt: dateTime,
    url: z.string().max(500)
  })).max(50_000)
}).superRefine((manifest, context) => {
  const noteIds = new Set(manifest.notes.map((note) => note.id));
  const tagIds = new Set(manifest.tags.map((tag) => tag.id));
  for (const relation of manifest.noteTags) {
    if (!noteIds.has(relation.noteId) || !tagIds.has(relation.tagId)) {
      context.addIssue({ code: 'custom', message: 'Backup contains an invalid note/tag relation' });
      break;
    }
  }
  for (const attachment of manifest.attachments) {
    if (!noteIds.has(attachment.noteId)) {
      context.addIssue({ code: 'custom', message: 'Backup contains an attachment without a note' });
      break;
    }
  }
});

export async function createBackupManifest(
  db: Database,
  userId: string,
  profile: { name: string; email: string }
): Promise<BackupManifest> {
  const [noteRows, tagRows, relationRows, attachmentRows] = await Promise.all([
    db.select().from(notes).where(eq(notes.userId, userId)),
    db.select().from(tags).where(eq(tags.userId, userId)),
    db
      .select({ noteId: noteTags.noteId, tagId: noteTags.tagId })
      .from(noteTags)
      .innerJoin(notes, and(eq(noteTags.noteId, notes.id), eq(notes.userId, userId))),
    db.select().from(attachments).where(eq(attachments.userId, userId))
  ]);

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    profile,
    notes: noteRows.map((note) => ({
      id: note.id,
      title: deriveNoteTitle(note.content),
      content: note.content,
      date: note.date,
      colorIndicator: note.colorIndicator,
      isFavorite: note.isFavorite,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString()
    })),
    tags: tagRows.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      createdAt: tag.createdAt.toISOString(),
      updatedAt: tag.updatedAt.toISOString(),
      lastNoteModifiedAt: tag.lastNoteModifiedAt.toISOString()
    })),
    noteTags: relationRows,
    attachments: attachmentRows.map((attachment) => ({
      id: attachment.id,
      noteId: attachment.noteId,
      fileName: attachment.fileName,
      mediaType: attachment.mediaType,
      kind: attachment.kind as AttachmentKind,
      size: attachment.size,
      createdAt: attachment.createdAt.toISOString(),
      url: `/api/attachments/${attachment.id}`
    }))
  };
}

export interface ImportResult {
  notes: number;
  tags: number;
  attachments: Array<{ sourceId: string; id: string; uploadUrl: string }>;
}

export async function importBackup(
  db: Database,
  bucket: R2Bucket,
  userId: string,
  manifest: BackupManifest,
  mode: 'merge' | 'replace'
): Promise<ImportResult> {
  const [oldNotes, oldTags, oldAttachments] = mode === 'replace'
    ? await Promise.all([
        db.select({ id: notes.id }).from(notes).where(eq(notes.userId, userId)),
        db.select({ id: tags.id }).from(tags).where(eq(tags.userId, userId)),
        db.select({ key: attachments.r2Key }).from(attachments).where(eq(attachments.userId, userId))
      ])
    : [[], [], []];

  const noteIdMap = new Map(manifest.notes.map((note) => [note.id, crypto.randomUUID()]));
  const tagIdMap = new Map(manifest.tags.map((tag) => [tag.id, crypto.randomUUID()]));
  const newNoteIds = [...noteIdMap.values()];
  const newTagIds = [...tagIdMap.values()];
  const importedAttachments: ImportResult['attachments'] = [];

  try {
    for (const note of manifest.notes) {
      const id = noteIdMap.get(note.id)!;
      await db.insert(notes).values({
        id,
        userId,
        title: deriveNoteTitle(note.content),
        content: note.content,
        renderedContent: renderNoteBody(note.content),
        date: note.date,
        colorIndicator: note.colorIndicator,
        isFavorite: note.isFavorite,
        createdAt: new Date(note.createdAt),
        updatedAt: new Date(note.updatedAt)
      });
    }

    for (const tag of manifest.tags) {
      await db.insert(tags).values({
        id: tagIdMap.get(tag.id)!,
        userId,
        name: tag.name,
        color: tag.color,
        createdAt: new Date(tag.createdAt),
        updatedAt: new Date(tag.updatedAt),
        lastNoteModifiedAt: new Date(tag.lastNoteModifiedAt)
      });
    }

    if (manifest.noteTags.length > 0) {
      await db.insert(noteTags).values(manifest.noteTags.map((relation) => ({
        noteId: noteIdMap.get(relation.noteId)!,
        tagId: tagIdMap.get(relation.tagId)!
      })));
    }

    for (const attachment of manifest.attachments) {
      const id = crypto.randomUUID();
      const noteId = noteIdMap.get(attachment.noteId)!;
      const fileName = safeFileName(attachment.fileName);
      const r2Key = `${userId}/${noteId}/${id}/${fileName}`;
      await db.insert(attachments).values({
        id,
        noteId,
        userId,
        r2Key,
        fileName,
        mediaType: attachment.mediaType,
        kind: classifyAttachment(attachment.mediaType, fileName),
        size: attachment.size,
        createdAt: new Date(attachment.createdAt)
      });
      importedAttachments.push({
        sourceId: attachment.id,
        id,
        uploadUrl: `/api/backup/attachments/${id}`
      });
    }
  } catch (error) {
    if (newNoteIds.length > 0) await db.delete(notes).where(inArray(notes.id, newNoteIds));
    if (newTagIds.length > 0) await db.delete(tags).where(inArray(tags.id, newTagIds));
    throw error;
  }

  if (mode === 'replace') {
    if (oldNotes.length > 0) await db.delete(notes).where(inArray(notes.id, oldNotes.map((note) => note.id)));
    if (oldTags.length > 0) await db.delete(tags).where(inArray(tags.id, oldTags.map((tag) => tag.id)));
    await deleteR2Objects(bucket, oldAttachments.map((attachment) => attachment.key));
  }

  return {
    notes: manifest.notes.length,
    tags: manifest.tags.length,
    attachments: importedAttachments
  };
}
