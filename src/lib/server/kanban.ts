import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '@/db';
import { kanbanBoards, kanbanCards, kanbanColumns } from '@/db/schema';
import { RequestError } from '$lib/server/http';
import type {
  KanbanBoardDto,
  KanbanBoardSummaryDto,
  KanbanCardDto,
  KanbanColumnDto
} from '$lib/types';

export const KANBAN_BOARD_COLORS = [
  '#5288e8',
  '#31a279',
  '#e69a2c',
  '#df6676',
  '#8b72d9',
  '#d65d9e'
] as const;

const maxBoards = 30;
const maxColumnsPerBoard = 12;
const maxCardsPerBoard = 500;
const defaultColumns = ['To do', 'In progress', 'Done'];

interface CreateBoardInput {
  name: string;
  color?: string;
}

interface UpdateBoardInput {
  name?: string;
  color?: string;
}

interface UpdateCardInput {
  title?: string;
  description?: string;
  columnId?: string;
  position?: number;
}

function cardDto(card: typeof kanbanCards.$inferSelect): KanbanCardDto {
  return {
    id: card.id,
    boardId: card.boardId,
    columnId: card.columnId,
    title: card.title,
    description: card.description,
    position: card.position,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString()
  };
}

function columnDto(
  column: typeof kanbanColumns.$inferSelect,
  cards: KanbanCardDto[]
): KanbanColumnDto {
  return {
    id: column.id,
    boardId: column.boardId,
    name: column.name,
    position: column.position,
    createdAt: column.createdAt.toISOString(),
    updatedAt: column.updatedAt.toISOString(),
    cards
  };
}

function summaryDto(
  board: typeof kanbanBoards.$inferSelect,
  columnCount: number,
  cardCount: number
): KanbanBoardSummaryDto {
  return {
    id: board.id,
    name: board.name,
    color: board.color,
    position: board.position,
    columnCount,
    cardCount,
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString()
  };
}

async function ownedBoard(
  db: Database,
  userId: string,
  boardId: string
): Promise<typeof kanbanBoards.$inferSelect | undefined> {
  const [board] = await db
    .select()
    .from(kanbanBoards)
    .where(and(eq(kanbanBoards.id, boardId), eq(kanbanBoards.userId, userId)))
    .limit(1);
  return board;
}

export async function listKanbanBoards(
  db: Database,
  userId: string
): Promise<KanbanBoardSummaryDto[]> {
  const boards = await db
    .select()
    .from(kanbanBoards)
    .where(eq(kanbanBoards.userId, userId))
    .orderBy(asc(kanbanBoards.position), asc(kanbanBoards.createdAt));
  if (boards.length === 0) return [];

  const boardIds = boards.map((board) => board.id);
  const [columnCounts, cardCounts] = await Promise.all([
    db
      .select({ boardId: kanbanColumns.boardId, count: sql<number>`count(*)` })
      .from(kanbanColumns)
      .where(and(eq(kanbanColumns.userId, userId), inArray(kanbanColumns.boardId, boardIds)))
      .groupBy(kanbanColumns.boardId),
    db
      .select({ boardId: kanbanCards.boardId, count: sql<number>`count(*)` })
      .from(kanbanCards)
      .where(and(eq(kanbanCards.userId, userId), inArray(kanbanCards.boardId, boardIds)))
      .groupBy(kanbanCards.boardId)
  ]);
  const columnsByBoard = new Map(columnCounts.map((row) => [row.boardId, Number(row.count)]));
  const cardsByBoard = new Map(cardCounts.map((row) => [row.boardId, Number(row.count)]));

  return boards.map((board) => summaryDto(
    board,
    columnsByBoard.get(board.id) ?? 0,
    cardsByBoard.get(board.id) ?? 0
  ));
}

