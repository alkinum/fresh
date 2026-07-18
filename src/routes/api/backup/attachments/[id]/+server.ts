import { getDb } from '@/db';
import { findAttachment } from '$lib/server/attachments';
import { apiError, unauthorized } from '$lib/server/http';
import { putSizedObject, UploadSizeError } from '$lib/server/r2-upload';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ locals, params, platform, request }) => {
  if (!locals.user || !platform?.env.DB || !platform.env.ATTACHMENTS) return unauthorized();

  try {
    const attachment = await findAttachment(getDb(platform.env.DB), locals.user.id, params.id);
    if (!attachment) return json({ error: 'Attachment import target not found' }, { status: 404 });
    const contentLength = Number(request.headers.get('content-length') ?? request.headers.get('x-file-size'));
    if (contentLength !== attachment.size || !request.body) {
      return json({ error: 'Imported attachment size does not match its manifest' }, { status: 400 });
    }

    await putSizedObject(platform.env.ATTACHMENTS, attachment.r2Key, request.body, attachment.size, {
      httpMetadata: { contentType: attachment.mediaType },
      customMetadata: {
        userId: locals.user.id,
        noteId: attachment.noteId,
        fileName: attachment.fileName
      }
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof UploadSizeError) return json({ error: error.message }, { status: 400 });
    return apiError(error);
  }
};
