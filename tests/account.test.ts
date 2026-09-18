import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import { getDb } from '../src/db';
import {
  accountSchema,
  avatarKey,
  avatarMaxBytes,
  avatarMediaType,
  getPreferences,
  readAvatar,
  replaceAvatar,
  updateAccount,
} from '../src/lib/server/account';
import { defaultPreferences } from '../src/lib/preferences';
import { PATCH } from '../src/routes/api/account/+server';
import { GET as getAvatar } from '../src/routes/api/account/avatar/[id]/+server';

const png = Uint8Array.from(
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6f6QAAAAASUVORK5CYII=', 'base64'),
);

describe('private account settings', () => {
  let runtime: Miniflare;
  let d1: D1Database;
  let bucket: R2Bucket;
  let db: ReturnType<typeof getDb>;

  beforeAll(async () => {
    runtime = new Miniflare({
      workers: [
        {
          config: {
            name: 'account-test',
            type: 'worker',
            compatibilityDate: '2026-07-17',
            manifest: {
              mainModule: 'index.js',
              modules: {
                'index.js': { type: 'esm', contents: 'export default { fetch() { return new Response("ok") } }' },
              },
            },
            env: { DB: { type: 'd1' }, ATTACHMENTS: { type: 'r2' } },
          },
        },
      ],
    });
    d1 = (await runtime.getD1Database('DB')) as D1Database;
    bucket = (await runtime.getR2Bucket('ATTACHMENTS')) as R2Bucket;
    db = getDb(d1);
    await d1
      .prepare(
        'CREATE TABLE user (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, email_verified INTEGER NOT NULL, image TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)',
      )
      .run();
    await d1.prepare(readFileSync(new URL('../migrations/0006_empty_orphan.sql', import.meta.url), 'utf8')).run();
    for (const id of ['first', 'second']) {
      await d1
        .prepare('INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, 1, 1)')
        .bind(id, id, `${id}@example.invalid`)
        .run();
    }
  });
  afterAll(async () => {
    await runtime?.dispose();
  });

  it('validates names and keeps profile and preferences scoped to the signed-in account', async () => {
    for (const input of [{ name: '' }, { name: '  ' }, { name: 'x'.repeat(81) }, { name: 'Valid', userId: 'second' }]) {
      expect(accountSchema.safeParse(input).success).toBe(false);
    }
    expect(await getPreferences(db, 'first')).toEqual(defaultPreferences);
    const input = accountSchema.parse({
      name: '  用户 이름  ',
      preferences: { language: 'ko', theme: 'dark', accent: 'green' },
    });
    const result = await updateAccount(db, 'first', input);
    expect(result.name).toBe('用户 이름');
    expect(await getPreferences(db, 'first')).toEqual(input.preferences);
    expect(await getPreferences(db, 'second')).toEqual(defaultPreferences);
    expect(await d1.prepare('SELECT name FROM user WHERE id = ?').bind('second').first('name')).toBe('second');
  });

  it('rejects unauthenticated writes and does not accept an owner ID from the client', async () => {
    const cookies = { set: vi.fn() };
    const event = (body: unknown, authenticated = true) =>
      ({
        locals: { user: authenticated ? { id: 'first' } : null },
        platform: { env: { DB: d1 } },
        cookies,
        url: new URL('https://fresh.test/api/account'),
        request: new Request('https://fresh.test/api/account', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
      }) as unknown as Parameters<typeof PATCH>[0];
    expect((await PATCH(event({ name: 'No' }, false))).status).toBe(401);
    expect((await PATCH(event({ name: 'No', userId: 'second' }))).status).toBe(400);
    expect((await PATCH(event({ preferences: { language: 'ja', theme: 'light', accent: 'rose' } }))).status).toBe(200);
    expect(cookies.set).toHaveBeenCalledWith(
      'fresh-preferences',
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', secure: true }),
    );
    expect(await getPreferences(db, 'first')).toEqual({ language: 'ja', theme: 'light', accent: 'rose' });
  });

  it('validates image signatures and bounds both declared and streamed request bodies', async () => {
    expect(avatarMediaType(png)).toBe('image/png');
    expect(() => avatarMediaType(new TextEncoder().encode('<svg onload="test()"/>'))).toThrow('PNG');
    expect(() => avatarMediaType(new Uint8Array())).toThrow('PNG');
    await expect(readAvatar(new Request('https://fresh.test', { method: 'PUT', body: png }))).resolves.toEqual(png);
    await expect(
      readAvatar(
        new Request('https://fresh.test', {
          method: 'PUT',
          headers: { 'content-length': String(avatarMaxBytes + 1) },
          body: png,
        }),
      ),
    ).rejects.toMatchObject({ status: 413 });
    const oversized = new Uint8Array(avatarMaxBytes + 1);
    await expect(
      readAvatar(new Request('https://fresh.test', { method: 'PUT', body: oversized })),
    ).rejects.toMatchObject({ status: 413 });
  });

  it('stores private avatars, blocks another account, and cleans up replacements and removal', async () => {
    const first = await replaceAvatar(db, bucket, 'first', png);
    const key = avatarKey('first', first.image)!;
    expect(await bucket.head(key)).not.toBeNull();
    const id = first.image!.split('/').at(-1)!;
    const event = (userId: string | null) =>
      ({
        locals: { user: userId ? { id: userId } : null },
        platform: { env: { ATTACHMENTS: bucket } },
        params: { id },
      }) as unknown as Parameters<typeof getAvatar>[0];
    const own = await getAvatar(event('first'));
    expect(own.status).toBe(200);
    expect(own.headers.get('cache-control')).toContain('private');
    expect(new Uint8Array(await own.arrayBuffer())).toEqual(png);
    expect((await getAvatar(event('second'))).status).toBe(404);
    expect((await getAvatar(event(null))).status).toBe(401);
    const next = await replaceAvatar(db, bucket, 'first', png);
    expect(await bucket.head(key)).toBeNull();
    await replaceAvatar(db, bucket, 'first', null);
    expect(await bucket.head(avatarKey('first', next.image)!)).toBeNull();
    expect(await d1.prepare('SELECT image FROM user WHERE id = ?').bind('first').first('image')).toBeNull();
  });

  it('removes a losing concurrent upload without overwriting the winning avatar', async () => {
    let reached!: () => void;
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => {
      reached = resolve;
    });
    const proceed = new Promise<void>((resolve) => {
      release = resolve;
    });
    const delayedBucket = {
      put: async (...args: Parameters<R2Bucket['put']>) => {
        const result = await bucket.put(...args);
        reached();
        await proceed;
        return result;
      },
      delete: bucket.delete.bind(bucket),
    } as unknown as R2Bucket;
    const losing = replaceAvatar(db, delayedBucket, 'first', png);
    await waiting;
    const winner = await replaceAvatar(db, bucket, 'first', png);
    const rejection = expect(losing).rejects.toMatchObject({ status: 409 });
    release();
    await rejection;
    const remaining = await bucket.list({ prefix: 'avatars/first/' });
    expect(remaining.objects.map((object) => object.key)).toEqual([avatarKey('first', winner.image)]);
    await replaceAvatar(db, bucket, 'first', null);
  });
});
