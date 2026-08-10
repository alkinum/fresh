import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Miniflare } from 'miniflare';
import { getDb } from '../src/db';
import {
  cleanupPreparedBackupImport,
  finalizeBackupImport,
  prepareBackupImport,
  uploadPreparedBackupAttachment
} from '../src/lib/server/backup';
import type { BackupManifest } from '../src/lib/types';

const timestamp = '2026-08-11T00:00:00.000Z';
const userId = 'user-1';

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = (): void => undefined;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function blockFirstAttachmentList(bucket: R2Bucket): {
  bucket: R2Bucket;
  reached: Promise<void>;
  release: () => void;
} {
  const reached = deferred();
  const release = deferred();
  let blocked = false;
  const wrapped = {
    head: bucket.head.bind(bucket),
    get: bucket.get.bind(bucket),
    put: bucket.put.bind(bucket),
    delete: bucket.delete.bind(bucket),
    list: async (options?: R2ListOptions) => {
      if (!blocked && options?.prefix?.includes('/files/')) {
        blocked = true;
        reached.resolve();
        await release.promise;
      }
      return bucket.list(options);
    }
  } as unknown as R2Bucket;
  return { bucket: wrapped, reached: reached.promise, release: release.resolve };
}

function blockFirstAttachmentPut(bucket: R2Bucket): {
  bucket: R2Bucket;
  reached: Promise<void>;
  release: () => void;
} {
  const reached = deferred();
  const release = deferred();
  let blocked = false;
  const wrapped = {
    head: bucket.head.bind(bucket),
    get: bucket.get.bind(bucket),
    put: async (key: string, value: Parameters<R2Bucket['put']>[1], options?: R2PutOptions) => {
      if (!blocked && key.includes('/files/')) {
        blocked = true;
        reached.resolve();
        await release.promise;
      }
      return bucket.put(key, value, options);
    },
    delete: bucket.delete.bind(bucket),
    list: bucket.list.bind(bucket)
  } as unknown as R2Bucket;
  return { bucket: wrapped, reached: reached.promise, release: release.resolve };
}

function failSessionDelete(bucket: R2Bucket): R2Bucket {
  return {
    head: bucket.head.bind(bucket),
    get: bucket.get.bind(bucket),
    put: bucket.put.bind(bucket),
    list: bucket.list.bind(bucket),
    delete: async (keys: string | string[]) => {
      if (typeof keys === 'string' && keys.includes('/backup-import-sessions/')) {
        throw new Error('simulated session delete failure');
      }
      return bucket.delete(keys);
    }
  } as unknown as R2Bucket;
}

function backupManifest(): BackupManifest {
  return {
    schemaVersion: 2,
    exportedAt: timestamp,
    profile: { name: 'Test User', email: 'test@example.com' },
    notes: [{
      id: 'source-note',
      title: 'Restored note',
      content: '# Restored note\n\nBody #restored',
      date: '2026-08-11',
      colorIndicator: '#4f8cff',
      isFavorite: true,
      createdAt: timestamp,
      updatedAt: timestamp
    }],
    tags: [{
      id: 'source-tag',
      name: 'restored',
      color: 'hsl(120 58% 64%)',
      createdAt: timestamp,
      updatedAt: timestamp,
      lastNoteModifiedAt: timestamp
    }],
    noteTags: [{ noteId: 'source-note', tagId: 'source-tag' }],
    attachments: [{
      id: 'source-attachment',
      noteId: 'source-note',
      fileName: 'hello.txt',
      mediaType: 'text/plain',
      kind: 'text',
      size: 5,
      createdAt: timestamp,
      url: '/api/attachments/source-attachment'
    }],
    kanbanBoards: [{
      id: 'source-board',
      name: 'Restored board',
      color: '#5288e8',
      position: 0,
      createdAt: timestamp,
      updatedAt: timestamp
    }],
    kanbanColumns: [{
      id: 'source-column',
      boardId: 'source-board',
      name: 'To do',
      position: 0,
      createdAt: timestamp,
      updatedAt: timestamp
    }],
    kanbanCards: [{
      id: 'source-card',
      boardId: 'source-board',
      columnId: 'source-column',
      title: 'Restored card',
      description: 'Ready',
      position: 0,
      createdAt: timestamp,
      updatedAt: timestamp
    }]
  };
}