export async function getKanbanBoard(
  db: Database,
  userId: string,
  boardId: string
): Promise<KanbanBoardDto | undefined> {
  const board = await ownedBoard(db, userId, boardId);
  if (!board) return undefined;

  const [columns, cards] = await Promise.all([
    db
      .select()
      .from(kanbanColumns)
      .where(and(eq(kanbanColumns.boardId, boardId), eq(kanbanColumns.userId, userId)))
      .orderBy(asc(kanbanColumns.position), asc(kanbanColumns.createdAt)),
    db
      .select()
      .from(kanbanCards)
      .where(and(eq(kanbanCards.boardId, boardId), eq(kanbanCards.userId, userId)))
      .orderBy(asc(kanbanCards.position), asc(kanbanCards.createdAt))
  ]);
  const cardsByColumn = new Map<string, KanbanCardDto[]>();
  for (const card of cards) {
    const list = cardsByColumn.get(card.columnId) ?? [];
    list.push(cardDto(card));
    cardsByColumn.set(card.columnId, list);
  }

  return {
    ...summaryDto(board, columns.length, cards.length),
    columns: columns.map((column) => columnDto(column, cardsByColumn.get(column.id) ?? []))
  };
}

export async function createKanbanBoard(
  db: Database,
  userId: string,
  input: CreateBoardInput
): Promise<KanbanBoardDto> {
  const [stats] = await db
    .select({
      count: sql<number>`count(*)`
    })
    .from(kanbanBoards)
    .where(eq(kanbanBoards.userId, userId));
  if (Number(stats?.count ?? 0) >= maxBoards) {
    throw new RequestError(`A workspace can contain up to ${maxBoards} boards`, 409);
  }

  const now = new Date();
  const id = crypto.randomUUID();
  const timestamp = Math.floor(now.getTime() / 1000);
  const color = input.color ?? KANBAN_BOARD_COLORS[Number(stats?.count ?? 0) % KANBAN_BOARD_COLORS.length];
  const columnValues = defaultColumns.map((name, position) => [crypto.randomUUID(), name, position]);
  const [created] = await db.$client.batch([
    db.$client.prepare(`
      INSERT INTO kanban_boards (id, user_id, name, color, position, created_at, updated_at)
      SELECT ?, ?, ?, ?,
        (SELECT coalesce(max(position), -1) + 1 FROM kanban_boards WHERE user_id = ?), ?, ?
      WHERE (SELECT count(*) FROM kanban_boards WHERE user_id = ?) < ?
    `).bind(id, userId, input.name.trim(), color, userId, timestamp, timestamp, userId, maxBoards),
    db.$client.prepare(`
      INSERT INTO kanban_columns (id, board_id, user_id, name, position, created_at, updated_at)
      SELECT json_extract(value, '$[0]'), ?, ?, json_extract(value, '$[1]'), json_extract(value, '$[2]'), ?, ?
      FROM json_each(?)
      WHERE EXISTS (SELECT 1 FROM kanban_boards WHERE id = ? AND user_id = ?)
    `).bind(id, userId, timestamp, timestamp, JSON.stringify(columnValues), id, userId)
  ]);
  if (Number(created.meta.changes ?? 0) === 0) {
    throw new RequestError(`A workspace can contain up to ${maxBoards} boards`, 409);
  }

  return (await getKanbanBoard(db, userId, id))!;
}

export async function updateKanbanBoard(
  db: Database,
  userId: string,
  boardId: string,
  input: UpdateBoardInput
): Promise<KanbanBoardDto | undefined> {
  if (!await ownedBoard(db, userId, boardId)) return undefined;
  await db
    .update(kanbanBoards)
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      updatedAt: new Date()
    })
    .where(and(eq(kanbanBoards.id, boardId), eq(kanbanBoards.userId, userId)));
  return getKanbanBoard(db, userId, boardId);
}

export async function deleteKanbanBoard(
  db: Database,
  userId: string,
  boardId: string
): Promise<boolean> {
  const board = await ownedBoard(db, userId, boardId);
  if (!board) return false;
  await db
    .delete(kanbanBoards)
    .where(and(eq(kanbanBoards.id, boardId), eq(kanbanBoards.userId, userId)));
  return true;
}

