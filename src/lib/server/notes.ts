import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '@/db';
import { attachments, notes, noteTags, tags } from '@/db/schema';
import { attachmentDto, deleteR2Objects } from '$lib/server/attachments';
import { deriveNoteTitle, extractTags, renderNoteBody } from '$lib/server/markdown';
import type { NoteDto, PaginatedResult, TagDto } from '$lib/types';

const noteColors = ['#4f8cff', '#36b37e', '#f5a524', '#f05d5e', '#a879ff', '#e75b9b'];

interface ListOptions {
  userId: string;
  page?: number;
  limit?: number;
  tagId?: string;
  favorite?: boolean;
}

interface NoteInput {
  content: string;
  colorIndicator?: string;
  isFavorite?: boolean;
}

function tagColor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue} 58% 64%)`;
}

async function hydrateNotes(db: Database, rows: Array<typeof notes.$inferSelect>): Promise<NoteDto[]> {
  if (rows.length === 0) return [];
  const noteIds = rows.map((note) => note.id);

  const [tagRows, attachmentRows] = await Promise.all([
    db
      .select({
        noteId: noteTags.noteId,
        id: tags.id,
        name: tags.name,
        color: tags.color,
        createdAt: tags.createdAt,
        updatedAt: tags.updatedAt
      })
      .from(noteTags)
      .innerJoin(tags, eq(noteTags.tagId, tags.id))
      .where(inArray(noteTags.noteId, noteIds)),
    db.select().from(attachments).where(inArray(attachments.noteId, noteIds)).orderBy(desc(attachments.createdAt))
  ]);

  const tagsByNote = new Map<string, TagDto[]>();
  for (const tag of tagRows) {
    const list = tagsByNote.get(tag.noteId) ?? [];
    list.push({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      count: 0,
      createdAt: tag.createdAt.toISOString(),
      updatedAt: tag.updatedAt.toISOString()
    });
    tagsByNote.set(tag.noteId, list);
  }

  const attachmentsByNote = new Map<string, ReturnType<typeof attachmentDto>[]>();
  for (const attachment of attachmentRows) {
    const list = attachmentsByNote.get(attachment.noteId) ?? [];
    list.push(attachmentDto(attachment));
    attachmentsByNote.set(attachment.noteId, list);
  }

  return rows.map((note) => ({
    id: note.id,
    title: deriveNoteTitle(note.content),
    content: note.content,
    renderedContent: renderNoteBody(note.content),
    date: note.date,
    colorIndicator: note.colorIndicator,
    isFavorite: note.isFavorite,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    tags: tagsByNote.get(note.id) ?? [],
    attachments: attachmentsByNote.get(note.id) ?? []
  }));
}

async function syncTags(db: Database, userId: string, noteId: string, content: string): Promise<void> {
  const names = extractTags(content);
  const existing = names.length === 0
    ? []
    : await db.select().from(tags).where(and(eq(tags.userId, userId), inArray(tags.name, names)));

  const byName = new Map(existing.map((tag) => [tag.name, tag]));
  for (const name of names) {
    if (byName.has(name)) continue;
    const [created] = await db.insert(tags).values({
      id: crypto.randomUUID(),
      userId,
      name,
      color: tagColor(name),
      lastNoteModifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    byName.set(name, created);
  }

  await db.delete(noteTags).where(eq(noteTags.noteId, noteId));
  if (names.length > 0) {
    await db.insert(noteTags).values(names.map((name) => ({ noteId, tagId: byName.get(name)!.id })));
    await db
      .update(tags)
      .set({ lastNoteModifiedAt: new Date(), updatedAt: new Date() })
      .where(inArray(tags.id, names.map((name) => byName.get(name)!.id)));
  }
}

export async function listNotes(db: Database, options: ListOptions): Promise<PaginatedResult<NoteDto>> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 30));
  const conditions = [eq(notes.userId, options.userId)];

  if (options.favorite !== undefined) conditions.push(eq(notes.isFavorite, options.favorite));
  if (options.tagId) {
    conditions.push(inArray(
      notes.id,
      db.select({ id: noteTags.noteId }).from(noteTags).where(eq(noteTags.tagId, options.tagId))
    ));
  }

  const where = and(...conditions);
  const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(notes).where(where);
  const totalItems = Number(countRow?.count ?? 0);
  const rows = await db
    .select()
    .from(notes)
    .where(where)
    .orderBy(desc(notes.isFavorite), desc(notes.updatedAt))
    .limit(limit)
    .offset((page - 1) * limit);

  return {
    items: await hydrateNotes(db, rows),
    totalItems,
    totalPages: Math.ceil(totalItems / limit),
    currentPage: page
  };
}

export async function listTags(db: Database, userId: string): Promise<TagDto[]> {
  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
      createdAt: tags.createdAt,
      updatedAt: tags.updatedAt,
      count: sql<number>`count(${noteTags.noteId})`
    })
    .from(tags)
    .leftJoin(noteTags, eq(tags.id, noteTags.tagId))
    .where(eq(tags.userId, userId))
    .groupBy(tags.id)
    .orderBy(desc(tags.lastNoteModifiedAt));

  return rows.map((tag) => ({
    ...tag,
    count: Number(tag.count),
    createdAt: tag.createdAt.toISOString(),
    updatedAt: tag.updatedAt.toISOString()
  }));
}

export async function getNote(db: Database, userId: string, id: string): Promise<NoteDto | undefined> {
  const [row] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, userId)))
    .limit(1);
  return row ? (await hydrateNotes(db, [row]))[0] : undefined;
}

export async function createNote(db: Database, userId: string, input: NoteInput): Promise<NoteDto> {
  const id = crypto.randomUUID();
  const now = new Date();
  const index = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % noteColors.length;
  const content = input.content.trim();

  await db.insert(notes).values({
    id,
    userId,
    title: deriveNoteTitle(content),
    content,
    renderedContent: renderNoteBody(content),
    date: now.toISOString().slice(0, 10),
    colorIndicator: input.colorIndicator ?? noteColors[index],
    isFavorite: input.isFavorite ?? false,
    createdAt: now,
    updatedAt: now
  });
  await syncTags(db, userId, id, content);

  return (await getNote(db, userId, id))!;
}

export async function updateNote(
  db: Database,
  userId: string,
  id: string,
  input: Partial<NoteInput>
): Promise<NoteDto | undefined> {
  const existing = await getNote(db, userId, id);
  if (!existing) return undefined;

  const content = input.content?.trim();
  await db
    .update(notes)
    .set({
      ...(content !== undefined ? {
        title: deriveNoteTitle(content),
        content,
        renderedContent: renderNoteBody(content)
      } : {}),
      ...(input.colorIndicator !== undefined ? { colorIndicator: input.colorIndicator } : {}),
      ...(input.isFavorite !== undefined ? { isFavorite: input.isFavorite } : {}),
      updatedAt: new Date()
    })
    .where(and(eq(notes.id, id), eq(notes.userId, userId)));

  if (content !== undefined) await syncTags(db, userId, id, content);
  return getNote(db, userId, id);
}

export async function deleteNote(
  db: Database,
  bucket: R2Bucket,
  userId: string,
  id: string
): Promise<boolean> {
  const [owned] = await db
    .select({ id: notes.id })
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, userId)))
    .limit(1);
  if (!owned) return false;

  const files = await db.select({ key: attachments.r2Key }).from(attachments).where(eq(attachments.noteId, id));
  await deleteR2Objects(bucket, files.map((file) => file.key));
  await db.delete(notes).where(and(eq(notes.id, id), eq(notes.userId, userId)));
  return true;
}
