import { getDb } from '@/db';
import { unauthorized } from '$lib/server/http';
import { listTags } from '$lib/server/notes';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform }) => {
  if (!locals.user || !platform?.env.DB) return unauthorized();
  return json(await listTags(getDb(platform.env.DB), locals.user.id));
};