export async function createKanbanColumn(
  db: Database,
  userId: string,
  boardId: string,
  name: string
): Promise<KanbanColumnDto | undefined> {
  if (!await ownedBoard(db, userId, boardId)) return undefined;
  const [stats] = await db
    .select({
      count: sql<number>`count(*)`
    })
    .from(kanbanColumns)
    .where(and(eq(kanbanColumns.boardId, boardId), eq(kanbanColumns.userId, userId)));
  if (Number(stats?.count ?? 0) >= maxColumnsPerBoard) {
    throw new RequestError(`A board can contain up to ${maxColumnsPerBoard} columns`, 409);
  }

  const now = new Date();
  const id = crypto.randomUUID();
  const timestamp = Math.floor(now.getTime() / 1000);
  const [created] = await db.$client.batch([
    db.$client.prepare(`
      INSERT INTO kanban_columns (id, board_id, user_id, name, position, created_at, updated_at)
      SELECT ?, ?, ?, ?,
        (SELECT coalesce(max(position), -1) + 1 FROM kanban_columns WHERE board_id = ? AND user_id = ?), ?, ?
      WHERE EXISTS (SELECT 1 FROM kanban_boards WHERE id = ? AND user_id = ?)
        AND (SELECT count(*) FROM kanban_columns WHERE board_id = ? AND user_id = ?) < ?
    `).bind(
      id,
      boardId,
      userId,
      name.trim(),
      boardId,
      userId,
      timestamp,
      timestamp,
      boardId,
      userId,
      boardId,
      userId,
      maxColumnsPerBoard
    ),
    db.$client.prepare(`
      UPDATE kanban_boards SET updated_at = ?
      WHERE id = ? AND user_id = ?
        AND EXISTS (SELECT 1 FROM kanban_columns WHERE id = ? AND user_id = ?)
    `).bind(timestamp, boardId, userId, id, userId)
  ]);
  if (Number(created.meta.changes ?? 0) === 0) {
    if (!await ownedBoard(db, userId, boardId)) return undefined;
    throw new RequestError(`A board can contain up to ${maxColumnsPerBoard} columns`, 409);
  }

  const board = await getKanbanBoard(db, userId, boardId);
  return board?.columns.find((column) => column.id === id);
}

export async function updateKanbanColumn(
  db: Database,
  userId: string,
  columnId: string,
  name: string
): Promise<KanbanColumnDto | undefined> {
  const [column] = await db
    .select()
    .from(kanbanColumns)
    .where(and(eq(kanbanColumns.id, columnId), eq(kanbanColumns.userId, userId)))
    .limit(1);
  if (!column) return undefined;

  const now = new Date();
  await db.batch([
    db
      .update(kanbanColumns)
      .set({ name: name.trim(), updatedAt: now })
      .where(and(eq(kanbanColumns.id, columnId), eq(kanbanColumns.userId, userId))),
    db
      .update(kanbanBoards)
      .set({ updatedAt: now })
      .where(and(eq(kanbanBoards.id, column.boardId), eq(kanbanBoards.userId, userId)))
  ]);
  const board = await getKanbanBoard(db, userId, column.boardId);
  return board?.columns.find((item) => item.id === columnId);
}

export async function deleteKanbanColumn(
  db: Database,
  userId: string,
  columnId: string
): Promise<boolean> {
  const [column] = await db
    .select({ boardId: kanbanColumns.boardId })
    .from(kanbanColumns)
    .where(and(eq(kanbanColumns.id, columnId), eq(kanbanColumns.userId, userId)))
    .limit(1);
  if (!column) return false;
  await db.batch([
    db
      .delete(kanbanColumns)
      .where(and(eq(kanbanColumns.id, columnId), eq(kanbanColumns.userId, userId))),
    db
      .update(kanbanBoards)
      .set({ updatedAt: new Date() })
      .where(and(eq(kanbanBoards.id, column.boardId), eq(kanbanBoards.userId, userId)))
  ]);
  return true;
}

