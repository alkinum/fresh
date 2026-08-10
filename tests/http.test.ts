import { describe, expect, it } from 'vitest';
import { MAX_NOTE_CONTENT_CHARACTERS, MAX_NOTE_JSON_BODY_BYTES } from '../src/lib/note-limits';
import { readJsonBody } from '../src/lib/server/http';

describe('bounded JSON requests', () => {
  it('accepts valid Unicode note bodies beyond the former ASCII-sized limit', async () => {
    const content = String.fromCodePoint(0x6c49).repeat(400_000);
    const body = JSON.stringify({ content });
    expect(new TextEncoder().encode(body).byteLength).toBeGreaterThan(1_100_000);

    const request = new Request('https://fresh.test/api/notes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body
    });
    await expect(readJsonBody(request, MAX_NOTE_JSON_BODY_BYTES)).resolves.toEqual({ content });
  });

  it('reserves enough JSON space for every allowed note code unit', () => {
    const worstCaseBody = JSON.stringify({ content: '\u0000'.repeat(MAX_NOTE_CONTENT_CHARACTERS) });
    expect(new TextEncoder().encode(worstCaseBody).byteLength).toBeLessThanOrEqual(MAX_NOTE_JSON_BODY_BYTES);
  });
});
