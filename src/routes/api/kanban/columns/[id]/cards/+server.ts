import { getDb } from '@/db';
import {
  MAX_KANBAN_CARD_TITLE_CHARACTERS,
  MAX_KANBAN_CARD_DESCRIPTION_CHARACTERS,
  MAX_KANBAN_CARD_JSON_BODY_BYTES
} from '$lib/kanban-limits';
import { createKanbanCard } from '$lib/server/kanban';
import { apiError, readJsonBody, unauthorized } from '$lib/server/http';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const createSchema = z.object({
  title: z.string().trim().min(1).max(MAX_KANBAN_CARD_TITLE_CHARACTERS),
  description: z.string().trim().max(MAX_KANBAN_CARD_DESCRIPTION_CHARACTERS).optional()
});

export const POST: RequestHandler = async ({ locals, params, platform, request }) => {
  if (!locals.user || !platform?.env.DB) return unauthorized();
  try {
    const input = createSchema.parse(await readJsonBody(request, MAX_KANBAN_CARD_JSON_BODY_BYTES));
    const card = await createKanbanCard(getDb(platform.env.DB), locals.user.id, params.id, input);
    return card
      ? json(card, { status: 201 })
      : json({ error: 'Column not found' }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
};
