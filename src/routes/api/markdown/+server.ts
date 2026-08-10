import { MAX_NOTE_CONTENT_CHARACTERS, MAX_NOTE_JSON_BODY_BYTES } from '$lib/note-limits';
import { apiError, readJsonBody, unauthorized } from '$lib/server/http';
import { renderMarkdown } from '$lib/server/markdown';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const schema = z.object({ content: z.string().max(MAX_NOTE_CONTENT_CHARACTERS) });

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) return unauthorized();
  try {
    const { content } = schema.parse(await readJsonBody(request, MAX_NOTE_JSON_BODY_BYTES));
    return json({ html: renderMarkdown(content) });
  } catch (error) {
    return apiError(error);
  }
};
