import { getDb } from '@/db';
import { attachments } from '@/db/schema';
import {
  canPreviewAttachment,
  findAttachment,
  normalizeMediaType,
  resolveAttachmentRange,
  type AttachmentByteRange
} from '$lib/server/attachments';
import { apiError, unauthorized } from '$lib/server/http';
import { and, eq } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function rangeHeaders(object: R2Object, range?: AttachmentByteRange): { status: number; headers: Headers } {
  const headers = new Headers();
  headers.set('accept-ranges', 'bytes');
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'private, max-age=3600');

  if (!range) {
    headers.set('content-length', String(object.size));
    return { status: 200, headers };
  }

  headers.set('content-range', `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`);
  headers.set('content-length', String(range.length));
  return { status: 206, headers };
}

function unsatisfiableRange(object: R2Object, attachment: Parameters<typeof attachmentHeaders>[0], request: Request): Response {
  const headers = attachmentHeaders(attachment, request);
  headers.set('accept-ranges', 'bytes');
  headers.set('content-range', `bytes */${object.size}`);
  headers.set('etag', object.httpEtag);
  return new Response(null, { status: 416, headers });
}

function attachmentHeaders(
  attachment: Awaited<ReturnType<typeof findAttachment>> & {},
  request: Request
): Headers {
  const headers = new Headers();
  const mediaType = normalizeMediaType(attachment.mediaType);
  const forceDownload = new URL(request.url).searchParams.get('download') === '1';
  const inline = !forceDownload && canPreviewAttachment(mediaType);

  headers.set('content-type', inline ? mediaType : 'application/octet-stream');
  headers.set('content-disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`);
  headers.set('cache-control', 'private, max-age=3600');
  headers.set('content-security-policy', "sandbox; default-src 'none'; frame-ancestors 'self'");
  headers.set('cross-origin-resource-policy', 'same-origin');
  headers.set('x-content-type-options', 'nosniff');
  return headers;
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

  const rangeHeader = request.headers.get('range');

  if (!includeBody) {
    const object = await bucket.head(attachment.r2Key);
    if (!object) return json({ error: 'Attachment data not found' }, { status: 404 });
    const resolved = resolveAttachmentRange(rangeHeader, object.size);
    if (resolved.kind === 'unsatisfiable') return unsatisfiableRange(object, attachment, request);
    const response = rangeHeaders(object, resolved.kind === 'range' ? resolved.range : undefined);
    for (const [name, value] of attachmentHeaders(attachment, request)) response.headers.set(name, value);
    return new Response(null, response);
  }

  if (rangeHeader !== null) {
    const metadata = await bucket.head(attachment.r2Key);
    if (!metadata) return json({ error: 'Attachment data not found' }, { status: 404 });
    const resolved = resolveAttachmentRange(rangeHeader, metadata.size);
    if (resolved.kind !== 'range') return unsatisfiableRange(metadata, attachment, request);

    const object = await bucket.get(attachment.r2Key, { range: resolved.range });
    if (!object) return json({ error: 'Attachment data not found' }, { status: 404 });
    const response = rangeHeaders(metadata, resolved.range);
    for (const [name, value] of attachmentHeaders(attachment, request)) response.headers.set(name, value);
    return new Response(object.body, response);
  }

  const object = await bucket.get(attachment.r2Key);
  if (!object) return json({ error: 'Attachment data not found' }, { status: 404 });
  const response = rangeHeaders(object);
  for (const [name, value] of attachmentHeaders(attachment, request)) response.headers.set(name, value);
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
    await db
      .delete(attachments)
      .where(and(eq(attachments.id, attachment.id), eq(attachments.userId, locals.user.id)));
    try {
      await platform.env.ATTACHMENTS.delete(attachment.r2Key);
    } catch (error) {
      console.error(JSON.stringify({
        message: 'could not remove deleted attachment object',
        attachmentId: attachment.id,
        error: error instanceof Error ? error.message : String(error)
      }));
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
};
