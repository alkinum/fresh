import { and, eq } from 'drizzle-orm';
import type { Database } from '@/db';
import { attachments } from '@/db/schema';
import type { AttachmentDto, AttachmentKind } from '$lib/types';

export const MAX_ATTACHMENT_BYTES = 95 * 1024 * 1024;

export interface AttachmentByteRange {
  offset: number;
  length: number;
}

export type AttachmentRangeResult =
  | { kind: 'none' }
  | { kind: 'range'; range: AttachmentByteRange }
  | { kind: 'unsatisfiable' };

const fallbackMediaType = 'application/octet-stream';
const mediaTypePattern = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;

const inlineKindsByMediaType = new Map<string, AttachmentKind>([
  ['image/avif', 'image'],
  ['image/bmp', 'image'],
  ['image/gif', 'image'],
  ['image/jpeg', 'image'],
  ['image/png', 'image'],
  ['image/webp', 'image'],
  ['image/x-icon', 'image'],
  ['audio/aac', 'audio'],
  ['audio/flac', 'audio'],
  ['audio/mp4', 'audio'],
  ['audio/mpeg', 'audio'],
  ['audio/ogg', 'audio'],
  ['audio/wav', 'audio'],
  ['audio/webm', 'audio'],
  ['audio/x-wav', 'audio'],
  ['video/mp4', 'video'],
  ['video/ogg', 'video'],
  ['video/quicktime', 'video'],
  ['video/webm', 'video'],
  ['application/pdf', 'pdf']
]);

const documentExtensions = new Set([
  'doc', 'docx', 'odt', 'pages', 'ppt', 'pptx', 'odp', 'key', 'xls', 'xlsx', 'ods', 'numbers', 'rtf'
]);
const archiveExtensions = new Set(['zip', '7z', 'rar', 'tar', 'gz', 'bz2', 'xz']);

export function classifyAttachment(mediaType: string, fileName: string): AttachmentKind {
  const type = normalizeMediaType(mediaType);
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';

  const inlineKind = inlineKindsByMediaType.get(type);
  if (inlineKind) return inlineKind;
  if (type.startsWith('text/') || ['md', 'markdown', 'json', 'yaml', 'yml', 'csv', 'log'].includes(extension)) return 'text';
  if (documentExtensions.has(extension) || type.includes('officedocument') || type.includes('opendocument')) return 'document';
  if (archiveExtensions.has(extension) || type.includes('zip') || type.includes('compressed')) return 'archive';
  return 'other';
}

export function normalizeMediaType(mediaType: string): string {
  const normalized = mediaType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  return normalized.length <= 200 && mediaTypePattern.test(normalized) ? normalized : fallbackMediaType;
}

export function canPreviewAttachment(mediaType: string): boolean {
  return inlineKindsByMediaType.has(normalizeMediaType(mediaType));
}

export function resolveAttachmentRange(header: string | null, size: number): AttachmentRangeResult {
  if (header === null) return { kind: 'none' };
  if (!Number.isSafeInteger(size) || size < 0) return { kind: 'unsatisfiable' };

  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match || (!match[1] && !match[2]) || size === 0) return { kind: 'unsatisfiable' };

  const [, startValue, endValue] = match;
  if (startValue) {
    const start = Number(startValue);
    if (!Number.isSafeInteger(start) || start >= size) return { kind: 'unsatisfiable' };

    const requestedEnd = endValue ? Number(endValue) : size - 1;
    if (!Number.isSafeInteger(requestedEnd) || requestedEnd < start) return { kind: 'unsatisfiable' };
    const end = Math.min(requestedEnd, size - 1);
    return { kind: 'range', range: { offset: start, length: end - start + 1 } };
  }

  const suffix = Number(endValue);
  if (!Number.isSafeInteger(suffix) || suffix <= 0) return { kind: 'unsatisfiable' };
  const length = Math.min(suffix, size);
  return { kind: 'range', range: { offset: size - length, length } };
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
  return [...(sanitized || 'attachment')].slice(0, 180).join('');
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
    url: `/api/attachments/${row.id}`,
    downloadUrl: `/api/attachments/${row.id}?download=1`
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

export async function deleteR2Prefix(bucket: R2Bucket, prefix: string): Promise<void> {
  let cursor: string | undefined;
  do {
    const listed = await bucket.list({ prefix, cursor, limit: 1000 });
    if (listed.objects.length > 0) await deleteR2Objects(bucket, listed.objects.map((object) => object.key));
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
}
