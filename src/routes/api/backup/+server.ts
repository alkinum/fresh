import { getDb } from '@/db';
import { backupManifestSchema, MAX_BACKUP_MANIFEST_BYTES } from '$lib/backup-schema';
import { createBackupManifest, prepareBackupImport } from '$lib/server/backup';
import { apiError, readJsonBody, unauthorized } from '$lib/server/http';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const importSchema = z.object({
  mode: z.enum(['merge', 'replace']),
  manifest: backupManifestSchema
});

export const GET: RequestHandler = async ({ locals, platform }) => {
  if (!locals.user || !platform?.env.DB) return unauthorized();
  try {
    const manifest = await createBackupManifest(getDb(platform.env.DB), locals.user.id, {
      name: locals.user.name,
      email: locals.user.email
    });
    return json(manifest);
  } catch (error) {
    return apiError(error);
  }
};

export const POST: RequestHandler = async ({ locals, platform, request }) => {
  if (!locals.user || !platform?.env.DB || !platform.env.ATTACHMENTS) return unauthorized();
  try {
    const { manifest, mode } = importSchema.parse(
      await readJsonBody(request, MAX_BACKUP_MANIFEST_BYTES + 1024)
    );
    const result = await prepareBackupImport(
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
