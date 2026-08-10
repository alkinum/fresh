import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { attachments, notes } from '@/db/schema';
import {
  attachmentDto,
  classifyAttachment,
  MAX_ATTACHMENT_BYTES,
  normalizeMediaType,
  safeFileName
} from '$lib/server/attachments';
import { apiError, RequestError, unauthorized } from '$lib/server/http';
import { putSizedObject, UploadSizeError } from '$lib/server/r2-upload';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const uploadIdSchema = z.string().uuid();

function isAttachmentIdConflict(error: unknown): boolean {
  return error instanceof Error && /unique constraint|constraint failed/i.test(error.message);
}

export const POST: RequestHandler = async ({ locals, params, platform, request }) => {
  if (!locals.user || !platform?.env.DB || !platform.env.ATTACHMENTS) return unauthorized();

  try {
    const rawName = request.headers.get('x-file-name');
    const contentLength = Number(request.headers.get('content-length') ?? request.headers.get('x-file-size'));
    const mediaType = normalizeMediaType(request.headers.get('content-type') ?? 'application/octet-stream');

    if (!rawName || !request.body) return json({ error: 'Missing file' }, { status: 400 });
    if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
      return json({ error: 'A valid Content-Length header is required' }, { status: 411 });
    }
    if (contentLength > MAX_ATTACHMENT_BYTES) {
      return json({ error: 'Attachment exceeds the 95 MiB limit' }, { status: 413 });
    }

    let decodedName: string;
    try {
      decodedName = decodeURIComponent(rawName);
    } catch {
      return json({ error: 'Invalid file name' }, { status: 400 });
    }

    const requestedUploadId = request.headers.get('x-upload-id');
    const id = requestedUploadId ? uploadIdSchema.parse(requestedUploadId) : crypto.randomUUID();
    const db = getDb(platform.env.DB);
    const [note] = await db
      .select({ id: notes.id })
      .from(notes)
      .where(and(eq(notes.id, params.id), eq(notes.userId, locals.user.id)))
      .limit(1);
    if (!note) return json({ error: 'Note not found' }, { status: 404 });

    const fileName = safeFileName(decodedName);
    const [existing] = await db
      .select()
      .from(attachments)
      .where(and(eq(attachments.id, id), eq(attachments.userId, locals.user.id)))
      .limit(1);
    if (existing) {
      if (
        existing.noteId === params.id
        && existing.fileName === fileName
        && existing.mediaType === mediaType
        && existing.size === contentLength
      ) {
        const object = await platform.env.ATTACHMENTS.head(existing.r2Key);
        if (!object || object.size !== contentLength) {
          await putSizedObject(platform.env.ATTACHMENTS, existing.r2Key, request.body, contentLength, {
            httpMetadata: { contentType: mediaType },
            customMetadata: { userId: locals.user.id, noteId: params.id, fileName }
          });
        }
        return json(attachmentDto(existing));
      }
      return json({ error: 'Attachment upload ID is already in use' }, { status: 409 });
    }
    const r2Key = `${locals.user.id}/${params.id}/${id}/${fileName}`;

    await putSizedObject(platform.env.ATTACHMENTS, r2Key, request.body, contentLength, {
      httpMetadata: { contentType: mediaType },
      customMetadata: { userId: locals.user.id, noteId: params.id, fileName }
    });

    try {
      const [created] = await db.insert(attachments).values({
        id,
        noteId: params.id,
        userId: locals.user.id,
        r2Key,
        fileName,
        mediaType,
        kind: classifyAttachment(mediaType, fileName),
        size: contentLength,
        createdAt: new Date()
      }).returning();
      return json(attachmentDto(created), { status: 201 });
    } catch (error) {
      const [committed] = await db
        .select()
        .from(attachments)
        .where(and(eq(attachments.id, id), eq(attachments.userId, locals.user.id)))
        .limit(1);
      if (
        committed?.userId === locals.user.id
        && committed.noteId === params.id
        && committed.r2Key === r2Key
        && committed.fileName === fileName
        && committed.mediaType === mediaType
        && committed.size === contentLength
      ) {
        return json(attachmentDto(committed));
      }
      await platform.env.ATTACHMENTS.delete(r2Key);
      if (isAttachmentIdConflict(error)) {
        throw new RequestError('Attachment upload ID is already in use', 409);
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof UploadSizeError) return json({ error: error.message }, { status: 400 });
    return apiError(error);
  }
};
