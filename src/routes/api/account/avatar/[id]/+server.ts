import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { apiError, unauthorized } from '$lib/server/http';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform, params }) => {
  if (!locals.user || !platform?.env.ATTACHMENTS) return unauthorized();
  try {
    const id = z.uuid().parse(params.id);
    const object = await platform.env.ATTACHMENTS.get(`avatars/${locals.user.id}/${id}`);
    if (!object) return json({ error: 'Avatar not found' }, { status: 404 });
    return new Response(object.body, {
      headers: {
        'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
        'cache-control': 'private, max-age=3600',
        'x-content-type-options': 'nosniff',
        'cross-origin-resource-policy': 'same-origin',
      },
    });
  } catch (error) {
    return apiError(error);
  }
};
