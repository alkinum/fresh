import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '@/db';
import {
  attachments,
  kanbanBoards,
  kanbanCards,
  kanbanColumns,
  notes,
  noteTags,
  tags
} from '@/db/schema';
import {
  backupManifestByteLength,
  MAX_BACKUP_MANIFEST_BYTES
} from '$lib/backup-schema';
import {
  classifyAttachment,
  deleteR2Objects,
  normalizeMediaType,
  safeFileName
} from '$lib/server/attachments';
import { RequestError } from '$lib/server/http';
import { deriveNoteTitle, renderNoteBody } from '$lib/server/markdown';
import { putSizedObject } from '$lib/server/r2-upload';
import type { AttachmentKind, BackupManifest, KanbanBackupManifest } from '$lib/types';

const maxBoards = 30;
const maxActiveImportSessions = 3;
const importSessionTtlMs = 60 * 60 * 1000;
const importOperationLeaseMs = 5 * 60 * 1000;
const importReceiptRetentionSeconds = 30 * 24 * 60 * 60;
const maxPreparedSessionBytes = 32 * 1024 * 1024;
const maxJsonBindingBytes = 1_500_000;
const maxImportBatchStatements = 40;
const encoder = new TextEncoder();

const attachmentKinds = ['image', 'audio', 'video', 'pdf', 'text', 'document', 'archive', 'other'] as const;
const preparedNoteRowSchema = z.tuple([
  z.string(), z.string(), z.string(), z.string(), z.string(), z.string(), z.number().int(), z.number().int(), z.number().int()
]);
const preparedTagRowSchema = z.tuple([
  z.string(), z.string(), z.string(), z.number().int(), z.number().int(), z.number().int()
]);
const preparedRelationRowSchema = z.tuple([z.string(), z.string()]);
const preparedBoardRowSchema = z.tuple([
  z.string(), z.string(), z.string(), z.number().int(), z.number().int(), z.number().int()
]);
const preparedColumnRowSchema = z.tuple([
  z.string(), z.string(), z.string(), z.number().int(), z.number().int(), z.number().int()
]);
const preparedCardRowSchema = z.tuple([
  z.string(), z.string(), z.string(), z.string(), z.string(), z.number().int(), z.number().int(), z.number().int()
]);
const preparedAttachmentRowSchema = z.tuple([
  z.string(), z.string(), z.string(), z.string(), z.string(), z.string(), z.enum(attachmentKinds), z.number().int().positive(), z.number().int()
]);

const preparedBackupImportSchema = z.object({
  version: z.literal(2),
  importId: z.string().uuid(),
  mode: z.enum(['merge', 'replace']),
  phase: z.enum(['prepared', 'finalize', 'cleaning']).default('prepared'),
  operationId: z.string().uuid().default('00000000-0000-4000-8000-000000000000'),
  phaseChangedAt: z.string().datetime().default('1970-01-01T00:00:00.000Z'),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  notes: z.array(preparedNoteRowSchema).max(20_000),
  tags: z.array(preparedTagRowSchema).max(20_000),
  noteTags: z.array(preparedRelationRowSchema).max(100_000),
  boards: z.array(preparedBoardRowSchema).max(30),
  columns: z.array(preparedColumnRowSchema).max(360),
  cards: z.array(preparedCardRowSchema).max(15_000),
  attachments: z.array(preparedAttachmentRowSchema).max(500)
});

type PreparedBackupImport = z.infer<typeof preparedBackupImportSchema>;
type JsonRow = readonly unknown[];

interface StoredPreparedBackupImport {
  session: PreparedBackupImport;
  etag: string;
}

export interface PrepareImportResult {
  importId: string;
  notes: number;
  tags: number;
  boards: number;
  attachments: Array<{ sourceId: string; id: string; uploadUrl: string }>;
  finalizeUrl: string;
}

export interface ImportResult {
  notes: number;
  tags: number;
  boards: number;
  attachments: number;
}

function timestamp(value: string): number {
  return Math.floor(new Date(value).getTime() / 1000);
}

function importPrefix(userId: string, importId: string): string {
  return `${userId}/backup-imports/${importId}`;
}

function importSessionPrefix(userId: string): string {
  return `${userId}/backup-import-sessions/`;
}

