import { getDb } from '@/db';
import { createKanbanCard } from '$lib/server/kanban';
import { apiError, readJsonBody, unauthorized } from '$lib/server/http';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10_000).optional()
});

export const POST: RequestHandler = async ({ locals, params, platform, request }) => {
  if (!locals.user || !platform?.env.DB) return unauthorized();
  try {
    const input = createSchema.parse(await readJsonBody(request, 12 * 1024));
    const card = await createKanbanCard(getDb(platform.env.DB), locals.user.id, params.id, input);
    return card
      ? json(card, { status: 201 })
      : json({ error: 'Column not found' }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
};
