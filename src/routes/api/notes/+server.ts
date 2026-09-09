import { getDb } from '@/db';
import { MAX_NOTE_CONTENT_CHARACTERS, MAX_NOTE_JSON_BODY_BYTES } from '$lib/note-limits';
import { apiError, readJsonBody, unauthorized } from '$lib/server/http';
import { createNote, listNotes } from '$lib/server/notes';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const createSchema = z.object({
  content: z.string().trim().min(1).max(MAX_NOTE_CONTENT_CHARACTERS),
  colorIndicator: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
  isFavorite: z.boolean().optional()
});
const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  tagId: z.string().uuid().optional(),
  search: z.string().trim().max(200).optional(),
  favorite: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional()
});

export const GET: RequestHandler = async ({ locals, platform, url }) => {
  if (!locals.user || !platform?.env.DB) return unauthorized();

  try {
    const query = querySchema.parse({
      page: url.searchParams.get('page') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
      tagId: url.searchParams.get('tagId') ?? undefined,
      search: url.searchParams.get('search') ?? undefined,
      favorite: url.searchParams.get('favorite') ?? undefined
    });
    const result = await listNotes(getDb(platform.env.DB), {
      userId: locals.user.id,
      ...query
    });
    return json(result);
  } catch (error) {
    return apiError(error);
  }
};

export const POST: RequestHandler = async ({ locals, platform, request }) => {
  if (!locals.user || !platform?.env.DB) return unauthorized();

  try {
    const input = createSchema.parse(await readJsonBody(request, MAX_NOTE_JSON_BODY_BYTES));
    const note = await createNote(getDb(platform.env.DB), locals.user.id, input);
    return json(note, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
};
