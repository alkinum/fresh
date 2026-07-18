import { describe, expect, it } from 'vitest';
import { decryptBackup, encryptBackup } from '../src/lib/backup';
import type { BackupManifest } from '../src/lib/types';

const manifest: BackupManifest = {
  schemaVersion: 1,
  exportedAt: '2026-07-18T00:00:00.000Z',
  profile: { name: 'Test User', email: 'test@example.com' },
  notes: [{
    id: 'note-1',
    title: 'A note',
    content: 'A note with $x^2$',
    date: '2026-07-18',
    colorIndicator: '#4f8cff',
    isFavorite: true,
    createdAt: '2026-07-18T00:00:00.000Z',
    updatedAt: '2026-07-18T00:00:00.000Z'
  }],
  tags: [],
  noteTags: [],
  attachments: [{
    id: 'file-1',
    noteId: 'note-1',
    fileName: 'hello.txt',
    mediaType: 'text/plain',
    kind: 'text',
    size: 5,
    createdAt: '2026-07-18T00:00:00.000Z',
    url: '/api/attachments/file-1'
  }]
};

describe('encrypted backup format', () => {
  it('round trips manifest and attachments', async () => {
    const backup = await encryptBackup(manifest, 'correct horse battery staple', async () => new TextEncoder().encode('hello'));
    const restored = await decryptBackup(backup, 'correct horse battery staple');
    expect(restored.manifest).toEqual(manifest);
    expect(new TextDecoder().decode(restored.attachmentFiles.get('file-1'))).toBe('hello');
  });

  it('rejects a wrong password', async () => {
    const backup = await encryptBackup(manifest, 'correct horse battery staple', async () => new Uint8Array([1, 2, 3, 4, 5]));
    await expect(decryptBackup(backup, 'wrong password')).rejects.toThrow('Incorrect password');
  });
});