function importSessionKey(userId: string, importId: string): string {
  return `${importSessionPrefix(userId)}${importId}.json`;
}

function importFileKey(userId: string, importId: string, index: number): string {
  return `${importPrefix(userId, importId)}/files/${index}`;
}

function jsonChunks(rows: JsonRow[], label: string): string[] {
  const chunks: string[] = [];
  let entries: string[] = [];
  let byteLength = 2;

  const flush = (): void => {
    if (entries.length === 0) return;
    chunks.push(`[${entries.join(',')}]`);
    entries = [];
    byteLength = 2;
  };

  for (const row of rows) {
    const serialized = JSON.stringify(row);
    const rowBytes = encoder.encode(serialized).byteLength;
    if (rowBytes + 2 > maxJsonBindingBytes) {
      throw new RequestError(`${label} contains a record that exceeds the D1 row limit`, 413);
    }
    const separatorBytes = entries.length > 0 ? 1 : 0;
    if (byteLength + separatorBytes + rowBytes > maxJsonBindingBytes) flush();
    entries.push(serialized);
    byteLength += separatorBytes + rowBytes;
  }
  flush();
  return chunks;
}

function plannedBatchStatementCount(session: PreparedBackupImport): number {
  return 1
    + (session.mode === 'replace' ? 3 : 0)
    + jsonChunks(session.notes, 'Notes').length
    + jsonChunks(session.tags, 'Tags').length
    + jsonChunks(session.noteTags, 'Note tags').length
    + jsonChunks(session.boards, 'Boards').length
    + jsonChunks(session.columns, 'Columns').length
    + jsonChunks(session.cards, 'Cards').length
    + jsonChunks(session.attachments, 'Attachments').length;
}

function assertImportFitsD1(session: PreparedBackupImport): void {
  if (plannedBatchStatementCount(session) > maxImportBatchStatements) {
    throw new RequestError('Backup contains too many records for one atomic D1 import', 413);
  }
}

function importCounts(session: PreparedBackupImport): ImportResult {
  return {
    notes: session.notes.length,
    tags: session.tags.length,
    boards: session.boards.length,
    attachments: session.attachments.length
  };
}

async function readImportReceipt(
  d1: D1Database,
  userId: string,
  importId: string
): Promise<ImportResult | undefined> {
  const receipt = await d1.prepare(`
    SELECT note_count AS notes, tag_count AS tags, board_count AS boards, attachment_count AS attachments
    FROM backup_import_receipts
    WHERE id = ? AND user_id = ?
    LIMIT 1
  `).bind(importId, userId).first<ImportResult>();
  return receipt ?? undefined;
}

