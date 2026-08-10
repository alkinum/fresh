import { describe, expect, it } from 'vitest';
import {
  backupManifestSchema,
  MAX_BACKUP_ATTACHMENT_BYTES,
  MAX_BACKUP_MANIFEST_BYTES
} from '../src/lib/backup-schema';
import { encryptBackup } from '../src/lib/backup';
import type { BackupManifest } from '../src/lib/types';

const timestamp = '2026-08-11T00:00:00.000Z';

function manifest(overrides: Partial<BackupManifest> = {}): BackupManifest {
  return {
    schemaVersion: 2,
    exportedAt: timestamp,
    profile: { name: 'Test User', email: 'test@example.com' },
    notes: [{
      id: 'note-1',
      title: 'Note',
      content: '# Note',
      date: '2026-08-11',
      colorIndicator: '#4f8cff',
      isFavorite: false,
      createdAt: timestamp,
      updatedAt: timestamp
    }],
    tags: [],
    noteTags: [],
    attachments: [],
    kanbanBoards: [],
    kanbanColumns: [],
    kanbanCards: [],
    ...overrides
  } as BackupManifest;
}

describe('backup manifest validation', () => {
  it('rejects executable CSS colors and malformed media types', () => {
    const unsafeColor = manifest({
      notes: [{ ...manifest().notes[0], colorIndicator: 'url(https://example.com)' }]
    });
    expect(backupManifestSchema.safeParse(unsafeColor).success).toBe(false);

    const unsafeMedia = manifest({
      attachments: [{
        id: 'attachment-1',
        noteId: 'note-1',
        fileName: 'payload.bin',
        mediaType: 'text/html\r\nx-injected: true',
        kind: 'other',
        size: 1,
        createdAt: timestamp,
        url: '/api/attachments/attachment-1'
      }]
    });
    expect(backupManifestSchema.safeParse(unsafeMedia).success).toBe(false);
  });

  it('rejects duplicate IDs and duplicate note/tag relations', () => {
    const duplicateNotes = manifest({ notes: [manifest().notes[0], manifest().notes[0]] });
    expect(backupManifestSchema.safeParse(duplicateNotes).success).toBe(false);

    const duplicateRelations = manifest({
      tags: [{
        id: 'tag-1',
        name: 'test',
        color: 'hsl(120 58% 64%)',
        createdAt: timestamp,
        updatedAt: timestamp,
        lastNoteModifiedAt: timestamp
      }],
      noteTags: [
        { noteId: 'note-1', tagId: 'tag-1' },
        { noteId: 'note-1', tagId: 'tag-1' }
      ]
    });
    expect(backupManifestSchema.safeParse(duplicateRelations).success).toBe(false);

    const duplicateTagNames = manifest({
      tags: [
        {
          id: 'tag-1',
          name: 'test',
          color: 'hsl(120 58% 64%)',
          createdAt: timestamp,
          updatedAt: timestamp,
          lastNoteModifiedAt: timestamp
        },
        {
          id: 'tag-2',
          name: 'test',
          color: 'hsl(121 58% 64%)',
          createdAt: timestamp,
          updatedAt: timestamp,
          lastNoteModifiedAt: timestamp
        }
      ]
    });
    expect(backupManifestSchema.safeParse(duplicateTagNames).success).toBe(false);
  });

  it('enforces board column and card limits inside each board', () => {
    const board = {
      id: 'board-1',
      name: 'Board',
      color: '#5288e8',
      position: 0,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const columns = Array.from({ length: 13 }, (_, index) => ({
      id: `column-${index}`,
      boardId: board.id,
      name: `Column ${index}`,
      position: index,
      createdAt: timestamp,
      updatedAt: timestamp
    }));
    expect(backupManifestSchema.safeParse(manifest({
      kanbanBoards: [board],
      kanbanColumns: columns
    })).success).toBe(false);
  });

  it('uses the same aggregate manifest limit for export and import', async () => {
    const large = manifest({
      notes: Array.from({ length: 11 }, (_, index) => ({
        ...manifest().notes[0],
        id: `note-${index}`,
        content: 'a'.repeat(1_000_000)
      }))
    });
    expect(new TextEncoder().encode(JSON.stringify(large)).byteLength).toBeGreaterThan(MAX_BACKUP_MANIFEST_BYTES);
    await expect(encryptBackup(large, 'correct horse battery staple', async () => new Uint8Array()))
      .rejects.toThrow('10 MiB export limit');
  });

  it('rejects attachment sets that cannot fit in a browser backup', () => {
    const oversized = manifest({
      attachments: Array.from({ length: 6 }, (_, index) => ({
        id: `attachment-${index}`,
        noteId: 'note-1',
        fileName: `file-${index}.bin`,
        mediaType: 'application/octet-stream',
        kind: 'other' as const,
        size: Math.floor(MAX_BACKUP_ATTACHMENT_BYTES / 6) + 1,
        createdAt: timestamp,
        url: `/api/attachments/attachment-${index}`
      }))
    });
    expect(backupManifestSchema.safeParse(oversized).success).toBe(false);
  });
});
