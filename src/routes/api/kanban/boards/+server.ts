import { getDb } from '@/db';
import {
  createKanbanBoard,
  KANBAN_BOARD_COLORS,
  listKanbanBoards
} from '$lib/server/kanban';
import { apiError, readJsonBody, unauthorized } from '$lib/server/http';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: z.enum(KANBAN_BOARD_COLORS).optional()
});

export const GET: RequestHandler = async ({ locals, platform }) => {
  if (!locals.user || !platform?.env.DB) return unauthorized();
  try {
    return json(await listKanbanBoards(getDb(platform.env.DB), locals.user.id));
  } catch (error) {
    return apiError(error);
  }
};

export const POST: RequestHandler = async ({ locals, platform, request }) => {
  if (!locals.user || !platform?.env.DB) return unauthorized();
  try {
    const input = createSchema.parse(await readJsonBody(request, 2048));
    const board = await createKanbanBoard(getDb(platform.env.DB), locals.user.id, input);
    return json(board, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
};
