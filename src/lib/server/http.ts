import { json } from '@sveltejs/kit';
import { ZodError } from 'zod';

export function apiError(error: unknown): Response {
  if (error instanceof ZodError) {
    return json({ error: 'Invalid request', issues: error.issues }, { status: 400 });
  }

  console.error(JSON.stringify({
    message: 'request failed',
    error: error instanceof Error ? error.message : String(error)
  }));
  return json({ error: 'Internal server error' }, { status: 500 });
}

export function unauthorized(): Response {
  return json({ error: 'Unauthorized' }, { status: 401 });
}
