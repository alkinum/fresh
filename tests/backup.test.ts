import { describe, expect, it } from 'vitest';
import { decryptBackup, encryptBackup, MAX_BACKUP_ARCHIVE_BYTES } from '../src/lib/backup';
import { MAX_BACKUP_FILE_BYTES } from '../src/lib/backup-schema';
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

const kanbanManifest: BackupManifest = {
  ...manifest,
  schemaVersion: 2,
  kanbanBoards: [{
    id: 'board-1',
    name: 'Launch plan',
    color: '#5288e8',
    position: 0,
    createdAt: '2026-07-18T00:00:00.000Z',
    updatedAt: '2026-07-18T00:00:00.000Z'
  }],
  kanbanColumns: [{
    id: 'column-1',
    boardId: 'board-1',
    name: 'To do',
    position: 0,
    createdAt: '2026-07-18T00:00:00.000Z',
    updatedAt: '2026-07-18T00:00:00.000Z'
  }],
  kanbanCards: [{
    id: 'card-1',
    boardId: 'board-1',
    columnId: 'column-1',
    title: 'Ship the board view',
    description: 'Add a first card',
    position: 0,
    createdAt: '2026-07-18T00:00:00.000Z',
    updatedAt: '2026-07-18T00:00:00.000Z'
  }]
};

const backupHeaderLength = 8 + 4 + 16 + 12;

function ownedBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function deriveBackupKey(payload: Uint8Array, password: string): Promise<{ key: CryptoKey; iv: Uint8Array }> {
  const rounds = new DataView(payload.buffer, payload.byteOffset).getUint32(8, false);
  const salt = payload.slice(12, 28);
  const iv = payload.slice(28, backupHeaderLength);
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: ownedBuffer(salt), iterations: rounds },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  return { key, iv };
}

function inflateDeclaredSize(archive: Uint8Array, entryName: string, size: number): void {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const decoder = new TextDecoder();
  for (let offset = 0; offset <= archive.byteLength - 46;) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      offset += 1;
      continue;
    }
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const name = decoder.decode(archive.subarray(offset + 46, offset + 46 + nameLength));
    if (name === entryName) {
      view.setUint32(offset + 24, size, true);
      return;
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`ZIP entry ${entryName} was not found`);
}

async function tamperDeclaredArchiveSize(backup: Blob, password: string): Promise<Blob> {
  const payload = new Uint8Array(await backup.arrayBuffer());
  const { key, iv } = await deriveBackupKey(payload, password);
  const archive = new Uint8Array(await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ownedBuffer(iv) },
    key,
    ownedBuffer(payload.slice(backupHeaderLength))
  ));
  inflateDeclaredSize(archive, 'attachments/file-1', 96 * 1024 * 1024);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ownedBuffer(iv) },
    key,
    ownedBuffer(archive)
  ));
  const output = new Uint8Array(backupHeaderLength + encrypted.byteLength);
  output.set(payload.subarray(0, backupHeaderLength));
  output.set(encrypted, backupHeaderLength);
  return new Blob([output]);
}

describe('encrypted backup format', () => {
  it('reserves room for the encryption envelope and authentication tag', () => {
    expect(MAX_BACKUP_ARCHIVE_BYTES).toBe(MAX_BACKUP_FILE_BYTES - backupHeaderLength - 16);
  });

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

  it('round trips kanban data while retaining the version 1 import path', async () => {
    const backup = await encryptBackup(kanbanManifest, 'correct horse battery staple', async () => new Uint8Array([1, 2, 3, 4, 5]));
    const restored = await decryptBackup(backup, 'correct horse battery staple');
    expect(restored.manifest).toEqual(kanbanManifest);
    if (restored.manifest.schemaVersion !== 2) throw new Error('Expected a version 2 manifest');
    expect(restored.manifest.kanbanCards[0].title).toBe('Ship the board view');
  });

  it('rejects oversized central-directory declarations before inflating the archive', async () => {
    const password = 'correct horse battery staple';
    const backup = await encryptBackup(manifest, password, async () => new TextEncoder().encode('hello'));
    const tampered = await tamperDeclaredArchiveSize(backup, password);

    await expect(decryptBackup(tampered, password)).rejects.toThrow('oversized attachment');
  });
});
