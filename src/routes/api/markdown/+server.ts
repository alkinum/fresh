import { unauthorized } from '$lib/server/http';
import { renderMarkdown } from '$lib/server/markdown';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const schema = z.object({ content: z.string().max(1_000_000) });

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) return unauthorized();
  const { content } = schema.parse(await request.json());
  return json({ html: renderMarkdown(content) });
};
