import { error, redirect } from '@sveltejs/kit';
import { getDb } from '@/db';
import { listNotes, listTags } from '$lib/server/notes';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ depends, locals, platform }) => {
  depends('fresh:notes');

  if (!locals.user) redirect(303, '/login');
  if (!platform?.env.DB) error(503, 'Database unavailable');

  const db = getDb(platform.env.DB);
  const [notes, tags] = await Promise.all([
    listNotes(db, { userId: locals.user.id, page: 1, limit: 30 }),
    listTags(db, locals.user.id)
  ]);

  return { user: locals.user, notes, tags };
};
