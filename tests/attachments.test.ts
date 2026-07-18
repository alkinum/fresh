import { describe, expect, it } from 'vitest';
import { classifyAttachment, safeFileName } from '../src/lib/server/attachments';

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
});
