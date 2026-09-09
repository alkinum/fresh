import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Miniflare } from 'miniflare';
import { getDb } from '../src/db';
import { createBackupManifest } from '../src/lib/server/backup';
import {
  createKanbanBoard,
  createKanbanCard,
  deleteKanbanCard,
  getKanbanBoard,
  updateKanbanCard
} from '../src/lib/server/kanban';
import { createNote, getNote, listNotes, listTags, updateNote } from '../src/lib/server/notes';

const userId = 'user-1';

async function createRuntime() {
  const miniflare = new Miniflare({
    workers: [
      {
        config: {
          name: 'd1-domain-test',
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
          env: { DB: { type: 'd1' } }
        }
      }
    ]
  });
  const d1 = (await miniflare.getD1Database('DB')) as D1Database;
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
  return { miniflare, d1, db: getDb(d1) };
}

describe('D1 domain transactions', () => {
  let runtime: Awaited<ReturnType<typeof createRuntime>> | undefined;

  beforeEach(async () => {
    runtime = await createRuntime();
  });

  afterEach(async () => {
    await runtime?.miniflare.dispose();
  });

  it('searches beyond the loaded page, combines filters, and treats wildcard characters literally', async () => {
    if (!runtime) throw new Error('Test runtime was not initialized');
    const { db } = runtime;
    const first = await createNote(db, userId, { content: '# Older\n\nBudget 50%_complete #plans', isFavorite: true });
    await createNote(db, userId, { content: '# Newer\n\nAnother plan' });
    await createNote(db, 'other-user', { content: '# Private\n\n50%_complete #plans', isFavorite: true });

    const found = await listNotes(db, { userId, search: '50%_', limit: 1 });
    expect(found.items.map((note) => note.id)).toEqual([first.id]);
    expect(found.totalItems).toBe(1);
    expect((await listNotes(db, { userId, search: 'OLDER', favorite: true, tagId: first.tags[0].id })).totalItems).toBe(
      1
    );
    expect((await listNotes(db, { userId, search: 'OLDER', favorite: false })).totalItems).toBe(0);
    const pageOne = await listNotes(db, { userId, limit: 1 });
    const pageTwo = await listNotes(db, { userId, limit: 1, page: 2 });
    expect(pageOne.items[0].id).not.toBe(pageTwo.items[0].id);
    expect(pageOne.totalItems).toBe(2);
  });

  it('searches owned filenames and ignores foreign attachment metadata', async () => {
    if (!runtime) throw new Error('Test runtime was not initialized');
    const { db, d1 } = runtime;
    const note = await createNote(db, userId, { content: '# Research\n\nField notes' });
    await d1.batch(
      ['user-1', 'other-user'].map((owner, index) =>
        d1
          .prepare(
            `
      INSERT INTO attachments VALUES (?, ?, ?, ?, ?, 'text/plain', 'text', 10, 1)
    `
          )
          .bind(`file-${index}`, note.id, owner, `key-${index}`, index ? 'secret.txt' : '调研-report.txt')
      )
    );
    expect((await listNotes(db, { userId, search: '调研' })).items.map((item) => item.id)).toEqual([note.id]);
    expect((await listNotes(db, { userId, search: 'REPORT.TXT' })).totalItems).toBe(1);
    expect((await listNotes(db, { userId, search: 'secret' })).totalItems).toBe(0);
  });

  it('deduplicates tags across concurrent note writes and rebuilds relations atomically', async () => {
    if (!runtime) throw new Error('Test runtime was not initialized');
    const [first, second] = await Promise.all([
      createNote(runtime.db, userId, { content: '# First\n\n#shared' }),
      createNote(runtime.db, userId, { content: '# Second\n\n#shared' })
    ]);

    expect(
      await runtime.d1.prepare(`SELECT count(*) AS count FROM tags WHERE name = 'shared'`).first<number>('count')
    ).toBe(1);
    expect(await runtime.d1.prepare('SELECT count(*) AS count FROM note_tags').first<number>('count')).toBe(2);

    await updateNote(runtime.db, userId, first.id, { content: '# First\n\n#other' });
    expect(
      await runtime.d1
        .prepare(
          `
      SELECT count(*) AS count FROM note_tags
      INNER JOIN tags ON tags.id = note_tags.tag_id
      WHERE note_tags.note_id = ? AND tags.name = 'other'
    `
        )
        .bind(first.id)
        .first<number>('count')
    ).toBe(1);
    expect(second.tags.map((tag) => tag.name)).toEqual(['shared']);
  });

  it('keeps card positions contiguous across same-column moves, cross-column moves, and deletes', async () => {
    if (!runtime) throw new Error('Test runtime was not initialized');
    const board = await createKanbanBoard(runtime.db, userId, { name: 'Board' });
    const [source, target] = board.columns;
    const first = await createKanbanCard(runtime.db, userId, source.id, { title: 'First' });
    const second = await createKanbanCard(runtime.db, userId, source.id, { title: 'Second' });
    const third = await createKanbanCard(runtime.db, userId, source.id, { title: 'Third' });
    if (!first || !second || !third) throw new Error('Cards were not created');

    await updateKanbanCard(runtime.db, userId, third.id, { columnId: source.id, position: 0 });
    await updateKanbanCard(runtime.db, userId, second.id, { columnId: target.id, position: 0 });
    await deleteKanbanCard(runtime.db, userId, third.id);

    const updated = await getKanbanBoard(runtime.db, userId, board.id);
    expect(updated?.columns[0].cards.map((card) => [card.title, card.position])).toEqual([['First', 0]]);
    expect(updated?.columns[1].cards.map((card) => [card.title, card.position])).toEqual([['Second', 0]]);
  });

  it('keeps every column compact when the same card is moved concurrently', async () => {
    if (!runtime) throw new Error('Test runtime was not initialized');
    const board = await createKanbanBoard(runtime.db, userId, { name: 'Concurrent moves' });
    const [source, firstTarget, secondTarget] = board.columns;
    const moving = await createKanbanCard(runtime.db, userId, source.id, { title: 'Moving' });
    await createKanbanCard(runtime.db, userId, firstTarget.id, { title: 'First target card' });
    await createKanbanCard(runtime.db, userId, secondTarget.id, { title: 'Second target card' });
    if (!moving) throw new Error('Moving card was not created');

    await Promise.all([
      updateKanbanCard(runtime.db, userId, moving.id, { columnId: firstTarget.id, position: 0 }),
      updateKanbanCard(runtime.db, userId, moving.id, { columnId: secondTarget.id, position: 0 })
    ]);

    const updated = await getKanbanBoard(runtime.db, userId, board.id);
    expect(updated).toBeDefined();
    for (const column of updated?.columns ?? []) {
      expect(column.cards.map((card) => card.position)).toEqual(column.cards.map((_, position) => position));
    }
  });

  it('does not move a card back when metadata and position are updated concurrently', async () => {
    if (!runtime) throw new Error('Test runtime was not initialized');
    const board = await createKanbanBoard(runtime.db, userId, { name: 'Board' });
    const [source, target] = board.columns;
    const card = await createKanbanCard(runtime.db, userId, source.id, { title: 'Original' });
    if (!card) throw new Error('Card was not created');

    await Promise.all([
      updateKanbanCard(runtime.db, userId, card.id, { columnId: target.id, position: 0 }),
      updateKanbanCard(runtime.db, userId, card.id, { title: 'Renamed' })
    ]);

    const updated = await getKanbanBoard(runtime.db, userId, board.id);
    const finalCard = updated?.columns.flatMap((column) => column.cards).find((item) => item.id === card.id);
    expect(finalCard).toMatchObject({ title: 'Renamed', columnId: target.id, position: 0 });
  });

  it('does not lose an unrelated note update under concurrency', async () => {
    if (!runtime) throw new Error('Test runtime was not initialized');
    const note = await createNote(runtime.db, userId, { content: '# Original' });

    await Promise.all([
      updateNote(runtime.db, userId, note.id, { content: '# Updated' }),
      updateNote(runtime.db, userId, note.id, { isFavorite: true })
    ]);

    const updated = await runtime.d1
      .prepare(
        `
      SELECT content, is_favorite AS isFavorite FROM notes WHERE id = ?
    `
      )
      .bind(note.id)
      .first<{ content: string; isFavorite: number }>();
    expect(updated).toEqual({ content: '# Updated', isFavorite: 1 });
  });

  it('ignores cross-user attachment and tag relations while hydrating notes and counts', async () => {
    if (!runtime) throw new Error('Test runtime was not initialized');
    const owned = await createNote(runtime.db, userId, { content: '# Owned\n\n#personal' });
    const foreign = await createNote(runtime.db, 'user-2', { content: '# Foreign\n\n#outside' });
    const ownedTagId = owned.tags[0].id;
    const foreignTagId = foreign.tags[0].id;

    await runtime.d1.batch([
      runtime.d1
        .prepare(
          `
        INSERT INTO attachments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .bind('foreign-file', owned.id, 'user-2', 'foreign-object', 'foreign.txt', 'text/plain', 'text', 1, 1),
      runtime.d1.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').bind(owned.id, foreignTagId),
      runtime.d1.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').bind(foreign.id, ownedTagId)
    ]);

    const hydrated = await getNote(runtime.db, userId, owned.id);
    expect(hydrated?.attachments).toEqual([]);
    expect(hydrated?.tags.map((tag) => tag.name)).toEqual(['personal']);
    expect((await listTags(runtime.db, userId)).find((tag) => tag.id === ownedTagId)?.count).toBe(1);
  });

  it('excludes forged cross-user relationships from backup manifests', async () => {
    if (!runtime) throw new Error('Test runtime was not initialized');
    const ownedNote = await createNote(runtime.db, userId, { content: '# Owned\n\n#personal' });
    const foreignNote = await createNote(runtime.db, 'user-2', { content: '# Foreign\n\n#outside' });
    const ownedBoard = await createKanbanBoard(runtime.db, userId, { name: 'Owned board' });
    const foreignBoard = await createKanbanBoard(runtime.db, 'user-2', { name: 'Foreign board' });
    const ownedCard = await createKanbanCard(runtime.db, userId, ownedBoard.columns[0].id, {
      title: 'Owned card'
    });
    if (!ownedCard) throw new Error('Owned card was not created');

    await runtime.d1.batch([
      runtime.d1
        .prepare(
          `
        INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)
      `
        )
        .bind(ownedNote.id, foreignNote.tags[0].id),
      runtime.d1
        .prepare(
          `
        INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)
      `
        )
        .bind(foreignNote.id, ownedNote.tags[0].id),
      runtime.d1
        .prepare(
          `
        INSERT INTO attachments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .bind('foreign-file', ownedNote.id, 'user-2', 'foreign-object', 'foreign.txt', 'text/plain', 'text', 1, 1),
      runtime.d1
        .prepare(
          `
        INSERT INTO kanban_columns VALUES (?, ?, ?, ?, ?, ?, ?)
      `
        )
        .bind('foreign-column', ownedBoard.id, 'user-2', 'Foreign column', 99, 1, 1),
      runtime.d1
        .prepare(
          `
        INSERT INTO kanban_columns VALUES (?, ?, ?, ?, ?, ?, ?)
      `
        )
        .bind('owned-column-on-foreign-board', foreignBoard.id, userId, 'Wrong board', 99, 1, 1),
      runtime.d1
        .prepare(
          `
        INSERT INTO kanban_cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .bind('foreign-card', ownedBoard.id, ownedBoard.columns[0].id, 'user-2', 'Foreign card', '', 99, 1, 1),
      runtime.d1
        .prepare(
          `
        INSERT INTO kanban_cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .bind(
          'owned-card-on-foreign-board',
          foreignBoard.id,
          foreignBoard.columns[0].id,
          userId,
          'Wrong board',
          '',
          99,
          1,
          1
        ),
      runtime.d1
        .prepare(
          `
        INSERT INTO kanban_cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .bind('owned-card-with-foreign-column', ownedBoard.id, 'foreign-column', userId, 'Wrong column', '', 100, 1, 1)
    ]);

    const manifest = await createBackupManifest(runtime.db, userId, {
      name: 'Owner',
      email: 'owner@example.com'
    });
    if (manifest.schemaVersion !== 2) throw new Error('Expected a version 2 manifest');

    expect(manifest.notes.map((note) => note.id)).toEqual([ownedNote.id]);
    expect(manifest.tags.map((tag) => tag.id)).toEqual([ownedNote.tags[0].id]);
    expect(manifest.noteTags).toEqual([{ noteId: ownedNote.id, tagId: ownedNote.tags[0].id }]);
    expect(manifest.attachments).toEqual([]);
    expect(manifest.kanbanBoards.map((board) => board.id)).toEqual([ownedBoard.id]);
    expect(manifest.kanbanColumns.every((column) => column.boardId === ownedBoard.id)).toBe(true);
    expect(manifest.kanbanColumns.map((column) => column.id)).not.toContain('foreign-column');
    expect(manifest.kanbanCards.map((card) => card.id)).toEqual([ownedCard.id]);
  });

  it('enforces the board limit inside the insert transaction', async () => {
    if (!runtime) throw new Error('Test runtime was not initialized');
    const rows = Array.from({ length: 29 }, (_, position) => [
      `board-${position}`,
      userId,
      `Board ${position}`,
      '#5288e8',
      position,
      1,
      1
    ]);
    await runtime.d1
      .prepare(
        `
      INSERT INTO kanban_boards (id, user_id, name, color, position, created_at, updated_at)
      SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'),
        json_extract(value, '$[3]'), json_extract(value, '$[4]'), json_extract(value, '$[5]'),
        json_extract(value, '$[6]') FROM json_each(?)
    `
      )
      .bind(JSON.stringify(rows))
      .run();

    const results = await Promise.allSettled([
      createKanbanBoard(runtime.db, userId, { name: 'Concurrent A' }),
      createKanbanBoard(runtime.db, userId, { name: 'Concurrent B' })
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await runtime.d1.prepare('SELECT count(*) AS count FROM kanban_boards').first<number>('count')).toBe(30);
  });
});
