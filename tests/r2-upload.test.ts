import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import ts from 'typescript';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { putSizedObject, UploadSizeError } from '../src/lib/server/r2-upload';

afterEach(() => vi.unstubAllGlobals());

describe('sized R2 uploads', () => {
  it.each(['short', 'longer-than-declared'])('rejects a %s body before committing it in the Node proxy', async (value) => {
    vi.stubGlobal('FixedLengthStream', undefined);
    const put = vi.fn();
    const bucket = { put } as unknown as R2Bucket;
    await expect(putSizedObject(bucket, 'file', new Blob([value]).stream(), 8, {}))
      .rejects.toBeInstanceOf(UploadSizeError);
    expect(put).not.toHaveBeenCalled();
  });

  it('stores an exact-length body', async () => {
    vi.stubGlobal('FixedLengthStream', undefined);
    const put = vi.fn().mockResolvedValue({ size: 5 });
    const bucket = { put } as unknown as R2Bucket;
    await putSizedObject(bucket, 'file', new Blob(['hello']).stream(), 5, {});
    expect(new TextDecoder().decode(put.mock.calls[0][1])).toBe('hello');
  });
});

describe('sized uploads in the Workers runtime', () => {
  let miniflare: Miniflare;
  let bucket: R2Bucket;

  beforeAll(async () => {
    const source = ts.transpileModule(
      readFileSync(new URL('../src/lib/server/r2-upload.ts', import.meta.url), 'utf8'),
      { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }
    ).outputText;
    miniflare = new Miniflare({ workers: [{ config: {
      name: 'sized-upload-test', type: 'worker', compatibilityDate: '2026-07-17',
      manifest: { mainModule: 'index.js', modules: { 'index.js': { type: 'esm', contents: `${source}
        export default { async fetch(request, env) {
          const url = new URL(request.url);
          try {
            const object = await putSizedObject(env.FILES, url.pathname, request.body, 5,
              url.searchParams.has('conditional') ? { onlyIf: { etagDoesNotMatch: '*' } } : {});
            return Response.json({ stored: object !== null });
          } catch (error) {
            return Response.json({ error: error.message }, { status: error instanceof UploadSizeError ? 400 : 500 });
          }
        } }
      ` } } },
      env: { FILES: { type: 'r2' } }
    } }] });
    bucket = await miniflare.getR2Bucket('FILES') as R2Bucket;
  });

  afterAll(async () => { await miniflare?.dispose(); });

  it.each(['hi', 'too long'])('rejects an incorrect streamed length (%s) without saving bytes', async (body) => {
    const path = `/${crypto.randomUUID()}`;
    const response = await miniflare.dispatchFetch(`https://fresh.test${path}`, { method: 'POST', body });
    expect(response.status).toBe(400);
    expect(await bucket.head(path)).toBeNull();
  });

  it('keeps an exact-length object unchanged when a conditional retry loses', async () => {
    const path = `/${crypto.randomUUID()}`;
    const url = `https://fresh.test${path}?conditional`;
    const first = await miniflare.dispatchFetch(url, { method: 'POST', body: 'hello' });
    expect(await first.json()).toEqual({ stored: true });
    const retry = await miniflare.dispatchFetch(url, { method: 'POST', body: 'stale' });
    expect(await retry.json()).toEqual({ stored: false });
    expect(await (await bucket.get(path))?.text()).toBe('hello');
  });
});