async function pruneExpiredImportSessions(
  d1: D1Database,
  bucket: R2Bucket,
  userId: string
): Promise<void> {
  let cursor: string | undefined;
  let activeSessions = 0;

  do {
    const listed = await bucket.list({
      prefix: importSessionPrefix(userId),
      cursor,
      limit: 1000,
      include: ['customMetadata']
    });
    for (const object of listed.objects) {
      const importId = object.key.slice(importSessionPrefix(userId).length, -'.json'.length);
      const expiredAt = Date.parse(object.customMetadata?.expiresAt ?? '');
      const expired = Number.isFinite(expiredAt)
        ? expiredAt <= Date.now()
        : object.uploaded.getTime() + importSessionTtlMs <= Date.now();
      if (expired) {
        try {
          await cleanupPreparedBackupImport(d1, bucket, userId, importId);
        } catch (error) {
          if (error instanceof RequestError && error.status === 409) activeSessions += 1;
          else throw error;
        }
      } else activeSessions += 1;
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  // A receipt protects finalized attachment objects if deleting the R2 session previously failed.
  await d1.prepare(`
    DELETE FROM backup_import_receipts
    WHERE user_id = ? AND created_at < ?
  `).bind(userId, Math.floor(Date.now() / 1000) - importReceiptRetentionSeconds).run();

  if (activeSessions >= maxActiveImportSessions) {
    throw new RequestError('Too many backup imports are already being prepared; cancel one or wait for it to expire', 409);
  }
}

export async function createBackupManifest(
  db: Database,
  userId: string,
  profile: { name: string; email: string }
): Promise<BackupManifest> {
  const [noteRows, tagRows, relationRows, attachmentRows, boardRows, columnRows, cardRows] = await Promise.all([
    db.select().from(notes).where(eq(notes.userId, userId)),
    db.select().from(tags).where(eq(tags.userId, userId)),
    db
      .select({ noteId: noteTags.noteId, tagId: noteTags.tagId })
      .from(noteTags)
      .innerJoin(notes, and(eq(noteTags.noteId, notes.id), eq(notes.userId, userId)))
      .innerJoin(tags, and(eq(noteTags.tagId, tags.id), eq(tags.userId, userId))),
    db
      .select()
      .from(attachments)
      .where(and(
        eq(attachments.userId, userId),
        inArray(
          attachments.noteId,
          db.select({ id: notes.id }).from(notes).where(eq(notes.userId, userId))
        )
      )),
    db.select().from(kanbanBoards).where(eq(kanbanBoards.userId, userId)),
    db
      .select()
      .from(kanbanColumns)
      .where(and(
        eq(kanbanColumns.userId, userId),
        inArray(
          kanbanColumns.boardId,
          db.select({ id: kanbanBoards.id }).from(kanbanBoards).where(eq(kanbanBoards.userId, userId))
        )
      )),
    db
      .select()
      .from(kanbanCards)
      .where(and(
        eq(kanbanCards.userId, userId),
        inArray(
          kanbanCards.boardId,
          db.select({ id: kanbanBoards.id }).from(kanbanBoards).where(eq(kanbanBoards.userId, userId))
        ),
        inArray(
          kanbanCards.columnId,
          db.select({ id: kanbanColumns.id }).from(kanbanColumns).where(eq(kanbanColumns.userId, userId))
        )
      ))
  ]);

  const manifest = {
    schemaVersion: 2,
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
      mediaType: normalizeMediaType(attachment.mediaType),
      kind: attachment.kind as AttachmentKind,
      size: attachment.size,
      createdAt: attachment.createdAt.toISOString(),
      url: `/api/attachments/${attachment.id}`
    })),
    kanbanBoards: boardRows.map((board) => ({
      id: board.id,
      name: board.name,
      color: board.color,
      position: board.position,
      createdAt: board.createdAt.toISOString(),
      updatedAt: board.updatedAt.toISOString()
    })),
    kanbanColumns: columnRows.map((column) => ({
      id: column.id,
      boardId: column.boardId,
      name: column.name,
      position: column.position,
      createdAt: column.createdAt.toISOString(),
      updatedAt: column.updatedAt.toISOString()
    })),
    kanbanCards: cardRows.map((card) => ({
      id: card.id,
      boardId: card.boardId,
      columnId: card.columnId,
      title: card.title,
      description: card.description,
      position: card.position,
      createdAt: card.createdAt.toISOString(),
      updatedAt: card.updatedAt.toISOString()
    }))
  } satisfies KanbanBackupManifest;

  if (backupManifestByteLength(manifest) > MAX_BACKUP_MANIFEST_BYTES) {
    throw new RequestError('Backup manifest exceeds the 10 MiB export limit', 413);
  }
  return manifest;
}

async function assertBoardCapacity(db: Database, userId: string, importedBoards: number): Promise<void> {
  if (importedBoards === 0) return;
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(kanbanBoards)
    .where(eq(kanbanBoards.userId, userId));
  if (Number(row?.count ?? 0) + importedBoards > maxBoards) {
    throw new RequestError(`A workspace can contain up to ${maxBoards} boards`, 409);
  }
}

