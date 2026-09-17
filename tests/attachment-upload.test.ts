import { readFileSync, readdirSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Miniflare } from 'miniflare';
import { getDb } from '../src/db';
import { createNote } from '../src/lib/server/notes';
import { POST } from '../src/routes/api/notes/[id]/attachments/+server';

describe('attachment upload retries', () => {
  let miniflare: Miniflare;
  let d1: D1Database;
  let bucket: R2Bucket;
  let noteId: string;

  beforeEach(async () => {
    miniflare = new Miniflare({
      workers: [{ config: {
        name: 'attachment-upload-test',
        type: 'worker',
        compatibilityDate: '2026-07-17',
        manifest: { mainModule: 'index.js', modules: {
          'index.js': { type: 'esm', contents: 'export default { fetch() { return new Response("ok") } }' }
        } },
        env: { DB: { type: 'd1' }, ATTACHMENTS: { type: 'r2' } }
      } }]
    });
    d1 = await miniflare.getD1Database('DB') as D1Database;
    bucket = await miniflare.getR2Bucket('ATTACHMENTS') as R2Bucket;
    const migrations = new URL('../migrations/', import.meta.url);
    for (const name of readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()) {
      const sql = readFileSync(new URL(name, migrations), 'utf8');
      await d1.batch(sql.split('--> statement-breakpoint').map((statement) => d1.prepare(statement)));
    }
    await d1.prepare(`INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
      VALUES ('upload-user', 'Uploader', 'upload@example.com', 1, 1, 1)`).run();
    noteId = (await createNote(getDb(d1), 'upload-user', { content: '# Upload' })).id;
  });

  afterEach(async () => { await miniflare?.dispose(); });

  function upload(target: R2Bucket, uploadId: string, body: string): Promise<Response> {
    return POST({
      locals: { user: { id: 'upload-user' } },
      params: { id: noteId },
      platform: { env: { DB: d1, ATTACHMENTS: target } },
      request: new Request('https://fresh.test/upload', {
        method: 'POST',
        headers: {
          'content-type': 'text/plain', 'x-file-name': 'upload.txt',
          'x-file-size': String(new TextEncoder().encode(body).length), 'x-upload-id': uploadId
        },
        body
      })
    } as Parameters<typeof POST>[0]) as Promise<Response>;
  }

  it.each(['stale', 'different-size'])('preserves the first committed bytes when a %s retry finishes later', async (lateBody) => {
    const uploadId = crypto.randomUUID();
    const reached = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const delayedBucket = {
      head: bucket.head.bind(bucket),
      delete: bucket.delete.bind(bucket),
      put: async (key: string, value: Parameters<R2Bucket['put']>[1], options?: R2PutOptions) => {
        reached.resolve();
        await release.promise;
        return bucket.put(key, value, options);
      }
    } as unknown as R2Bucket;
    const delayed = upload(delayedBucket, uploadId, lateBody);
    await reached.promise;
    let first: Response;
    try {
      first = await upload(bucket, uploadId, 'hello');
    } finally {
      release.resolve();
    }
    const last = await delayed;
    expect(first.status).toBe(201);
    expect(last.status).toBe(lateBody.length === 5 ? 200 : 409);
    const key = await d1.prepare('SELECT r2_key AS key FROM attachments').first<string>('key');
    expect(await (await bucket.get(key!))?.text()).toBe('hello');
    expect((await bucket.list()).objects.map((object) => object.key)).toEqual([key]);
  });
});
