import { describe, expect, it } from 'vitest';
import {
  canPreviewAttachment,
  classifyAttachment,
  normalizeMediaType,
  resolveAttachmentRange,
  safeFileName
} from '../src/lib/server/attachments';

describe('attachment classification', () => {
  it.each([
    ['image/png', 'image.png', 'image'],
    ['audio/mpeg', 'song.mp3', 'audio'],
    ['video/mp4', 'clip.mp4', 'video'],
    ['application/pdf', 'paper.pdf', 'pdf'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'paper.docx', 'document'],
    ['application/zip', 'archive.zip', 'archive'],
    ['application/octet-stream', 'unknown.bin', 'other']
  ] as const)('classifies %s', (mediaType, fileName, expected) => {
    expect(classifyAttachment(mediaType, fileName)).toBe(expected);
  });

  it('removes path and control characters from file names', () => {
    expect(safeFileName('../folder/unsafe\u0000.txt')).toBe('.._folder_unsafe_.txt');
  });

  it('truncates long Unicode names without splitting a code point', () => {
    const emoji = String.fromCodePoint(0x1f642);
    const fileName = safeFileName(emoji.repeat(200));
    expect([...fileName]).toHaveLength(180);
    expect(fileName.endsWith(emoji)).toBe(true);
  });

  it('does not trust a PDF extension or executable image type', () => {
    expect(classifyAttachment('text/html', 'payload.pdf')).toBe('text');
    expect(classifyAttachment('image/svg+xml', 'payload.svg')).toBe('other');
    expect(canPreviewAttachment('text/html')).toBe(false);
    expect(canPreviewAttachment('image/svg+xml')).toBe(false);
  });

  it('normalizes invalid media types to a binary download', () => {
    expect(normalizeMediaType('IMAGE/PNG; charset=utf-8')).toBe('image/png');
    expect(normalizeMediaType('text/html\r\nx-injected: true')).toBe('application/octet-stream');
  });

  it('resolves bounded, open-ended, and suffix byte ranges', () => {
    expect(resolveAttachmentRange('bytes=2-5', 10)).toEqual({
      kind: 'range',
      range: { offset: 2, length: 4 }
    });
    expect(resolveAttachmentRange('bytes=7-', 10)).toEqual({
      kind: 'range',
      range: { offset: 7, length: 3 }
    });
    expect(resolveAttachmentRange('bytes=-4', 10)).toEqual({
      kind: 'range',
      range: { offset: 6, length: 4 }
    });
    expect(resolveAttachmentRange('bytes=8-99', 10)).toEqual({
      kind: 'range',
      range: { offset: 8, length: 2 }
    });
    expect(resolveAttachmentRange('bytes=-99', 10)).toEqual({
      kind: 'range',
      range: { offset: 0, length: 10 }
    });
  });

  it('rejects malformed, multiple, reversed, and unsatisfiable ranges', () => {
    for (const value of ['items=0-1', 'bytes=', 'bytes=-', 'bytes=2-1', 'bytes=10-', 'bytes=0-1,4-5']) {
      expect(resolveAttachmentRange(value, 10)).toEqual({ kind: 'unsatisfiable' });
    }
    expect(resolveAttachmentRange('bytes=0-0', 0)).toEqual({ kind: 'unsatisfiable' });
    expect(resolveAttachmentRange(null, 10)).toEqual({ kind: 'none' });
  });
});