function createPreparedSession(
  userId: string,
  manifest: BackupManifest,
  mode: 'merge' | 'replace'
): PreparedBackupImport {
  const importId = crypto.randomUUID();
  const now = new Date();
  const noteIdMap = new Map(manifest.notes.map((note) => [note.id, crypto.randomUUID()]));
  const tagIdMap = new Map(manifest.tags.map((tag) => [tag.id, crypto.randomUUID()]));
  const tagNameMap = new Map(manifest.tags.map((tag) => [tag.id, tag.name]));
  const sourceBoards = manifest.schemaVersion === 2 ? manifest.kanbanBoards : [];
  const sourceColumns = manifest.schemaVersion === 2 ? manifest.kanbanColumns : [];
  const sourceCards = manifest.schemaVersion === 2 ? manifest.kanbanCards : [];
  const boardIdMap = new Map(sourceBoards.map((board) => [board.id, crypto.randomUUID()]));
  const columnIdMap = new Map(sourceColumns.map((column) => [column.id, crypto.randomUUID()]));

  return {
    version: 2,
    importId,
    mode,
    phase: 'prepared',
    operationId: crypto.randomUUID(),
    phaseChangedAt: now.toISOString(),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + importSessionTtlMs).toISOString(),
    notes: manifest.notes.map((note) => {
      const content = note.content.trim();
      return [
        noteIdMap.get(note.id)!,
        deriveNoteTitle(content),
        content,
        renderNoteBody(content),
        note.date,
        note.colorIndicator,
        note.isFavorite ? 1 : 0,
        timestamp(note.createdAt),
        timestamp(note.updatedAt)
      ];
    }),
    tags: manifest.tags.map((tag) => [
      tagIdMap.get(tag.id)!,
      tag.name,
      tag.color,
      timestamp(tag.lastNoteModifiedAt),
      timestamp(tag.createdAt),
      timestamp(tag.updatedAt)
    ]),
    noteTags: manifest.noteTags.map((relation) => [
      noteIdMap.get(relation.noteId)!,
      tagNameMap.get(relation.tagId)!
    ]),
    boards: sourceBoards.map((board) => [
      boardIdMap.get(board.id)!,
      board.name,
      board.color,
      board.position,
      timestamp(board.createdAt),
      timestamp(board.updatedAt)
    ]),
    columns: sourceColumns.map((column) => [
      columnIdMap.get(column.id)!,
      boardIdMap.get(column.boardId)!,
      column.name,
      column.position,
      timestamp(column.createdAt),
      timestamp(column.updatedAt)
    ]),
    cards: sourceCards.map((card) => [
      crypto.randomUUID(),
      boardIdMap.get(card.boardId)!,
      columnIdMap.get(card.columnId)!,
      card.title,
      card.description,
      card.position,
      timestamp(card.createdAt),
      timestamp(card.updatedAt)
    ]),
    attachments: manifest.attachments.map((attachment, index) => {
      const id = crypto.randomUUID();
      const noteId = noteIdMap.get(attachment.noteId)!;
      const fileName = safeFileName(attachment.fileName);
      const mediaType = normalizeMediaType(attachment.mediaType);
      return [
        attachment.id,
        id,
        noteId,
        importFileKey(userId, importId, index),
        fileName,
        mediaType,
        classifyAttachment(mediaType, fileName),
        attachment.size,
        timestamp(attachment.createdAt)
      ];
    })
  };
}

export async function prepareBackupImport(
  db: Database,
  bucket: R2Bucket,
  userId: string,
  manifest: BackupManifest,
  mode: 'merge' | 'replace'
): Promise<PrepareImportResult> {
  if (backupManifestByteLength(manifest) > MAX_BACKUP_MANIFEST_BYTES) {
    throw new RequestError('Backup manifest exceeds the 10 MiB import limit', 413);
  }

  await pruneExpiredImportSessions(db.$client, bucket, userId);

  const boardCount = manifest.schemaVersion === 2 ? manifest.kanbanBoards.length : 0;
  if (mode === 'merge') await assertBoardCapacity(db, userId, boardCount);

  const session = createPreparedSession(userId, manifest, mode);
  assertImportFitsD1(session);
  const serialized = JSON.stringify(session);
  if (encoder.encode(serialized).byteLength > maxPreparedSessionBytes) {
    throw new RequestError('Backup expands beyond the 32 MiB restore preparation limit', 413);
  }

  await bucket.put(importSessionKey(userId, session.importId), serialized, {
    httpMetadata: { contentType: 'application/json' },
    customMetadata: { userId, expiresAt: session.expiresAt }
  });

  return {
    importId: session.importId,
    notes: session.notes.length,
    tags: session.tags.length,
    boards: session.boards.length,
    attachments: session.attachments.map((attachment, index) => ({
      sourceId: attachment[0],
      id: attachment[1],
      uploadUrl: `/api/backup/imports/${session.importId}/attachments/${index}`
    })),
    finalizeUrl: `/api/backup/imports/${session.importId}`
  };
}

