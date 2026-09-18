import { json } from '@sveltejs/kit';
import { getDb } from '@/db';
import { readAvatar, replaceAvatar } from '$lib/server/account';
import { apiError, unauthorized } from '$lib/server/http';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ locals, platform, request }) => {
  if (!locals.user || !platform?.env.DB || !platform.env.ATTACHMENTS) return unauthorized();
  try {
    return json(
      await replaceAvatar(getDb(platform.env.DB), platform.env.ATTACHMENTS, locals.user.id, await readAvatar(request)),
    );
  } catch (error) {
    return apiError(error);
  }
};

export const DELETE: RequestHandler = async ({ locals, platform }) => {
  if (!locals.user || !platform?.env.DB || !platform.env.ATTACHMENTS) return unauthorized();
  try {
    return json(await replaceAvatar(getDb(platform.env.DB), platform.env.ATTACHMENTS, locals.user.id, null));
  } catch (error) {
    return apiError(error);
  }
};
