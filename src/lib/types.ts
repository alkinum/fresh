export type AttachmentKind =
  | 'image'
  | 'audio'
  | 'video'
  | 'pdf'
  | 'text'
  | 'document'
  | 'archive'
  | 'other';

export interface AttachmentDto {
  id: string;
  noteId: string;
  fileName: string;
  mediaType: string;
  kind: AttachmentKind;
  size: number;
  createdAt: string;
  url: string;
}

export interface TagDto {
  id: string;
  name: string;
  color: string;
  count: number;
  createdAt: string;
  updatedAt: string;
}

export interface NoteDto {
  id: string;
  title: string;
  content: string;
  renderedContent: string;
  date: string;
  colorIndicator: string;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  tags: TagDto[];
  attachments: AttachmentDto[];
}

export interface PaginatedResult<T> {
  items: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
}

export interface BackupManifest {
  schemaVersion: 1;
  exportedAt: string;
  profile: { name: string; email: string };
  notes: Array<{
    id: string;
    title: string;
    content: string;
    date: string;
    colorIndicator: string;
    isFavorite: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  tags: Array<{
    id: string;
    name: string;
    color: string;
    createdAt: string;
    updatedAt: string;
    lastNoteModifiedAt: string;
  }>;
  noteTags: Array<{ noteId: string; tagId: string }>;
  attachments: Array<{
    id: string;
    noteId: string;
    fileName: string;
    mediaType: string;
    kind: AttachmentKind;
    size: number;
    createdAt: string;
    url: string;
  }>;
}
