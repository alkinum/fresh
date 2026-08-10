import { getDb } from '@/db';
import { deleteKanbanColumn, updateKanbanColumn } from '$lib/server/kanban';
import { apiError, readJsonBody, unauthorized } from '$lib/server/http';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const updateSchema = z.object({
  name: z.string().trim().min(1).max(60)
});

export const PATCH: RequestHandler = async ({ locals, params, platform, request }) => {
  if (!locals.user || !platform?.env.DB) return unauthorized();
  try {
    const { name } = updateSchema.parse(await readJsonBody(request, 1024));
    const column = await updateKanbanColumn(getDb(platform.env.DB), locals.user.id, params.id, name);
    return column ? json(column) : json({ error: 'Column not found' }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
};

export const DELETE: RequestHandler = async ({ locals, params, platform }) => {
  if (!locals.user || !platform?.env.DB) return unauthorized();
  try {
    const deleted = await deleteKanbanColumn(getDb(platform.env.DB), locals.user.id, params.id);
    return deleted
      ? new Response(null, { status: 204 })
      : json({ error: 'Column not found' }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
};
