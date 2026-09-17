import type { NoteDto } from '$lib/types';

export const NOTE_CACHE_COUNT = 180;
export const NOTE_CACHE_BYTES = 16 * 1024 * 1024;

function estimatedBytes(note: NoteDto): number {
  return (
    1024 +
    2 * (note.content.length + note.renderedContent.length + note.title.length) +
    note.tags.reduce((size, tag) => size + 256 + tag.name.length * 2, 0) +
    note.attachments.reduce((size, file) => size + 512 + file.fileName.length * 2, 0)
  );
}

// Keep only IDs/geometry for the full feed; expensive Markdown DTOs use this LRU.
export class NoteCache {
  private records = new Map<string, { note: NoteDto; bytes: number }>();
  private protectedIds = new Set<string>();
  bytes = 0;

  constructor(
    private maxCount = NOTE_CACHE_COUNT,
    private maxBytes = NOTE_CACHE_BYTES,
  ) {}

  has(id: string): boolean {
    return this.records.has(id);
  }

  peek(id: string): NoteDto | undefined {
    return this.records.get(id)?.note;
  }

  protect(ids: string[]): void {
    this.protectedIds = new Set(ids);
    for (const id of ids) {
      const entry = this.records.get(id);
      if (entry) {
        this.records.delete(id);
        this.records.set(id, entry);
      }
    }
    this.trim();
  }

  put(notes: NoteDto[]): void {
    for (const note of notes) {
      this.delete(note.id);
      const bytes = estimatedBytes(note);
      this.records.set(note.id, { note, bytes });
      this.bytes += bytes;
    }
    this.trim();
  }

  delete(id: string): void {
    const entry = this.records.get(id);
    if (entry) this.bytes -= entry.bytes;
    this.records.delete(id);
  }

  clear(): void {
    this.records.clear();
    this.protectedIds.clear();
    this.bytes = 0;
  }

  snapshot(): ReadonlyMap<string, NoteDto> {
    return new Map([...this.records].map(([id, entry]) => [id, entry.note]));
  }

  private trim(): void {
    for (const [id] of this.records) {
      if (this.records.size <= this.maxCount && this.bytes <= this.maxBytes) break;
      // Visible rows and active interactions must not disappear mid-operation.
      if (!this.protectedIds.has(id)) this.delete(id);
    }
  }
}
