import { getDb } from '@/db';
import { deleteKanbanCard, updateKanbanCard } from '$lib/server/kanban';
import { apiError, readJsonBody, unauthorized } from '$lib/server/http';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(10_000).optional(),
  columnId: z.string().uuid().optional(),
  position: z.number().int().nonnegative().max(500).optional()
}).refine((value) => Object.keys(value).length > 0, 'No changes supplied').refine(
  (value) => (value.columnId === undefined) === (value.position === undefined),
  'Column and position must be supplied together'
);

export const PATCH: RequestHandler = async ({ locals, params, platform, request }) => {
  if (!locals.user || !platform?.env.DB) return unauthorized();
  try {
    const input = updateSchema.parse(await readJsonBody(request, 12 * 1024));
    const card = await updateKanbanCard(getDb(platform.env.DB), locals.user.id, params.id, input);
    return card ? json(card) : json({ error: 'Card not found' }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
};

export const DELETE: RequestHandler = async ({ locals, params, platform }) => {
  if (!locals.user || !platform?.env.DB) return unauthorized();
  try {
    const deleted = await deleteKanbanCard(getDb(platform.env.DB), locals.user.id, params.id);
    return deleted
      ? new Response(null, { status: 204 })
      : json({ error: 'Card not found' }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
};
