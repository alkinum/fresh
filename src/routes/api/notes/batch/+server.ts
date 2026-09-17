import { getDb } from '@/db';
import { apiError, readJsonBody, unauthorized } from '$lib/server/http';
import { getNotesByIds } from '$lib/server/notes';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const schema = z.object({ ids: z.array(z.string().uuid()).min(1).max(100) });

export const POST: RequestHandler = async ({ locals, platform, request }) => {
  if (!locals.user || !platform?.env.DB) return unauthorized();
  try {
    const { ids } = schema.parse(await readJsonBody(request, 8192));
    return json(await getNotesByIds(getDb(platform.env.DB), locals.user.id, ids));
  } catch (error) {
    return apiError(error);
  }
};
