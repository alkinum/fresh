import { getDb } from '@/db';
import { apiError, unauthorized } from '$lib/server/http';
import { toggleTaskItem } from '$lib/server/markdown';
import { deleteNote, getNote, updateNote } from '$lib/server/notes';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const updateSchema = z.object({
  content: z.string().trim().min(1).max(1_000_000).optional(),
  colorIndicator: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  isFavorite: z.boolean().optional(),
  taskIndex: z.number().int().nonnegative().optional(),
  taskChecked: z.boolean().optional()
}).refine((value) => Object.keys(value).length > 0, 'No changes supplied').refine(
  (value) => (value.taskIndex === undefined) === (value.taskChecked === undefined),
  'Task index and checked state must be supplied together'
).refine(
  (value) => value.taskIndex === undefined || (
    value.content === undefined
    && value.colorIndicator === undefined
    && value.isFavorite === undefined
  ),
  'Task updates cannot be combined with other changes'
);

export const GET: RequestHandler = async ({ locals, params, platform }) => {
  if (!locals.user || !platform?.env.DB) return unauthorized();
  const note = await getNote(getDb(platform.env.DB), locals.user.id, params.id);
  return note ? json(note) : json({ error: 'Note not found' }, { status: 404 });
};

export const PATCH: RequestHandler = async ({ locals, params, platform, request }) => {
  if (!locals.user || !platform?.env.DB) return unauthorized();

  try {
    const input = updateSchema.parse(await request.json());
    const db = getDb(platform.env.DB);

    if (input.taskIndex !== undefined && input.taskChecked !== undefined) {
      const existing = await getNote(db, locals.user.id, params.id);
      if (!existing) return json({ error: 'Note not found' }, { status: 404 });

      const content = toggleTaskItem(existing.content, input.taskIndex, input.taskChecked);
      if (content === null) return json({ error: 'Task item not found' }, { status: 400 });

      const note = await updateNote(db, locals.user.id, params.id, { content });
      return note ? json(note) : json({ error: 'Note not found' }, { status: 404 });
    }

    const note = await updateNote(db, locals.user.id, params.id, {
      content: input.content,
      colorIndicator: input.colorIndicator,
      isFavorite: input.isFavorite
    });
    return note ? json(note) : json({ error: 'Note not found' }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
};

export const DELETE: RequestHandler = async ({ locals, params, platform }) => {
  if (!locals.user || !platform?.env.DB || !platform.env.ATTACHMENTS) return unauthorized();

  try {
    const deleted = await deleteNote(
      getDb(platform.env.DB),
      platform.env.ATTACHMENTS,
      locals.user.id,
      params.id
    );
    return deleted
      ? new Response(null, { status: 204 })
      : json({ error: 'Note not found' }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
};
