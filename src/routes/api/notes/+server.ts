import { getDb } from '@/db';
import { apiError, unauthorized } from '$lib/server/http';
import { createNote, listNotes } from '$lib/server/notes';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const createSchema = z.object({
  content: z.string().trim().min(1).max(1_000_000),
  colorIndicator: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  isFavorite: z.boolean().optional()
});

export const GET: RequestHandler = async ({ locals, platform, url }) => {
  if (!locals.user || !platform?.env.DB) return unauthorized();

  try {
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 30);
    const favoriteValue = url.searchParams.get('favorite');
    const result = await listNotes(getDb(platform.env.DB), {
      userId: locals.user.id,
      page: Number.isFinite(page) ? page : 1,
      limit: Number.isFinite(limit) ? limit : 30,
      tagId: url.searchParams.get('tagId') ?? undefined,
      favorite: favoriteValue === null ? undefined : favoriteValue === 'true'
    });
    return json(result);
  } catch (error) {
    return apiError(error);
  }
};

export const POST: RequestHandler = async ({ locals, platform, request }) => {
  if (!locals.user || !platform?.env.DB) return unauthorized();

  try {
    const input = createSchema.parse(await request.json());
    const note = await createNote(getDb(platform.env.DB), locals.user.id, input);
    return json(note, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
};
