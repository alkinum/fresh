import { uploadPreparedBackupAttachment } from '$lib/server/backup';
import { apiError, unauthorized } from '$lib/server/http';
import { UploadSizeError } from '$lib/server/r2-upload';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const paramsSchema = z.object({
  importId: z.string().uuid(),
  index: z.coerce.number().int().nonnegative().max(499)
});

export const PUT: RequestHandler = async ({ locals, params, platform, request }) => {
  if (!locals.user || !platform?.env.DB || !platform.env.ATTACHMENTS) return unauthorized();

  try {
    const parsed = paramsSchema.parse(params);
    const contentLength = Number(request.headers.get('content-length') ?? request.headers.get('x-file-size'));
    if (!Number.isSafeInteger(contentLength) || contentLength <= 0 || !request.body) {
      return json({ error: 'A valid file size is required' }, { status: 411 });
    }
    await uploadPreparedBackupAttachment(
      platform.env.DB,
      platform.env.ATTACHMENTS,
      locals.user.id,
      parsed.importId,
      parsed.index,
      request.body,
      contentLength
    );
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof UploadSizeError) return json({ error: error.message }, { status: 400 });
    return apiError(error);
  }
};