async function readStoredPreparedSession(
  bucket: R2Bucket,
  userId: string,
  importId: string
): Promise<StoredPreparedBackupImport> {
  const object = await bucket.get(importSessionKey(userId, importId));
  if (!object) throw new RequestError('Backup import session not found', 404);
  if (object.size > maxPreparedSessionBytes + 1024) {
    throw new RequestError('Backup import session is damaged', 409);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await object.text());
  } catch {
    throw new RequestError('Backup import session is damaged', 409);
  }
  const result = preparedBackupImportSchema.safeParse(parsed);
  if (!result.success || result.data.importId !== importId) {
    throw new RequestError('Backup import session is damaged', 409);
  }
  return { session: result.data, etag: object.etag };
}

async function writePreparedSessionPhase(
  bucket: R2Bucket,
  userId: string,
  stored: StoredPreparedBackupImport,
  phase: PreparedBackupImport['phase']
): Promise<StoredPreparedBackupImport | undefined> {
  const session: PreparedBackupImport = {
    ...stored.session,
    phase,
    operationId: crypto.randomUUID(),
    phaseChangedAt: new Date().toISOString()
  };
  const object = await bucket.put(
    importSessionKey(userId, session.importId),
    JSON.stringify(session),
    {
      onlyIf: { etagMatches: stored.etag },
      httpMetadata: { contentType: 'application/json' },
      customMetadata: { userId, expiresAt: session.expiresAt }
    }
  );
  return object ? { session, etag: object.etag } : undefined;
}

function phaseLeaseIsActive(session: PreparedBackupImport): boolean {
  return Date.parse(session.phaseChangedAt) + importOperationLeaseMs > Date.now();
}

async function claimBackupFinalization(
  bucket: R2Bucket,
  userId: string,
  importId: string
): Promise<StoredPreparedBackupImport> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const stored = await readStoredPreparedSession(bucket, userId, importId);
    const { session } = stored;
    if (Date.parse(session.expiresAt) <= Date.now()) {
      throw new RequestError('Backup import session expired; start the import again', 410);
    }
    if (session.phase === 'cleaning') {
      throw new RequestError('Backup import is being canceled', 409);
    }
    if (session.phase === 'finalize' && phaseLeaseIsActive(session)) {
      throw new RequestError('Backup import is already being finalized; retry shortly', 503);
    }

    const claimed = await writePreparedSessionPhase(bucket, userId, stored, 'finalize');
    if (claimed) return claimed;
  }
  throw new RequestError('Backup import state changed; retry the request', 409);
}

async function releaseBackupFinalization(
  bucket: R2Bucket,
  userId: string,
  claimed: StoredPreparedBackupImport
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let stored: StoredPreparedBackupImport;
    try {
      stored = await readStoredPreparedSession(bucket, userId, claimed.session.importId);
    } catch (error) {
      if (error instanceof RequestError && error.status === 404) return;
      throw error;
    }
    if (stored.session.phase !== 'finalize' || stored.session.operationId !== claimed.session.operationId) return;
    if (await writePreparedSessionPhase(bucket, userId, stored, 'prepared')) return;
  }
}

async function readPreparedSession(
  d1: D1Database,
  bucket: R2Bucket,
  userId: string,
  importId: string
): Promise<PreparedBackupImport> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const stored = await readStoredPreparedSession(bucket, userId, importId);
    if (Date.parse(stored.session.expiresAt) <= Date.now()) {
      await cleanupPreparedBackupImport(d1, bucket, userId, importId).catch(() => undefined);
      throw new RequestError('Backup import session expired; start the import again', 410);
    }
    if (stored.session.phase === 'finalize') {
      if (phaseLeaseIsActive(stored.session)) {
        throw new RequestError('Backup import is being finalized', 409);
      }
      if (await writePreparedSessionPhase(bucket, userId, stored, 'prepared')) continue;
      continue;
    }
    if (stored.session.phase === 'cleaning') {
      throw new RequestError('Backup import is being canceled', 409);
    }
    return stored.session;
  }
  throw new RequestError('Backup import state changed; retry the request', 409);
}

