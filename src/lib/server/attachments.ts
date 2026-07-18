import { and, eq } from 'drizzle-orm';
import type { Database } from '@/db';
import { attachments } from '@/db/schema';
import type { AttachmentDto, AttachmentKind } from '$lib/types';

export const MAX_ATTACHMENT_BYTES = 95 * 1024 * 1024;

const documentExtensions = new Set([
  'doc', 'docx', 'odt', 'pages', 'ppt', 'pptx', 'odp', 'key', 'xls', 'xlsx', 'ods', 'numbers', 'rtf'
]);
const archiveExtensions = new Set(['zip', '7z', 'rar', 'tar', 'gz', 'bz2', 'xz']);

export function classifyAttachment(mediaType: string, fileName: string): AttachmentKind {
  const type = mediaType.toLowerCase();
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';

  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('audio/')) return 'audio';
  if (type.startsWith('video/')) return 'video';
  if (type === 'application/pdf' || extension === 'pdf') return 'pdf';
  if (type.startsWith('text/') || ['md', 'markdown', 'json', 'yaml', 'yml', 'csv', 'log'].includes(extension)) return 'text';
  if (documentExtensions.has(extension) || type.includes('officedocument') || type.includes('opendocument')) return 'document';
  if (archiveExtensions.has(extension) || type.includes('zip') || type.includes('compressed')) return 'archive';
  return 'other';
}

export function safeFileName(fileName: string): string {
  const sanitized = [...fileName.normalize('NFC')]
    .map((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code <= 31 || code === 127 || character === '/' || character === '\\' ? '_' : character;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  return (sanitized || 'attachment').slice(0, 180);
}

export function attachmentDto(row: typeof attachments.$inferSelect): AttachmentDto {
  return {
    id: row.id,
    noteId: row.noteId,
    fileName: row.fileName,
    mediaType: row.mediaType,
    kind: row.kind,
    size: row.size,
    createdAt: row.createdAt.toISOString(),
    url: `/api/attachments/${row.id}`
  };
}

export async function findAttachment(db: Database, userId: string, id: string) {
  const [attachment] = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.id, id), eq(attachments.userId, userId)))
    .limit(1);
  return attachment;
}

export async function deleteR2Objects(bucket: R2Bucket, keys: string[]): Promise<void> {
  for (let offset = 0; offset < keys.length; offset += 1000) {
    await bucket.delete(keys.slice(offset, offset + 1000));
  }
}
