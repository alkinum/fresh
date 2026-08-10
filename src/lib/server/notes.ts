import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '@/db';
import { attachments, notes, noteTags, tags } from '@/db/schema';
import { attachmentDto, deleteR2Objects, deleteR2Prefix } from '$lib/server/attachments';
import { RequestError } from '$lib/server/http';
import { deriveNoteTitle, extractTags, renderNoteBody } from '$lib/server/markdown';
import type { NoteDto, PaginatedResult, TagDto } from '$lib/types';

const noteColors = ['#4f8cff', '#36b37e', '#f5a524', '#f05d5e', '#a879ff', '#e75b9b'];
const maxNoteRowBytes = 1_500_000;
const encoder = new TextEncoder();

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

async function hydrateNotes(
  db: Database,
  userId: string,
  rows: Array<typeof notes.$inferSelect>
): Promise<NoteDto[]> {
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
      .where(and(inArray(noteTags.noteId, noteIds), eq(tags.userId, userId))),
    db
      .select()
      .from(attachments)
      .where(and(inArray(attachments.noteId, noteIds), eq(attachments.userId, userId)))
      .orderBy(desc(attachments.createdAt))
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

function assertNoteFitsD1(values: unknown[]): void {
  if (encoder.encode(JSON.stringify(values)).byteLength > maxNoteRowBytes) {
    throw new RequestError('Note is too large after Markdown rendering', 413);
  }
}

async function tagSyncStatements(
  db: Database,
  userId: string,
  noteId: string,
  content: string,
  now: number
): Promise<D1PreparedStatement[]> {
  const names = extractTags(content);
  const candidates = names.map((name) => [crypto.randomUUID(), name, tagColor(name)]);

  const statements: D1PreparedStatement[] = [];
  if (candidates.length > 0) {
    statements.push(db.$client.prepare(`
      INSERT OR IGNORE INTO tags (id, user_id, name, color, last_note_modified_at, created_at, updated_at)
      SELECT json_extract(candidate.value, '$[0]'), ?, json_extract(candidate.value, '$[1]'),
        json_extract(candidate.value, '$[2]'), ?, ?, ?
      FROM json_each(?) AS candidate
      WHERE EXISTS (SELECT 1 FROM notes WHERE id = ? AND user_id = ?)
      AND NOT EXISTS (
        SELECT 1 FROM tags
        WHERE user_id = ? AND name = json_extract(candidate.value, '$[1]')
      )
    `).bind(userId, now, now, now, JSON.stringify(candidates), noteId, userId, userId));
  }
  statements.push(db.$client.prepare(`
    DELETE FROM note_tags
    WHERE note_id = ? AND EXISTS (
      SELECT 1 FROM notes WHERE id = ? AND user_id = ?
    )
  `).bind(noteId, noteId, userId));

  if (names.length > 0) {
    statements.push(
      db.$client.prepare(`
        INSERT INTO note_tags (note_id, tag_id)
        SELECT ?, min(tags.id)
        FROM json_each(?) AS requested
        INNER JOIN tags ON tags.user_id = ? AND tags.name = requested.value
        WHERE EXISTS (SELECT 1 FROM notes WHERE id = ? AND user_id = ?)
        GROUP BY requested.value
      `).bind(noteId, JSON.stringify(names), userId, noteId, userId),
      db.$client.prepare(`
        UPDATE tags SET last_note_modified_at = ?, updated_at = ?
        WHERE user_id = ? AND name IN (SELECT value FROM json_each(?))
          AND EXISTS (SELECT 1 FROM notes WHERE id = ? AND user_id = ?)
      `).bind(now, now, userId, JSON.stringify(names), noteId, userId)
    );
  }
  return statements;
}

export async function listNotes(db: Database, options: ListOptions): Promise<PaginatedResult<NoteDto>> {
  const page = Number.isSafeInteger(options.page) && (options.page ?? 0) > 0 ? options.page! : 1;
  const limit = Number.isSafeInteger(options.limit) && (options.limit ?? 0) > 0
    ? Math.min(100, options.limit!)
    : 30;
  const conditions = [eq(notes.userId, options.userId)];

  if (options.favorite !== undefined) conditions.push(eq(notes.isFavorite, options.favorite));
  if (options.tagId) {
    conditions.push(inArray(
      notes.id,
      db
        .select({ id: noteTags.noteId })
        .from(noteTags)
        .innerJoin(tags, eq(noteTags.tagId, tags.id))
        .where(and(eq(noteTags.tagId, options.tagId), eq(tags.userId, options.userId)))
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
    items: await hydrateNotes(db, options.userId, rows),
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
      count: sql<number>`count(${notes.id})`
    })
    .from(tags)
    .leftJoin(noteTags, eq(tags.id, noteTags.tagId))
    .leftJoin(notes, and(eq(noteTags.noteId, notes.id), eq(notes.userId, userId)))
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
  return row ? (await hydrateNotes(db, userId, [row]))[0] : undefined;
}

export async function createNote(db: Database, userId: string, input: NoteInput): Promise<NoteDto> {
  const id = crypto.randomUUID();
  const now = new Date();
  const index = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % noteColors.length;
  const content = input.content.trim();
  const title = deriveNoteTitle(content);
  const renderedContent = renderNoteBody(content);
  const colorIndicator = input.colorIndicator ?? noteColors[index];
  const isFavorite = input.isFavorite ?? false;
  const timestamp = Math.floor(now.getTime() / 1000);
  assertNoteFitsD1([id, userId, title, content, renderedContent, now.toISOString().slice(0, 10), colorIndicator, isFavorite]);
  const tagStatements = await tagSyncStatements(db, userId, id, content, timestamp);

  await db.$client.batch([
    db.$client.prepare(`
      INSERT INTO notes (id, user_id, title, content, rendered_content, date, color_indicator, is_favorite, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      userId,
      title,
      content,
      renderedContent,
      now.toISOString().slice(0, 10),
      colorIndicator,
      isFavorite ? 1 : 0,
      timestamp,
      timestamp
    ),
    ...tagStatements
  ]);

  return (await getNote(db, userId, id))!;
}

export async function updateNote(
  db: Database,
  userId: string,
  id: string,
  input: Partial<NoteInput>
): Promise<NoteDto | undefined> {
  const [existing] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, userId)))
    .limit(1);
  if (!existing) return undefined;

  const content = input.content?.trim();
  const nextContent = content ?? existing.content;
  const nextTitle = content === undefined ? null : deriveNoteTitle(nextContent);
  const nextRenderedContent = content === undefined ? null : renderNoteBody(nextContent);
  const timestamp = Math.floor(Date.now() / 1000);
  if (content !== undefined) {
    assertNoteFitsD1([id, userId, nextTitle, nextContent, nextRenderedContent, existing.date]);
  }
  const statements = content === undefined
    ? []
    : await tagSyncStatements(db, userId, id, nextContent, timestamp);

  await db.$client.batch([
    db.$client.prepare(`
      UPDATE notes
      SET
        title = CASE WHEN ? = 1 THEN ? ELSE title END,
        content = CASE WHEN ? = 1 THEN ? ELSE content END,
        rendered_content = CASE WHEN ? = 1 THEN ? ELSE rendered_content END,
        color_indicator = coalesce(?, color_indicator),
        is_favorite = coalesce(?, is_favorite),
        updated_at = ?
      WHERE id = ? AND user_id = ?
    `).bind(
      content === undefined ? 0 : 1,
      nextTitle,
      content === undefined ? 0 : 1,
      nextContent,
      content === undefined ? 0 : 1,
      nextRenderedContent,
      input.colorIndicator ?? null,
      input.isFavorite === undefined ? null : input.isFavorite ? 1 : 0,
      timestamp,
      id,
      userId
    ),
    ...statements
  ]);
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

  const files = await db
    .select({ key: attachments.r2Key })
    .from(attachments)
    .where(and(eq(attachments.noteId, id), eq(attachments.userId, userId)));
  const deleted = await db.$client
    .prepare('DELETE FROM notes WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run();
  if (Number(deleted.meta.changes ?? 0) === 0) return false;
  const cleanupResults = await Promise.allSettled([
    deleteR2Objects(bucket, files.map((file) => file.key)),
    deleteR2Prefix(bucket, `${userId}/${id}/`)
  ]);
  const cleanupErrors = cleanupResults.filter((result) => result.status === 'rejected');
  if (cleanupErrors.length > 0) {
    console.error(JSON.stringify({
      message: 'could not remove deleted note attachments',
      noteId: id,
      errors: cleanupErrors.map((result) => (
        result.reason instanceof Error ? result.reason.message : String(result.reason)
      ))
    }));
  }
  return true;
}
