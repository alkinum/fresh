import { getDb } from '@/db';
import { attachments } from '@/db/schema';
import { findAttachment } from '$lib/server/attachments';
import { apiError, unauthorized } from '$lib/server/http';
import { eq } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function requestedRange(header: string | null): R2Range | undefined {
  if (!header?.startsWith('bytes=') || header.includes(',')) return undefined;
  const [startValue, endValue] = header.slice(6).split('-', 2);
  const start = startValue ? Number(startValue) : undefined;
  const end = endValue ? Number(endValue) : undefined;

  if (start !== undefined && (!Number.isSafeInteger(start) || start < 0)) return undefined;
  if (end !== undefined && (!Number.isSafeInteger(end) || end < 0)) return undefined;
  if (start !== undefined && end !== undefined) {
    if (end < start) return undefined;
    return { offset: start, length: end - start + 1 };
  }
  if (start !== undefined) return { offset: start };
  if (end !== undefined && end > 0) return { suffix: end };
  return undefined;
}

function rangeHeaders(object: R2ObjectBody, request: Request): { status: number; headers: Headers } {
  const headers = new Headers();
  headers.set('accept-ranges', 'bytes');
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'private, max-age=3600');

  if (!request.headers.has('range') || !object.range) {
    headers.set('content-length', String(object.size));
    return { status: 200, headers };
  }

  let offset: number;
  let length: number;
  if ('suffix' in object.range) {
    length = object.range.suffix;
    offset = object.size - length;
  } else {
    offset = object.range.offset ?? 0;
    length = object.range.length ?? object.size - offset;
  }
  headers.set('content-range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
  headers.set('content-length', String(length));
  return { status: 206, headers };
}

async function serve(
  request: Request,
  userId: string,
  id: string,
  db: ReturnType<typeof getDb>,
  bucket: R2Bucket,
  includeBody: boolean
): Promise<Response> {
  const attachment = await findAttachment(db, userId, id);
  if (!attachment) return json({ error: 'Attachment not found' }, { status: 404 });

  if (!includeBody) {
    const object = await bucket.head(attachment.r2Key);
    if (!object) return json({ error: 'Attachment data not found' }, { status: 404 });
    const headers = new Headers();
    headers.set('content-type', attachment.mediaType);
    headers.set('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`);
    headers.set('content-length', String(object.size));
    headers.set('accept-ranges', 'bytes');
    headers.set('etag', object.httpEtag);
    return new Response(null, { headers });
  }

  const range = requestedRange(request.headers.get('range'));
  const object = await bucket.get(attachment.r2Key, range ? { range } : undefined);
  if (!object) return json({ error: 'Attachment data not found' }, { status: 404 });
  const response = rangeHeaders(object, request);
  response.headers.set('content-type', attachment.mediaType);
  response.headers.set('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`);
  return new Response(object.body, response);
}

export const GET: RequestHandler = async ({ locals, params, platform, request }) => {
  if (!locals.user || !platform?.env.DB || !platform.env.ATTACHMENTS) return unauthorized();
  try {
    return await serve(request, locals.user.id, params.id, getDb(platform.env.DB), platform.env.ATTACHMENTS, true);
  } catch (error) {
    return apiError(error);
  }
};

export const HEAD: RequestHandler = async ({ locals, params, platform, request }) => {
  if (!locals.user || !platform?.env.DB || !platform.env.ATTACHMENTS) return unauthorized();
  try {
    return await serve(request, locals.user.id, params.id, getDb(platform.env.DB), platform.env.ATTACHMENTS, false);
  } catch (error) {
    return apiError(error);
  }
};

export const DELETE: RequestHandler = async ({ locals, params, platform }) => {
  if (!locals.user || !platform?.env.DB || !platform.env.ATTACHMENTS) return unauthorized();

  try {
    const db = getDb(platform.env.DB);
    const attachment = await findAttachment(db, locals.user.id, params.id);
    if (!attachment) return json({ error: 'Attachment not found' }, { status: 404 });
    await platform.env.ATTACHMENTS.delete(attachment.r2Key);
    await db.delete(attachments).where(eq(attachments.id, attachment.id));
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
};
