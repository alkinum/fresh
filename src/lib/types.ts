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
  downloadUrl: string;
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

export interface KanbanCardDto {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface KanbanColumnDto {
  id: string;
  boardId: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  cards: KanbanCardDto[];
}

export interface KanbanBoardSummaryDto {
  id: string;
  name: string;
  color: string;
  position: number;
  columnCount: number;
  cardCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KanbanBoardDto extends KanbanBoardSummaryDto {
  columns: KanbanColumnDto[];
}

interface BackupManifestBase {
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

export interface LegacyBackupManifest extends BackupManifestBase {
  schemaVersion: 1;
}

export interface KanbanBackupManifest extends BackupManifestBase {
  schemaVersion: 2;
  kanbanBoards: Array<{
    id: string;
    name: string;
    color: string;
    position: number;
    createdAt: string;
    updatedAt: string;
  }>;
  kanbanColumns: Array<{
    id: string;
    boardId: string;
    name: string;
    position: number;
    createdAt: string;
    updatedAt: string;
  }>;
  kanbanCards: Array<{
    id: string;
    boardId: string;
    columnId: string;
    title: string;
    description: string;
    position: number;
    createdAt: string;
    updatedAt: string;
  }>;
}

export type BackupManifest = LegacyBackupManifest | KanbanBackupManifest;