async function createRuntime() {
  const miniflare = new Miniflare({
    workers: [{
      config: {
        name: 'backup-import-test',
        type: 'worker',
        compatibilityDate: '2026-07-17',
        manifest: {
          mainModule: 'index.js',
          modules: {
            'index.js': {
              type: 'esm',
              contents: 'export default { fetch() { return new Response("ok") } }'
            }
          }
        },
        env: {
          DB: { type: 'd1' },
          ATTACHMENTS: { type: 'r2' }
        }
      }
    }]
  });
  const d1 = await miniflare.getD1Database('DB') as D1Database;
  const bucket = await miniflare.getR2Bucket('ATTACHMENTS') as R2Bucket;
  await d1.batch([
    d1.prepare(`CREATE TABLE notes (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL,
      rendered_content TEXT NOT NULL, date TEXT NOT NULL, color_indicator TEXT NOT NULL,
      is_favorite INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    )`),
    d1.prepare(`CREATE TABLE tags (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL,
      last_note_modified_at INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    )`),
    d1.prepare('CREATE UNIQUE INDEX tags_user_name_unique ON tags (user_id, name)'),
    d1.prepare(`CREATE TABLE note_tags (
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (note_id, tag_id)
    )`),
    d1.prepare(`CREATE TABLE attachments (
      id TEXT PRIMARY KEY, note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL, r2_key TEXT NOT NULL UNIQUE, file_name TEXT NOT NULL,
      media_type TEXT NOT NULL, kind TEXT NOT NULL, size INTEGER NOT NULL, created_at INTEGER NOT NULL
    )`),
    d1.prepare(`CREATE TABLE backup_import_receipts (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, note_count INTEGER NOT NULL, tag_count INTEGER NOT NULL,
      board_count INTEGER NOT NULL, attachment_count INTEGER NOT NULL, created_at INTEGER NOT NULL
    )`),
    d1.prepare(`CREATE TABLE kanban_boards (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL,
      position INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    )`),
    d1.prepare(`CREATE TABLE kanban_columns (
      id TEXT PRIMARY KEY, board_id TEXT NOT NULL REFERENCES kanban_boards(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL, name TEXT NOT NULL, position INTEGER NOT NULL,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    )`),
    d1.prepare(`CREATE TABLE kanban_cards (
      id TEXT PRIMARY KEY, board_id TEXT NOT NULL REFERENCES kanban_boards(id) ON DELETE CASCADE,
      column_id TEXT NOT NULL REFERENCES kanban_columns(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL,
      position INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    )`)
  ]);
  return { miniflare, d1, bucket };
}