export async function uploadPreparedBackupAttachment(
  d1: D1Database,
  bucket: R2Bucket,
  userId: string,
  importId: string,
  index: number,
  body: ReadableStream<Uint8Array>,
  contentLength: number
): Promise<void> {
  if (await readImportReceipt(d1, userId, importId)) {
    throw new RequestError('Backup import has already been finalized', 409);
  }
  const session = await readPreparedSession(d1, bucket, userId, importId);
  const attachment = session.attachments[index];
  if (!attachment) throw new RequestError('Attachment import target not found', 404);
  if (contentLength !== attachment[7]) {
    throw new RequestError('Imported attachment size does not match its manifest', 400);
  }

  const finalized = await d1
    .prepare('SELECT 1 AS found FROM attachments WHERE id = ? AND user_id = ? LIMIT 1')
    .bind(attachment[1], userId)
    .first('found');
  if (finalized) throw new RequestError('Backup import has already been finalized', 409);

  await putSizedObject(bucket, attachment[3], body, attachment[7], {
    httpMetadata: { contentType: attachment[5] },
    customMetadata: { userId, noteId: attachment[2], fileName: attachment[4] }
  });

  try {
    if (await readImportReceipt(d1, userId, importId)) return;
    const stored = await readStoredPreparedSession(bucket, userId, importId);
    if (Date.parse(stored.session.expiresAt) <= Date.now()) {
      await bucket.delete(attachment[3]).catch(() => undefined);
      throw new RequestError('Backup import session expired; start the import again', 410);
    }
    if (stored.session.phase === 'cleaning') {
      await bucket.delete(attachment[3]).catch(() => undefined);
      throw new RequestError('Backup import is being canceled', 409);
    }
    if (stored.session.phase === 'finalize') {
      throw new RequestError('Backup import is being finalized', 409);
    }
  } catch (error) {
    if (!(error instanceof RequestError) || error.status !== 404) throw error;
    if (await readImportReceipt(d1, userId, importId)) return;
    await bucket.delete(attachment[3]).catch(() => undefined);
    throw new RequestError('Backup import session not found', 404);
  }
}

function insertStatements(
  d1: D1Database,
  userId: string,
  rows: JsonRow[],
  label: string,
  statement: string,
  userBinding: 'first' | 'last' | 'none' = 'first'
): D1PreparedStatement[] {
  return jsonChunks(rows, label).map((chunk) => {
    if (userBinding === 'none') return d1.prepare(statement).bind(chunk);
    return userBinding === 'first'
      ? d1.prepare(statement).bind(userId, chunk)
      : d1.prepare(statement).bind(chunk, userId);
  });
}

