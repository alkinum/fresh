import { getDb } from '@/db';
import { backupManifestSchema, createBackupManifest, importBackup } from '$lib/server/backup';
import { apiError, unauthorized } from '$lib/server/http';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const importSchema = z.object({
  mode: z.enum(['merge', 'replace']),
  manifest: backupManifestSchema
});

export const GET: RequestHandler = async ({ locals, platform }) => {
  if (!locals.user || !platform?.env.DB) return unauthorized();
  const manifest = await createBackupManifest(getDb(platform.env.DB), locals.user.id, {
    name: locals.user.name,
    email: locals.user.email
  });
  return json(manifest);
};

export const POST: RequestHandler = async ({ locals, platform, request }) => {
  if (!locals.user || !platform?.env.DB || !platform.env.ATTACHMENTS) return unauthorized();
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 10 * 1024 * 1024) {
    return json({ error: 'Backup manifest exceeds the 10 MiB limit' }, { status: 413 });
  }

  try {
    const { manifest, mode } = importSchema.parse(await request.json());
    const result = await importBackup(
      getDb(platform.env.DB),
      platform.env.ATTACHMENTS,
      locals.user.id,
      manifest,
      mode
    );
    return json(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
};
