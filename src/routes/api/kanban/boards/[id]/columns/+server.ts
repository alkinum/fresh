import { getDb } from '@/db';
import { createKanbanColumn } from '$lib/server/kanban';
import { apiError, readJsonBody, unauthorized } from '$lib/server/http';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const createSchema = z.object({
  name: z.string().trim().min(1).max(60)
});

export const POST: RequestHandler = async ({ locals, params, platform, request }) => {
  if (!locals.user || !platform?.env.DB) return unauthorized();
  try {
    const { name } = createSchema.parse(await readJsonBody(request, 1024));
    const column = await createKanbanColumn(getDb(platform.env.DB), locals.user.id, params.id, name);
    return column
      ? json(column, { status: 201 })
      : json({ error: 'Board not found' }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
};