function buildImportStatements(d1: D1Database, userId: string, session: PreparedBackupImport): D1PreparedStatement[] {
  const receiptCreatedAt = Math.floor(Date.now() / 1000);
  const receipt = session.mode === 'merge'
    ? d1.prepare(`
        INSERT INTO backup_import_receipts
          (id, user_id, note_count, tag_count, board_count, attachment_count, created_at)
        SELECT ?, ?,
          CASE WHEN ? = 0 OR (
            SELECT count(*) FROM kanban_boards WHERE user_id = ?
          ) + ? <= ? THEN ? END,
          ?, ?, ?, ?
      `).bind(
        session.importId,
        userId,
        session.boards.length,
        userId,
        session.boards.length,
        maxBoards,
        session.notes.length,
        session.tags.length,
        session.boards.length,
        session.attachments.length,
        receiptCreatedAt
      )
    : d1.prepare(`
        INSERT INTO backup_import_receipts
          (id, user_id, note_count, tag_count, board_count, attachment_count, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        session.importId,
        userId,
        session.notes.length,
        session.tags.length,
        session.boards.length,
        session.attachments.length,
        receiptCreatedAt
      );
  const statements: D1PreparedStatement[] = [receipt];
  if (session.mode === 'replace') {
    statements.push(
      d1.prepare('DELETE FROM notes WHERE user_id = ?').bind(userId),
      d1.prepare('DELETE FROM tags WHERE user_id = ?').bind(userId),
      d1.prepare('DELETE FROM kanban_boards WHERE user_id = ?').bind(userId)
    );
  }

  statements.push(
    ...insertStatements(d1, userId, session.notes, 'Notes', `
      INSERT INTO notes (id, user_id, title, content, rendered_content, date, color_indicator, is_favorite, created_at, updated_at)
      SELECT json_extract(value, '$[0]'), ?, json_extract(value, '$[1]'), json_extract(value, '$[2]'),
        json_extract(value, '$[3]'), json_extract(value, '$[4]'), json_extract(value, '$[5]'),
        json_extract(value, '$[6]'), json_extract(value, '$[7]'), json_extract(value, '$[8]')
      FROM json_each(?)
    `),
    ...insertStatements(d1, userId, session.tags, 'Tags', `
      INSERT OR IGNORE INTO tags (id, user_id, name, color, last_note_modified_at, created_at, updated_at)
      SELECT json_extract(value, '$[0]'), ?, json_extract(value, '$[1]'), json_extract(value, '$[2]'),
        json_extract(value, '$[3]'), json_extract(value, '$[4]'), json_extract(value, '$[5]')
      FROM json_each(?)
    `),
    ...insertStatements(d1, userId, session.noteTags, 'Note tags', `
      INSERT OR IGNORE INTO note_tags (note_id, tag_id)
      SELECT json_extract(relation.value, '$[0]'), tags.id
      FROM json_each(?) AS relation
      INNER JOIN tags
        ON tags.user_id = ? AND tags.name = json_extract(relation.value, '$[1]')
    `, 'last'),
    ...insertStatements(d1, userId, session.boards, 'Boards', `
      INSERT INTO kanban_boards (id, user_id, name, color, position, created_at, updated_at)
      SELECT json_extract(value, '$[0]'), ?, json_extract(value, '$[1]'), json_extract(value, '$[2]'),
        json_extract(value, '$[3]'), json_extract(value, '$[4]'), json_extract(value, '$[5]')
      FROM json_each(?)
    `),
    ...insertStatements(d1, userId, session.columns, 'Columns', `
      INSERT INTO kanban_columns (id, board_id, user_id, name, position, created_at, updated_at)
      SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), ?, json_extract(value, '$[2]'),
        json_extract(value, '$[3]'), json_extract(value, '$[4]'), json_extract(value, '$[5]')
      FROM json_each(?)
    `),
    ...insertStatements(d1, userId, session.cards, 'Cards', `
      INSERT INTO kanban_cards (id, board_id, column_id, user_id, title, description, position, created_at, updated_at)
      SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'), ?,
        json_extract(value, '$[3]'), json_extract(value, '$[4]'), json_extract(value, '$[5]'),
        json_extract(value, '$[6]'), json_extract(value, '$[7]')
      FROM json_each(?)
    `),
    ...insertStatements(d1, userId, session.attachments, 'Attachments', `
      INSERT INTO attachments (id, note_id, user_id, r2_key, file_name, media_type, kind, size, created_at)
      SELECT json_extract(value, '$[1]'), json_extract(value, '$[2]'), ?, json_extract(value, '$[3]'),
        json_extract(value, '$[4]'), json_extract(value, '$[5]'), json_extract(value, '$[6]'),
        json_extract(value, '$[7]'), json_extract(value, '$[8]')
      FROM json_each(?)
    `)
  );
  return statements;
}

async function validateUploadedAttachments(
  bucket: R2Bucket,
  userId: string,
  session: PreparedBackupImport
): Promise<void> {
  if (session.attachments.length === 0) return;
  const listed = await bucket.list({
    prefix: `${importPrefix(userId, session.importId)}/files/`,
    limit: 1000
  });
  if (listed.truncated) throw new RequestError('Backup contains too many attachments', 413);
  const sizes = new Map(listed.objects.map((object) => [object.key, object.size]));
  const missing = session.attachments.find((attachment) => sizes.get(attachment[3]) !== attachment[7]);
  if (missing) throw new RequestError(`Attachment ${missing[4]} has not finished uploading`, 409);
}

export async function finalizeBackupImport(
  d1: D1Database,
  bucket: R2Bucket,
  userId: string,
  importId: string
): Promise<ImportResult> {
  const receipt = await readImportReceipt(d1, userId, importId);
  if (receipt) return receipt;

  let claimed: StoredPreparedBackupImport;
  try {
    claimed = await claimBackupFinalization(bucket, userId, importId);
  } catch (error) {
    const concurrentReceipt = await readImportReceipt(d1, userId, importId);
    if (concurrentReceipt) return concurrentReceipt;
    throw error;
  }
  const session = claimed.session;
  const result = importCounts(session);
  let oldAttachmentRows: { results: Array<{ r2Key: string }> };

  try {
    await validateUploadedAttachments(bucket, userId, session);
    oldAttachmentRows = session.mode === 'replace'
      ? await d1
        .prepare('SELECT r2_key AS r2Key FROM attachments WHERE user_id = ?')
        .bind(userId)
        .all<{ r2Key: string }>()
      : { results: [] };

    const statements = buildImportStatements(d1, userId, session);
    if (statements.length > maxImportBatchStatements) {
      throw new RequestError('Backup contains too many records for one atomic D1 import', 413);
    }
    if (statements.length > 0) await d1.batch(statements);
  } catch (error) {
    const concurrentReceipt = await readImportReceipt(d1, userId, importId);
    if (concurrentReceipt) {
      await bucket.delete(importSessionKey(userId, importId)).catch(() => undefined);
      return concurrentReceipt;
    }
    await releaseBackupFinalization(bucket, userId, claimed).catch((releaseError) => {
      console.error(JSON.stringify({
        message: 'could not release failed backup finalization',
        importId,
        error: releaseError instanceof Error ? releaseError.message : String(releaseError)
      }));
    });
    if (session.mode === 'merge' && session.boards.length > 0) {
      const count = await d1
        .prepare('SELECT count(*) AS count FROM kanban_boards WHERE user_id = ?')
        .bind(userId)
        .first<number>('count');
      if (Number(count ?? 0) + session.boards.length > maxBoards) {
        throw new RequestError(`A workspace can contain up to ${maxBoards} boards`, 409);
      }
    }
    throw error;
  }

  try {
    await bucket.delete(importSessionKey(userId, importId));
  } catch (error) {
    console.error(JSON.stringify({
      message: 'could not remove finalized backup session',
      importId,
      error: error instanceof Error ? error.message : String(error)
    }));
  }

  if (oldAttachmentRows.results.length > 0) {
    try {
      await deleteR2Objects(bucket, oldAttachmentRows.results.map((attachment) => attachment.r2Key));
    } catch (error) {
      console.error(JSON.stringify({
        message: 'could not remove replaced backup attachments',
        importId,
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  }
  return result;
}

async function claimBackupCleanup(
  d1: D1Database,
  bucket: R2Bucket,
  userId: string,
  importId: string
): Promise<PreparedBackupImport | undefined> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (await readImportReceipt(d1, userId, importId)) {
      await bucket.delete(importSessionKey(userId, importId)).catch(() => undefined);
      return undefined;
    }

    let stored: StoredPreparedBackupImport;
    try {
      stored = await readStoredPreparedSession(bucket, userId, importId);
    } catch (error) {
      if (error instanceof RequestError && error.status === 404) return undefined;
      throw error;
    }
    if (stored.session.phase === 'finalize' && phaseLeaseIsActive(stored.session)) {
      throw new RequestError('Backup import is being finalized', 409);
    }
    if (stored.session.phase === 'cleaning') return stored.session;

    const claimed = await writePreparedSessionPhase(bucket, userId, stored, 'cleaning');
    if (claimed) return claimed.session;
  }
  throw new RequestError('Backup import state changed; retry the request', 409);
}

export async function cleanupPreparedBackupImport(
  d1: D1Database,
  bucket: R2Bucket,
  userId: string,
  importId: string
): Promise<void> {
  const session = await claimBackupCleanup(d1, bucket, userId, importId);
  if (!session) return;

  const prefix = `${importPrefix(userId, importId)}/`;
  let cursor: string | undefined;
  do {
    const listed = await bucket.list({ prefix, cursor, limit: 1000 });
    if (listed.objects.length > 0) await deleteR2Objects(bucket, listed.objects.map((object) => object.key));
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  await bucket.delete(importSessionKey(userId, importId));
}