describe('atomic backup import', () => {
  let runtime: Awaited<ReturnType<typeof createRuntime>> | undefined;

  beforeEach(async () => {
    runtime = await createRuntime();
  });

  afterEach(async () => {
    await runtime?.miniflare.dispose();
  });

  it('keeps old data until every attachment is uploaded and finalization commits', async () => {
    if (!runtime) throw new Error('Test runtime was not initialized');
    await runtime.d1.batch([
      runtime.d1.prepare(`
        INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind('old-note', userId, 'Old', '# Old', '<p>Old</p>', '2026-08-10', '#4f8cff', 0, 1, 1),
      runtime.d1.prepare(`
        INSERT INTO attachments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind('old-attachment', 'old-note', userId, 'old-object', 'old.txt', 'text/plain', 'text', 3, 1)
    ]);
    await runtime.bucket.put('old-object', 'old');

    const prepared = await prepareBackupImport(
      getDb(runtime.d1),
      runtime.bucket,
      userId,
      backupManifest(),
      'replace'
    );
    expect(await runtime.d1.prepare('SELECT count(*) AS count FROM notes').first<number>('count')).toBe(1);

    const bytes = new TextEncoder().encode('hello');
    await uploadPreparedBackupAttachment(
      runtime.d1,
      runtime.bucket,
      userId,
      prepared.importId,
      0,
      new Blob([bytes]).stream(),
      bytes.byteLength
    );
    expect(await runtime.d1.prepare('SELECT count(*) AS count FROM notes').first<number>('count')).toBe(1);

    const result = await finalizeBackupImport(runtime.d1, runtime.bucket, userId, prepared.importId);
    expect(result).toEqual({ notes: 1, tags: 1, boards: 1, attachments: 1 });
    expect(await runtime.d1.prepare('SELECT count(*) AS count FROM notes').first<number>('count')).toBe(1);
    expect(await runtime.d1.prepare('SELECT title FROM notes').first<string>('title')).toBe('Restored note');
    expect(await runtime.d1.prepare('SELECT count(*) AS count FROM note_tags').first<number>('count')).toBe(1);
    expect(await runtime.d1.prepare('SELECT count(*) AS count FROM kanban_cards').first<number>('count')).toBe(1);

    const restoredKey = await runtime.d1.prepare('SELECT r2_key AS key FROM attachments').first<string>('key');
    expect(restoredKey).toBeTruthy();
    expect(await (await runtime.bucket.get(restoredKey!))?.text()).toBe('hello');
    expect(await runtime.bucket.get('old-object')).toBeNull();

    expect(await finalizeBackupImport(runtime.d1, runtime.bucket, userId, prepared.importId)).toEqual(result);
    await cleanupPreparedBackupImport(runtime.d1, runtime.bucket, userId, prepared.importId);
    expect(await (await runtime.bucket.get(restoredKey!))?.text()).toBe('hello');
  });

  it('does not let cleanup delete attachments after finalization claims the session', async () => {
    if (!runtime) throw new Error('Test runtime was not initialized');
    const prepared = await prepareBackupImport(
      getDb(runtime.d1),
      runtime.bucket,
      userId,
      backupManifest(),
      'merge'
    );
    const bytes = new TextEncoder().encode('hello');
    await uploadPreparedBackupAttachment(
      runtime.d1,
      runtime.bucket,
      userId,
      prepared.importId,
      0,
      new Blob([bytes]).stream(),
      bytes.byteLength
    );

    const blocked = blockFirstAttachmentList(runtime.bucket);
    const finalization = finalizeBackupImport(runtime.d1, blocked.bucket, userId, prepared.importId);
    await blocked.reached;
    const [cleanupResult] = await Promise.allSettled([
      cleanupPreparedBackupImport(runtime.d1, runtime.bucket, userId, prepared.importId)
    ]);
    blocked.release();
    const [finalizationResult] = await Promise.allSettled([finalization]);

    expect(cleanupResult.status).toBe('rejected');
    if (cleanupResult.status === 'rejected') {
      expect(cleanupResult.reason).toMatchObject({ message: 'Backup import is being finalized' });
    }
    expect(finalizationResult.status).toBe('fulfilled');
    const restoredKey = await runtime.d1.prepare(`
      SELECT r2_key AS key FROM attachments LIMIT 1
    `).first<string>('key');
    expect(restoredKey).toBeTruthy();
    expect(await (await runtime.bucket.get(restoredKey!))?.text()).toBe('hello');
  });

  it('keeps finalized attachments when a stale session outlives its receipt retention window', async () => {
    if (!runtime) throw new Error('Test runtime was not initialized');
    const prepared = await prepareBackupImport(
      getDb(runtime.d1),
      runtime.bucket,
      userId,
      backupManifest(),
      'merge'
    );
    const bytes = new TextEncoder().encode('hello');
    await uploadPreparedBackupAttachment(
      runtime.d1,
      runtime.bucket,
      userId,
      prepared.importId,
      0,
      new Blob([bytes]).stream(),
      bytes.byteLength
    );
    await finalizeBackupImport(runtime.d1, failSessionDelete(runtime.bucket), userId, prepared.importId);
    await runtime.d1.prepare(`
      UPDATE backup_import_receipts SET created_at = 0 WHERE id = ?
    `).bind(prepared.importId).run();
    const sessionKey = `${userId}/backup-import-sessions/${prepared.importId}.json`;
    const sessionObject = await runtime.bucket.get(sessionKey);
    if (!sessionObject) throw new Error('Prepared session was unexpectedly removed');
    const session = JSON.parse(await sessionObject.text()) as Record<string, unknown>;
    session.expiresAt = '2020-01-01T00:00:00.000Z';
    await runtime.bucket.put(sessionKey, JSON.stringify(session), {
      httpMetadata: { contentType: 'application/json' },
      customMetadata: { userId, expiresAt: '2020-01-01T00:00:00.000Z' }
    });

    const empty = backupManifest();
    if (empty.schemaVersion !== 2) throw new Error('Expected a version 2 manifest');
    await prepareBackupImport(getDb(runtime.d1), runtime.bucket, userId, {
      ...empty,
      notes: [],
      tags: [],
      noteTags: [],
      attachments: [],
      kanbanBoards: [],
      kanbanColumns: [],
      kanbanCards: []
    }, 'merge');

    const restoredKey = await runtime.d1.prepare(`
      SELECT r2_key AS key FROM attachments LIMIT 1
    `).first<string>('key');
    expect(restoredKey).toBeTruthy();
    expect(await (await runtime.bucket.get(restoredKey!))?.text()).toBe('hello');
    expect(await runtime.bucket.head(sessionKey)).toBeNull();
    expect(await runtime.d1.prepare(`
      SELECT count(*) AS count FROM backup_import_receipts WHERE id = ?
    `).bind(prepared.importId).first<number>('count')).toBe(0);
  });

  it('removes an attachment upload that finishes after its session was canceled', async () => {
    if (!runtime) throw new Error('Test runtime was not initialized');
    const prepared = await prepareBackupImport(
      getDb(runtime.d1),
      runtime.bucket,
      userId,
      backupManifest(),
      'merge'
    );
    const bytes = new TextEncoder().encode('hello');
    const blocked = blockFirstAttachmentPut(runtime.bucket);
    const upload = uploadPreparedBackupAttachment(
      runtime.d1,
      blocked.bucket,
      userId,
      prepared.importId,
      0,
      new Blob([bytes]).stream(),
      bytes.byteLength
    );
    await blocked.reached;
    await cleanupPreparedBackupImport(runtime.d1, runtime.bucket, userId, prepared.importId);
    blocked.release();

    await expect(upload).rejects.toThrow('session not found');
    expect(await runtime.bucket.get(`${userId}/backup-imports/${prepared.importId}/files/0`)).toBeNull();
  });

  it('rejects finalization without deleting existing data when an upload is missing', async () => {
    if (!runtime) throw new Error('Test runtime was not initialized');
    await runtime.d1.prepare(`
      INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind('old-note', userId, 'Old', '# Old', '<p>Old</p>', '2026-08-10', '#4f8cff', 0, 1, 1).run();
    const prepared = await prepareBackupImport(
      getDb(runtime.d1),
      runtime.bucket,
      userId,
      backupManifest(),
      'replace'
    );

    await expect(finalizeBackupImport(runtime.d1, runtime.bucket, userId, prepared.importId))
      .rejects.toThrow('has not finished uploading');
    expect(await runtime.d1.prepare('SELECT title FROM notes').first<string>('title')).toBe('Old');

    const bytes = new TextEncoder().encode('hello');
    await uploadPreparedBackupAttachment(
      runtime.d1,
      runtime.bucket,
      userId,
      prepared.importId,
      0,
      new Blob([bytes]).stream(),
      bytes.byteLength
    );
    await expect(finalizeBackupImport(runtime.d1, runtime.bucket, userId, prepared.importId))
      .resolves.toEqual({ notes: 1, tags: 1, boards: 1, attachments: 1 });
  });

  it('does not repeat an empty replace after finalization is retried', async () => {
    if (!runtime) throw new Error('Test runtime was not initialized');
    await runtime.d1.prepare(`
      INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind('old-note', userId, 'Old', '# Old', '<p>Old</p>', '2026-08-10', '#4f8cff', 0, 1, 1).run();

    const sourceManifest = backupManifest();
    if (sourceManifest.schemaVersion !== 2) throw new Error('Expected a version 2 manifest');
    const emptyManifest: BackupManifest = {
      ...sourceManifest,
      notes: [],
      tags: [],
      noteTags: [],
      attachments: [],
      kanbanBoards: [],
      kanbanColumns: [],
      kanbanCards: []
    };
    const prepared = await prepareBackupImport(
      getDb(runtime.d1),
      runtime.bucket,
      userId,
      emptyManifest,
      'replace'
    );
    const result = await finalizeBackupImport(runtime.d1, runtime.bucket, userId, prepared.importId);
    expect(result).toEqual({ notes: 0, tags: 0, boards: 0, attachments: 0 });

    await runtime.d1.prepare(`
      INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind('new-note', userId, 'New', '# New', '<p>New</p>', '2026-08-11', '#4f8cff', 0, 2, 2).run();

    expect(await finalizeBackupImport(runtime.d1, runtime.bucket, userId, prepared.importId)).toEqual(result);
    expect(await runtime.d1.prepare('SELECT title FROM notes').first<string>('title')).toBe('New');
  });

  it('reuses an existing tag by name during a merge', async () => {
    if (!runtime) throw new Error('Test runtime was not initialized');
    await runtime.d1.prepare(`
      INSERT INTO tags VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind('existing-tag', userId, 'restored', 'hsl(120 58% 64%)', 1, 1, 1).run();

    const source = backupManifest();
    if (source.schemaVersion !== 2) throw new Error('Expected a version 2 manifest');
    const withoutFiles: BackupManifest = { ...source, attachments: [] };
    const prepared = await prepareBackupImport(getDb(runtime.d1), runtime.bucket, userId, withoutFiles, 'merge');
    await finalizeBackupImport(runtime.d1, runtime.bucket, userId, prepared.importId);

    expect(await runtime.d1.prepare(`
      SELECT count(*) AS count FROM tags WHERE user_id = ? AND name = 'restored'
    `).bind(userId).first<number>('count')).toBe(1);
    expect(await runtime.d1.prepare(`
      SELECT tag_id FROM note_tags LIMIT 1
    `).first<string>('tag_id')).toBe('existing-tag');
  });

  it('keeps concurrent merge imports within the board limit', async () => {
    if (!runtime) throw new Error('Test runtime was not initialized');
    const rows = Array.from({ length: 29 }, (_, position) => [
      `existing-board-${position}`,
      userId,
      `Existing board ${position}`,
      '#5288e8',
      position,
      1,
      1
    ]);
    await runtime.d1.prepare(`
      INSERT INTO kanban_boards (id, user_id, name, color, position, created_at, updated_at)
      SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'),
        json_extract(value, '$[3]'), json_extract(value, '$[4]'), json_extract(value, '$[5]'),
        json_extract(value, '$[6]') FROM json_each(?)
    `).bind(JSON.stringify(rows)).run();

    const source = backupManifest();
    if (source.schemaVersion !== 2) throw new Error('Expected a version 2 manifest');
    const boardOnly: BackupManifest = {
      ...source,
      notes: [],
      tags: [],
      noteTags: [],
      attachments: [],
      kanbanColumns: [],
      kanbanCards: []
    };
    const [first, second] = await Promise.all([
      prepareBackupImport(getDb(runtime.d1), runtime.bucket, userId, boardOnly, 'merge'),
      prepareBackupImport(getDb(runtime.d1), runtime.bucket, userId, boardOnly, 'merge')
    ]);
    const results = await Promise.allSettled([
      finalizeBackupImport(runtime.d1, runtime.bucket, userId, first.importId),
      finalizeBackupImport(runtime.d1, runtime.bucket, userId, second.importId)
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await runtime.d1.prepare(`
      SELECT count(*) AS count FROM kanban_boards WHERE user_id = ?
    `).bind(userId).first<number>('count')).toBe(30);
  });
});