export async function createKanbanCard(
  db: Database,
  userId: string,
  columnId: string,
  input: { title: string; description?: string }
): Promise<KanbanCardDto | undefined> {
  const [column] = await db
    .select()
    .from(kanbanColumns)
    .where(and(eq(kanbanColumns.id, columnId), eq(kanbanColumns.userId, userId)))
    .limit(1);
  if (!column) return undefined;

  const [boardCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(kanbanCards)
    .where(and(eq(kanbanCards.boardId, column.boardId), eq(kanbanCards.userId, userId)));
  if (Number(boardCount?.count ?? 0) >= maxCardsPerBoard) {
    throw new RequestError(`A board can contain up to ${maxCardsPerBoard} cards`, 409);
  }

  const now = new Date();
  const id = crypto.randomUUID();
  const timestamp = Math.floor(now.getTime() / 1000);
  const [created] = await db.$client.batch([
    db.$client.prepare(`
      INSERT INTO kanban_cards
        (id, board_id, column_id, user_id, title, description, position, created_at, updated_at)
      SELECT ?, ?, ?, ?, ?, ?,
        (SELECT coalesce(max(position), -1) + 1 FROM kanban_cards WHERE column_id = ? AND user_id = ?), ?, ?
      WHERE EXISTS (
        SELECT 1 FROM kanban_columns WHERE id = ? AND board_id = ? AND user_id = ?
      ) AND (SELECT count(*) FROM kanban_cards WHERE board_id = ? AND user_id = ?) < ?
    `).bind(
      id,
      column.boardId,
      columnId,
      userId,
      input.title.trim(),
      input.description?.trim() ?? '',
      columnId,
      userId,
      timestamp,
      timestamp,
      columnId,
      column.boardId,
      userId,
      column.boardId,
      userId,
      maxCardsPerBoard
    ),
    db.$client.prepare(`
      UPDATE kanban_boards SET updated_at = ?
      WHERE id = ? AND user_id = ?
        AND EXISTS (SELECT 1 FROM kanban_cards WHERE id = ? AND user_id = ?)
    `).bind(timestamp, column.boardId, userId, id, userId)
  ]);
  if (Number(created.meta.changes ?? 0) === 0) {
    const [currentColumn] = await db
      .select({ id: kanbanColumns.id })
      .from(kanbanColumns)
      .where(and(eq(kanbanColumns.id, columnId), eq(kanbanColumns.userId, userId)))
      .limit(1);
    if (!currentColumn) return undefined;
    throw new RequestError(`A board can contain up to ${maxCardsPerBoard} cards`, 409);
  }
  const [card] = await db
    .select()
    .from(kanbanCards)
    .where(and(eq(kanbanCards.id, id), eq(kanbanCards.userId, userId)))
    .limit(1);
  return card ? cardDto(card) : undefined;
}

function compactColumnStatement(
  db: Database,
  userId: string,
  columnId: string,
  excludedCardId?: string
): D1PreparedStatement {
  return db.$client.prepare(`
    WITH ordered AS (
      SELECT id, row_number() OVER (ORDER BY position, created_at, id) - 1 AS next_position
      FROM kanban_cards
      WHERE user_id = ? AND column_id = ? AND (? IS NULL OR id != ?)
    )
    UPDATE kanban_cards
    SET position = (SELECT next_position FROM ordered WHERE ordered.id = kanban_cards.id)
    WHERE user_id = ? AND column_id = ? AND id IN (SELECT id FROM ordered)
  `).bind(
    userId,
    columnId,
    excludedCardId ?? null,
    excludedCardId ?? null,
    userId,
    columnId
  );
}

function compactBoardColumnsStatement(
  db: Database,
  userId: string,
  boardId: string
): D1PreparedStatement {
  return db.$client.prepare(`
    WITH ordered AS (
      SELECT id,
        row_number() OVER (PARTITION BY column_id ORDER BY position, created_at, id) - 1 AS next_position
      FROM kanban_cards
      WHERE user_id = ? AND board_id = ?
    )
    UPDATE kanban_cards
    SET position = (SELECT next_position FROM ordered WHERE ordered.id = kanban_cards.id)
    WHERE user_id = ? AND board_id = ? AND id IN (SELECT id FROM ordered)
  `).bind(userId, boardId, userId, boardId);
}

export async function updateKanbanCard(
  db: Database,
  userId: string,
  cardId: string,
  input: UpdateCardInput
): Promise<KanbanCardDto | undefined> {
  const [existing] = await db
    .select()
    .from(kanbanCards)
    .where(and(eq(kanbanCards.id, cardId), eq(kanbanCards.userId, userId)))
    .limit(1);
  if (!existing) return undefined;

  const moving = input.columnId !== undefined && input.position !== undefined;
  const targetColumnId = moving ? input.columnId! : existing.columnId;
  if (moving) {
    const [targetColumn] = await db
      .select({ id: kanbanColumns.id, boardId: kanbanColumns.boardId })
      .from(kanbanColumns)
      .where(and(eq(kanbanColumns.id, targetColumnId), eq(kanbanColumns.userId, userId)))
      .limit(1);
    if (!targetColumn || targetColumn.boardId !== existing.boardId) {
      throw new RequestError('Target column does not belong to this board', 400);
    }
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const title = input.title?.trim() ?? null;
  const description = input.description?.trim() ?? null;
  const statements: D1PreparedStatement[] = moving
    ? [db.$client.prepare(`
        UPDATE kanban_cards
        SET title = coalesce(?, title), description = coalesce(?, description),
          column_id = ?, position = -1, updated_at = ?
        WHERE id = ? AND user_id = ?
      `).bind(title, description, targetColumnId, timestamp, cardId, userId)]
    : [db.$client.prepare(`
        UPDATE kanban_cards
        SET title = coalesce(?, title), description = coalesce(?, description), updated_at = ?
        WHERE id = ? AND user_id = ?
      `).bind(title, description, timestamp, cardId, userId)];
  if (moving) {
    statements.push(
      compactColumnStatement(db, userId, targetColumnId, cardId),
      db.$client.prepare(`
        UPDATE kanban_cards SET position = position + 1
        WHERE user_id = ? AND column_id = ? AND id != ? AND position >= (
          SELECT min(max(?, 0), count(*)) FROM kanban_cards
          WHERE user_id = ? AND column_id = ? AND id != ?
        )
      `).bind(userId, targetColumnId, cardId, input.position!, userId, targetColumnId, cardId),
      db.$client.prepare(`
        UPDATE kanban_cards SET position = (
          SELECT min(max(?, 0), count(*)) FROM kanban_cards
          WHERE user_id = ? AND column_id = ? AND id != ?
        ) WHERE id = ? AND user_id = ?
      `).bind(input.position!, userId, targetColumnId, cardId, cardId, userId)
    );
    statements.push(compactBoardColumnsStatement(db, userId, existing.boardId));
  }
  statements.push(db.$client.prepare(`
    UPDATE kanban_boards SET updated_at = ? WHERE id = ? AND user_id = ?
  `).bind(timestamp, existing.boardId, userId));
  await db.$client.batch(statements);
  const [updated] = await db
    .select()
    .from(kanbanCards)
    .where(and(eq(kanbanCards.id, cardId), eq(kanbanCards.userId, userId)))
    .limit(1);
  return updated ? cardDto(updated) : undefined;
}

export async function deleteKanbanCard(
  db: Database,
  userId: string,
  cardId: string
): Promise<boolean> {
  const [card] = await db
    .select({ boardId: kanbanCards.boardId, columnId: kanbanCards.columnId })
    .from(kanbanCards)
    .where(and(eq(kanbanCards.id, cardId), eq(kanbanCards.userId, userId)))
    .limit(1);
  if (!card) return false;
  const results = await db.$client.batch([
    db.$client.prepare('DELETE FROM kanban_cards WHERE id = ? AND user_id = ?').bind(cardId, userId),
    compactBoardColumnsStatement(db, userId, card.boardId),
    db.$client.prepare('UPDATE kanban_boards SET updated_at = ? WHERE id = ? AND user_id = ?')
      .bind(Math.floor(Date.now() / 1000), card.boardId, userId)
  ]);
  return Number(results[0]?.meta.changes ?? 0) > 0;
}
