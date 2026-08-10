import { json } from '@sveltejs/kit';
import { ZodError } from 'zod';

export class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'RequestError';
  }
}

export function apiError(error: unknown): Response {
  if (error instanceof ZodError) {
    return json({ error: 'Invalid request', issues: error.issues }, { status: 400 });
  }

  if (error instanceof RequestError) {
    return json({ error: error.message }, { status: error.status });
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

export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestError('Request body is too large', 413);
  }
  if (!request.body) throw new RequestError('Request body is required', 400);

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let byteLength = 0;
  let body = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maxBytes) throw new RequestError('Request body is too large', 413);
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new RequestError('Request body must contain valid JSON', 400);
  }
}
