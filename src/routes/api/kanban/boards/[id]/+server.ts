import { getDb } from '@/db';
import { KANBAN_BOARD_COLORS } from '$lib/server/kanban';
import {
  deleteKanbanBoard,
  getKanbanBoard,
  updateKanbanBoard
} from '$lib/server/kanban';
import { apiError, readJsonBody, unauthorized } from '$lib/server/http';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  color: z.enum(KANBAN_BOARD_COLORS).optional()
}).refine((value) => Object.keys(value).length > 0, 'No changes supplied');

export const GET: RequestHandler = async ({ locals, params, platform }) => {
  if (!locals.user || !platform?.env.DB) return unauthorized();
  try {
    const board = await getKanbanBoard(getDb(platform.env.DB), locals.user.id, params.id);
    return board ? json(board) : json({ error: 'Board not found' }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
};

export const PATCH: RequestHandler = async ({ locals, params, platform, request }) => {
  if (!locals.user || !platform?.env.DB) return unauthorized();
  try {
    const input = updateSchema.parse(await readJsonBody(request, 2048));
    const board = await updateKanbanBoard(getDb(platform.env.DB), locals.user.id, params.id, input);
    return board ? json(board) : json({ error: 'Board not found' }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
};

export const DELETE: RequestHandler = async ({ locals, params, platform }) => {
  if (!locals.user || !platform?.env.DB) return unauthorized();
  try {
    const deleted = await deleteKanbanBoard(getDb(platform.env.DB), locals.user.id, params.id);
    return deleted
      ? new Response(null, { status: 204 })
      : json({ error: 'Board not found' }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
};
