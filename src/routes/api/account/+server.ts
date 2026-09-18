import { json } from '@sveltejs/kit';
import { getDb } from '@/db';
import { accountSchema, updateAccount } from '$lib/server/account';
import { apiError, readJsonBody, unauthorized } from '$lib/server/http';
import { preferenceCookie } from '$lib/preferences';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ locals, platform, request, cookies, url }) => {
  if (!locals.user || !platform?.env.DB) return unauthorized();
  try {
    const input = accountSchema.parse(await readJsonBody(request, 4096));
    const result = await updateAccount(getDb(platform.env.DB), locals.user.id, input);
    if (input.preferences)
      cookies.set(preferenceCookie, JSON.stringify(result.preferences), {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: url.protocol === 'https:',
        maxAge: 60 * 60 * 24 * 365,
      });
    return json(result);
  } catch (error) {
    return apiError(error);
  }
};
