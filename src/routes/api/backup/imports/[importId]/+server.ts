import { cleanupPreparedBackupImport, finalizeBackupImport } from '$lib/server/backup';
import { apiError, unauthorized } from '$lib/server/http';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const importIdSchema = z.string().uuid();

export const POST: RequestHandler = async ({ locals, params, platform }) => {
  if (!locals.user || !platform?.env.DB || !platform.env.ATTACHMENTS) return unauthorized();
  try {
    const importId = importIdSchema.parse(params.importId);
    const result = await finalizeBackupImport(
      platform.env.DB,
      platform.env.ATTACHMENTS,
      locals.user.id,
      importId
    );
    return json(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
};

export const DELETE: RequestHandler = async ({ locals, params, platform }) => {
  if (!locals.user || !platform?.env.DB || !platform.env.ATTACHMENTS) return unauthorized();
  try {
    const importId = importIdSchema.parse(params.importId);
    await cleanupPreparedBackupImport(platform.env.DB, platform.env.ATTACHMENTS, locals.user.id, importId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
};
